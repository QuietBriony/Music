import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const band = readFileSync("band-room.js", "utf8");
const flavor = readFileSync("audio/genre-flavor.js", "utf8");
function functionSource(source, name) {
  const match = source.match(new RegExp(`  function ${name}\\([^]*?\\n  }`));
  assert.ok(match, `${name} must exist`);
  return match[0];
}

// Native one-shots retain scheduled timing and clean up both on natural end
// and STOP, including notes reserved later in the current bar.
const sources = [];
const gains = [];
const raw = {
  currentTime: 10,
  createGain() {
    const gain = { gain: {}, disconnect() { this.disconnected = true; } };
    gains.push(gain);
    return gain;
  },
  createBufferSource() {
    const source = {
      playbackRate: {}, connect() {},
      start(time) { this.startTime = time; },
      stop() { this.stopped = true; },
      disconnect() { this.disconnected = true; }
    };
    sources.push(source);
    return source;
  }
};
const sb = {
  Tone: { getContext: () => ({ rawContext: raw }), connect() {} },
  clamp: (value, lo, hi) => Math.min(hi, Math.max(lo, value))
};
vm.runInNewContext(`const activeDrumHits = new Set();
${functionSource(band, "playDrumHit")}
${functionSource(band, "stopDrumHits")}
this.play = playDrumHit; this.stop = stopDrumHits;
this.count = () => activeDrumHits.size;`, sb);
const buffer = { duration: 0.4 };
sb.play({ get: () => buffer }, {}, 11.25, 0.8, 1.001);
assert.equal(sources[0].buffer, buffer);
assert.equal(sources[0].startTime, 11.25, "Lookahead must not move future hits");
assert.equal(gains[0].gain.value, 0.8);
assert.equal(sources[0].playbackRate.value, 1.001);
sources[0].onended();
assert.equal(sb.count(), 0);
assert.equal(gains[0].disconnected, true);
sb.play(buffer, {}, 9, 0.7);
assert.equal(sources[1].startTime, 10.003, "Late hits use the immediate audio clock");
sb.play(buffer, {}, 14, 0.4);
sb.stop();
assert.equal(sb.count(), 0);
assert.ok(sources.slice(1).every(s => s.stopped && s.disconnected));
assert.ok(gains.every(g => g.disconnected));
sb.stop();
assert.match(functionSource(band, "stopPlayback"), /stopSynthBand\(\)/);

// Every GenreFlavor room goes through the same tier, even the piano recipe
// and secondary color fields that previously bypassed the phone gate.
const reverbSites = flavor.match(/new Tone\.Reverb\(/g) || [];
assert.equal(reverbSites.length, 1, "Only the device-gated room factory may construct convolution");
let light = true;
const roomSandbox = {
  lightRuntimeEnabled: () => light,
  Tone: {
    FeedbackDelay: class { constructor(options) { this.options = options; this.kind = "delay"; } },
    Reverb: class { constructor(options) { this.options = options; this.kind = "reverb"; } }
  }
};
vm.runInNewContext(`${functionSource(flavor, "makeRuntimeRoom")}\nthis.make = makeRuntimeRoom;`, roomSandbox);
assert.equal(roomSandbox.make({ decay: 7, wet: 0.42 }).kind, "delay");
assert.ok(roomSandbox.make({ decay: 7, wet: 0.42 }).options.wet <= 0.24);
light = false;
assert.equal(roomSandbox.make({ decay: 7, wet: 0.42 }).kind, "reverb");
// Ambient starts once on the Transport; catch-up ticks cannot precede a
// fifth already queued on the same mono oscillator.
let droneCallback;
let droneStart;
let lastAttack = -Infinity;
const attacks = [];
const droneSandbox = {
  Tone: { Transport: { seconds: 12, scheduleRepeat(callback, interval, start) {
    droneCallback = callback; droneStart = start; assert.equal(interval, "16m"); return 7;
  } } },
  safeEventTime: (time) => Math.max(time, 20.006),
  fifth: () => "A2"
};
vm.runInNewContext(`${functionSource(flavor, "scheduleAmbientDrone")}\nthis.schedule = scheduleAmbientDrone;`, droneSandbox);
assert.equal(droneSandbox.schedule({triggerAttackRelease(note, duration, time) {
  assert.ok(time > lastAttack, "Mono start times must increase strictly");
  lastAttack = time; attacks.push(note);
}}, "D2"), 7);
assert.equal(attacks.length, 0, "Building the layer must not queue a second manual drone");
assert.equal(droneStart, 12.1);
droneCallback(20.1);
droneCallback(20.1);
droneCallback(19);
assert.equal(attacks.length, 2, "Duplicate/stale ticks must not restart the oscillator");
droneCallback(84.1);
assert.deepEqual(attacks, ["D2","A2","D2","A2"]);
const cleared = [];
let deferredDispose;
const oldLayer = {gain:{gain:{rampTo() {}},dispose() {}},synths:[],scheduledIds:[7,8]};
const teardownSandbox = {
  activeLayer:oldLayer,CROSSFADE_S:2,
  clearSchedules: ids => cleared.push(...ids),
  setTimeout: callback => { deferredDispose = callback; }, disposeSynths() {}
};
vm.runInNewContext(`${functionSource(flavor, "teardownActive")}\nteardownActive();`, teardownSandbox);
assert.deepEqual(cleared, [7,8], "STOP/switch clears callbacks before the fade finishes");
assert.equal(oldLayer.scheduledIds.length, 0);
assert.equal(teardownSandbox.activeLayer, null);
deferredDispose();

// Pinned jsDelivr sample URLs must retain the repo@commit separator.
// Tone's original URL/format handling remains available outside this scope.
const safety = readFileSync("audio/audio-safety.js", "utf8");
const requests = [];
const fallback = [];
const payload = new ArrayBuffer(8);
const decoded = {};
let responseOk = true;
const BufferType = { baseUrl: "", load(url) { fallback.push(url); return "original"; } };
const loaderSandbox = {
  Tone: { ToneAudioBuffer: BufferType, getContext: () => ({
    decodeAudioData: async (data) => { assert.equal(data, payload); return decoded; }
  }) },
  fetch: async (url) => { requests.push(url); return {
    ok: responseOk, status: responseOk ? 200 : 404, arrayBuffer: async () => payload
  }; }
};
vm.runInNewContext(`${functionSource(safety, "installPinnedSampleLoader")}\ninstallPinnedSampleLoader();`, loaderSandbox);
const sampleUrl = "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@622c2f1c32c8cfce4158ddc3eb26e518ddef37e5/samples/harp/E4.mp3";
assert.equal(await BufferType.load(sampleUrl), decoded);
assert.equal(requests[0], sampleUrl);
assert.equal(BufferType.load("relative.[mp3|ogg]"), "original");
assert.equal(BufferType.load(sampleUrl.replace("@", "%40")), "original");
BufferType.baseUrl = "custom/";
assert.equal(BufferType.load(sampleUrl), "original");
BufferType.baseUrl = "";
responseOk = false;
await assert.rejects(BufferType.load(sampleUrl), /HTTP 404/);
assert.equal(fallback.length, 3);

// The shared pad's bounded trigger API admits a complete chord only when
// it fits the actual synth ceiling, rather than losing arbitrary notes.
const engine = readFileSync("engine.js", "utf8");
const guardSource = engine.match(/function guardToneTriggerReleaseSchedule\([^]*?\n}/)?.[0];
const padGuardCall = engine.match(/^guardToneTriggerReleaseSchedule\("pad",[^\n]+/m)?.[0];
assert.ok(guardSource && padGuardCall);
const triggered = [];
const boundedPad = {
  maxPolyphony: 24, activeVoices: 20,
  triggerAttackRelease(notes) { triggered.push(notes); return this; }
};
const guardSandbox = {
  pad: boundedPad, toneVoiceRetriggerTooSoon: () => false,
  safeToneScheduleTime: (_key, time) => time,
  estimateTriggeredNoteCount: notes => Array.isArray(notes) ? notes.length : 1
};
vm.runInNewContext(`${guardSource}\n${padGuardCall}`, guardSandbox);
boundedPad.triggerAttackRelease(["D3", "F3", "A3", "C4"], "1n", 10);
assert.equal(triggered.length, 1, "A complete chord fits at the ceiling");
boundedPad.activeVoices = 22;
boundedPad.triggerAttackRelease(["D3", "F3", "A3", "C4"], "1n", 11);
assert.equal(triggered.length, 1, "Do not play only part of a chord");
boundedPad.activeVoices = 24;
boundedPad.triggerAttackRelease("D3", "1n", 12);
assert.equal(triggered.length, 1, "Released tails still count against the ceiling");
boundedPad.activeVoices = 19;
boundedPad.triggerAttackRelease(["D3", "F3", "A3", "C4"], "1n", 13);
assert.equal(triggered.length, 2, "A later chord plays after voice pressure falls");
console.log("Audio playback stability checks passed: clock, STOP cleanup, genre rooms, ambient restart, pinned samples and pad admission");
