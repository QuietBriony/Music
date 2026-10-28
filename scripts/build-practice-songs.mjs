// Reproduce our two symbolic MIDI exercises. Pass the original Mutopia MIDI as argv[2].
// Never downloads sources or imports recordings/lyrics.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseMidi } from '../practice/midi.mjs';
const vlq = value => { const out = [value & 127]; while ((value >>>= 7)) out.unshift((value & 127) | 128); return out; };
const be = (value, count) => Array.from({ length: count }, (_, i) => (value >>> ((count - i - 1) * 8)) & 255);
const ascii = value => [...Buffer.from(value, 'utf8')];
const meta = (type, data) => [255, type, ...vlq(data.length), ...data];
export function encodeMidi(notes, { ppq = 384, bpm = 90, signature = [4, 4], chords = [], name = 'Melody' } = {}) {
  const events = [
    { tick: 0, data: meta(3, ascii(name)) },
    { tick: 0, data: meta(0x51, be(Math.round(60e6 / bpm), 3)) },
    { tick: 0, data: meta(0x58, [signature[0], Math.log2(signature[1]), 24, 8]) },
    ...chords.map(c => ({ tick: Math.round(c.beat * ppq), data: meta(6, ascii(`chord:${c.chord}`)) })),
    ...notes.flatMap(n => [{ tick: Math.round(n.beat * ppq), data: [0x90, n.midi, 90] }, { tick: Math.round((n.beat + n.beats) * ppq), data: [0x80, n.midi, 0] }])
  ].sort((a, b) => a.tick - b.tick || (a.data[0] === 0x80 ? -1 : b.data[0] === 0x80 ? 1 : 0));
  let tick = 0; const track = [];
  for (const event of events) { track.push(...vlq(event.tick - tick), ...event.data); tick = event.tick; }
  track.push(0, ...meta(0x2f, []));
  return Buffer.from([...ascii('MThd'), ...be(6, 4), 0, 0, 0, 1, ...be(ppq, 2), ...ascii('MTrk'), ...be(track.length, 4), ...track]);
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/build-practice-songs.mjs') && process.argv[2]) {
  const source = readFileSync(process.argv[2]), parsed = parseMidi(source);
  const main = parsed.groups[0].notes.filter(n => n.durationTicks >= 80);
  const notes = main.map((n, i) => ({ midi: n.midi - 8, beat: n.beat, beats: (main[i + 1]?.beat ?? parsed.endBeat) - n.beat }));
  const chords = [[0,'G'],[6,'G'],[10.5,'C'],[15,'G'],[19.5,'G'],[24,'G'],[28.5,'D'],[33,'D'],[37.5,'G'],[42,'G'],[46.5,'C'],[51,'G'],[55.5,'G'],[60,'G'],[63,'D'],[64.5,'G']].map(([beat,chord])=>({beat,chord}));
  const grace = encodeMidi(notes, { signature: [9, 8], chords, name: 'Amazing Grace - simple melody' });
  const phrases = [[48,48,55,55,57,57,55],[53,53,52,52,50,50,48],[55,55,53,53,52,52,50],[55,55,53,53,52,52,50],[48,48,55,55,57,57,55],[53,53,52,52,50,50,48]];
  let beat = 0; const twinkle = encodeMidi(phrases.flatMap(phrase => phrase.map((midi,i) => { const beats = i === 6 ? 2 : 1; const n = {midi,beat,beats}; beat += beats; return n; })), { name: 'Twinkle - sanshin melody' });
  writeFileSync('practice/songs/amazing-grace.mid', grace); writeFileSync('practice/songs/twinkle.mid', twinkle);
  const provenance = JSON.parse(readFileSync('practice/songs/provenance.json', 'utf8'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  provenance.songs[0].source_sha256 = hash(source);
  for (const song of provenance.songs) song.sha256 = hash(readFileSync(`practice/songs/${song.file}`));
  writeFileSync('practice/songs/provenance.json', JSON.stringify(provenance, null, 2) + '\n');
  console.log('Two symbolic practice MIDIs generated; hashes recorded.');
}
