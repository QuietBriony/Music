// Inspect the shipped row selector without playing audio or changing song data.
// Retained transcription rows are NOT an accuracy score against the recording.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const source = read('band-room.js');
const start = source.indexOf('  function transcribedLightRowLimit(');
const end = source.indexOf('  function playTranscribedBar(', start);
if (start < 0 || end <= start) throw new Error('Row-selector source boundaries changed; review the harness.');
const sandbox = { currentMode: 'synth', aiLayerLightRuntimeEnabled: () => true, clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)) };
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end) + '\nthis.select = rowsForLightTranscribedPlayback;', sandbox);
const classes = ['kick', 'snare', 'hat', 'crash'];
const parts = { drums: 'drum_line', bass: 'bass_line', guitar: 'guitar_line', voice: 'vocal_melody' };
const registryText = read('presets/bands.json');
const registry = JSON.parse(registryText).bands.tabasco;
const songs = registry.songs.map(song => {
  const framePath = registry.drum_frames_pattern.replace('{songid}', song.id);
  const text = read(framePath);
  const data = JSON.parse(text);
  const result = { id: song.id, title: song.title, inputSha256: sha(text), totalBars: data.total_bars, parts: {} };
  for (const [part, key] of Object.entries(parts)) {
    const rows = data[key]?.events || [];
    const byBar = new Map();
    for (const r of rows) {
      if (!byBar.has(r[0])) byBar.set(r[0], []);
      byBar.get(r[0]).push(r);
    }
    let retained = 0;
    const discardedByClass = Object.fromEntries(classes.map(c => [c, 0]));
    for (const bar of byBar.values()) {
      const selected = sandbox.select(key, bar);
      retained += selected.length;
      if (part === 'drums') for (const row of bar) {
        if (!selected.includes(row)) discardedByClass[classes[row[3]]]++;
      }
    }
    result.parts[part] = {
      status: rows.length ? 'transcribed' : 'pattern-fallback',
      transcribed: rows.length, lightRetained: retained, discarded: rows.length - retained,
      discardedPercent: rows.length ? Number((100 * (rows.length - retained) / rows.length).toFixed(1)) : null,
      ...(part === 'drums' && rows.length ? { discardedByClass } : {})
    };
  }
  // One pass through the declared structure, without an A/B loop or seeking.
  result.generatedSectionCrashesBeforeFix = data.drum_line?.events?.length
    ? data.structure.slice(1).filter(s => /^(chorus|outro)/.test(s.section) || ['bridge', 'chant-b'].includes(s.section)).length
    : 0;
  return result;
});
const report = {
  schemaVersion: 1, measuredAt: new Date().toISOString(), scope: 'Tabasco transcription row retention in the actual light selector',
  limitations: ['Not audio comparison or a full scheduler dump.', 'Missing transcription bars are not necessarily rests.', 'Removed section hints are counted for one declared song pass; transcribed crashes remain.'],
  runtimeSha256: sha(source), selectorSha256: sha(source.slice(start, end)), registrySha256: sha(registryText), songs
};
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0) {
  if (!process.argv[outIndex + 1]) throw new Error('--out requires a filename');
  writeFileSync(resolve(process.argv[outIndex + 1]), JSON.stringify(report, null, 2) + '\n');
}
console.table(songs.map(s => ({ song: s.title, 'drums lost': s.parts.drums.discarded, 'bass lost %': s.parts.bass.discardedPercent, 'guitar lost %': s.parts.guitar.discardedPercent, 'voice lost %': s.parts.voice.discardedPercent, 'extra section crashes removed': s.generatedSectionCrashesBeforeFix })));
