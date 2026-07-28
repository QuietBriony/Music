import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const recipePath = "references/studiopc-sonar-ni-reference.json";
const recipe = JSON.parse(readFileSync(recipePath, "utf8"));
const pipeline = readFileSync("scripts/worker-gaming-pipeline.py", "utf8");
const wrapper = readFileSync("scripts/invoke-worker-sonar-ni.ps1", "utf8");
const parityRunbook = readFileSync("docs/MUSIC-PC-DAW-PARITY-RUNBOOK.md", "utf8");
const workerRunbook = readFileSync("docs/WORKER-GAMING-RUNBOOK.md", "utf8");

assert.equal(recipe.schema_version, 1);
assert.equal(recipe.id, "studiopc-sonar-ni-good-output-20260728");
assert.equal(recipe.daw.product_version, "2026.07");
assert.equal(recipe.daw.file_version, "32.07.0.021");
assert.equal(recipe.audio.sample_rate_hz, 48000);
assert.equal(recipe.audio.bit_depth, 24);
assert.equal(recipe.audio.channels, 2);
assert.equal(recipe.reference_audio.frequency_hz, 440);
assert.equal(recipe.reference_audio.duration_seconds, 2);
assert.match(recipe.source_observation.audible_certainty, /440 Hz reference tone/);

const instruments = new Map(recipe.instruments.map((item) => [item.id, item]));
assert.equal(instruments.get("scarbee-blue-ballad")?.plugin, "Kontakt 8");
assert.equal(instruments.get("scarbee-blue-ballad")?.preset, "Blue Ballad");
assert.equal(instruments.get("reaktor-polar-wind")?.plugin, "Reaktor 6");
assert.equal(instruments.get("reaktor-polar-wind")?.preset, "Polar Wind");
assert.equal(recipe.diagnostic_midi.tracks.length, 2);
assert.deepEqual(
  recipe.render.variants,
  [
    "A-reference-tone.wav",
    "B-scarbee-blue-ballad.wav",
    "C-reaktor-polar-wind.wav",
    "D-combined-reference.wav"
  ]
);

assert.match(pipeline, /def command_sonar_ni_reference\(/);
assert.match(pipeline, /add_parser\("sonar-ni-reference"/);
assert.match(wrapper, /git -C \$repoRoot pull --ff-only origin main/);
assert.match(wrapper, /"sonar-ni-reference"/);
assert.match(parityRunbook, /studiopc-sonar-ni-reference\.json/);
assert.match(workerRunbook, /invoke-worker-sonar-ni\.ps1/);
assert.match(workerRunbook, /A-reference-tone\.wav/);

console.log("DAW reference recipe check passed");
