import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';
import { defaultSet, readTechnoSet, technoSetCode } from '../src/live-code.js';
import {
  clampLevel, comparableCode, deckMixCode, managedSliderValue,
  replaceManagedSliderValue, singleWorkCode, upgradeLegacyDraftCode,
  SINGLE_LEVEL, DECK_A_LEVEL, DECK_B_LEVEL, DECK_XFADE,
} from '../src/mix-code.js';

const source = new URL('../src/', import.meta.url);
const app = readFileSync(new URL('app.js', source), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('library.json', source), 'utf8'));
const patterns = new Map(catalog.items.map((item) => [item.path,
  readFileSync(new URL('patterns/' + item.id + '.txt', source), 'utf8'),
]));
const [first, second, third] = catalog.items;
const liveState = defaultSet('acid-drive', ['techno-dub', 'namima-test'].map(id => {
  const item = catalog.items.find(entry => entry.id === id);
  return { id, title: item.title, source: patterns.get(item.path) };
}));
const liveCode = technoSetCode(liveState);
const editedLiveCode = liveCode.replace(
  '.hpf(signal(t => setShadowAt(t).hpf))', '.hpf(signal(t => setShadowAt(t).hpf * 1.25))',
);
assert.notEqual(editedLiveCode, liveCode, 'fixture edits the generated shadow sound body');
const liveSelection = { kind: 'set', label: 'Acid Drive', detail: 'Existing V4 live set' };

function between(start, end) {
  const a = app.indexOf(start);
  const b = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'production app section exists: ' + start);
  return app.slice(a, b);
}

// Execute the production handlers with controllable browser boundaries. No
// alternative selection or playback implementation lives in this harness.
const handlers = [
  between('function currentCode()', 'function syncMixFaders()'),
  between('function hasUnsavedChanges()', 'function readDrafts()'),
  between('function readDrafts()', 'function writeDrafts('),
  between('async function openDraft(', 'function backupCounts('),
  between("playButton.addEventListener('click'", 'function warnUnsavedExit('),
  'const openPerformance = ({' + between('  async openCode(', '  fader(key, value)') + '}).openCode;',
].join('\n');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class Element {
  hidden = false;
  textContent = '';
  value = '';
  disabled = false;
  listeners = new Map();
  attributes = new Map();
  addEventListener(name, fn, options) {
    const list = this.listeners.get(name) || [];
    list.push({ fn, once: options?.once });
    this.listeners.set(name, list);
  }
  emit(name) {
    const list = this.listeners.get(name) || [];
    this.listeners.set(name, list.filter((entry) => !entry.once));
    return Promise.all(list.map((entry) => entry.fn()));
  }
  click() { return this.emit('click'); }
  setAttribute(name, value) { this.attributes.set(name, value); }
}

function harness({ playing = false, code = singleWorkCode(patterns.get(first.path)),
  selection = { kind: 'published', id: first.id, label: first.title, detail: first.label },
} = {}) {
  const storage = new Map();
  const responseGates = new Map();
  const fetches = [];
  let preparation;
  let evaluation;
  let definition;
  let stopped = 0;
  let evaluated = 0;
  let closedMachine = 0;
  const editor = {
    code, prebaked: Promise.resolve(),
    repl: { state: {}, scheduler: { started: playing } },
    setCode(value) { this.code = value; },
    stop() { stopped++; this.repl.scheduler.started = false; },
    async evaluate() {
      evaluated++;
      if (evaluation) await evaluation.promise;
      this.repl.scheduler.started = true;
    },
  };
  const published = catalog.items.map((item) => {
    const button = new Element();
    button.dataset = { workId: item.id };
    return button;
  });
  const context = createContext({
    URL, catalog, loadedCode: code, activeEditor: { editor },
    activeSelection: selection,
    busy: false, wantsPlayback: playing, playbackToken: 0,
    SINGLE_LEVEL, DECK_A_LEVEL, DECK_B_LEVEL, DECK_XFADE,
    LEVEL_KEY: 'levels', DECK_KEY: 'decks', DRAFT_KEY: 'drafts',
    clampLevel, comparableCode, deckMixCode, managedSliderValue,
    replaceManagedSliderValue, singleWorkCode, upgradeLegacyDraftCode,
    status: new Element(), currentWork: new Element(), draftForm: new Element(),
    playButton: new Element(), updateButton: new Element(), stopButton: new Element(),
    saveButton: new Element(), reloadButton: new Element(), editorHost: new Element(),
    confirmMessage: new Element(), confirmAccept: new Element(), confirmDialog: new Element(),
    deckASelect: Object.assign(new Element(), { value: first.id }),
    deckBSelect: Object.assign(new Element(), { value: second.id }), deckInfo: new Element(),
    publishedList: { querySelectorAll: () => published },
    draftList: { querySelectorAll: () => [] },
    window: {
      location: { href: 'http://localhost/?work=' + first.id },
      localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      history: { replaceState(_state, _title, url) { context.window.location.href = String(url); } },
    },
    async fetch(path) {
      fetches.push(path);
      if (responseGates.has(path)) await responseGates.get(path).promise;
      return { ok: true, text: async () => patterns.get(path) };
    },
    customElements: { whenDefined: () => definition?.promise || Promise.resolve() },
    audioPlayback: { prepare: () => preparation?.promise || Promise.resolve() },
    sliderBridge: { capture() {} }, queueControlSync() {}, cancelSetEvaluation() {},
    closeAcidModule() { closedMachine++; }, acidSliderDeclarations: () => null,
    readTechnoSet, performance: { show() {} },
  });
  let confirmations = 0;
  context.confirmDialog.showModal = () => { context.confirmDialog.open = true; confirmations++; };
  runInContext(handlers, context, { filename: 'app.js selection handlers' });
  const state = () => ({
    code: editor.code, selection: context.activeSelection, href: context.window.location.href,
    playing: editor.repl.scheduler.started, wantsPlayback: context.wantsPlayback,
  });
  return {
    context, editor, storage, fetches, published, state,
    get confirmations() { return confirmations; },
    get evaluated() { return evaluated; }, get stopped() { return stopped; },
    get closedMachine() { return closedMachine; },
    open: (item) => context.openPublished(item),
    openDeck: () => context.openDeck(first.id, second.id),
    openDraft: () => context.openDraft('saved-work'),
    openPerformance: () => runInContext('openPerformance', context)(
      singleWorkCode(patterns.get(second.path)), 'Existing preset handoff', editor.code,
    ),
    play: () => context.playButton.click(), stop: () => context.stopButton.click(),
    confirm(value) {
      context.confirmDialog.returnValue = value ? 'yes' : 'cancel';
      context.confirmDialog.open = false;
      return context.confirmDialog.emit('close');
    },
    waitForFetch(path) { const gate = deferred(); responseGates.set(path, gate); return gate; },
    waitForPreparation() { return preparation = deferred(); },
    waitForEvaluation() { return evaluation = deferred(); },
    waitForDefinition() { return definition = deferred(); },
    saveDraft(imported = false, savedCode = singleWorkCode(patterns.get(second.path))) {
      storage.set('drafts', JSON.stringify([{
        id: 'saved-work', title: second.title, code: savedCode,
        savedAt: '2026-10-01T00:00:00.000Z', ...(imported ? { importedAt: '2026-10-01T01:00:00.000Z' } : {}),
      }]));
    },
  };
}

test('each existing shelf work loads its own code and needs explicit Play when stopped', async () => {
  const h = harness();
  for (const item of catalog.items) {
    await h.open(item);
    assert.equal(h.context.activeSelection.id, item.id);
    assert.equal(new URL(h.context.window.location.href).searchParams.get('work'), item.id);
    assert.equal(h.editor.code, singleWorkCode(patterns.get(item.path)));
    assert.equal(h.published.find((button) => button.dataset.workId === item.id).attributes.get('aria-pressed'), 'true');
    assert.equal(h.evaluated, 0);
  }
  await h.play();
  assert.equal(h.evaluated, 1);
  assert.equal(h.editor.repl.scheduler.started, true);
});

test('cancelling an unsaved switch preserves current code, selection, URL, and playback', async () => {
  const h = harness({ playing: true });
  h.editor.code += '\n// unfinished edit';
  const before = h.state();
  const opening = h.open(second);
  await setImmediate();
  assert.equal(h.confirmations, 1);
  await h.confirm(false);
  await opening;
  assert.deepEqual(h.state(), before);
  assert.equal(h.fetches.length, 0);
  assert.equal(h.context.draftForm.hidden, false);
});

for (const route of ['published', 'deck', 'draft', 'performance']) {
  test(route + ': cancelling edits made during loading keeps the existing work', async () => {
    const h = harness({ playing: true });
    h.saveDraft();
    const gate = route === 'published' ? h.waitForFetch(second.path) : h.waitForDefinition();
    const opening = route === 'published' ? h.open(second)
      : route === 'deck' ? h.openDeck() : route === 'draft' ? h.openDraft() : h.openPerformance();
    await setImmediate();
    h.editor.code += '\n// edit while the next work is loading';
    const before = h.state();
    gate.resolve();
    await setImmediate();
    assert.equal(h.confirmations, 1, 'new edits require fresh consent before replacement');
    await h.confirm(false);
    await opening;
    assert.deepEqual(h.state(), before);
    assert.equal(h.context.draftForm.hidden, false);
    assert.equal(h.closedMachine, 0);
    assert.equal(h.evaluated, 0);
    assert.equal(h.context.busy, false);
    assert.match(h.context.status.textContent, /中止/);
  });
}

test('a second consent covers edits made after accepting the initial unsaved switch', async () => {
  const h = harness();
  h.editor.code += '\n// first edit';
  const gate = h.waitForFetch(second.path);
  const opening = h.open(second);
  await setImmediate();
  await h.confirm(true);
  await setImmediate();
  h.editor.code += '\n// newer edit';
  gate.resolve();
  await setImmediate();
  assert.equal(h.confirmations, 2);
  await h.confirm(true);
  await opening;
  assert.equal(h.editor.code, singleWorkCode(patterns.get(second.path)));
  assert.equal(h.context.activeSelection.id, second.id);
});

test('rapid selections serialize one load and allow another selection after completion', async () => {
  const h = harness();
  const gate = h.waitForFetch(second.path);
  const opening = h.open(second);
  await setImmediate();
  await h.open(third);
  assert.deepEqual(h.fetches, [second.path]);
  gate.resolve();
  await opening;
  assert.equal(h.context.activeSelection.id, second.id);
  await h.open(third);
  assert.equal(h.context.activeSelection.id, third.id);
});

test('Stop during selection loading prevents the late response from starting playback', async () => {
  const h = harness({ playing: true });
  const gate = h.waitForFetch(second.path);
  const opening = h.open(second);
  await setImmediate();
  await h.stop();
  gate.resolve();
  await opening;
  assert.equal(h.context.activeSelection.id, second.id);
  assert.equal(h.evaluated, 0);
  assert.equal(h.state().playing, false);
  assert.equal(h.state().wantsPlayback, false);
});

for (const boundary of ['audio preparation', 'sample preparation', 'evaluation']) {
  test('Stop during ' + boundary + ' prevents a late playback restart', async () => {
    const h = harness();
    const gate = boundary === 'audio preparation' ? h.waitForPreparation()
      : boundary === 'evaluation' ? h.waitForEvaluation() : deferred();
    if (boundary === 'sample preparation') h.editor.prebaked = gate.promise;
    const playing = h.play();
    await setImmediate();
    await h.stop();
    gate.resolve();
    await playing;
    assert.equal(h.evaluated, boundary === 'evaluation' ? 1 : 0);
    assert.equal(h.state().playing, false);
    assert.equal(h.state().wantsPlayback, false);
    assert.equal(h.context.status.textContent, '停止しました。');
  });
}

test('imported saved code opens stopped even when the prior work was playing', async () => {
  const h = harness({ playing: true });
  h.saveDraft(true);
  await h.openDraft();
  assert.equal(h.context.activeSelection.kind, 'draft');
  assert.equal(h.evaluated, 0);
  assert.equal(h.state().playing, false);
  await h.play();
  assert.equal(h.evaluated, 1);
});

test('a stored 15% work level survives switching and applies one outer trim', async () => {
  const h = harness();
  h.editor.code = replaceManagedSliderValue(h.editor.code, SINGLE_LEVEL, 0.15);
  h.context.persistManagedSettings();
  await h.open(second);
  await h.open(first);
  assert.equal(h.confirmations, 0, 'persisted fader changes are not unsaved musical edits');
  assert.equal(managedSliderValue(h.editor.code, SINGLE_LEVEL), 0.15);
  assert.equal((h.editor.code.match(/\.mul\(gain\(WORKBENCH_LEVEL_V1\)\)/g) || []).length, 1);
  assert.ok(h.editor.code.includes(patterns.get(first.path).replace(/\r\n?/g, '\n').trim()), 'original per-part gains survive');
});

for (const route of ['published', 'deck', 'draft', 'performance']) {
  test(route + ': late cancel preserves a hand-edited V4 shadow sound body', async () => {
    const h = harness({ playing: true, code: liveCode, selection: liveSelection });
    h.saveDraft();
    const gate = route === 'published' ? h.waitForFetch(second.path) : h.waitForDefinition();
    const opening = route === 'published' ? h.open(second)
      : route === 'deck' ? h.openDeck() : route === 'draft' ? h.openDraft() : h.openPerformance();
    await setImmediate();
    h.editor.code = editedLiveCode;
    assert.equal(readTechnoSet(h.editor.code), null, 'musical body edits stay outside automatic restructuring');
    const before = h.state();
    gate.resolve();
    await setImmediate();
    assert.equal(h.confirmations, 1);
    await h.confirm(false);
    await opening;
    assert.deepEqual(h.state(), before);
    assert.equal(h.evaluated, 0);
  });

  test(route + ': repeated Stop survives accepting a delayed V4 hand-edit switch', async () => {
    const h = harness({ playing: true, code: liveCode, selection: liveSelection });
    h.saveDraft();
    const gate = route === 'published' ? h.waitForFetch(second.path) : h.waitForDefinition();
    const opening = route === 'published' ? h.open(second)
      : route === 'deck' ? h.openDeck() : route === 'draft' ? h.openDraft() : h.openPerformance();
    await setImmediate();
    h.editor.code = editedLiveCode;
    await h.stop(); await h.stop(); await h.stop();
    gate.resolve();
    await setImmediate();
    assert.equal(h.confirmations, 1);
    await h.confirm(true);
    await opening;
    assert.equal(h.evaluated, 0);
    assert.equal(h.state().playing, false);
    assert.equal(h.state().wantsPlayback, false);
    assert.equal(h.context.busy, false);
  });
}

test('a saved hand-edited V4 draft restores the entire sound code', async () => {
  const h = harness();
  h.saveDraft(false, editedLiveCode);
  await h.openDraft();
  assert.equal(h.editor.code, editedLiveCode);
  assert.equal(h.state().playing, false);
  assert.equal(h.evaluated, 0);
});

test('an imported V4 draft stops an existing live set and needs another explicit Play', async () => {
  const h = harness({ playing: true, code: liveCode, selection: liveSelection });
  h.saveDraft(true, editedLiveCode);
  await h.openDraft();
  assert.equal(h.editor.code, editedLiveCode);
  assert.equal(h.state().playing, false);
  assert.equal(h.state().wantsPlayback, false);
  assert.equal(h.evaluated, 0);
  await h.play();
  assert.equal(h.evaluated, 1);
});

test('opening a saved V3 live set preserves its exact legacy body', async () => {
  const legacy = structuredClone(liveState);
  delete legacy.shadow;
  for (const name of ['SHADOW', 'SHADOW_ON', 'SHADOW_HPF']) delete legacy.values[name];
  const legacyCode = technoSetCode(legacy);
  assert.ok(legacyCode.startsWith('// TECHNO_SET_V3 '));
  const h = harness();
  h.saveDraft(false, legacyCode);
  await h.openDraft();
  assert.equal(h.editor.code, legacyCode);
  assert.equal(h.editor.code.includes('TECHNO_SET_V4'), false);
});
