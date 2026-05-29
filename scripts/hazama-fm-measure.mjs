// scripts/hazama-fm-measure.mjs
// =============================================================
// Hazama FM measurement harness — Phase 1 (static design analyzer)
//
// Band Room has a measurement loop (scripts/analyze-band-stems.py +
// compare-capture.py) that grounds AI 再現 tuning in measured numbers
// instead of qualitative ear feedback. Hazama FM had no equivalent —
// its tuning relied on the user saying "乗れない / 退屈" then guess-fix.
//
// This is the Hazama FM analog, Phase 1: a STATIC design analyzer.
// It does NOT capture audio. It reads the *design* artifacts that
// determine Hazama FM's per-pill groove —
//   - presets/drum-frames-{funk,jazz,lofi,techno}.json (frame BPM /
//     swing / per-event microMs + velocity)
//   - audio/genre-flavor.js GOVERNOR_BY_PILL (rdj wrongness + D Angelo
//     behind-beat wash amounts)
// — computes a measured profile per pill, and diffs it against the
// reference targets distilled from references/apple-music-refs.json +
// references/hazama-fm-pill-refs.json.
//
// Output:
//   1. console: per-pill measured profile + drift report
//   2. docs/hazama-fm-design-spec.json: machine-readable measured profile
//      (overwrite each run; like Band Room's target-spec-bands.json)
//
// Usage (from Music repo root, or any Music worktree):
//   node scripts/hazama-fm-measure.mjs
//   node scripts/hazama-fm-measure.mjs --json   # only write JSON, terse console
//
// This is an ANALYSIS tool, not a pass/fail gate. Drift is informative,
// not necessarily "bad" — design choices may intentionally diverge from a
// reference. It is intentionally NOT named check-*.mjs so stack-check.mjs
// does not auto-run it as a gate.
//
// Phase 2 (future): live capture + actual-output compare. Hazama FM
// playback recorded via Claude Code preview MCP (see
// docs/HAZAMA-FM-MEASUREMENT.md §4), analyzed for real timing/spectral,
// diffed against this design spec. Phase 2 needs the preview MCP audio
// path; Phase 1 stands alone and grounds the design first.
// =============================================================

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SELF_DIR, "..");
const JSON_ONLY = process.argv.includes("--json");

// ----------------------------------------------------------------
// Reference targets, distilled from references/*.json prose into the
// numeric ranges the analyzer can diff against. Each target cites its
// source so the number is reviewable. When the prose is qualitative
// (no number), the field is null and only reported, not diffed.
//
// Sources:
//   references/apple-music-refs.json  (production_translation prose)
//   references/hazama-fm-pill-refs.json (sub_styles, axis hints)
// ----------------------------------------------------------------
const TARGET_SPEC = {
  lofi: {
    source: "apple-music-refs Nujabes 'Aruarian Dance' (85-95 BPM, swing 14-18%, snare 12-18ms behind); 'Feather' (~92 BPM); pill-refs lofi-jazz-hop / lofi-drunken-pocket",
    bpm: [85, 95],
    swing: [0.14, 0.18],
    snare_behind_ms: [12, 18],
    kick_behind_ms: [0, 10],
    behind_beat_note: "jazz-hop integrated. Dilla drunken-pocket sub-style allows stronger (up to ~25ms).",
  },
  jazz: {
    source: "apple-music-refs Art Blakey 'Moanin' (drum-led hard bop) + Miles 'So What' (132 BPM modal, swing 16-22%); pill-refs jazz-brush ~90 BPM",
    bpm: [88, 135],
    swing: [0.16, 0.22],
    snare_behind_ms: [4, 12],
    kick_behind_ms: [3, 8],
    behind_beat_note: "drum-led hard-bop OR modal-sparse — wide BPM range by sub-style.",
  },
  funk: {
    source: "apple-music-refs Funkadelic 'Maggot Brain' (live full band pocket) + D Angelo governor (GOVERNOR_BY_PILL.funk.dangelo); Stevie 'Higher Ground' (95-100 BPM tight rubber)",
    bpm: [88, 105],
    swing: [0.0, 0.08],
    snare_behind_ms: [2, 18],
    kick_behind_ms: [0, 6],
    behind_beat_note: "behind-beat pocket strong (governor dangelo wash on top of frame microMs).",
  },
  techno: {
    source: "apple-music-refs Derrick May 'Strings of Life' (4-on-floor); pill-refs techno-detroit-emotional; four-on-floor.json tight +/-2ms",
    bpm: [120, 135],
    swing: [0.0, 0.03],
    snare_behind_ms: [0, 4],
    kick_behind_ms: [0, 3],
    behind_beat_note: "tight grid, minimal swing. IDM-wash sub-style adds micro-shift via governor rdj.",
  },
};

const PILLS = Object.keys(TARGET_SPEC);

// Pills without a drum-frames JSON: their groove comes from genre-flavor.js
// builders directly (pad envelope / release / velocity / rubato), not from
// a drum-frames file. Phase 1 (drum-frame static analysis) does not measure
// them. Acknowledged here so the report is honest about coverage — a future
// Phase 1.5 could parse the builder envelopes (buildAmbientDefault /
// buildPianoDefault) to extract release / density / velocity profiles.
const NON_DRUM_PILLS = {
  any: "engine 9-program drift, no fixed pill groove (intentional)",
  ambient: "groove from buildAmbient* (pad envelope / long release), no drum-frames",
  piano: "groove from buildPiano* (rubato / long-rest / pianoMemory), no drum-frames",
};

// ----------------------------------------------------------------
// Read GOVERNOR_BY_PILL from genre-flavor.js (rdj + dangelo per pill).
// Regex-extract the object literal; no JS execution.
// ----------------------------------------------------------------
function readGovernors() {
  const path = join(ROOT, "audio/genre-flavor.js");
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8");
  const start = text.indexOf("GOVERNOR_BY_PILL");
  if (start < 0) return {};
  const block = text.slice(start, text.indexOf("};", start) + 1);
  const governors = {};
  // match e.g.  lofi:    { rdj: 0.030, dangelo: 0.10 },
  const re = /(\w+):\s*\{\s*rdj:\s*([\d.]+),\s*dangelo:\s*([\d.]+)\s*\}/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    governors[m[1]] = { rdj: parseFloat(m[2]), dangelo: parseFloat(m[3]) };
  }
  return governors;
}

// ----------------------------------------------------------------
// Measure a drum-frames JSON: per-instrument timing/velocity stats,
// BPM/swing across frames, density.
// ----------------------------------------------------------------
function measureFrames(genre) {
  const path = join(ROOT, `presets/drum-frames-${genre}.json`);
  if (!existsSync(path)) return { missing: true };
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { error: String(e) };
  }
  const frames = Array.isArray(data.frames) ? data.frames : [];
  if (frames.length === 0) return { error: "no frames" };

  const bpms = frames.map((f) => f.bpm).filter((b) => typeof b === "number");
  const swings = frames.map((f) => f.swing).filter((s) => typeof s === "number");

  // Per-instrument microMs + velocity aggregation across all frames.
  const byInst = {}; // inst -> { microMs: [], vel: [] }
  let totalEvents = 0;
  for (const f of frames) {
    const events = Array.isArray(f.events) ? f.events : [];
    totalEvents += events.length;
    for (const ev of events) {
      const inst = ev.instrument || "?";
      if (!byInst[inst]) byInst[inst] = { microMs: [], vel: [] };
      if (typeof ev.microMs === "number") byInst[inst].microMs.push(ev.microMs);
      if (typeof ev.velocity === "number") byInst[inst].vel.push(ev.velocity);
    }
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const min = (arr) => (arr.length ? Math.min(...arr) : null);
  const max = (arr) => (arr.length ? Math.max(...arr) : null);
  const round = (v, d = 1) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

  const instStats = {};
  for (const [inst, s] of Object.entries(byInst)) {
    instStats[inst] = {
      count: s.microMs.length || s.vel.length,
      micro_ms_avg: round(avg(s.microMs)),
      micro_ms_range: [min(s.microMs), max(s.microMs)],
      vel_avg: round(avg(s.vel), 2),
    };
  }

  return {
    frame_count: frames.length,
    bpm_avg: round(avg(bpms)),
    bpm_range: [min(bpms), max(bpms)],
    swing_avg: round(avg(swings), 3),
    swing_range: [min(swings), max(swings)],
    events_per_bar_avg: round(totalEvents / frames.length),
    instruments: instStats,
  };
}

// ----------------------------------------------------------------
// Diff measured vs target. Returns array of drift findings.
// ----------------------------------------------------------------
function diff(genre, measured, governor) {
  const target = TARGET_SPEC[genre];
  const findings = [];
  if (!target || measured.missing || measured.error) return findings;

  const inRange = (v, [lo, hi]) => v !== null && v >= lo && v <= hi;
  const dir = (v, [lo, hi]) => (v < lo ? "LOW" : v > hi ? "HIGH" : "ok");

  // BPM
  if (target.bpm && measured.bpm_avg !== null) {
    if (!inRange(measured.bpm_avg, target.bpm)) {
      findings.push({
        axis: "bpm",
        measured: measured.bpm_avg,
        target: target.bpm,
        direction: dir(measured.bpm_avg, target.bpm),
      });
    }
  }
  // Swing
  if (target.swing && measured.swing_avg !== null) {
    if (!inRange(measured.swing_avg, target.swing)) {
      findings.push({
        axis: "swing",
        measured: measured.swing_avg,
        target: target.swing,
        direction: dir(measured.swing_avg, target.swing),
      });
    }
  }
  // Snare behind-beat (frame microMs + governor dangelo wash, qualitatively).
  // The governor dangelo adds an extra behind-beat wash; we report the
  // frame microMs against target, and note the governor amount separately.
  const snare = measured.instruments?.snare;
  if (target.snare_behind_ms && snare && snare.micro_ms_avg !== null) {
    if (!inRange(snare.micro_ms_avg, target.snare_behind_ms)) {
      findings.push({
        axis: "snare_behind_ms",
        measured: snare.micro_ms_avg,
        target: target.snare_behind_ms,
        direction: dir(snare.micro_ms_avg, target.snare_behind_ms),
        note: governor ? `+ governor dangelo wash ${governor.dangelo}` : undefined,
      });
    }
  }
  // Kick behind-beat
  const kick = measured.instruments?.kick;
  if (target.kick_behind_ms && kick && kick.micro_ms_avg !== null) {
    if (!inRange(kick.micro_ms_avg, target.kick_behind_ms)) {
      findings.push({
        axis: "kick_behind_ms",
        measured: kick.micro_ms_avg,
        target: target.kick_behind_ms,
        direction: dir(kick.micro_ms_avg, target.kick_behind_ms),
      });
    }
  }
  return findings;
}

// ----------------------------------------------------------------
// Run
// ----------------------------------------------------------------
const governors = readGovernors();
const spec = { generated_by: "scripts/hazama-fm-measure.mjs", phase: 1, pills: {} };
const allFindings = {};

for (const genre of PILLS) {
  const measured = measureFrames(genre);
  const governor = governors[genre] || null;
  const findings = diff(genre, measured, governor);
  spec.pills[genre] = {
    target_source: TARGET_SPEC[genre].source,
    target: TARGET_SPEC[genre],
    measured,
    governor,
    drift: findings,
  };
  allFindings[genre] = findings;
}

// Record the non-drum pills so the spec covers all 7 pills, even though
// Phase 1 does not measure their groove.
for (const [pill, reason] of Object.entries(NON_DRUM_PILLS)) {
  spec.pills[pill] = { not_measured_phase1: true, reason };
}

// Write machine-readable spec.
const specPath = join(ROOT, "docs/hazama-fm-design-spec.json");
writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n", "utf8");

if (JSON_ONLY) {
  const totalDrift = Object.values(allFindings).reduce((n, f) => n + f.length, 0);
  console.log(`hazama-fm-measure: wrote ${specPath} (${totalDrift} drift findings)`);
  process.exit(0);
}

// Console report.
const pad = (s, n) => String(s ?? "").padEnd(n);
console.log("\nHazama FM — design measurement (Phase 1, static)");
console.log("=".repeat(72));
console.log("Reads drum-frames-*.json + genre-flavor.js GOVERNOR_BY_PILL,");
console.log("diffs against references/ targets. Drift is informative, not a gate.\n");

for (const genre of PILLS) {
  const p = spec.pills[genre];
  const m = p.measured;
  console.log(`[${genre.toUpperCase()}]`);
  if (m.missing) {
    console.log(`  (no drum-frames-${genre}.json — skipped)\n`);
    continue;
  }
  if (m.error) {
    console.log(`  (error: ${m.error})\n`);
    continue;
  }
  console.log(`  frames=${m.frame_count}  bpm=${m.bpm_avg} ${JSON.stringify(m.bpm_range)}  swing=${m.swing_avg} ${JSON.stringify(m.swing_range)}  events/bar=${m.events_per_bar_avg}`);
  const g = p.governor;
  console.log(`  governor: ${g ? `rdj=${g.rdj} dangelo=${g.dangelo}` : "(not found in genre-flavor.js)"}`);
  for (const inst of ["kick", "snare", "hat", "ghost"]) {
    const s = m.instruments[inst];
    if (s) console.log(`    ${pad(inst, 6)} microMs avg=${pad(s.micro_ms_avg, 5)} range=${pad(JSON.stringify(s.micro_ms_range), 11)} vel=${s.vel_avg}`);
  }
  if (p.drift.length === 0) {
    console.log(`  drift: none (within reference targets)`);
  } else {
    console.log(`  drift vs reference (${TARGET_SPEC[genre].source.split(";")[0]}…):`);
    for (const f of p.drift) {
      const note = f.note ? `  [${f.note}]` : "";
      console.log(`    ${pad(f.axis, 16)} measured=${pad(f.measured, 7)} target=${pad(JSON.stringify(f.target), 14)} ${f.direction}${note}`);
    }
  }
  console.log();
}

console.log("[non-drum pills — not measured in Phase 1]");
for (const [pill, reason] of Object.entries(NON_DRUM_PILLS)) {
  console.log(`  ${pad(pill, 8)} ${reason}`);
}
console.log();

const totalDrift = Object.values(allFindings).reduce((n, f) => n + f.length, 0);
console.log("=".repeat(72));
console.log(`${totalDrift} drift finding(s) across ${PILLS.length} drum-frame pills (+ ${Object.keys(NON_DRUM_PILLS).length} non-drum pills noted). Wrote docs/hazama-fm-design-spec.json`);
console.log("Drift = design diverges from reference target. Review whether intentional;");
console.log("if a tuning is wanted, it is engine.js / genre-flavor.js work + 試聴 human-gate.");
process.exit(0);
