import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const source = new URL('../src/', import.meta.url);
const app = readFileSync(new URL('app.js', source), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('library.json', source), 'utf8'));
const archivedIds = ['acid-303-909-v1', 'aphex1-v1', 'namima-test'];
const existingMixableIds = ['aphex1', 'techno-floor', 'acid-303-909', 'acid-303-909-v1',
  'techno-dub', 'auto-groove', 'aphex1-v1', 'namima-test'];

function between(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'production app section exists: ' + start);
  return app.slice(a, b);
}

// Execute the production renderer and route handler against a small DOM. The
// harness provides browser boundaries, not a replacement grouping algorithm.
class Element {
  constructor(tag = 'div') { this.tagName = tag; }
  children = [];
  dataset = {};
  attributes = new Map();
  listeners = new Map();
  className = '';
  hidden = false;
  text = '';
  value = '';
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  set textContent(text) { this.text = text; this.children = []; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; this.text = ''; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  async click() { return this.listeners.get('click')?.(); }
  querySelectorAll(selector) {
    const match = element => selector === '[data-work-id]' ? Boolean(element.dataset.workId)
      : selector.startsWith('.') ? element.className.split(' ').includes(selector.slice(1)) : false;
    return this.children.flatMap(child => [...(match(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
}

function harness(library = catalog, requested = '') {
  const publishedList = new Element(), opened = [], scrolls = [];
  const context = createContext({
    URL, catalog: library, publishedList, draftList: new Element(), currentWork: new Element(),
    activeSelection: null, cancelSetEvaluation() {},
    deckASelect: new Element('select'), deckBSelect: new Element('select'),
    deckOpenButton: new Element('button'), deckSwapButton: new Element('button'),
    status: new Element(),
    document: { createElement: tag => new Element(tag), querySelector: selector => ({ scrollIntoView(options) { scrolls.push({ selector, options }); } }) },
    window: {
      location: { href: 'http://localhost/' + (requested ? '?work=' + requested : '') },
      matchMedia: () => ({ matches: false }),
      history: { replaceState() {} },
      get localStorage() { throw new Error('Shelf rendering and routing must not access saved data'); },
    },
    fetch: async path => {
      assert.equal(path, '/library.json');
      return { ok: true, json: async () => library };
    },
    performance: { setCatalog() {}, openPreset() { throw new Error('Direct work links must select the work'); } },
    renderDrafts() {}, openAcidModule() {},
    openDeck() { throw new Error('A work URL must not open a deck'); },
    async openPublished(item) {
      opened.push(item.id);
      context.setCurrentSelection({ kind: 'published', id: item.id, label: item.title, detail: item.label });
    },
  });
  runInContext([
    between('function setCurrentSelection(', 'async function openPublished('),
    between('function makeElement(', 'function renderDrafts('),
    between('async function loadCatalog()', "deckOpenButton.addEventListener('click'"),
  ].join('\n'), context);
  return { context, publishedList, opened, scrolls, render: () => context.renderPublished(), load: () => context.loadCatalog() };
}

test('a direct minimal link shows playback controls without changing other work landings', async () => {
  const minimal = harness(catalog, 'minimal-techno-01');
  await minimal.load();
  assert.deepEqual(minimal.opened, ['minimal-techno-01']);
  assert.equal(minimal.scrolls.length, 1);
  assert.equal(minimal.scrolls[0].selector, '.workspace');
  assert.deepEqual({ ...minimal.scrolls[0].options }, { behavior: 'auto', block: 'start' });
  for (const requested of ['', 'aphex1', 'afterimage-synth-v1', 'unknown-work']) {
    const h = harness(catalog, requested);
    await h.load();
    assert.equal(h.scrolls.length, 0, 'other work links keep their existing landing');
  }
});

const group = (h, id) => h.publishedList.children.find(section => section.dataset.shelfGroup === id);
const cardIds = section => section.querySelectorAll('[data-work-id]').map(button => button.dataset.workId);

test('the shelf retains the default and archive IDs, with one independent finite minimal work', () => {
  assert.equal(catalog.schema_version, 1);
  assert.equal(catalog.default_id, 'aphex1');
  assert.equal(catalog.items.length, 10);
  assert.deepEqual(catalog.items.filter(item => item.shelf === 'archive').map(item => item.id), archivedIds);
  assert.deepEqual(catalog.items.filter(item => item.shelf === 'minimal-techno').map(item => item.id), ['minimal-techno-01']);
  const minimal = catalog.items.find(item => item.id === 'minimal-techno-01');
  assert.equal(minimal.genre, 'ミニマルテクノ');
  assert.equal(minimal.playback, 'from-start');
  assert.equal(minimal.mixable, false);
  assert.match(minimal.description, /32小節で発音が終了/);
  assert.match(minimal.description, /内蔵音量60%/);
  for (const item of catalog.items) {
    assert.equal(item.path, '/patterns/' + item.id + '.txt');
    assert.equal(item.status, 'prototype');
    if (item.genre.endsWith('系')) assert.match(item.genre_note, /構成からの目安/);
  }
  assert.equal(catalog.items.find(item => item.id === 'techno-floor').genre, 'テクノ');
  assert.equal(catalog.items.find(item => item.id === 'techno-dub').genre, 'テクノ（ダブ寄り）');
  assert.equal(catalog.items.find(item => item.id === 'namima-test').genre, 'IDM');
});

test('production rendering visibly exposes regular, minimal and archive cards with metadata', () => {
  const h = harness(); h.render();
  assert.deepEqual(h.publishedList.children.map(section => section.dataset.shelfGroup), ['regular', 'minimal-techno', 'archive']);
  assert.equal(cardIds(group(h, 'regular')).length, 6);
  assert.deepEqual(cardIds(group(h, 'minimal-techno')), ['minimal-techno-01']);
  assert.deepEqual(cardIds(group(h, 'archive')), archivedIds);
  for (const section of h.publishedList.children) {
    assert.equal(section.hidden, false);
    assert.equal(section.tagName, 'section', 'archive is a visible section, not a collapsed detail');
    assert.ok(section.attributes.get('aria-labelledby'));
  }
  const cards = h.publishedList.querySelectorAll('[data-work-id]');
  assert.equal(cards.length, 10);
  for (const item of catalog.items) {
    const button = cards.find(card => card.dataset.workId === item.id);
    assert.equal(button.hidden, false);
    assert.equal(button.querySelectorAll('.card-label')[0].textContent, item.label + ' · ' + item.indexed_at);
    assert.equal(button.querySelectorAll('.card-description')[0].textContent, item.description);
    assert.equal(button.querySelectorAll('.card-genre')[0].textContent, 'ジャンル：' + item.genre);
    assert.equal(button.querySelectorAll('.card-status')[0].textContent, '試作');
    assert.equal(button.querySelectorAll('.card-genre-note').length, item.genre_note ? 1 : 0);
  }
});

test('archive and minimal clicks keep selection state across all nested groups and support re-selection', async () => {
  const h = harness(); h.render();
  const cards = h.publishedList.querySelectorAll('[data-work-id]');
  for (const id of [...archivedIds, 'minimal-techno-01', 'aphex1']) {
    const button = cards.find(card => card.dataset.workId === id);
    await button.click(); await button.click();
    assert.equal(h.context.activeSelection.id, id);
    assert.deepEqual(h.opened.slice(-2), [id, id]);
    for (const card of cards) assert.equal(card.attributes.get('aria-pressed'), String(card === button));
  }
});

test('production direct work routing resolves every archived ID and the minimal ID without filtering', async () => {
  for (const id of [...archivedIds, 'minimal-techno-01', 'aphex1']) {
    const h = harness(catalog, id); await h.load();
    assert.deepEqual(h.opened, [id]);
    assert.equal(h.context.activeSelection.id, id);
    const selected = h.publishedList.querySelectorAll('[data-work-id]').find(card => card.dataset.workId === id);
    assert.equal(selected.attributes.get('aria-pressed'), 'true');
  }
  const h = harness(catalog, 'unknown-old-link'); await h.load();
  assert.deepEqual(h.opened, ['aphex1']);
});

test('legacy schema1 items lacking new fields stay visible and selectable in the regular shelf', async () => {
  const legacy = { schema_version: 1, default_id: 'aphex1', items: catalog.items.slice(0, 9).map(item => {
    const { genre, genre_note, status, shelf, ...previous } = item;
    return previous;
  }) };
  const h = harness(legacy, 'aphex1-v1'); await h.load();
  assert.equal(cardIds(group(h, 'regular')).length, 9);
  assert.equal(cardIds(group(h, 'minimal-techno')).length, 0);
  assert.equal(cardIds(group(h, 'archive')).length, 0);
  assert.match(group(h, 'minimal-techno').textContent, /まだありません/);
  assert.equal(h.publishedList.querySelectorAll('.card-genre').length, 0);
  assert.equal(h.publishedList.querySelectorAll('.card-status').length, 0);
  assert.deepEqual(h.opened, ['aphex1-v1']);
  const unknown = structuredClone(legacy);
  unknown.items[0].shelf = 'future-category';
  const next = harness(unknown); next.render();
  assert.ok(cardIds(group(next, 'regular')).includes('aphex1'));
});

test('grouping preserves the eight existing A/B options including all archive works', () => {
  const h = harness(); h.context.renderDeckOptions();
  for (const select of [h.context.deckASelect, h.context.deckBSelect]) {
    assert.deepEqual(select.children.map(option => option.value), existingMixableIds);
    for (const id of archivedIds) assert.ok(select.children.some(option => option.value === id));
    assert.ok(!select.children.some(option => ['minimal-techno-01', 'afterimage-synth-v1'].includes(option.value)));
  }
  assert.equal(h.context.deckASelect.value, 'aphex1');
});
