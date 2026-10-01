// Repository-owned, build-time documentation only. No browser JS or dependencies.
// --write mechanically refreshes ONLY marked catalog blocks; --check is read-only.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BEGIN = "<!-- stack-tools:begin -->";
export const END = "<!-- stack-tools:end -->";
export const PUBLIC_BEGIN = "<!-- public-pages:begin -->";
export const PUBLIC_END = "<!-- public-pages:end -->";
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mdText = (value) => String(value).replace(/[\\`*_[\]<>|]/g, (c) => `\\${c}`).replace(/\r?\n/g, " ");
const docHref = (href) => /^https:\/\//.test(href) ? href : `../${href}`;
const sourceHref = ({ repo, path }) => `https://github.com/QuietBriony/${repo}/blob/main/${path}`;

export function renderPublicHtml(catalog) {
  const navigation = catalog.public_navigation;
  return `<div class="bookmark-panel">
  <strong>いつも戻るのは、このページ。</strong>
  <a href="${escapeHtml(navigation.bookmark)}">${escapeHtml(navigation.bookmark.replace("https://", ""))}</a>
  <p>ここをブックマークすれば、作品も道具も同じ入口から辿れます。</p>
</div>
${navigation.groups.map((group) => `<div class="public-box" data-public-box="${escapeHtml(group.id)}">
  <h3>${escapeHtml(group.title)}</h3>
  <p class="guide-note">${escapeHtml(group.note)}</p>
  <div class="public-grid">
${group.tool_ids.map((id) => {
  const tool = catalog.tools.find((item) => item.id === id);
  return `    <a class="public-entry" data-public-entry="${escapeHtml(id)}" href="${escapeHtml(tool.href)}"><strong>${escapeHtml(tool.title)} <span aria-hidden="true">→</span></strong><span>${escapeHtml(tool.public_summary)}</span></a>`;
}).join("\n")}
  </div>
</div>`).join("\n")}
<nav class="index-links" aria-label="公開ページの続き"><a class="mini-link" href="#recorded-works">録音・公開デモを聴く →</a><a class="mini-link" href="#sound-experiments">音の実験 →</a><a class="mini-link" href="#visual-release">映像・公開 →</a><a class="mini-link" href="#tool-map">詳しい機能と使い方 →</a></nav>
<details class="tool-group"><summary>別の入口・過去のアプリ <span>普段は上のURLへ</span></summary><div class="collection-links"><p>MusicのGitHub Pages版も同じ道具の別入口です。作品棚の端末間同期を使う時は、いつものMusicへ戻ってください。</p><a class="mini-link" href="${escapeHtml(navigation.mirror)}">Musicの別入口 →</a><p>test／namima-labは回収済みのアイデアと履歴を保管しています。残したエッセンスは、今の道具と試奏へつないでいます。</p><a class="mini-link" href="https://github.com/QuietBriony/Music/blob/main/docs/archive-repo-harvest-audit.md">アーカイブの記録 →</a></div></details>`;
}

export function renderPublicMarkdown(catalog) {
  const navigation = catalog.public_navigation;
  return `普段のブックマークは [Music Stack Listen](${navigation.bookmark})。公開先を増やさず、既存のページと道具をここから辿ります。

${navigation.groups.map((group) => `### ${mdText(group.title)}

${mdText(group.note)}

| 公開ページ | 用途 |
|---|---|
${group.tool_ids.map((id) => {
  const tool = catalog.tools.find((item) => item.id === id);
  return `| [${mdText(tool.title)}](${docHref(tool.href)}) | ${mdText(tool.public_summary)} |`;
}).join("\n")}`).join("\n\n")}

[MusicのGitHub Pages版](${navigation.mirror})は同じ道具の別入口。Lyric Labの端末間同期は既存Cloudflare/D1の認証が必要です。
録音・実験・映像はListenの既存sectionへ。test／namima-labは履歴保管で、演奏アプリの一覧には含めません。`;
}

export function renderHtml(catalog) {
  const groups = catalog.groups.map((group) => {
    const tools = catalog.tools.filter((tool) => tool.group === group.id);
    return `<details class="tool-group" data-tool-group="${escapeHtml(group.id)}">
  <summary>${escapeHtml(group.title)} <span>${tools.length}項目</span></summary>
  <div class="tool-grid">
${tools.map((tool) => `    <article class="tool-item" id="tool-${escapeHtml(tool.id)}" data-tool-status="${escapeHtml(tool.status)}">
      <p class="tool-status">${escapeHtml(tool.repo)} · ${escapeHtml(catalog.statuses[tool.status])}</p>
      <h3>${escapeHtml(tool.title)}</h3>
      <p>${escapeHtml(tool.purpose)}</p>
      <dl>
        <dt>最初の一手</dt><dd>${escapeHtml(tool.first_step)}</dd>
        <dt>残るもの</dt><dd>${escapeHtml(tool.outputs)}</dd>
        <dt>できることの境界</dt><dd>${escapeHtml(tool.boundary)}</dd>
      </dl>
      <a class="mini-link" data-tool-entry="${escapeHtml(tool.id)}" href="${escapeHtml(tool.href)}">${escapeHtml(tool.title)} — ${escapeHtml(tool.action)}</a>
    </article>`).join("\n")}
  </div>
</details>`;
  }).join("\n");
  return `<p class="guide-note">ソース照合：${escapeHtml(catalog.reviewed_at)}。実装確認と、実音・実機の合格は別です。</p>\n${groups}`;
}

export function renderMarkdown(catalog) {
  return catalog.groups.map((group) => `### ${mdText(group.title)}

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
${catalog.tools.filter((tool) => tool.group === group.id).map((tool) => `| [${mdText(tool.title)}](${docHref(tool.href)}) | ${mdText(tool.purpose)}<br>${mdText(tool.first_step)} | ${mdText(tool.outputs)}<br>${mdText(tool.boundary)} | ${mdText(catalog.statuses[tool.status])}<br>${tool.sources.map((source) => `[${mdText(`${source.repo}/${source.path}`)}](${sourceHref(source)})`).join(" / ")} |`).join("\n")}`).join("\n\n");
}

export function replaceBlock(text, block, begin = BEGIN, finish = END) {
  const source = text.replace(/\r\n/g, "\n");
  if (source.split(begin).length !== 2 || source.split(finish).length !== 2) throw new Error("Expected exactly one catalog marker pair");
  const start = source.indexOf(begin);
  const end = source.indexOf(finish);
  if (end < start) throw new Error("Catalog markers out of order");
  return source.slice(0, start) + `${begin}\n${block}\n${finish}` + source.slice(end + finish.length);
}

export function guideTargets(catalog) {
  return [
    { path: "listen.html", block: renderHtml(catalog) },
    { path: "docs/MUSIC-STACK-SYSTEM-MANUAL.md", block: renderMarkdown(catalog) },
    { path: "listen.html", block: renderPublicHtml(catalog), begin: PUBLIC_BEGIN, end: PUBLIC_END },
    { path: "docs/MUSIC-STACK-SYSTEM-MANUAL.md", block: renderPublicMarkdown(catalog), begin: PUBLIC_BEGIN, end: PUBLIC_END }
  ];
}

function main() {
  const mode = process.argv[2];
  if (!["--write", "--check"].includes(mode) || process.argv.length !== 3) throw new Error("Usage: node scripts/render-stack-guide.mjs --check | --write");
  const catalog = JSON.parse(readFileSync(resolve(ROOT, "config/music-stack-tools.json"), "utf8"));
  for (const target of guideTargets(catalog)) {
    const path = resolve(ROOT, target.path);
    const current = readFileSync(path, "utf8");
    const expected = replaceBlock(current, target.block, target.begin, target.end);
    if (mode === "--write") {
      if (current.replace(/\r\n/g, "\n") !== expected) writeFileSync(path, expected, "utf8");
    } else if (current.replace(/\r\n/g, "\n") !== expected) {
      throw new Error(`${target.path}: catalog drift; run node scripts/render-stack-guide.mjs --write`);
    }
  }
  console.log(`Stack guide ${mode === "--write" ? "rendered" : "in sync"}: ${catalog.tools.length} tools, 2 views`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
