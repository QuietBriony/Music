const editorHost = document.querySelector('#editor');
const status = document.querySelector('#status');
const publishedList = document.querySelector('#published-list');
const draftList = document.querySelector('#draft-list');
const draftDetails = document.querySelector('#draft-details');
const draftCount = document.querySelector('#draft-count');
const currentWork = document.querySelector('#current-work');
const reloadButton = document.querySelector('#reload-pattern');
const saveButton = document.querySelector('#save-draft');
const playButton = document.querySelector('#play');
const updateButton = document.querySelector('#update');
const stopButton = document.querySelector('#stop');

const DRAFT_KEY = 'music-workbench-drafts-v1';
const MAX_CODE_LENGTH = 100_000;
const samplePrelude = [
  'samples({',
  "  pad: '/api/sounds/pad',",
  "  sub: '/api/sounds/sub',",
  "  drums: '/api/sounds/drums',",
  '});',
].join('\n');

let catalog;
let activeEditor;
let activeSelection;
let loadedCode = '';
let busy = false;

function fullCode(pattern) {
  return samplePrelude + '\n\n' + pattern.replace(/\r\n?/g, '\n').trim() + '\n';
}

function currentCode() {
  return activeEditor?.editor?.code || '';
}

function hasUnsavedChanges() {
  return Boolean(activeSelection && currentCode() !== loadedCode);
}

function mayReplaceCode() {
  return !hasUnsavedChanges() || window.confirm(
    'いまの編集は保存されていません。切り替えると消えます。保存せずに続けますか？'
  );
}

function setEditorCode(code) {
  activeEditor?.editor?.stop();
  if (!activeEditor) {
    activeEditor = document.createElement('strudel-editor');
    activeEditor.setAttribute('code', code);
    editorHost.append(activeEditor);
  } else {
    activeEditor.editor.setCode(code);
  }
  activeEditor.editor?.setLineWrappingEnabled?.(true);
  // CodeMirror normalizes line endings. Compare with its actual document.
  loadedCode = activeEditor.editor?.code || code;
  playButton.disabled = false;
  updateButton.disabled = false;
  stopButton.disabled = false;
  saveButton.disabled = false;
  reloadButton.disabled = false;
}

function setCurrentSelection(selection) {
  activeSelection = selection;
  currentWork.textContent = selection.label + ' — ' + selection.detail;
  publishedList.querySelectorAll('[data-work-id]').forEach((button) => {
    button.setAttribute('aria-pressed', String(
      selection.kind === 'published' && button.dataset.workId === selection.id
    ));
  });
  draftList.querySelectorAll('[data-draft-id]').forEach((button) => {
    button.setAttribute('aria-pressed', String(
      selection.kind === 'draft' && button.dataset.draftId === selection.id
    ));
  });
}

function setWorkUrl(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('work', id);
  else url.searchParams.delete('work');
  window.history.replaceState(null, '', url);
}

async function openPublished(item) {
  if (busy || !mayReplaceCode()) return;
  busy = true;
  status.textContent = item.title + ' を読み込み中…';
  try {
    const response = await fetch(item.path, { cache: 'no-store' });
    if (!response.ok) throw new Error('コードの取得に失敗しました (' + response.status + ')');
    const pattern = await response.text();
    if (!pattern.trim()) throw new Error('保存済みのコードが空です');
    await customElements.whenDefined('strudel-editor');
    setEditorCode(fullCode(pattern));
    setCurrentSelection({
      kind: 'published', id: item.id, label: item.title, detail: item.label,
    });
    setWorkUrl(item.id);
    status.textContent = 'コードを開きました。Play で聴けます。切り替えてもこの版は一覧に残ります。';
  } catch (error) {
    status.textContent = error.message || '読み込みに失敗しました';
  } finally {
    busy = false;
  }
}

function readDrafts() {
  const stored = window.localStorage.getItem(DRAFT_KEY);
  if (!stored) return [];
  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error('下書き一覧を読めません');
  return parsed.filter((draft) =>
    draft && typeof draft.id === 'string' && typeof draft.title === 'string'
    && typeof draft.code === 'string' && typeof draft.savedAt === 'string'
  );
}

function writeDrafts(drafts) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderPublished() {
  publishedList.replaceChildren();
  for (const item of catalog.items) {
    const button = makeElement('button', 'pattern-card');
    button.type = 'button';
    button.dataset.workId = item.id;
    button.setAttribute('aria-pressed', 'false');
    button.append(
      makeElement('span', 'card-label', item.label + ' · ' + item.indexed_at),
      makeElement('strong', '', item.title),
      makeElement('span', 'card-description', item.description),
    );
    button.addEventListener('click', () => openPublished(item));
    publishedList.append(button);
  }
}

function renderDrafts() {
  draftList.replaceChildren();
  let drafts;
  try {
    drafts = readDrafts().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    draftCount.textContent = '読込不可';
    draftList.append(makeElement('p', 'empty-note', 'この端末の下書きは読めません。公開試作はそのまま使えます。'));
    return;
  }
  draftCount.textContent = drafts.length + '件';
  if (drafts.length === 0) {
    draftList.append(makeElement('p', 'empty-note', 'まだ下書きはありません。コードを直したら「この端末に保存」を押します。'));
    return;
  }
  for (const draft of drafts) {
    const row = makeElement('div', 'draft-row');
    const open = makeElement('button', 'draft-open');
    open.type = 'button';
    open.dataset.draftId = draft.id;
    open.setAttribute('aria-pressed', String(activeSelection?.kind === 'draft' && activeSelection.id === draft.id));
    open.append(
      makeElement('strong', '', draft.title),
      makeElement('span', 'card-label', new Date(draft.savedAt).toLocaleString('ja-JP')),
    );
    open.addEventListener('click', () => openDraft(draft.id));
    const remove = makeElement('button', 'draft-remove', '削除');
    remove.type = 'button';
    remove.setAttribute('aria-label', draft.title + ' を削除');
    remove.addEventListener('click', () => deleteDraft(draft.id));
    row.append(open, remove);
    draftList.append(row);
  }
}

async function openDraft(id) {
  if (busy || !mayReplaceCode()) return;
  try {
    const draft = readDrafts().find((item) => item.id === id);
    if (!draft) throw new Error('下書きが見つかりません');
    await customElements.whenDefined('strudel-editor');
    setEditorCode(draft.code);
    setCurrentSelection({
      kind: 'draft', id: draft.id, label: draft.title, detail: 'この端末の下書き',
    });
    setWorkUrl(null);
    status.textContent = '下書きを開きました。Play で聴けます。';
  } catch (error) {
    status.textContent = error.message || '下書きを開けませんでした';
  }
}

function saveDraft() {
  const code = currentCode();
  if (!code) return;
  if (code.length > MAX_CODE_LENGTH) {
    status.textContent = 'コードが長すぎて、この端末には保存できません。';
    return;
  }
  const suggested = (activeSelection?.label || '試作') + ' ' + new Date().toLocaleString('ja-JP');
  const title = window.prompt('下書きの名前', suggested)?.trim();
  if (!title) return;
  try {
    const draft = {
      id: window.crypto.randomUUID(),
      title: title.slice(0, 80),
      code,
      savedAt: new Date().toISOString(),
    };
    const drafts = readDrafts();
    drafts.unshift(draft);
    writeDrafts(drafts);
    loadedCode = code;
    setCurrentSelection({
      kind: 'draft', id: draft.id, label: draft.title, detail: 'この端末の下書き',
    });
    setWorkUrl(null);
    renderDrafts();
    draftDetails.open = true;
    status.textContent = 'この端末に保存しました。下書き一覧からいつでもコードを戻せます。';
  } catch {
    status.textContent = '保存できませんでした。ブラウザの空き容量や保存設定を確認してください。';
  }
}

function deleteDraft(id) {
  try {
    const drafts = readDrafts();
    const draft = drafts.find((item) => item.id === id);
    if (!draft || !window.confirm('「' + draft.title + '」をこの端末から削除しますか？')) return;
    writeDrafts(drafts.filter((item) => item.id !== id));
    if (activeSelection?.kind === 'draft' && activeSelection.id === id) {
      activeSelection = { kind: 'unsaved', label: '開いているコード', detail: '下書きは削除済み' };
      currentWork.textContent = activeSelection.label + ' — ' + activeSelection.detail;
      reloadButton.disabled = true;
    }
    renderDrafts();
    status.textContent = '下書きを削除しました。開いているコードはそのままです。';
  } catch {
    status.textContent = '下書きを削除できませんでした。';
  }
}

async function loadCatalog() {
  status.textContent = '試作一覧を読み込み中…';
  try {
    const response = await fetch('/library.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('試作一覧を取得できません (' + response.status + ')');
    catalog = await response.json();
    if (catalog.schema_version !== 1 || !Array.isArray(catalog.items)) {
      throw new Error('試作一覧の形式が合いません');
    }
    renderPublished();
    renderDrafts();
    const requested = new URL(window.location.href).searchParams.get('work');
    const item = catalog.items.find((entry) => entry.id === requested)
      || catalog.items.find((entry) => entry.id === catalog.default_id);
    if (!item) throw new Error('開く試作がありません');
    await openPublished(item);
  } catch (error) {
    status.textContent = error.message || '試作一覧を読み込めませんでした';
  }
}

reloadButton.addEventListener('click', () => {
  if (activeSelection?.kind === 'published') {
    const item = catalog.items.find((entry) => entry.id === activeSelection.id);
    if (item) openPublished(item);
  } else if (activeSelection?.kind === 'draft') {
    openDraft(activeSelection.id);
  }
});
saveButton.addEventListener('click', saveDraft);
playButton.addEventListener('click', async () => {
  if (!activeEditor?.editor) return;
  try {
    await activeEditor.editor.evaluate();
    status.textContent = '再生中。コードを変えた後は「コードを反映」で更新できます。';
  } catch (error) {
    status.textContent = error.message || '再生に失敗しました';
  }
});
updateButton.addEventListener('click', async () => {
  if (!activeEditor?.editor) return;
  try {
    await activeEditor.editor.evaluate();
    status.textContent = '現在のコードを反映しました。';
  } catch (error) {
    status.textContent = error.message || 'コードの反映に失敗しました';
  }
});
stopButton.addEventListener('click', () => {
  activeEditor?.editor?.stop();
  status.textContent = '停止しました。';
});
window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
});

loadCatalog();
