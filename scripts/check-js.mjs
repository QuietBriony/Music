import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const files = [
  "engine.js",
  "fm.js",
  "band-room.js",
  "sw.js",
  "audio/audio-safety.js",
  "audio/genre-flavor.js",
  "audio/ai-fills.js",
  "audio/namima-audio-adapter.js",
  "audio/human-groove-governor.js",
  "presets/loader.js",
  "scripts/check-js.mjs",
  "scripts/check-band-room-logic.mjs",
  "scripts/check-fm-route-badge.mjs"
];

let bad = 0;

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`BAD missing JS file: ${file}`);
    bad += 1;
    continue;
  }
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) bad += 1;
}

if (bad) {
  console.error(`JS syntax check failed: ${bad} file(s)`);
  process.exit(1);
}

console.log(`JS syntax check passed: ${files.length} file(s)`);
