import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync("listen.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const feedback = readFileSync("docs/listening-feedback-backlog.md", "utf8");
const stories = readFileSync("docs/qa/feature-stories.csv", "utf8");

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? match[1].replaceAll("&amp;", "&") : "";
}

function textContent(fragment) {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionById(id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<section\\b[^>]*\\bid="${escaped}"[^>]*>[\\s\\S]*?<\\/section>`, "i"));
  assert.ok(match, `listen.html should expose #${id}`);
  return match[0];
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  assert.equal(quoted, false, "Feature-story CSV rows should close every quoted field");
  fields.push(field);
  return fields;
}

const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({
  attrs: match[1],
  href: attr(match[1], "href"),
  name: textContent(match[2])
}));

assert.ok(links.length > 0, "Listen hub should expose navigation links");
for (const link of links) {
  assert.ok(link.href, "Every Listen anchor should have a non-empty href");
  assert.ok(link.name, `Every Listen anchor should have an accessible text name (${link.href || "missing href"})`);
  assert.doesNotMatch(link.href, /^javascript:/i, `Listen href must not execute JavaScript: ${link.href}`);
  if (attr(link.attrs, "target") === "_blank") {
    assert.match(attr(link.attrs, "rel"), /(?:^|\s)noopener(?:\s|$)/, `External target should use rel=noopener: ${link.href}`);
  }
  if (!/^(?:https?:|mailto:|tel:|#)/i.test(link.href)) {
    const localPath = link.href.split(/[?#]/, 1)[0];
    assert.ok(localPath && existsSync(resolve(localPath)), `Local Listen target should exist: ${link.href}`);
  }
}

const hrefs = new Set(links.map((link) => link.href));
for (const required of [
  "fm.html",
  "index.html",
  "band-room.html?band=hazama",
  "band-room.html?band=hazama&song=still-moving&mode=stems",
  "band-room.html?band=hazama&song=still-moving&mode=synth",
  "band-room.html?band=hazama&song=still-moving-hard&mode=stems",
  "band-room.html?band=hazama&song=still-moving-hard&mode=synth",
  "band-room.html?band=hazama&song=still-moving&mode=synth&aiLight=1",
  "lyric-lab.html",
  "https://quietbriony.github.io/drum-floor/",
  "https://quietbriony.github.io/chill/session.html",
  "https://quietbriony.github.io/namima/",
  "https://quietbriony.github.io/openclaw/"
]) {
  assert.ok(hrefs.has(required), `Listen hub should expose ${required}`);
}

const hazamaNames = links.filter((link) => link.href.includes("band=hazama")).map((link) => link.name).join(" ");
const lyricLabNames = links.filter((link) => link.href === "lyric-lab.html").map((link) => link.name).join(" ");
assert.match(hazamaNames, /HAZAMA/i, "HAZAMA links should name their destination");
assert.match(lyricLabNames, /Lyric Lab/i, "Lyric Lab links should name their destination");

assert.equal((html.match(/<main\b/gi) || []).length, 1, "Listen should have one main landmark");
assert.equal((html.match(/<\/main>/gi) || []).length, 1, "Listen should close its main landmark once");
assert.equal((html.match(/<h1\b/gi) || []).length, 1, "Listen should have one h1");
assert.match(html, /<html\b[^>]*\blang="ja"/i, "Listen should declare Japanese document language");
assert.doesNotMatch(html, /<script\b/i, "Listen should remain a static no-script hub");
assert.doesNotMatch(html, /\son[a-z]+\s*=/i, "Listen should not add inline event handlers");
assert.doesNotMatch(html, /outline\s*:\s*(?:none|0(?:\s|;|$))/i, "Listen should not globally suppress focus outlines");

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "Listen element ids should be unique");
for (const match of html.matchAll(/<section\b([^>]*)>/gi)) {
  const labelledBy = attr(match[1], "aria-labelledby");
  assert.ok(labelledBy, "Every Listen section should have aria-labelledby");
  assert.ok(ids.includes(labelledBy), `Section label target should exist: #${labelledBy}`);
}
for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
  assert.match(match[1], /\balt="[^"]*"/i, "Every Listen image should expose alt text, including decorative empty alt");
}

const currentPass = sectionById("current-pass");
for (const marker of [/HAZAMA/, /v398/, /v399/, /v400/, /15[–-]30秒/, /6分/, /phone-light/, /01 原音/, /01 AI 再現/, /02 原音/, /02 AI 再現（暫定）/, /02固有AIではありません/, /約33 MiB/, /01 frames共有/, /START/, /KARAOKE/, /画面ロック/, /Tabasco/, /feedback pad/, /lyric-lab\.html/]) {
  assert.match(currentPass, marker, `Current pass should include ${marker}`);
}
assert.doesNotMatch(currentPass, /v299|v301/, "v299/v301 should not remain in the current pass");

const historicalCards = [...html.matchAll(/<a\b[^>]*data-pass-status="historical"[^>]*>[\s\S]*?<\/a>/gi)].map((match) => match[0]).join("\n");
assert.match(historicalCards, /v299/, "Historical cards should retain the v299 evidence");
assert.match(historicalCards, /v301/, "Historical cards should retain the v301 evidence");
assert.doesNotMatch(historicalCards, /<b>Current pass:<\/b>/, "Historical cards must not claim to be current");

const feedbackCurrentStart = feedback.indexOf("### 2026-08-11 HAZAMA v397-v400 01/02 current pass");
const feedbackHistoricalStart = feedback.indexOf("### Historical:");
assert.ok(feedbackCurrentStart >= 0 && feedbackHistoricalStart > feedbackCurrentStart, "Listening backlog should separate current HAZAMA from historical notes");
const feedbackCurrent = feedback.slice(feedbackCurrentStart, feedbackHistoricalStart);
assert.match(feedbackCurrent, /v397[\s\S]*v398[\s\S]*v399[\s\S]*v400/, "Listening backlog current note should cover the original lanes, safe START, and audition clarity");
assert.match(feedbackCurrent, /four short cases[\s\S]*six-minute/i, "Listening backlog should separate the four-case quick pass and long arc");
assert.match(feedbackCurrent, /02[\s\S]*01 frames[\s\S]*original/i, "Listening backlog should preserve the provisional 02 AI boundary");
assert.match(feedbackCurrent, /BL-041/, "Listening backlog should keep the audible decision behind BL-041");
assert.doesNotMatch(feedbackCurrent, /v299|v301/, "Historical v299/v301 notes should stay outside the current backlog section");

const ls01 = stories.match(/^LS-01,.*$/m);
const ls03 = stories.match(/^LS-03,.*$/m);
const storyRows = stories.trim().split(/\r?\n/).map(parseCsvLine);
const storyWidth = storyRows[0].length;
assert.equal(storyWidth, 12, "Feature-story CSV should keep its 12-column schema");
for (const [index, row] of storyRows.entries()) {
  assert.equal(row.length, storyWidth, `Feature-story CSV row ${index + 1} should keep ${storyWidth} columns`);
}
assert.ok(ls01, "Feature stories should retain LS-01");
assert.ok(ls03, "Feature stories should add LS-03");
assert.equal((stories.match(/^LS-01,/gm) || []).length, 1, "LS-01 should be unique");
assert.equal((stories.match(/^LS-03,/gm) || []).length, 1, "LS-03 should be unique");
assert.match(ls01[0], /band-room\.html\?band=hazama[\s\S]*lyric-lab\.html/, "LS-01 should include HAZAMA and Lyric Lab navigation");
assert.match(ls03[0], /v397-v400[\s\S]*4ケース[\s\S]*BL-041/, "LS-03 should cover the current four-case QA while preserving BL-041");

for (const route of [
  /song=still-moving&amp;mode=stems&amp;mix=karaoke/,
  /song=still-moving-hard&amp;mode=stems&amp;mix=karaoke/
]) {
  assert.match(currentPass, route, "Listen should expose both session-only HAZAMA KARAOKE routes");
}

assert.match(sw, /"listen\.html"/, "Listen should remain in the Service Worker precache");

console.log(`Listen hub check passed (${links.length} links; ${new Set(links.map((link) => link.href)).size} unique targets)`);
