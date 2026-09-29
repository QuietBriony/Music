import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../third_party/acidbros');
const read = (path) => readFileSync(join(root, path));

function filesUnder(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

test('the optional acid module has its local code, worklets, icons, and four intact WAVs', () => {
  for (const path of ['index.html', 'js/main.js', 'js/audio/TB303FilterProcessor.js',
    'js/audio/ClockProcessor.js', 'assets/favicon.png', 'assets/DSEG7Classic-Bold.woff2']) {
    assert.ok(existsSync(join(root, path)), path + ' is missing');
  }
  for (const file of filesUnder(join(root, 'js'))) {
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(/(?:from\s*|import\()\s*['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('.')) {
        assert.ok(existsSync(resolve(dirname(file), match[1])), file + ' imports missing ' + match[1]);
      }
    }
  }
  for (const file of filesUnder(join(root, 'css'))) {
    const css = readFileSync(file, 'utf8');
    for (const match of css.matchAll(/url\(['"]?(\.\.[^'")]+)['"]?\)/g)) {
      assert.ok(existsSync(resolve(dirname(file), match[1])), file + ' references missing ' + match[1]);
    }
  }
  const notice = read('UPSTREAM.md').toString('utf8');
  const hashes = [...notice.matchAll(/\| `([a-z0-9]+\.wav)` \| `([0-9a-f]{64})` \|/g)];
  assert.equal(hashes.length, 4);
  let bytes = 0;
  for (const [, name, hash] of hashes) {
    const wav = read('assets/samples/tr909/' + name);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(createHash('sha256').update(wav).digest('hex'), hash);
    bytes += wav.length;
  }
  assert.equal(bytes, 438798);
  assert.ok(statSync(join(root, 'index.html')).size > 0);
});

test('embedded snapshot does not install another service worker or request MIDI at load', () => {
  const html = read('index.html').toString('utf8');
  const ui = read('js/ui/UI.js').toString('utf8');
  assert.doesNotMatch(html, /serviceWorker\.register|user-scalable=no/);
  assert.doesNotMatch(ui, /^\s*MidiManager\.init\(\);/m);
  assert.match(ui, /MidiManager\.refreshDevices\(\)/);
});
