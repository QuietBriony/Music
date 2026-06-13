// check-sw-version-history.mjs — v359 (health-review G-3). Guards the shared
// `hazama-fm-vN` cache counter against the parallel-session collision class: two
// workstreams editing the same sw.js VERSION line tend to pick the same next integer.
// This catches a re-USED version number (the collision artifact) and confirms sw.js
// matches the latest changelog release. See docs/AUDIO-COST-INVARIANTS.md context /
// the ARCH-1 finding. Pairs with audit.py's sw==max(docs) check (this adds dup-detect).
import { readFileSync } from "node:fs";
import assert from "node:assert";

const sw = readFileSync("sw.js", "utf8");
const changelog = readFileSync("docs/BAND-ROOM-CHANGELOG.md", "utf8");

const swMatch = sw.match(/const VERSION = "hazama-fm-v(\d+)";/);
assert.ok(swMatch, "sw.js should expose a hazama-fm-vN VERSION");
const swN = Number(swMatch[1]);

const headers = [...changelog.matchAll(/^## v(\d+)\b/gm)].map((m) => Number(m[1]));
assert.ok(headers.length > 0, "BAND-ROOM-CHANGELOG.md should have ## vN entries");

// (1) No duplicate version headers — a re-used number is the symptom of a merge-time
//     version collision (two sessions both shipped vN).
const seen = new Set();
const dups = new Set();
for (const n of headers) { if (seen.has(n)) dups.add(n); seen.add(n); }
assert.ok(dups.size === 0, `changelog has duplicate version header(s): v${[...dups].join(", v")} — sign of a version collision on merge (renumber the loser)`);

// (2) sw.js VERSION must equal the highest changelog entry (the latest release), so a
//     stale/low VERSION can't ship under a newer changelog.
const maxN = Math.max(...headers);
assert.equal(swN, maxN, `sw.js VERSION (hazama-fm-v${swN}) must equal the latest changelog entry (v${maxN})`);

console.log(`sw-version history check passed (hazama-fm-v${swN}; ${headers.length} entries, no duplicates)`);
