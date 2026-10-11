import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { initPerformanceLayout } from '../src/performance-layout.js';

// Only the DOM operations used by the view controller; no audio or score mocks.
class Element {
  constructor(text = '') {
    this.textContent = text;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.open = false;
    const classes = new Set();
    this.classList = {
      contains: name => classes.has(name),
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
    };
  }
  get nextSibling() {
    return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] ?? null;
  }
  append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
  insertBefore(node, next) {
    if (next !== null) assert.ok(this.children.includes(next), 'restore anchor remains in original parent');
    if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
    this.children.splice(next === null ? this.children.length : this.children.indexOf(next), 0, node);
    node.parentNode = this;
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { this.listeners.get('click')?.(); }
  scrollIntoView() { this.scrolled = true; }
  focus() { this.focused = true; }
}
function setup() {
  const ui = Object.fromEntries(['body', 'detailButton', 'codeLink', 'listenButton', 'libraryButton',
    'library', 'draftDetails', 'feedback', 'draftForm', 'status'].map(key => [key, new Element()]));
  ui.libraryTitle = new Element('作品棚・ジャンルから選ぶ');
  ui.fullDetails = [new Element(), new Element()];
  const workspace = new Element();
  workspace.append(new Element('heading'), ui.draftForm, new Element('text node'), ui.status, new Element('editor'));
  const original = [...workspace.children];
  return { ui, workspace, original, layout: initPerformanceLayout(ui) };
}

test('LIVE moves the original save form and status out of the hidden editor and restores their order', () => {
  const { ui, workspace, original, layout } = setup();
  ui.draftForm.value = '未保存のタイトル';
  let saves = 0;
  ui.draftForm.addEventListener('submit', () => saves++);
  layout.show(true);
  assert.deepEqual(ui.feedback.children, [ui.draftForm, ui.status]);
  assert.equal(ui.libraryTitle.textContent, '保存版・バックアップ');
  ui.status.textContent = '保存できませんでした';
  const children = [...ui.feedback.children];
  layout.show(true);
  assert.deepEqual(ui.feedback.children, children, 'showing an already active set does not reparent inputs');
  ui.draftForm.listeners.get('submit')();
  assert.equal(saves, 1);
  layout.show(false);
  assert.deepEqual(workspace.children, original);
  assert.equal(ui.draftForm.value, '未保存のタイトル');
  assert.equal(ui.status.textContent, '保存できませんでした');
  assert.equal(ui.libraryTitle.textContent, '作品棚・ジャンルから選ぶ');
  layout.show(true);
  assert.deepEqual(ui.feedback.children, [ui.draftForm, ui.status]);
});

test('full controls open collapsed editors; returning to simple preserves a user-open detail', () => {
  const { ui, layout } = setup();
  ui.fullDetails[1].open = true;
  layout.show(true);
  assert.equal(ui.body.classList.contains('set-detailed-view'), false);
  ui.detailButton.click();
  assert.equal(ui.detailButton.attributes.get('aria-pressed'), 'true');
  assert.ok(ui.fullDetails.every(detail => detail.open));
  ui.detailButton.click();
  assert.equal(ui.body.classList.contains('set-detailed-view'), false);
  assert.equal(ui.fullDetails[0].open, false);
  assert.equal(ui.fullDetails[1].open, true);
});

test('code link exits listening and reveals the existing editor without invoking playback', () => {
  const { ui, layout } = setup();
  layout.show(true);
  ui.listenButton.click();
  assert.equal(ui.body.classList.contains('listening-view'), true);
  ui.codeLink.click();
  assert.equal(ui.body.classList.contains('listening-view'), false);
  assert.equal(ui.listenButton.attributes.get('aria-pressed'), 'false');
  assert.equal(ui.body.classList.contains('set-detailed-view'), true);
  assert.equal(ui.detailButton.textContent, 'シンプル表示へ');
});

test('saved versions open the existing draft list and reset on leaving LIVE', () => {
  const { ui, layout } = setup();
  layout.show(true);
  ui.listenButton.click();
  ui.libraryButton.click();
  assert.equal(ui.body.classList.contains('set-library-visible'), true);
  assert.equal(ui.body.classList.contains('listening-view'), false);
  assert.equal(ui.draftDetails.open, true);
  assert.equal(ui.library.scrolled, true);
  assert.equal(ui.libraryButton.attributes.get('aria-expanded'), 'true');
  ui.libraryButton.click();
  assert.equal(ui.libraryButton.attributes.get('aria-expanded'), 'false');
  ui.libraryButton.click();
  ui.listenButton.click();
  layout.show(false);
  assert.equal(ui.body.classList.contains('set-library-visible'), false);
  assert.equal(ui.body.classList.contains('listening-view'), false);
  assert.equal(ui.libraryButton.textContent, '保存版を開く');
  assert.equal(ui.listenButton.textContent, '聴くだけ');
});

test('save completion and cancellation return focus to a visible save control in either view', async () => {
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function focusSaveButton()'), app.indexOf("cancelDraftButton.addEventListener"));
  const body = new Element(), liveSave = new Element(), saveButton = new Element();
  const context = vm.createContext({ document: { body, querySelector: selector => {
    assert.equal(selector, '#set-save'); return liveSave;
  } }, saveButton });
  vm.runInContext(source, context);
  vm.runInContext('focusSaveButton()', context);
  assert.equal(saveButton.focused, true);
  body.classList.toggle('performance-view', true);
  vm.runInContext('focusSaveButton()', context);
  assert.equal(liveSave.focused, true);
  assert.match(app, /cancelDraftButton\.addEventListener\('click', \(\) => \{ draftForm\.hidden = true; focusSaveButton\(\); \}\)/);
  const save = app.slice(app.indexOf('function saveDraft('), app.indexOf('async function deleteDraft('));
  assert.match(save, /focusSaveButton\(\)/);
});

test('Space operates disclosure, link and button normally while background Space still toggles playback', async () => {
  const source = (await readFile(new URL('../src/performance.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const keyboard = source.slice(source.indexOf("  window.addEventListener('keydown'"), source.indexOf('\n\n  return {\n    show, sync'));
  let handler, plays = 0, stops = 0;
  vm.runInNewContext(keyboard, {
    window: { addEventListener: (name, listener) => { assert.equal(name, 'keydown'); handler = listener; } },
    document: { querySelector: () => ({ open: false }) }, view: true,
    hooks: { stop: () => stops++ }, start: { click: () => plays++ },
  });
  for (const tag of ['summary', 'a', 'button', 'input']) {
    handler({ key: ' ', code: 'Space', target: { closest: selectors => selectors.split(',').includes(tag) },
      preventDefault() { assert.fail('keep native keyboard activation for ' + tag); } });
  }
  assert.equal(plays, 0);
  let prevented = false;
  handler({ key: ' ', code: 'Space', target: { closest: () => null }, preventDefault() { prevented = true; } });
  assert.equal(plays, 1);
  assert.equal(prevented, true);
  handler({ key: 'Escape', preventDefault() {} });
  assert.equal(stops, 1);
});
