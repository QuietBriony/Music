import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';
import { comparableCode, singleWorkCode } from '../src/mix-code.js';
import { minimalPlaybackCode, readMinimalPlaybackMode } from '../src/minimal-playback.js';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const template = readFileSync(new URL('../src/index.html.template', import.meta.url), 'utf8');
const pattern = readFileSync(new URL('../src/patterns/minimal-techno-01.txt', import.meta.url), 'utf8');
const initialCode = singleWorkCode(pattern);

function between(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'production handler exists: ' + start);
  return app.slice(a, b);
}

class Element {
  hidden = false;
  disabled = false;
  value = '';
  textContent = '';
  listeners = new Map();
  addEventListener(name, fn, options) {
    const entries = this.listeners.get(name) || [];
    entries.push({ fn, once: options?.once });
    this.listeners.set(name, entries);
  }
  emit(name) {
    const entries = this.listeners.get(name) || [];
    this.listeners.set(name, entries.filter(entry => !entry.once));
    return Promise.all(entries.map(entry => entry.fn()));
  }
}

// Execute the real UI handler and existing confirmation/save guard. The harness
// supplies browser/audio boundaries; it never substitutes a playback algorithm.
function harness({ playing = false, code = initialCode, loadedCode = initialCode } = {}) {
  let stops = 0, cancels = 0, syncs = 0, confirms = 0;
  const editor = {
    code,
    repl: { scheduler: { started: playing } },
    setCode(value) { this.code = value; },
    stop() { stops++; this.repl.scheduler.started = false; },
  };
  const context = createContext({
    activeEditor: { editor }, activeSelection: { kind: 'published', id: 'minimal-techno-01' },
    loadedCode, wantsPlayback: playing, playbackToken: 7, busy: false,
    comparableCode, minimalPlaybackCode, readMinimalPlaybackMode,
    minimalPlaybackPanel: new Element(), minimalPlaybackMode: new Element(), minimalPlaybackDetail: new Element(), status: new Element(),
    stopButton: new Element(),
    confirmDialog: new Element(), confirmMessage: new Element(), confirmAccept: new Element(),
    currentCode: () => editor.code,
    cancelSetEvaluation() { cancels++; }, closeAcidModule() {},
    queueControlSync() { syncs++; context.syncMinimalPlayback(); },
    setTimeout() { throw new Error('Mode changes must not schedule playback'); },
    setInterval() { throw new Error('Mode changes must not create a sound clock'); },
    window: { localStorage: {
      getItem() { throw new Error('Mode changes must not read stored drafts or settings'); },
      setItem() { throw new Error('Mode changes must not add persistent settings'); },
    } },
  });
  context.confirmDialog.showModal = () => { context.confirmDialog.open = true; confirms++; };
  runInContext([
    between('function syncMinimalPlayback()', 'function queueControlSync()'),
    between('function hasUnsavedChanges()', 'function setEditorCode('),
    between("stopButton.addEventListener('click'", 'function warnUnsavedExit('),
  ].join('\n'), context, { filename: 'app.js minimal playback UI' });
  context.syncMinimalPlayback();
  return {
    context, editor,
    get stops() { return stops; }, get cancels() { return cancels; },
    get confirms() { return confirms; }, get syncs() { return syncs; },
    change(mode) { context.minimalPlaybackMode.value = mode; return context.minimalPlaybackMode.emit('change'); },
    stop() { return context.stopButton.emit('click'); },
    confirm(accepted) {
      context.confirmDialog.returnValue = accepted ? 'yes' : 'cancel';
      context.confirmDialog.open = false;
      return context.confirmDialog.emit('close');
    },
  };
}

test('the optional panel exposes three explicit modes and stays hidden for other scores', () => {
  assert.match(template, /id="minimal-playback-panel"[^>]*hidden/);
  assert.match(template, /id="minimal-playback-mode"[^>]*disabled/);
  assert.match(template, /<option value="once" selected>1回（ループOFF）<\/option>/);
  assert.match(template, /<option value="loop">固定ループ<\/option>/);
  assert.match(template, /<option value="develop">自動展開<\/option>/);
  const h = harness();
  assert.equal(h.context.minimalPlaybackPanel.hidden, false);
  assert.equal(h.context.minimalPlaybackMode.value, 'once');
  assert.match(h.context.minimalPlaybackDetail.textContent, /1回.*32小節.*62秒/);
  h.editor.code = 'setcpm(31)\ns("sine")';
  h.context.syncMinimalPlayback();
  assert.equal(h.context.minimalPlaybackPanel.hidden, true);
  assert.equal(h.context.minimalPlaybackMode.disabled, true);
  h.editor.code = initialCode;
  h.context.busy = true;
  h.context.syncMinimalPlayback();
  assert.equal(h.context.minimalPlaybackPanel.hidden, false);
  assert.equal(h.context.minimalPlaybackMode.disabled, true);
});

test('a playing mode change stops once, invalidates pending playback and requires manual Play', async () => {
  const h = harness({ playing: true });
  await h.change('loop');
  assert.equal(readMinimalPlaybackMode(h.editor.code), 'loop');
  assert.equal(h.context.loadedCode, initialCode, 'mode change remains an unsaved code edit');
  assert.equal(h.context.wantsPlayback, false);
  assert.equal(h.editor.repl.scheduler.started, false);
  assert.equal(h.context.playbackToken, 8);
  assert.equal(h.stops, 1);
  assert.equal(h.cancels, 1);
  assert.equal(h.confirms, 0);
  assert.equal(h.context.busy, false);
  assert.match(h.context.status.textContent, /停止中.*Playで冒頭/);
});

test('cancelled dirty edits retain the exact score, mode and live playback', async () => {
  const edited = initialCode + '\n// my unsaved phrase';
  const h = harness({ playing: true, code: edited });
  const changing = h.change('develop');
  await setImmediate();
  assert.equal(h.confirms, 1);
  assert.match(h.context.confirmMessage.textContent, /編集を残して再生モードだけ変え/);
  await h.confirm(false); await changing;
  assert.equal(h.editor.code, edited);
  assert.equal(h.context.wantsPlayback, true);
  assert.equal(h.editor.repl.scheduler.started, true);
  assert.equal(h.context.playbackToken, 7);
  assert.equal(h.stops, 0);
  assert.equal(h.cancels, 0);
  assert.equal(h.context.minimalPlaybackMode.value, 'once');
});

test('accepted mode changes preserve edits, including edits made while confirmation is open', async () => {
  const h = harness({ code: initialCode + '\n// unsaved phrase' });
  const changing = h.change('develop');
  await setImmediate();
  h.editor.code += '\n// edit during confirmation';
  const latest = h.editor.code;
  await h.confirm(true); await changing;
  assert.equal(h.editor.code, minimalPlaybackCode(latest, 'develop'));
  assert.equal(h.context.loadedCode, initialCode);
  assert.equal(h.context.hasUnsavedChanges(), true);
  assert.equal(h.context.wantsPlayback, false);
  assert.equal(h.stops, 1);
});

test('unsupported edits during confirmation fail closed before stopping or replacing the score', async () => {
  const h = harness({ playing: true, code: initialCode + '\n// unsaved phrase' });
  const changing = h.change('loop');
  await setImmediate();
  h.editor.code = 'setcpm(31)\ns("sine")';
  const unsupported = h.editor.code;
  await h.confirm(true); await changing;
  assert.equal(h.editor.code, unsupported);
  assert.equal(h.context.wantsPlayback, true);
  assert.equal(h.editor.repl.scheduler.started, true);
  assert.equal(h.context.playbackToken, 7);
  assert.equal(h.stops, 0);
  assert.equal(h.context.minimalPlaybackPanel.hidden, true);
  assert.equal(h.context.busy, false);
});

test('same mode, unknown mode, unsupported scores and busy operations cannot start or replace playback', async () => {
  const h = harness();
  await h.change('once');
  await h.change('invalid-mode');
  assert.equal(h.editor.code, initialCode);
  assert.equal(h.stops, 0);
  h.context.busy = true;
  await h.change('loop');
  assert.equal(h.editor.code, initialCode);
  assert.equal(h.stops, 0);
  h.context.busy = false;
  h.editor.code = 'setcpm(31)\ns("sine")';
  await h.change('loop');
  assert.equal(h.context.minimalPlaybackPanel.hidden, true);
  assert.equal(h.stops, 0);
});

test('a saved non-default mode reopens from code without new mode settings', () => {
  for (const mode of ['loop', 'develop']) {
    const saved = minimalPlaybackCode(initialCode, mode);
    const h = harness({ code: saved, loadedCode: saved });
    assert.equal(h.context.minimalPlaybackMode.value, mode);
    assert.match(h.context.minimalPlaybackDetail.textContent,
      mode === 'loop' ? /同じ32小節.*繰り返し/ : /16小節.*4章.*124秒.*引き算と復帰/);
    assert.equal(h.context.hasUnsavedChanges(), false);
    assert.equal(h.context.wantsPlayback, false);
    assert.equal(h.stops, 0);
  }
});

test('mode-only changes can return through all three modes without an edit confirmation', async () => {
  for (const savedMode of ['once', 'loop', 'develop']) {
    const saved = minimalPlaybackCode(initialCode, savedMode);
    const h = harness({ playing: true, code: saved, loadedCode: saved });
    const modes = savedMode === 'loop' ? ['develop', 'once', 'loop'] : ['loop', 'develop', 'once', savedMode];
    for (const mode of modes) {
      const changing = h.change(mode);
      await setImmediate();
      assert.equal(h.confirms, 0, 'a mode choice alone is not a hand edit');
      await changing;
      assert.equal(readMinimalPlaybackMode(h.editor.code), mode);
      assert.equal(h.editor.repl.scheduler.started, false);
      assert.equal(h.context.wantsPlayback, false);
      assert.equal(h.context.loadedCode, saved, 'saving still uses the original baseline');
    }
    assert.equal(h.context.hasUnsavedChanges(), false, 'return to the saved mode is clean');
  }
});

test('mode-only changes retain the common save and score-replacement guard', async () => {
  const h = harness();
  await h.change('loop');
  assert.equal(h.context.hasUnsavedChanges(), true);
  const replacing = h.context.mayReplaceCode();
  await setImmediate();
  assert.equal(h.confirms, 1, 'replacing the score still protects the unsaved mode');
  await h.confirm(false);
  assert.equal(await replacing, false);
  assert.equal(readMinimalPlaybackMode(h.editor.code), 'loop');
  const returning = h.change('once');
  await setImmediate();
  assert.equal(h.confirms, 1, 'the mode-only return does not add another confirmation');
  await returning;
  assert.equal(h.context.hasUnsavedChanges(), false);
});

test('hand edits after a mode-only change still require confirmation and survive cancellation', async () => {
  const h = harness();
  await h.change('loop');
  h.editor.code += '\n// a real edit after choosing loop';
  h.editor.repl.scheduler.started = true;
  h.context.wantsPlayback = true;
  const edited = h.editor.code;
  const stopsBefore = h.stops;
  const changing = h.change('develop');
  await setImmediate();
  assert.equal(h.confirms, 1);
  await h.confirm(false); await changing;
  assert.equal(h.editor.code, edited);
  assert.equal(h.editor.repl.scheduler.started, true);
  assert.equal(h.context.wantsPlayback, true);
  assert.equal(h.stops, stopsBefore);
  assert.equal(h.context.hasUnsavedChanges(), true);
  assert.equal(h.context.minimalPlaybackMode.value, 'loop');
});

test('an unsupported saved baseline cannot suppress confirmation for a recognized current score', async () => {
  const h = harness({ loadedCode: 'setcpm(31)\ns("sine")' });
  const unchanged = h.editor.code;
  const changing = h.change('loop');
  await setImmediate();
  assert.equal(h.confirms, 1);
  await h.confirm(false); await changing;
  assert.equal(h.editor.code, unchanged);
  assert.equal(h.stops, 0);
});

test('Stop while mode confirmation is open stays stopped after accepting or cancelling', async () => {
  for (const accepted of [true, false]) {
    const edited = initialCode + '\n// unsaved phrase';
    const h = harness({ playing: true, code: edited });
    const changing = h.change('loop');
    await setImmediate();
    await h.stop();
    await h.confirm(accepted); await changing;
    assert.equal(h.context.wantsPlayback, false);
    assert.equal(h.editor.repl.scheduler.started, false);
    assert.equal(h.context.playbackToken, accepted ? 9 : 8);
    assert.equal(h.editor.code, accepted ? minimalPlaybackCode(edited, 'loop') : edited);
    assert.equal(h.context.loadedCode, initialCode);
  }
});
