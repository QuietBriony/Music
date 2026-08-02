import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = "presets/tabasco-songs.json";
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const catalogText = read(CATALOG_PATH);
const catalog = JSON.parse(catalogText);
const bands = JSON.parse(read("presets/bands.json"));
const sw = read("sw.js");

function git(args) {
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${ROOT.replace(/\\/g, "/")}`, ...args],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    assert.fail(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

function exactKeys(value, expected, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} key set drift`);
}

function presentString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim(), `${label} must not be empty`);
}

function positiveFinite(value, label) {
  assert.equal(typeof value, "number", `${label} must be a number`);
  assert.ok(Number.isFinite(value) && value > 0, `${label} must be positive and finite`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function repoPath(path, label) {
  assert.equal(typeof path, "string", `${label} must be a string`);
  assert.ok(path.length > 0, `${label} must not be empty`);
  assert.equal(path.includes("\\"), false, `${label} must use / separators`);
  assert.equal(path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path), false, `${label} must be repo-relative`);
  assert.equal(path.split("/").includes(".."), false, `${label} must not contain ..`);
  const target = resolve(ROOT, path);
  assert.ok(target === ROOT || target.startsWith(`${ROOT}${sep}`), `${label} escapes the repository`);
}

function visitStrings(value, label = "catalog") {
  if (typeof value === "string") {
    assert.doesNotMatch(value, /\b(?:TBD|todo)\b/i, `${label} contains a legacy placeholder`);
    assert.doesNotMatch(value, /[A-Za-z]:[\\/]|^\\\\|\/(?:Users|home|Volumes)\/|^file:|^~[\\/]/i, `${label} contains a machine-local path`);
    assert.equal(value.includes("\\"), false, `${label} contains a backslash path separator`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitStrings(item, `${label}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => visitStrings(item, `${label}.${key}`));
  }
}

const trackedFiles = new Set(git(["ls-files", "-z"]).split("\0").filter(Boolean));
const assertTrackedFile = (path, label) => {
  repoPath(path, label);
  assert.ok(trackedFiles.has(path), `${label} must be tracked with exact path casing: ${path}`);
  assert.ok(existsSync(resolve(ROOT, path)), `${label} does not exist: ${path}`);
};

assertTrackedFile(CATALOG_PATH, "catalog path");
visitStrings(catalog);
exactKeys(
  catalog,
  ["format", "version", "role", "runtime_consumed", "derived_from", "delivery", "policy", "summary", "songs"],
  "catalog"
);
assert.equal(catalog.format, "tabasco-songs", "catalog format drift");
assert.equal(catalog.version, 2, "catalog version must be 2");
assert.equal(catalog.role, "derived_inventory", "catalog must remain a derived inventory");
assert.equal(catalog.runtime_consumed, false, "derived inventory must not become a runtime input");

exactKeys(catalog.derived_from, ["band_registry", "band_id", "drum_frames_pattern", "lyrics_doc"], "derived_from");
assert.equal(catalog.derived_from.band_registry, "presets/bands.json", "band registry authority drift");
assert.equal(catalog.derived_from.band_id, "tabasco", "band id drift");
assertTrackedFile(catalog.derived_from.band_registry, "derived_from.band_registry");

const band = bands.bands?.[catalog.derived_from.band_id];
assert.ok(band, "Tabasco band registry entry is missing");
assert.equal(catalog.derived_from.drum_frames_pattern, band.drum_frames_pattern, "drum-frame pattern authority drift");
assert.equal(catalog.derived_from.lyrics_doc, band.lyrics_doc, "lyrics authority drift");
repoPath(catalog.derived_from.drum_frames_pattern.replace("{songid}", "path-probe"), "derived_from.drum_frames_pattern");
assertTrackedFile(catalog.derived_from.lyrics_doc, "derived_from.lyrics_doc");

assert.deepEqual(catalog.delivery, { service_worker: "not_precached" }, "derived inventory delivery policy drift");
assert.deepEqual(
  catalog.policy,
  {
    metadata_only: true,
    stores_audio: false,
    stores_lyrics_inline: false,
    repo_relative_paths_only: true,
    bpm_key_verification: "human_unverified",
    asset_provenance: "pending_bl_035_owner_contract"
  },
  "catalog policy drift"
);

assert.ok(Array.isArray(band.songs), "Tabasco registry songs must be an array");
assert.equal(band.songs.length, 7, "Tabasco runtime registry must contain exactly 7 songs");
assert.ok(Array.isArray(catalog.songs), "catalog songs must be an array");
assert.equal(catalog.songs.length, 7, "catalog must contain exactly 7 songs");
assert.deepEqual(
  catalog.songs.map((song) => song.id),
  band.songs.map((song) => song.id),
  "catalog song IDs or order drifted from the runtime registry"
);
assert.deepEqual(catalog.songs.map((song) => song.track), ["01", "02", "03", "04", "05", "06", "07"], "track order must be 01-07");
assert.equal(new Set(catalog.songs.map((song) => song.id)).size, 7, "catalog song IDs must be unique");
assert.equal(new Set(catalog.songs.map((song) => song.track)).size, 7, "catalog tracks must be unique");

const lyricDocument = read(band.lyrics_doc).replace(/<!--[\s\S]*?-->/g, "");
const lyricLines = lyricDocument.split(/\r?\n/);
const lyricHeadingIndexes = lyricLines
  .map((line, index) => (/^## \d{2} /.test(line) ? index : -1))
  .filter((index) => index >= 0);
const lyricHeadings = lyricHeadingIndexes.map((index) => lyricLines[index]);
assert.equal(lyricHeadings.length, 7, "final lyrics must have exactly 7 numbered H2 headings");

let shippedFrames = 0;
const frameBpms = [];
for (const [index, song] of catalog.songs.entries()) {
  const label = `songs[${index}]`;
  const registrySong = band.songs[index];
  exactKeys(song, ["id", "track", "title", "duration_s", "bpm", "key", "lyrics", "drum_frames"], label);
  for (const field of ["id", "track", "title"]) {
    presentString(song[field], `${label}.${field}`);
    presentString(registrySong[field], `${label}.registry.${field}`);
  }
  positiveFinite(song.duration_s, `${label}.duration_s`);
  positiveFinite(registrySong.duration_s, `${label}.registry.duration_s`);
  positiveFinite(registrySong.bpm, `${label}.registry.bpm`);
  presentString(registrySong.key, `${label}.registry.key`);
  assert.deepEqual(
    { id: song.id, track: song.track, title: song.title, duration_s: song.duration_s },
    { id: registrySong.id, track: registrySong.track, title: registrySong.title, duration_s: registrySong.duration_s },
    `${label} runtime registry metadata drift`
  );

  exactKeys(song.bpm, ["runtime_value", "verification"], `${label}.bpm`);
  exactKeys(song.key, ["runtime_value", "verification"], `${label}.key`);
  positiveFinite(song.bpm.runtime_value, `${label}.bpm.runtime_value`);
  presentString(song.key.runtime_value, `${label}.key.runtime_value`);
  assert.equal(song.bpm.verification, "human_unverified", `${label}.bpm must remain human_unverified`);
  assert.equal(song.key.verification, "human_unverified", `${label}.key must remain human_unverified`);

  exactKeys(song.lyrics, ["path", "heading", "status"], `${label}.lyrics`);
  assert.equal(song.lyrics.path, band.lyrics_doc, `${label}.lyrics path drift`);
  assert.equal(song.lyrics.status, "final_singable", `${label}.lyrics status drift`);
  assert.equal(song.lyrics.heading, lyricHeadings[index], `${label}.lyrics heading drift`);
  assert.equal(lyricHeadings.filter((heading) => heading === song.lyrics.heading).length, 1, `${label}.lyrics heading must be unique`);
  const expectedHeading = new RegExp(`^## ${escapeRegExp(song.track)} ${escapeRegExp(song.title)}(?:\\s+-|\\s*$)`);
  assert.match(song.lyrics.heading, expectedHeading, `${label}.lyrics heading must match registry track and title`);
  assert.equal(lyricHeadings.filter((heading) => expectedHeading.test(heading)).length, 1, `${label}.lyrics track/title heading must occur exactly once`);
  const bodyStart = lyricHeadingIndexes[index] + 1;
  const bodyEnd = lyricHeadingIndexes[index + 1] ?? lyricLines.length;
  const lyricBodyLines = lyricLines
    .slice(bodyStart, bodyEnd)
    .filter((line) => line.trim() && !/^(?:#{1,6}\s|---$|```)/.test(line.trim()));
  assert.ok(lyricBodyLines.length > 0, `${label}.lyrics final section must contain non-empty body text`);

  exactKeys(
    song.drum_frames,
    ["path", "status", "format", "version", "total_bars", "structure_sections", "frame_variants"],
    `${label}.drum_frames`
  );
  const expectedFramePath = band.drum_frames_pattern.replace("{songid}", song.id);
  assert.equal(song.drum_frames.path, expectedFramePath, `${label}.drum_frames path drift`);
  assert.equal(song.drum_frames.status, "shipped", `${label}.drum_frames status drift`);
  assertTrackedFile(song.drum_frames.path, `${label}.drum_frames.path`);

  const frame = JSON.parse(read(song.drum_frames.path));
  assert.equal(frame.format, "song-track", `${label} frame format drift`);
  assert.equal(frame.version, 1, `${label} frame version drift`);
  assert.equal(frame.song_id, `tabasco-${song.id}`, `${label} frame song_id drift`);
  assert.equal(frame.song_title, registrySong.title, `${label} frame title drift`);
  positiveFinite(frame.bpm, `${label} frame BPM`);
  presentString(frame.key, `${label} frame key`);
  assert.equal(frame.bpm, registrySong.bpm, `${label} frame/registry BPM parity drift`);
  assert.equal(frame.key, registrySong.key, `${label} frame/registry key parity drift`);
  assert.equal(song.bpm.runtime_value, frame.bpm, `${label}.bpm frame authority drift`);
  assert.equal(song.key.runtime_value, frame.key, `${label}.key frame authority drift`);
  positiveFinite(frame.estimated_duration_s, `${label} frame duration`);
  assert.ok(Math.abs(frame.estimated_duration_s - registrySong.duration_s) <= 1.5, `${label} frame duration differs by more than 1.5 seconds`);
  assert.ok(Array.isArray(frame.structure) && frame.structure.length > 0, `${label} frame structure must be non-empty`);
  assert.ok(Array.isArray(frame.frames) && frame.frames.length > 0, `${label} frame variants must be non-empty`);
  assert.equal(frame.total_bars, frame.structure.reduce((sum, section) => sum + section.bars, 0), `${label} frame total_bars drift`);
  for (const [frameIndex, frameVariant] of frame.frames.entries()) {
    assert.equal(typeof frameVariant.id, "string", `${label} frames[${frameIndex}].id must be a string`);
    assert.ok(frameVariant.id.trim(), `${label} frames[${frameIndex}].id must not be empty`);
  }
  const frameIds = new Set(frame.frames.map((item) => item.id));
  assert.equal(frameIds.size, frame.frames.length, `${label} frame IDs must be unique`);
  for (const section of frame.structure) {
    assert.equal(typeof section.frame_id, "string", `${label} structure frame_id must be a string`);
    assert.ok(section.frame_id.trim(), `${label} structure frame_id must not be empty`);
    assert.ok(Number.isSafeInteger(section.bars) && section.bars > 0, `${label} structure bars must be a positive integer`);
    assert.ok(frameIds.has(section.frame_id), `${label} structure references missing frame ${section.frame_id}`);
  }
  assert.equal(frame.events_extracted_from, `presets/tabasco-stems/${song.id}/drums.mp3`, `${label} extracted-event source drift`);
  assertTrackedFile(frame.events_extracted_from, `${label}.events_extracted_from`);
  assert.equal(song.drum_frames.format, frame.format, `${label} inventory frame format drift`);
  assert.equal(song.drum_frames.version, frame.version, `${label} inventory frame version drift`);
  assert.equal(song.drum_frames.total_bars, frame.total_bars, `${label} inventory total_bars drift`);
  assert.equal(song.drum_frames.structure_sections, frame.structure.length, `${label} inventory structure count drift`);
  assert.equal(song.drum_frames.frame_variants, frame.frames.length, `${label} inventory frame count drift`);
  frameBpms.push(frame.bpm);
  shippedFrames += 1;
}

exactKeys(
  catalog.summary,
  ["track_count", "total_duration_s", "bpm_min", "bpm_max", "final_lyrics_count", "shipped_drum_frames_count", "human_verified_bpm_count", "human_verified_key_count"],
  "summary"
);
assert.deepEqual(
  catalog.summary,
  {
    track_count: band.songs.length,
    total_duration_s: band.songs.reduce((sum, song) => sum + song.duration_s, 0),
    bpm_min: Math.min(...frameBpms),
    bpm_max: Math.max(...frameBpms),
    final_lyrics_count: lyricHeadings.length,
    shipped_drum_frames_count: shippedFrames,
    human_verified_bpm_count: 0,
    human_verified_key_count: 0
  },
  "catalog summary drift"
);

const runtimePaths = [...trackedFiles].filter((path) => {
  if (!/\.(?:html|js)$/.test(path)) return false;
  if (!path.includes("/")) return true;
  return path.startsWith("audio/") || path.startsWith("functions/") || path.startsWith("presets/");
});
assert.ok(runtimePaths.includes("band-room.js") && runtimePaths.includes("sw.js"), "runtime surface discovery is incomplete");
for (const runtimePath of runtimePaths) {
  assert.doesNotMatch(read(runtimePath), /tabasco-songs\.json/, `${runtimePath} must not consume the derived inventory`);
}
const precacheBlock = sw.match(/const PRECACHE_URLS = \[(.*?)\];/s);
assert.ok(precacheBlock, "Service Worker PRECACHE_URLS block is missing");
const precacheMentions = precacheBlock[1].match(/"presets\/tabasco-songs\.json"/g) || [];
assert.equal(precacheMentions.length, 0, "not-precached derived inventory must stay out of Service Worker precache");

console.log(
  `Tabasco songs catalog check passed (v2; ${catalog.songs.length}/7 registry songs; ` +
  `${lyricHeadings.length} final lyrics; ${shippedFrames} shipped frames; SW not precached)`
);
