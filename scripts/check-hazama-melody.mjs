import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("engine.js", "utf8");
const routingSource = readFileSync("audio/music-stack-routing.js", "utf8");
const html = readFileSync("fm.html", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cacheMarkerFor(text, assetPath, label) {
  const match = text.match(new RegExp(`${escapeRegex(assetPath)}\\?v=(fm-\\d+)`));
  assert.ok(match, `${label} should include ${assetPath}?v=fm-N`);
  return match[1];
}

function assertSameMarkers(label, markers) {
  const entries = Object.entries(markers);
  const [, expected] = entries[0];
  for (const [sourceName, marker] of entries) {
    assert.equal(marker, expected, `${label} cache marker should match in ${sourceName}`);
  }
}

function serviceWorkerVersion(text) {
  const match = text.match(/const VERSION = "([^"]+)"/);
  assert.ok(match, "Service worker should define VERSION");
  assert.match(match[1], /^hazama-fm-v\d+$/, "Service worker VERSION should be hazama-fm-vN");
  return match[1];
}

assert.match(source, /const MELODIC_DIRECTOR_KEYS = \[/, "Hazama FM should define phrase-level melodic keys");
assert.match(source, /const MELODIC_DIRECTOR_CONTOURS = \[/, "Hazama FM should define melodic call/answer contours");
assert.match(source, /function advanceMelodicDirectorPhrase\(/, "Hazama FM should advance a melodic director by phrase");
assert.match(source, /function melodicDirectorNote\(/, "Hazama FM should transpose melody notes through the director");
assert.match(source, /function melodicDirectorChord\(/, "Hazama FM should transpose pad chords through the director");
assert.match(source, /function tonalRhymeIndex\(step = stepIndex, offset = 0, span = 8\)/, "Tonal rhyme index should support pool-length spans");
assert.match(source, /tonalRhymeIndex\(step, offset, pool\.length\)/, "Tonal rhyme note should use the whole note pool");
assert.match(source, /tonalRhymeIndex\(stepIndex, GenomeState\.generation \+ phaseOffset \+ offset, pool\.length\)/, "Voice fragments should use the whole selected pool");
assert.match(source, /advanceMelodicDirectorPhrase\(\{ energyNorm, creationNorm, observerNorm, voidNorm \}\);[\s\S]*syncMelodicDirectorBassRoot\(\);/, "Groove structure should update melodic key and bass root at phrase boundaries");
assert.match(source, /melodicDirector: melodicDirectorRuntimeState\(\)/, "Runtime state should expose the melodic director for browser diagnostics");
assert.match(source, /const idx = \(MelodicDirectorState\.phrase \+ MelodicDirectorState\.chordTurn/, "Mode chords should be phrase-aware");
assert.match(source, /return melodicDirectorChord\(HAZE_CHORDS\[idx\], idx\)/, "Haze chords should be phrase-aware");
assert.match(source, /\["A3", "E4", "G4", "C#5"\]/, "Haze chord pool should include a gentle dominant-side color");
assert.match(source, /\["B2", "D3", "F#3", "A3"\]/, "Jazz chord pool should include an additional minor-color turn");
assert.match(source, /const BASSLINE_DIRECTOR_PATTERNS = \{/, "Hazama FM should define phrase-level bassline patterns");
assert.match(source, /function advanceBasslineDirectorPhrase\(/, "Bassline director should advance by phrase");
assert.match(source, /basslineDirector: basslineDirectorRuntimeState\(\)/, "Runtime state should expose the bassline director");
assert.match(source, /basslineDirectedPattern\(patternVariationForRole\("bass"\)\)/, "Main synth bass should use directed phrase gates");
assert.match(source, /function triggerSamplerBasslineBar\(/, "Sampled bass layers should share directed phrase movement");
assert.match(source, /triggerSamplerBasslineBar\(sampler, time,[\s\S]*register: "low"/, "Lofi bass should use directed low-register movement");
assert.match(source, /triggerSamplerBasslineBar\(sampler, time,[\s\S]*register: "sub"/, "Dub bass should use directed sub-register movement");
assert.match(source, /case "funk":[\s\S]*EngineParams\.bassPattern = "x\.\.x\.\.o\.x\.\.\.x\.o\."/, "Funk mode should have a directed 16-step bass pocket");
assert.match(source, /case "piano":[\s\S]*EngineParams\.bassPattern = "x\.\.\.\.\.\.\.o\.\.\.\.\.\.\."/, "Piano mode should keep a sparse directed 16-step bass gate");

assert.match(source, /function hazamaFmConversationPacketState\(/, "Hazama FM packet should expose groove conversation metadata");
assert.match(source, /conversation,\s*\n\s*integration_mode: "metadata-only"/, "Hazama FM conversation should stay metadata-only in the packet");

const swCacheVersion = serviceWorkerVersion(sw);
const routingMarkers = {
  fm: cacheMarkerFor(html, "audio/music-stack-routing.js", "FM page"),
  core: cacheMarkerFor(index, "audio/music-stack-routing.js", "Music Core"),
  sw: cacheMarkerFor(sw, "audio/music-stack-routing.js", "Service worker")
};
const engineMarkers = {
  fm: cacheMarkerFor(html, "engine.js", "FM page"),
  core: cacheMarkerFor(index, "engine.js", "Music Core"),
  sw: cacheMarkerFor(sw, "engine.js", "Service worker")
};
assertSameMarkers("Routing module", routingMarkers);
assertSameMarkers("Engine", engineMarkers);
assert.equal(routingMarkers.fm, engineMarkers.fm, "FM page should load routing and engine with the same fm cache marker");
assert.equal(routingMarkers.core, engineMarkers.core, "Music Core should load routing and engine with the same fm cache marker");
assert.equal(routingMarkers.sw, engineMarkers.sw, "Service worker should precache routing and engine with the same fm cache marker");

const routingSandbox = { window: {} };
vm.runInNewContext(routingSource, routingSandbox);
assert.equal(typeof routingSandbox.window.MusicStackRoutes.reviewCue, "function", "Routing module should expose Hazama FM review cue");
assert.equal(typeof routingSandbox.window.MusicStackRoutes.routingRecommendation, "function", "Routing module should expose route recommendation");
const routeRecommendation = routingSandbox.window.MusicStackRoutes.routingRecommendation({
  selfReview: { densityRisk: 0.2, lowEndRisk: 0.1, brightnessRisk: 0.1, restraintScore: 0.8, referenceFit: 0.7 },
  parts: { energy: 0.3, resource: 0.2, creation: 0.2, body: 0.2, voidness: 0.2, circle: 0.6, observer: 0.5 },
  gradient: { micro: 0.2, ghost: 0.1, haze: 0.4, memory: 0.5 },
  kits: { technoKit: 0.1, pressureKit: 0.1, spaceKit: 0.2, ambientKit: 0.5, idmKit: 0.1 },
  activePads: ["void"],
  producerHabitCuriosity: 0.2
});
assert.equal(routeRecommendation.schema, "music.stack-routing-review.v1", "Routing recommendation should keep its schema");
assert.equal(routeRecommendation.destination, "namima", "Routing recommendation should preserve void-pad namima routing");
assert.equal(routeRecommendation.metadata_only, true, "Routing recommendation should remain metadata-only");

console.log(`Hazama FM melody check passed (${swCacheVersion}, ${engineMarkers.fm})`);
