import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "config/autonomy-doc-currency.json";
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const manifest = JSON.parse(read(MANIFEST_PATH));

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${ROOT.replace(/\\/g, "/")}`, ...args],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    assert.fail(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function zeroList(value) {
  return value.split("\0").filter(Boolean);
}

function assertSortedUnique(values, label) {
  assert.ok(Array.isArray(values), `${label} must be an array`);
  const sorted = [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  assert.deepEqual(values, sorted, `${label} must be sorted and unique`);
}

function assertRepoPath(path, label, { prefix = false } = {}) {
  assert.equal(typeof path, "string", `${label} must be a string`);
  assert.ok(path.length > 0, `${label} must not be empty`);
  assert.equal(path.includes("\\"), false, `${label} must use / separators`);
  assert.equal(path.startsWith("/") || /^[A-Za-z]:\//.test(path), false, `${label} must be repo-relative`);
  assert.equal(path.split("/").includes(".."), false, `${label} must not contain ..`);
  if (prefix) assert.ok(path.endsWith("/"), `${label} prefix must end with /`);
}

function isSourcePath(path, document) {
  return document.watch_exact.includes(path) || document.watch_prefixes.some((prefix) => path.startsWith(prefix));
}

function isAncestor(older, newer) {
  const result = git(["merge-base", "--is-ancestor", older, newer], { allowFailure: true });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  assert.fail(`git merge-base failed: ${(result.stderr || result.stdout).trim()}`);
}

assert.equal(manifest.schema_version, 1, "autonomy currency schema_version must be 1");
assert.match(manifest.last_verified_commit, /^[0-9a-f]{40}$/, "last_verified_commit must be a lowercase 40-character SHA");
assert.match(manifest.verified_at, /^\d{4}-\d{2}-\d{2}$/, "verified_at must be YYYY-MM-DD");
assert.deepEqual(
  manifest.policy,
  {
    comparison: "tree_delta_plus_document_freshness",
    network: "forbidden",
    dirty_fact_requires_dirty_document: true,
    committed_fact_requires_descendant_document_commit: true
  },
  "autonomy currency policy drift"
);
assertSortedUnique(manifest.documents.map((item) => item.path), "documents");

const baselineObject = git(["cat-file", "-e", `${manifest.last_verified_commit}^{commit}`], { allowFailure: true });
assert.equal(baselineObject.status, 0, "last_verified_commit must resolve to a local commit object");
assert.equal(isAncestor(manifest.last_verified_commit, "HEAD"), true, "last_verified_commit must be an ancestor of HEAD");

const trackedFiles = new Set(zeroList(git(["ls-files", "-z"]).stdout));
const unstagedPaths = new Set(zeroList(git(["diff", "--name-only", "-z", "--no-renames"]).stdout));
const stagedPaths = new Set(zeroList(git(["diff", "--cached", "--name-only", "-z", "--no-renames"]).stdout));
const untrackedPaths = new Set(zeroList(git(["ls-files", "--others", "--exclude-standard", "-z"]).stdout));
const dirtyPaths = new Set([
  ...unstagedPaths,
  ...stagedPaths,
  ...untrackedPaths
]);

let committedSourceChanges = 0;
let stagedSourceChanges = 0;
let worktreeSourceChanges = 0;
const backlog = read("docs/autonomy/BACKLOG.md");

for (const [index, document] of manifest.documents.entries()) {
  const label = `documents[${index}]`;
  assertRepoPath(document.path, `${label}.path`);
  assert.ok(trackedFiles.has(document.path), `${document.path} must be tracked`);
  assert.equal(typeof document.purpose, "string", `${label}.purpose must be a string`);
  assert.ok(document.purpose.trim(), `${label}.purpose must not be empty`);
  assertSortedUnique(document.watch_exact, `${label}.watch_exact`);
  assertSortedUnique(document.watch_prefixes, `${label}.watch_prefixes`);
  assertSortedUnique(document.required_markers, `${label}.required_markers`);
  assertSortedUnique(document.forbidden_markers, `${label}.forbidden_markers`);

  for (const path of document.watch_exact) {
    assertRepoPath(path, `${label}.watch_exact`);
    assert.ok(trackedFiles.has(path), `${document.path} watches missing/untracked path ${path}`);
  }
  for (const prefix of document.watch_prefixes) {
    assertRepoPath(prefix, `${label}.watch_prefixes`, { prefix: true });
    assert.ok([...trackedFiles].some((path) => path.startsWith(prefix)), `${document.path} prefix has no tracked files: ${prefix}`);
  }

  const content = read(document.path);
  for (const marker of document.required_markers) {
    assert.ok(content.includes(marker), `${document.path} is missing current marker: ${marker}`);
    for (const backlogId of marker.match(/BL-\d{3}/g) || []) {
      assert.ok(backlog.includes(`### ${backlogId} `), `${document.path} references unknown backlog item ${backlogId}`);
    }
  }
  for (const marker of document.forbidden_markers) {
    assert.equal(content.includes(marker), false, `${document.path} retains stale live marker: ${marker}`);
  }

  const pathspecs = [...document.watch_exact, ...document.watch_prefixes];
  const committed = zeroList(
    git(["diff", "--name-only", "-z", "--no-renames", manifest.last_verified_commit, "HEAD", "--", ...pathspecs]).stdout
  ).filter((path) => isSourcePath(path, document));
  const staged = [...stagedPaths].filter((path) => isSourcePath(path, document)).sort();
  const worktree = [...new Set([...unstagedPaths, ...untrackedPaths])]
    .filter((path) => isSourcePath(path, document))
    .sort();
  const documentDirty = dirtyPaths.has(document.path);
  const documentStaged = stagedPaths.has(document.path);
  const documentWorktree = unstagedPaths.has(document.path) || untrackedPaths.has(document.path);

  committedSourceChanges += committed.length;
  stagedSourceChanges += staged.length;
  worktreeSourceChanges += worktree.length;

  if (staged.length > 0) {
    assert.ok(
      documentStaged,
      `${document.path} is stale in the index: staged factual sources require a staged doc update (${staged.join(", ")})`
    );
  }
  if (worktree.length > 0) {
    assert.ok(
      documentWorktree,
      `${document.path} is stale in the worktree: unstaged/untracked factual sources require an unstaged doc update (${worktree.join(", ")})`
    );
  }

  if (committed.length > 0) {
    const latestSourceCommit = git([
      "rev-list",
      "--topo-order",
      "--max-count=1",
      "HEAD",
      `^${manifest.last_verified_commit}`,
      "--",
      ...pathspecs
    ]).stdout.trim();
    assert.match(latestSourceCommit, /^[0-9a-f]{40}$/, `${document.path} latest factual commit is missing`);
    const latestDocumentCommit = git(["log", "-1", "--format=%H", "HEAD", "--", document.path]).stdout.trim();
    assert.match(latestDocumentCommit, /^[0-9a-f]{40}$/, `${document.path} latest document commit is missing`);
    assert.ok(
      documentDirty || isAncestor(latestSourceCommit, latestDocumentCommit),
      `${document.path} is stale: factual commit ${latestSourceCommit.slice(0, 7)} is newer than doc commit ${latestDocumentCommit.slice(0, 7)}`
    );
  }
}

const sw = read("sw.js");
const fmHtml = read("fm.html");
const bandRoomHtml = read("band-room.html");
const architecture = read("docs/HAZAMA-FM-ARCHITECTURE.md");
const handoff = read("docs/CODEX-HANDOFF.md");
const machineRegistry = JSON.parse(read("config/music-machines.json"));
const swVersion = sw.match(/const VERSION = "(hazama-fm-v\d+)";/)?.[1];
assert.ok(swVersion, "sw.js cache version is missing");

function versionedAsset(html, path) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escaped}\\?v=([^"\\s]+)`));
  assert.ok(match, `${path} version marker is missing`);
  return `${path}?v=${match[1]}`;
}

for (const marker of [
  swVersion,
  versionedAsset(fmHtml, "style.css"),
  versionedAsset(fmHtml, "fm.css"),
  versionedAsset(fmHtml, "engine.js"),
  versionedAsset(fmHtml, "audio/genre-flavor.js"),
  versionedAsset(fmHtml, "fm.js"),
  versionedAsset(bandRoomHtml, "band-room.js"),
  versionedAsset(bandRoomHtml, "band-room.css")
]) {
  assert.ok(architecture.includes(marker), `architecture must carry current runtime marker ${marker}`);
}

for (const surface of ["listen.html", "band-room.html", "lyric-lab.html", "fm.html", "index.html"]) {
  assert.ok(trackedFiles.has(surface), `public surface is missing: ${surface}`);
  assert.ok(architecture.includes(surface), `architecture must name public surface ${surface}`);
}
for (const manifestPath of ["manifest.webmanifest", "manifest-mixer.webmanifest", "manifest-band-room.webmanifest"]) {
  assert.ok(architecture.includes(manifestPath), `architecture must name ${manifestPath}`);
}
assert.ok(machineRegistry.machines["worker-gaming"], "worker-gaming machine is missing");
assert.ok(machineRegistry.machines["worker-gaming"].capabilities.includes("worker.gpu"), "worker-gaming must provide worker.gpu");
assert.ok(handoff.includes("worker-gaming") && handoff.includes("worker.gpu"), "handoff must use canonical GPU machine identity");

console.log(
  `Autonomy doc currency check passed (${manifest.documents.length} documents; baseline ` +
  `${manifest.last_verified_commit.slice(0, 7)}; ${committedSourceChanges} committed source changes; ` +
  `${stagedSourceChanges} staged source changes; ${worktreeSourceChanges} worktree source changes; ${swVersion})`
);
