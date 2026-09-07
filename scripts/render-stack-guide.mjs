// Repository-owned, build-time documentation only. No browser JS or dependencies.
// --write mechanically refreshes ONLY marked catalog blocks; --check is read-only.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BEGIN = "<!-- stack-tools:begin -->";
export const END = "<!-- stack-tools:end -->";
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mdText = (value) => String(value).replace(/[\\`*_[\]<>|]/g, (c) => `\\${c}`).replace(/\r?\n/g, " ");
const docHref = (href) => /^https:\/\//.test(href) ? href : `../${href}`;
const sourceHref = ({ repo, path }) => `https://github.com/QuietBriony/${repo}/blob/main/${path}`;

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

export function replaceBlock(text, block) {
  const source = text.replace(/\r\n/g, "\n");
  if (source.split(BEGIN).length !== 2 || source.split(END).length !== 2) throw new Error("Expected exactly one catalog marker pair");
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (end < start) throw new Error("Catalog markers out of order");
  return source.slice(0, start) + `${BEGIN}\n${block}\n${END}` + source.slice(end + END.length);
}

export function guideTargets(catalog) {
  return [
    { path: "listen.html", block: renderHtml(catalog) },
    { path: "docs/MUSIC-STACK-SYSTEM-MANUAL.md", block: renderMarkdown(catalog) }
  ];
}

function main() {
  const mode = process.argv[2];
  if (!["--write", "--check"].includes(mode) || process.argv.length !== 3) throw new Error("Usage: node scripts/render-stack-guide.mjs --check | --write");
  const catalog = JSON.parse(readFileSync(resolve(ROOT, "config/music-stack-tools.json"), "utf8"));
  for (const target of guideTargets(catalog)) {
    const path = resolve(ROOT, target.path);
    const current = readFileSync(path, "utf8");
    const expected = replaceBlock(current, target.block);
    if (mode === "--write") {
      if (current.replace(/\r\n/g, "\n") !== expected) writeFileSync(path, expected, "utf8");
    } else if (current.replace(/\r\n/g, "\n") !== expected) {
      throw new Error(`${target.path}: catalog drift; run node scripts/render-stack-guide.mjs --write`);
    }
  }
  console.log(`Stack guide ${mode === "--write" ? "rendered" : "in sync"}: ${catalog.tools.length} tools, 2 views`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
