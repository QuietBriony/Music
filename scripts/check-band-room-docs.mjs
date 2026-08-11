import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const DOCS = [
  "README.md",
  "docs/BAND-ROOM-MANUAL.md",
  "docs/BAND-ROOM-USAGE.md"
];

const read = (path) => readFileSync(path, "utf8");
const readme = read(DOCS[0]);
const manual = read(DOCS[1]);
const usage = read(DOCS[2]);
const sw = read("sw.js");
const bandRoomHtml = read("band-room.html");
const changelog = read("docs/BAND-ROOM-CHANGELOG.md");
const repoRoot = resolve(".");

function mustMatch(text, pattern, label) {
  const match = text.match(pattern);
  assert.ok(match, label);
  return match[1] || match[0];
}

function assertLocalMarkdownLinks(path, text) {
  const absoluteDoc = resolve(path);
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim());
  let localLinks = 0;
  for (const target of links) {
    if (/^(?:https?:|mailto:|tel:|#)/i.test(target)) continue;
    const withoutTitle = target.replace(/^<|>$/g, "").split(/\s+[\"']/)[0];
    const localPath = withoutTitle.split(/[?#]/, 1)[0];
    if (!localPath) continue;
    const decodedPath = decodeURIComponent(localPath);
    const resolvedTarget = resolve(dirname(absoluteDoc), decodedPath);
    assert.ok(
      resolvedTarget === repoRoot || resolvedTarget.startsWith(`${repoRoot}${sep}`),
      `${path} local link must stay inside the repository: ${target}`
    );
    assert.ok(
      existsSync(resolvedTarget),
      `${path} should link to an existing local target: ${target}`
    );
    localLinks++;
  }
  return { total: links.length, local: localLinks };
}

const checkedLinks = { total: 0, local: 0 };
for (const path of DOCS) {
  const count = assertLocalMarkdownLinks(path, read(path));
  checkedLinks.total += count.total;
  checkedLinks.local += count.local;
}

for (const target of [
  "https://quietbriony.github.io/Music/listen.html",
  "https://quietbriony.github.io/Music/band-room.html?band=hazama",
  "https://quietbriony.github.io/Music/band-room.html",
  "https://quietbriony.github.io/Music/lyric-lab.html",
  "https://quietbriony.github.io/Music/fm.html",
  "https://quietbriony.github.io/Music/"
]) {
  assert.ok(readme.includes(`](${target})`), `README should expose the public app entry ${target}`);
}
assert.match(readme, /docs\/BAND-ROOM-MANUAL\.md/, "README should link to the Band Room Manual");
assert.match(readme, /docs\/BAND-ROOM-USAGE\.md/, "README should link to Band Room Usage");

const bandJsMarker = mustMatch(
  bandRoomHtml,
  /band-room\.js\?v=([^"\s]+)/,
  "Band Room HTML should expose its current JS marker"
);
const bandCssMarker = mustMatch(
  bandRoomHtml,
  /band-room\.css\?v=([^"\s]+)/,
  "Band Room HTML should expose its current CSS marker"
);
const swVersion = mustMatch(sw, /const VERSION = "(hazama-fm-v\d+)";/, "SW should expose a cache version");
const runtimeVersion = mustMatch(
  changelog,
  /Latest Band Room runtime change: (v\d+)/,
  "Changelog should expose the latest Band Room runtime version"
);

for (const [name, text] of [["Manual", manual], ["Usage", usage]]) {
  assert.ok(text.includes(runtimeVersion), `${name} should identify current Band Room runtime ${runtimeVersion}`);
  assert.ok(text.includes(bandJsMarker), `${name} should identify current Band Room JS marker ${bandJsMarker}`);
  assert.ok(text.includes(bandCssMarker), `${name} should identify current Band Room CSS marker ${bandCssMarker}`);
  assert.match(text, /HAZAMA/, `${name} should name HAZAMA`);
  assert.match(text, /📻 原音/, `${name} should expose HAZAMA's original reference lane`);
  assert.match(text, /🎛 AI 再現/, `${name} should expose HAZAMA's AI comparison lane`);
  assert.match(text, /01[\s\S]{0,120}02|01\s*\/\s*02/, `${name} should cover both HAZAMA songs`);
  assert.match(text, /02[\s\S]{0,100}01 frames[\s\S]{0,100}暫定|02[\s\S]{0,100}暫定[\s\S]{0,100}01 frames/, `${name} should explain the provisional HAZAMA 02 AI source`);
  assert.match(text, /KARAOKE/, `${name} should expose the original-stem vocal-off lane`);
  assert.match(text, /session(?:-only|限定)/, `${name} should explain that KARAOKE vocal-off does not become a global preference`);
  assert.match(text, /原音[^\n]{0,40}(?:既定|自動選択)/, `${name} should explain the original-reference default`);
  assert.match(text, /WARMING UP/, `${name} should name the initial START busy state`);
  assert.match(text, /PREPARING AI/, `${name} should name the AI preparation busy state`);
  assert.match(text, /RESET AUDIO/, `${name} should expose the actionable START recovery control`);
  assert.match(text, /Lyric Lab/, `${name} should include the Lyric Lab handoff`);
  assert.match(text, /BL-041[^\n]*human gate/, `${name} should keep HAZAMA promotion behind BL-041`);
  assert.doesNotMatch(
    text,
    /(?:実音|音質|desktop|mobile|スマホ|車載|Bluetooth).{0,12}(?:確認|試聴|検証|合格|完了)済|(?:確認|試聴|検証|合格|完了)済.{0,12}(?:実音|音質|desktop|mobile|スマホ|車載|Bluetooth)|公開昇格済/,
    `${name} must not claim unperformed human QA`
  );
}

for (const marker of [
  /\.\.\/listen\.html/,
  /\.\.\/band-room\.html\?band=hazama/,
  /band \/ song \/ mode/,
  /playingへ進まず/,
  /REC \/ stems packも無音のまま開始しない/,
  /BL-003 human gate/,
  /model実行、weight download/
]) {
  assert.match(manual, marker, `Manual shortest flow should include ${marker}`);
}
assert.ok(manual.includes(swVersion), `Manual should distinguish its current docs cache ${swVersion}`);
assert.match(usage, /正本は[\s\S]{0,160}BAND-ROOM-MANUAL\.md/, "Usage should point recovery details to the Manual source of truth");
assert.match(usage, /手動で整理/, "Usage should describe Lyric Lab as a manual metadata handoff");
assert.match(usage, /model実行やdownloadが始まることはない/, "Usage should not imply that opening Lyric Lab executes a model");

const staleCurrentClaims = /v168 時点|現在地 \(v168|画面構成[^\n]*v168|v65-v79|v65-v172|v65\s*→\s*v172|WiFi 必須|何回かボタン押し直す|5 つの典型用途/;
assert.doesNotMatch(`${manual}\n${usage}`, staleCurrentClaims, "Band Room guides should not retain known-stale current-version claims");

assert.match(sw, /"docs\/BAND-ROOM-MANUAL\.md"/, "SW should precache the Band Room Manual");
assert.match(sw, /"docs\/BAND-ROOM-USAGE\.md"/, "SW should precache Band Room Usage");
assert.equal(
  mustMatch(changelog, /Current sw\.js VERSION: (v\d+)/, "Changelog should expose the current SW version"),
  swVersion.replace("hazama-fm-", ""),
  "Changelog and SW cache versions should agree"
);

console.log(`Band Room docs check passed (${checkedLinks.total} Markdown links scanned; ${checkedLinks.local} local targets verified; ${runtimeVersion}; ${swVersion})`);
