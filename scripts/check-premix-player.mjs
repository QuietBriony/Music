import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { createPremixPlayer, PREMIX_GAIN } from "../audio/premix-player.mjs";

const catalog = JSON.parse(readFileSync("presets/bands.json", "utf8")).bands.tabasco.songs;
const proof = JSON.parse(readFileSync("presets/tabasco-premix/provenance.json", "utf8"));
assert.equal(proof.files.length, 7);
for (const song of catalog) {
  const f = proof.files.find((f) => f.song_id === song.id);
  const bytes = readFileSync(song.original_mix.url);
  assert.equal(f.path, song.original_mix.url);
  assert.equal(f.title, song.title); assert.equal(f.track, song.track);
  assert.equal(f.duration_s, song.original_mix.duration_s);
  assert.equal(bytes.length, f.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), f.sha256);
  assert.ok(bytes.length < 25 * 1024 * 1024, "Each existing Pages asset must fit the file limit");
  assert.equal(song.original_mix.gain_db, -2.2);
}
assert.equal(proof.files.reduce((n, f) => n + f.bytes, 0), 46658249);

const entry = readFileSync("audio/premix-entry.js", "utf8");
for (const [url, expected] of [
  ["https://test/band-room.html", "original"],
  ["https://test/band-room.html?band=tabasco&song=hey", "original"],
  ["https://test/band-room.html?band=tabasco&mode=original", "original"],
  ["https://test/band-room.html?mode=stems", "practice"],
  ["https://test/band-room.html?mode=synth", "practice"],
  ["https://test/band-room.html?mix=karaoke", "practice"],
  ["https://test/band-room.html?band=hazama", "practice"],
  ["https://test/band-room.html?bandId=hazama&mode=original", "practice"],
  ["https://test/band-room.html?safe=1", "practice"],
  ["https://test/band-room.html#br-guitar-audition", "practice"]
]) {
  const document = { documentElement: { dataset: {} } };
  vm.runInNewContext(entry, { document, location: new URL(url), URLSearchParams });
  assert.equal(document.documentElement.dataset.brSurface, expected, url);
}

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const events = {};
const requests = [];
const media = { paused: true, currentTime: 0, readyState: 0, duration: NaN, ended: false,
  addEventListener(name, cb) { events[name] = cb; },
  pause() { this.paused = true; },
  play() { this.paused = false; const d = deferred(); requests.push(d); return d.promise; },
  removeAttribute() { this.src = ""; }, load() { this.readyState = 0; this.duration = NaN; }
};
let sources = 0, contextCalls = 0;
const output = { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; } }, connect() {} };
const context = { currentTime: 0, state: "running", destination: {}, addEventListener() {}, resume: () => Promise.resolve(),
  createMediaElementSource() { ++sources; return { connect() {} }; }, createGain: () => output };
const p = createPremixPlayer({ media, getContext: () => { ++contextCalls; return context; } });
p.select(catalog[0]);
assert.equal(contextCalls, 0); assert.equal(media.src, "");
p.seek(12); assert.equal(p.snapshot().position, 12);
const first = p.play();
assert.equal(media.src, catalog[0].original_mix.url);
media.readyState = 1; media.duration = 44.7; events.loadedmetadata();
assert.equal(media.currentTime, 12, "Seek before metadata survives first play");
p.stop(); requests[0].resolve(); await first;
assert.equal(p.snapshot().phase, "idle"); assert.ok(media.paused); assert.equal(output.gain.value, 0); assert.equal(media.currentTime, 0);

const old = p.play(); p.select(catalog[1]); const newer = p.play();
requests[1].reject(new Error("old abort")); await old;
assert.equal(p.snapshot().phase, "loading"); assert.ok(!media.paused, "An old abort must not pause the new song");
requests[2].resolve(); await newer;
assert.equal(p.snapshot().phase, "playing"); assert.equal(sources, 1);
assert.equal(output.gain.value, PREMIX_GAIN);
p.setVolume(0); assert.equal(output.gain.value, 0);
p.setVolume(3); assert.equal(output.gain.value, PREMIX_GAIN);
p.setVolume(NaN); assert.equal(output.gain.value, PREMIX_GAIN);
p.seek(-1); assert.equal(p.snapshot().position, 0);
p.pause(); assert.equal(output.gain.value, 0);
const failed = p.play(); requests[3].reject(new Error("network failure")); await failed;
assert.equal(p.snapshot().phase, "error"); assert.equal(output.gain.value, 0); assert.ok(media.paused);
media.error = {}; events.error(); assert.equal(p.snapshot().phase, "error");
assert.equal(sources, 1, "No alternate/stem/synth source on error");
assert.throws(() => p.select({ id: "bad", original_mix: { url: "https://example.com/music" } }));
const blocked = createPremixPlayer({ media, getContext: () => ({ createMediaElementSource() { throw new Error("Unavailable graph"); } }) });
const count = requests.length;
blocked.select(catalog[0]); await blocked.play(); await blocked.play();
assert.equal(requests.length, count, "A failed output graph must never fall back to unattenuated native audio");
assert.equal(media.src, "");
console.log("PASS: seven immutable original assets; routing, streaming lifecycle, seek, mute, cancellation and failure isolation");
