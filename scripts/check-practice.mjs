import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { LESSONS, lessonNotes, frequencyFor, centsFrom, detectPitch, NoteFollower } from '../practice/music.mjs';
import { renderPluck, pluckDuration } from '../practice/instrument-voice.mjs';

// Render the actual instrument model, independently measure its pitch and ring.
const rms = (samples, rate, start, seconds = .12) => {
  const slice = samples.subarray(Math.round(start * rate), Math.round((start + seconds) * rate));
  return Math.sqrt(slice.reduce((sum, x) => sum + x*x, 0) / slice.length);
};
const harmonicPower = (samples, rate, hz, start = .03, seconds = .15) => {
  let real = 0, imaginary = 0;
  for (let i = Math.round(start*rate); i < Math.round((start+seconds)*rate); i++) {
    real += samples[i] * Math.cos(2*Math.PI*hz*i/rate);
    imaginary += samples[i] * Math.sin(2*Math.PI*hz*i/rate);
  }
  return real*real + imaginary*imaginary;
};
for (const sampleRate of [44100,48000]) {
  for (const instrument of ['guitar','sanshin']) {
    for (const midi of instrument === 'guitar' ? [40,45,50,55,59,64] : [45,46,47,48,50,53,60,62]) {
      const duration = pluckDuration(instrument,.55,true);
      const samples = renderPluck({instrument,midi,sampleRate,duration});
      assert.ok(samples.every(Number.isFinite));
      assert.equal(samples[0],0); assert.equal(samples.at(-1),0);
      assert.ok(Math.max(...samples.subarray(0,4096).map(Math.abs)) <= .881);
      const detection = detectPitch(samples.subarray(Math.round(sampleRate*.15),Math.round(sampleRate*.15)+4096),sampleRate,.001);
      assert.ok(detection.frequency && Math.abs(centsFrom(detection.frequency,midi)) < 6, `${instrument} ${midi} must remain a tuning reference`);
      assert.ok(rms(samples,sampleRate,2.5) > .006, `${instrument} ${midi} has an audible tail beyond the previous .55 seconds`);
      assert.ok(rms(samples,sampleRate,2.5) < rms(samples,sampleRate,.25)*.65, 'The string decays naturally');
      assert.ok(rms(samples,sampleRate,duration-.12) < rms(samples,sampleRate,2.5)*.2, 'The end fades rather than cuts');
      const guide = renderPluck({instrument,midi,sampleRate,duration:pluckDuration(instrument)});
      assert.ok(rms(guide,sampleRate,1.2) > .01, 'Guide and touch notes also ring');
    }
  }
  const guitar = renderPluck({instrument:'guitar',midi:60,sampleRate,duration:3});
  const sanshin = renderPluck({instrument:'sanshin',midi:60,sampleRate,duration:3});
  const brightness = data => [2,3,4,5,6].reduce((sum,h)=>sum+harmonicPower(data,sampleRate,frequencyFor(60)*h),0)/harmonicPower(data,sampleRate,frequencyFor(60));
  assert.ok(brightness(sanshin) > brightness(guitar)*1.4, 'Sanshin has a distinct brighter bachi/string attack');
}
assert.throws(()=>renderPluck({midi:NaN,sampleRate:48000,duration:3}),RangeError);
assert.throws(()=>renderPluck({midi:60,sampleRate:48000,duration:1000}),RangeError);

// Independent signal fixtures: the detector never receives their target MIDI.
for (const sampleRate of [44100, 48000]) {
  for (const midi of [40, 45, 48, 50, 53, 55, 59, 60, 64, 65, 67]) {
    const frequency = frequencyFor(midi);
    for (const harmonic of [false, true]) {
      const samples = Float32Array.from({ length: 4096 }, (_, i) => {
        const phase = 2 * Math.PI * frequency * i / sampleRate;
        return 0.16 * (Math.sin(phase) + (harmonic ? 0.7 * Math.sin(phase * 2) + 0.25 * Math.sin(phase * 3) : 0)) * Math.exp(-i / (sampleRate * 0.25));
      });
      const result = detectPitch(samples, sampleRate);
      assert.ok(result.frequency, `Missing ${midi} at ${sampleRate}`);
      assert.ok(Math.abs(centsFrom(result.frequency, midi)) < 12, `Pitch error ${midi}: ${centsFrom(result.frequency, midi)} cent`);
    }
  }
}
assert.equal(detectPitch(new Float32Array(4096), 48000).frequency, null);
assert.equal(detectPitch(new Float32Array(4096).fill(0.08), 48000).frequency, null, 'DC is not a note');
let seed = 123456;
const noise = Float32Array.from({ length: 4096 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 2 ** 32 - 0.5) * 0.2; });
assert.equal(detectPitch(noise, 48000).frequency, null, 'Noise must not advance a lesson');
const signal = (midi, rms = 0.1) => ({ frequency: frequencyFor(midi), rms, clarity: 0.99 });
const quiet = { frequency: null, rms: 0, clarity: 0 };
const follower = new NoteFollower([{ midi: 64 }, { midi: 64 }, { midi: 65 }]);
assert.equal(follower.feed(signal(76), 0).matched, false, 'Octaves are not silently accepted');
follower.feed(signal(64), 50);
assert.equal(follower.feed(signal(64), 200).matched, true);
for (const time of [450, 700, 1000, 1500]) assert.equal(follower.feed(signal(64), time).matched, false, 'One sustained note cannot consume repeated notes');
follower.feed(quiet, 1550); follower.feed(quiet, 1650);
follower.feed(signal(64), 1750);
assert.equal(follower.feed(signal(64), 1900).matched, true, 'A new pluck after a muted gap counts');
follower.feed(signal(65), 2200);
assert.equal(follower.feed(signal(65), 2350).done, true);
assert.equal(follower.feed(signal(65), 2700).matched, false, 'Completed session does not overrun');
const attack = new NoteFollower([{ midi: 60 }, { midi: 60 }]);
attack.feed(signal(60), 0); attack.feed(signal(60), 150);
attack.feed(signal(60, 0.012), 450);
attack.feed(signal(60, 0.08), 500);
assert.equal(attack.feed(signal(60, 0.075), 650).done, true, 'A fresh attack after decay can count');
const range = new NoteFollower([{ midi: 60 }, { midi: 62 }, { midi: 64 }], { start: 1, end: 2 });
range.feed(signal(62), 0);
assert.equal(range.feed(signal(62), 150).done, true, 'Loop bounds stop at the selected final note');
for (const instrument of Object.keys(LESSONS)) {
  for (const lesson of LESSONS[instrument]) {
    for (const transpose of instrument === 'sanshin' ? [-3, -2, -1, 0, 2] : [0]) {
      const notes = lessonNotes(instrument, lesson.id, transpose);
      assert.equal(notes.length, lesson.notes.length);
      assert.equal(notes[0].midi, lesson.notes[0].midi + transpose);
      assert.ok(notes.every(note => Number.isInteger(note.midi) && note.midi >= 40 && note.midi <= 80));
    }
  }
}
const manifest = JSON.parse(readFileSync('practice/manifest.webmanifest', 'utf8'));
assert.equal(manifest.scope, './'); assert.equal(manifest.start_url, './index.html');
const sw = readFileSync('practice/sw.js', 'utf8');
assert.match(sw, /music-practice-v26/); assert.doesNotMatch(sw, /hazama-fm-/);
for (const file of ['index.html', 'style.css', 'presets.css', 'app.mjs', 'music.mjs', 'midi.mjs', 'chords.mjs', 'scores.mjs', 'tuner.mjs', 'learning.mjs', 'songs/amazing-grace.mid', 'songs/twinkle.mid', 'songs/ode-to-joy.mid', 'songs/provenance.json', 'manifest.webmanifest', 'icon.svg']) {
  assert.ok(existsSync(`practice/${file}`)); assert.ok(sw.includes(file), `${file} needs offline coverage`);
}
assert.ok(sw.includes('instrument-voice.mjs?v=26'),'Synthesizer is available offline');
assert.doesNotMatch(readFileSync('practice/app.mjs', 'utf8'), /MediaRecorder|fetch\(|XMLHttpRequest|sendBeacon/);
assert.match(readFileSync('practice/midi.mjs','utf8'), /credentials: 'omit'/);
console.log('Practice: plucked guitar/sanshin pitch, decay, distinct spectra and guide tails at 44.1/48 kHz; 44 pitch fixtures, silence/noise, repeats, onset, exact octave, loops, transposition and local-only PWA PASS');
