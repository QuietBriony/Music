import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("engine.js", "utf8");
const html = readFileSync("fm.html", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

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

assert.match(html, /engine\.js\?v=fm-84/, "FM page should load the v170 engine marker");
assert.match(index, /engine\.js\?v=fm-84/, "Music Core should load the v170 engine marker");
assert.match(sw, /const VERSION = "hazama-fm-v171"/, "Service worker should use v171 cache");
assert.match(sw, /engine\.js\?v=fm-84/, "Service worker should precache the v170 engine marker");

console.log("Hazama FM melody check passed");
