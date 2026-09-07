import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml, guideTargets, renderHtml, replaceBlock } from "./render-stack-guide.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const repos = ["Music", "chill", "drum-floor", "namima", "openclaw"];
const catalog = JSON.parse(read("config/music-stack-tools.json"));
const html = read("listen.html");
const manual = read("docs/MUSIC-STACK-SYSTEM-MANUAL.md");
const slug = /^[a-z][a-z0-9-]*$/;

function safePath(path) {
  assert.equal(typeof path, "string");
  assert.match(path, /^[A-Za-z0-9_./-]+$/);
  assert.ok(!path.startsWith("/") && !path.split("/").some((part) => ["", ".", ".."].includes(part)), `Unsafe source path: ${path}`);
}

function safeHref(href) {
  assert.equal(typeof href, "string");
  assert.doesNotMatch(href, /[\s<>"'\\]/);
  if (href.startsWith("https://")) {
    const url = new URL(href);
    assert.ok(["quietbriony.github.io", "github.com"].includes(url.hostname), `Unexpected public destination: ${href}`);
    assert.ok(!url.username && !url.password && !url.port);
  } else {
    safePath(href.split(/[?#]/)[0]);
  }
}

function validate(data) {
  assert.equal(data.schema_version, 1);
  assert.match(data.reviewed_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(`${data.reviewed_at}T00:00:00Z`).toISOString().slice(0, 10), data.reviewed_at);
  assert.equal(typeof data.evidence_scope, "string");
  assert.deepEqual(Object.keys(data.source_revisions).sort(), [...repos].sort());
  for (const revision of Object.values(data.source_revisions)) assert.match(revision, /^[a-f0-9]{7,40}$/);
  assert.deepEqual(Object.keys(data.statuses).sort(), ["candidate", "implemented", "manual", "planned"]);
  assert.ok(data.groups.length > 0 && data.tools.length > 0);
  const groups = new Set();
  for (const group of data.groups) {
    assert.match(group.id, slug);
    assert.ok(!groups.has(group.id));
    assert.ok(typeof group.title === "string" && group.title.trim());
    groups.add(group.id);
  }
  const ids = new Set();
  for (const tool of data.tools) {
    assert.match(tool.id, slug);
    assert.ok(!ids.has(tool.id), `Duplicate tool: ${tool.id}`);
    ids.add(tool.id);
    assert.ok(repos.includes(tool.repo), `Private / unknown owner must not enter public catalog: ${tool.repo}`);
    assert.ok(groups.has(tool.group));
    assert.ok(Object.hasOwn(data.statuses, tool.status));
    for (const field of ["title", "purpose", "first_step", "outputs", "boundary", "action"]) {
      assert.ok(typeof tool[field] === "string" && tool[field].trim(), `${tool.id}.${field} is required`);
    }
    safeHref(tool.href);
    assert.ok(Array.isArray(tool.sources) && tool.sources.length > 0, `${tool.id} needs source evidence`);
    for (const source of tool.sources) {
      assert.ok(repos.includes(source.repo));
      safePath(source.path);
    }
  }
  for (const id of groups) assert.ok(data.tools.some((tool) => tool.group === id), `Empty group ${id}`);
}

validate(catalog);
let checkedSources = 0;
const absentSiblings = new Set();
for (const tool of catalog.tools) {
  for (const source of tool.sources) {
    const base = source.repo === "Music" ? ROOT : resolve(ROOT, "..", source.repo);
    if (!existsSync(base)) { absentSiblings.add(source.repo); continue; }
    const path = resolve(base, source.path);
    assert.ok(existsSync(path) && statSync(path).isFile(), `${tool.id} evidence missing: ${source.repo}/${source.path}`);
    checkedSources++;
  }
  const githubDoc = tool.href.startsWith("https://github.com/QuietBriony/Music/blob/main/")
    ? tool.href.slice("https://github.com/QuietBriony/Music/blob/main/".length) : null;
  if (!tool.href.startsWith("https://") || githubDoc) {
    const [path, fragment] = (githubDoc || tool.href).split("#");
    const localPath = path.split("?")[0];
    assert.ok(existsSync(resolve(ROOT, localPath)), `Missing entry ${tool.href}`);
    if (fragment) assert.ok(read(localPath).includes(`id="${fragment}"`), `Missing named anchor ${tool.href}`);
  }
}

for (const target of guideTargets(catalog)) {
  const actual = read(target.path).replace(/\r\n/g, "\n");
  assert.equal(actual, replaceBlock(actual, target.block), `${target.path}: generated catalog is stale; run render-stack-guide.mjs --write`);
}

// Navigation, no runtime activation, and key limitations survive future editing.
for (const id of ["start-here", "production-flow", "tool-map", "first-session", "current-pass"]) assert.ok(html.includes(`id="${id}"`));
for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${match[1]}"`), `Missing section link #${match[1]}`);
for (const path of ["MUSIC-STACK-SYSTEM-MANUAL.md", "VISUAL-COMPOSER-PLAN.md"]) {
  assert.ok(html.includes(`href="https://github.com/QuietBriony/Music/blob/main/docs/${path}"`), "New guide links must use the readable Markdown view");
  assert.ok(!html.includes(`href="docs/${path}"`), "Do not send phone users to raw Markdown");
}
for (const tool of catalog.tools) assert.ok(html.includes(`data-tool-entry="${tool.id}" href="${escapeHtml(tool.href)}"`));
assert.doesNotMatch(html, /<(?:script|audio|video|iframe)\b|\son[a-z]+\s*=/i);
assert.equal((html.match(/<details\b/g) || []).length, (html.match(/<\/details>/g) || []).length, "Details disclosures must close");
assert.match(manual, /先頭1小節/);
assert.match(manual, /別PCやiPhoneへは自動で共有されません/);
assert.match(manual, /公開担当[\s\S]*未監査/);
assert.match(manual, /private `music-ops`/);
assert.equal(catalog.tools.find((tool) => tool.id === "visual-composer")?.status, "planned");
assert.equal(catalog.tools.find((tool) => tool.id === "offline-render")?.status, "candidate");
assert.match(read("docs/VISUAL-COMPOSER-PLAN.md"), /未実装/);
assert.match(read("sw.js"), /"docs\/MUSIC-STACK-SYSTEM-MANUAL.md"/);
assert.match(read("sw.js"), /"config\/music-stack-tools.json"/);
assert.match(read("README.md"), /MUSIC-STACK-SYSTEM-MANUAL.md/);

// Negative fixtures: malformed catalogs and unsafe source paths must fail closed.
for (const mutate of [
  (data) => data.tools.push({ ...data.tools[0] }),
  (data) => { data.tools[0].status = "verified_on_device"; },
  (data) => { data.tools[0].repo = "music-ops"; },
  (data) => { data.tools[0].sources = []; },
  (data) => { data.tools[0].sources[0].path = "../../private.json"; },
  (data) => { data.tools[0].href = "javascript:alert(1)"; },
  (data) => { data.tools[0].href = "https://example.com/unknown"; },
  (data) => { data.tools[0].boundary = ""; },
  (data) => { data.reviewed_at = "2026-02-31"; }
]) {
  const fixture = structuredClone(catalog);
  mutate(fixture);
  assert.throws(() => validate(fixture));
}
const escaped = structuredClone(catalog);
escaped.tools[0].title = '<script>alert("x")</script>';
assert.doesNotMatch(renderHtml(escaped), /<script>/);
assert.throws(() => replaceBlock("no markers", "anything"));
assert.throws(() => replaceBlock("<!-- stack-tools:end --><!-- stack-tools:begin -->", "anything"));

console.log(`Music Stack guide passed: ${catalog.tools.length} tools, ${checkedSources} evidence paths, 2 generated views, negative fixtures`);
if (absentSiblings.size) console.log(`Source files not checked (public clone without siblings): ${[...absentSiblings].join(", ")}`);
