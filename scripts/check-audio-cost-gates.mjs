// check-audio-cost-gates.mjs — v359 guardrail (regression guard for the v352–v358
// audio-thread-overload fixes). Flags always-on HEAVY audio nodes (convolution
// Reverb / oversample 2x|4x) that are NOT behind a device/light-runtime gate — the
// exact class that choked 原音 on phones. See docs/AUDIO-COST-INVARIANTS.md.
//
// Rollout: WARN-ONLY first release (exit 0 always) so it can never false-FAIL a
// parallel/cheap-model build while we confirm calibration. Flip BAND_ROOM_FAIL=true
// once band-room sits at 0 warnings (it does today) to make band-room regressions a
// hard FAIL. FM files (engine/fm/genre-flavor) are tagged [FM→handoff] and never FAIL
// here — that territory is owned by the FM workstream (tracked in CODEX-HANDOFF BL-028).
import { readFileSync } from "node:fs";

// Heavy = the proven overload primitives (v352 root cause). Chorus/LFO/AutoPanner are
// far cheaper and intentionally used (e.g. v358 vocal chorus), so they are out of scope.
const HEAVY = /new Tone\.(?:Reverb|Convolver|Freeverb|JCReverb)\b|oversample:\s*"(?:2x|4x)"/;
const DEVICE = /aiLightRuntimeEnabled|isMobileOrStandaloneRuntime|lightRuntime|mobileAiDiet|\bisMobile\b|\blight\b/;
const MODE = /currentMode|isBandAiPlaybackMode/;
const ALLOW = /\/\/\s*audio-cost-ok:\s*\S/; // trailing "// audio-cost-ok: <reason>" suppresses (reason required)
const WINDOW = 6; // lines of context to search for a device gate

const TARGETS = [
  { file: "band-room.js", tier: "band-room" },
  { file: "engine.js", tier: "FM" },
  { file: "fm.js", tier: "FM" },
  { file: "audio/genre-flavor.js", tier: "FM" },
];

// Flip to true once band-room burns down to 0 (next release) to enforce as FAIL.
const BAND_ROOM_FAIL = false;

let bandRoomViolations = 0;
const warnings = [];
for (const { file, tier } of TARGETS) {
  let src;
  try { src = readFileSync(file, "utf8"); } catch { continue; }
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!HEAVY.test(line)) continue;
    if (ALLOW.test(line)) continue;
    const ctx = lines.slice(Math.max(0, i - WINDOW), Math.min(lines.length, i + WINDOW + 1)).join("\n");
    if (DEVICE.test(ctx)) continue; // device/light-runtime gated → OK
    const modeOnly = MODE.test(ctx);
    const tag = tier === "FM" ? "[FM→handoff]" : "[band-room]";
    warnings.push(`${tag} ${file}:${i + 1}  ${modeOnly ? "gated on MODE not DEVICE" : "ungated always-on heavy node"}\n      ${line.trim().slice(0, 110)}`);
    if (tier === "band-room") bandRoomViolations++;
  }
}

if (warnings.length) {
  console.log("audio-cost guardrail — heavy always-on node without a device gate (v352–v358 regression class):");
  for (const w of warnings) console.log("  WARN " + w);
  console.log(`\n(${warnings.length} warning(s); band-room=${bandRoomViolations}. FM items are owned by the FM workstream → CODEX-HANDOFF BL-028. Allowlist a true exception with a trailing "// audio-cost-ok: <reason>".)`);
} else {
  console.log("audio-cost guardrail passed: no ungated always-on heavy nodes");
}

if (BAND_ROOM_FAIL && bandRoomViolations > 0) {
  console.error(`\naudio-cost guardrail FAILED: ${bandRoomViolations} ungated always-on heavy node(s) in band-room.js (device-gate them or allowlist with a reason)`);
  process.exit(1);
}
process.exit(0);
