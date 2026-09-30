import {
  clampLevel, comparableCode, deckMixCode, managedSliderValue,
  replaceManagedSliderValue, singleWorkCode, upgradeLegacyDraftCode, SINGLE_LEVEL,
  DECK_A_LEVEL, DECK_B_LEVEL, DECK_XFADE,
} from './mix-code.js';
import { strudelBpm, withStrudelBpm } from './tempo-bridge.js';
import {
  BACKUP_KEYS, MAX_BACKUP_BYTES, backupText, mergeBackup, parseBackup,
  readBackupState, writeBackupState,
} from './session-backup.js';
import { initPwa } from './pwa.js';

const editorHost = document.querySelector('#editor');
const status = document.querySelector('#status');
const publishedList = document.querySelector('#published-list');
const draftList = document.querySelector('#draft-list');
const draftDetails = document.querySelector('#draft-details');
const draftCount = document.querySelector('#draft-count');
const currentWork = document.querySelector('#current-work');
const reloadButton = document.querySelector('#reload-pattern');
const saveButton = document.querySelector('#save-draft');
const draftForm = document.querySelector('#draft-form');
const draftTitle = document.querySelector('#draft-title');
const cancelDraftButton = document.querySelector('#cancel-draft');
const confirmDialog = document.querySelector('#confirm-dialog');
const confirmMessage = document.querySelector('#confirm-message');
const confirmAccept = document.querySelector('#confirm-accept');
const playButton = document.querySelector('#play');
const updateButton = document.querySelector('#update');
const stopButton = document.querySelector('#stop');
const acidFaderPanel = document.querySelector('#acid-faders');
const acidFaderHelp = document.querySelector('#acid-faders-help');
const acidFaders = [...acidFaderPanel.querySelectorAll('[data-acid-fader]')];
const singleLevelPanel = document.querySelector('#single-level-panel');
const singleLevelFader = document.querySelector('#single-level');
const singleLevelOutput = document.querySelector('#single-level-output');
const deckASelect = document.querySelector('#deck-a-select');
const deckBSelect = document.querySelector('#deck-b-select');
const deckOpenButton = document.querySelector('#deck-open');
const deckSwapButton = document.querySelector('#deck-swap');
const deckInfo = document.querySelector('#deck-info');
const deckFadersPanel = document.querySelector('#deck-faders');
const deckFaders = [...deckFadersPanel.querySelectorAll('[data-deck-fader]')];
const acidModuleOpen = document.querySelector('#acid-module-open');
const acidModuleClose = document.querySelector('#acid-module-close');
const acidModuleFull = document.querySelector('#acid-module-full');
const acidModuleCardFull = document.querySelector('#acid-module-card-full');
const acidModuleStage = document.querySelector('#acid-module-stage');
const acidModuleFrame = document.querySelector('#acid-module-frame');
const acidModuleStatus = document.querySelector('#acid-module-status');
const acidSavedList = document.querySelector('#acid-saved-list');
const acidPatchesRefresh = document.querySelector('#acid-patches-refresh');
const acidTempoToMachine = document.querySelector('#acid-tempo-to-machine');
const acidTempoToCode = document.querySelector('#acid-tempo-to-code');
const backupExport = document.querySelector('#backup-export');
const backupFile = document.querySelector('#backup-file');
const backupPreview = document.querySelector('#backup-preview');
const backupSummary = document.querySelector('#backup-summary');
const backupItems = document.querySelector('#backup-items');
const backupApply = document.querySelector('#backup-apply');
const backupCancel = document.querySelector('#backup-cancel');
const backupStatus = document.querySelector('#backup-status');
const ACID_FADER_KEYS = ['CUTOFF', 'RESONANCE', 'DRIVE', 'DECAY'];

const DRAFT_KEY = BACKUP_KEYS.drafts;
const LEVEL_KEY = BACKUP_KEYS.levels;
const DECK_KEY = BACKUP_KEYS.decks;
const MAX_CODE_LENGTH = 100_000;

let catalog;
let activeEditor;
let activeSelection;
let loadedCode = '';
let busy = false;
let wantsPlayback = false;
let playbackToken = 0;
let faderSyncQueued = false;
let acidBridgeReady = false;
let pendingAcidFileId = null;
let pendingBackup = null;
let backupReadToken = 0;

function savedAcidFiles() {
  try {
    const files = JSON.parse(window.localStorage.getItem('acidbros_files') || '[]');
    return Array.isArray(files) ? files.filter((file) =>
      file && typeof file.id === 'string' && typeof file.name === 'string'
      && Number.isFinite(file.modified)).sort((a, b) => b.modified - a.modified) : [];
  } catch { return []; }
}

function renderAcidFiles() {
  acidSavedList.replaceChildren();
  const files = savedAcidFiles();
  if (!files.length) {
    acidSavedList.append(makeElement('p', 'empty-note', '保存パッチはまだありません。中のFILE → SAVEで作れます。'));
    return;
  }
  let currentId = '';
  try { currentId = window.localStorage.getItem('acidbros_current_file') || ''; } catch { /* storage can be unavailable */ }
  for (const file of files) {
    const item = makeElement('div', 'acid-saved-item');
    const button = makeElement('button', 'acid-saved-file');
    button.type = 'button';
    button.append(makeElement('span', '', file.name), makeElement('small', '',
      new Date(file.modified).toLocaleString('ja-JP') + (file.id === currentId ? ' · 前回のFILE' : '')));
    button.addEventListener('click', async () => {
      if (!acidModuleStage.hidden && !await askConfirmation(
        'いまの303＋909を停止して「' + file.name + '」を開きます。中の未保存の変更は消えます。', '開く'
      )) return;
      if (acidModuleStage.hidden) openAcidModule({ fileId: file.id });
      else {
        pendingAcidFileId = file.id;
        sendAcidCommand({ type: 'load-file', fileId: file.id });
      }
    });
    const fullPage = makeElement('a', '', '全画面 ↗');
    fullPage.href = '/modules/acidbros/?file=' + encodeURIComponent(file.id);
    fullPage.target = '_blank';
    fullPage.rel = 'noopener';
    fullPage.addEventListener('click', openAcidFullPage);
    item.append(button, fullPage);
    acidSavedList.append(item);
  }
}

function syncAcidBridgeControls() {
  acidTempoToMachine.disabled = !acidBridgeReady || strudelBpm(currentCode()) === null;
  acidTempoToCode.disabled = !acidBridgeReady || !activeEditor?.editor;
}

function sendAcidCommand(command) {
  if (!acidBridgeReady || acidModuleStage.hidden) return;
  acidModuleFrame.contentWindow?.postMessage({ source: 'music-workbench-v1', ...command }, window.location.origin);
}

function setModuleUrl(open) {
  const url = new URL(window.location.href);
  if (open) url.searchParams.set('module', 'acidbros');
  else url.searchParams.delete('module');
  window.history.replaceState(null, '', url);
}

function closeAcidModule({ updateUrl = true, focus = false } = {}) {
  if (acidModuleStage.hidden) return;
  // Destroying the frame is the only reliable stop for this independent audio engine.
  acidModuleFrame.src = 'about:blank';
  acidBridgeReady = false;
  pendingAcidFileId = null;
  syncAcidBridgeControls();
  acidModuleStage.hidden = true;
  acidModuleOpen.setAttribute('aria-expanded', 'false');
  acidModuleOpen.textContent = 'この中で開く';
  acidModuleStatus.textContent = '停止しました。';
  if (updateUrl) setModuleUrl(false);
  if (focus) acidModuleOpen.focus();
}

function stopStrudelForModule() {
  playbackToken++;
  wantsPlayback = false;
  activeEditor?.editor?.stop();
  queueControlSync();
  status.textContent = 'Strudelを停止しました。acidBrosではRUNを押して演奏します。';
}

function openAcidModule({ updateUrl = true, scroll = true, fileId = null } = {}) {
  if (!acidModuleStage.hidden) return;
  stopStrudelForModule();
  pendingAcidFileId = fileId;
  renderAcidFiles();
  acidModuleStage.hidden = false;
  acidModuleOpen.setAttribute('aria-expanded', 'true');
  acidModuleOpen.textContent = '303＋909を閉じる';
  acidModuleStatus.textContent = '303＋909を読み込み中…';
  acidModuleFrame.src = '/modules/acidbros/';
  if (updateUrl) setModuleUrl(true);
  if (scroll) {
    const reveal = () => setTimeout(() => {
      if (!acidModuleStage.hidden) acidModuleStage.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 0);
    if (document.readyState === 'complete') reveal();
    else window.addEventListener('load', reveal, { once: true });
  }
}

acidModuleOpen.addEventListener('click', () => {
  if (acidModuleStage.hidden) openAcidModule();
  else closeAcidModule();
});
acidModuleClose.addEventListener('click', () => closeAcidModule({ focus: true }));
function openAcidFullPage() {
  stopStrudelForModule();
  closeAcidModule();
}
acidModuleFull.addEventListener('click', openAcidFullPage);
acidModuleCardFull.addEventListener('click', openAcidFullPage);
acidModuleFrame.addEventListener('load', () => {
  if (!acidModuleStage.hidden && !acidBridgeReady) acidModuleStatus.textContent = '画面を読み込みました。接続待ち…';
});
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.source !== acidModuleFrame.contentWindow
    || acidModuleStage.hidden || event.data?.source !== 'acidbros-bridge-v1') return;
  const message = event.data;
  if (message.type === 'ready') {
    acidBridgeReady = true;
    syncAcidBridgeControls();
    acidModuleStatus.textContent = '準備できました（' + message.bpm + ' BPM）。中のRUNを押すと音が出ます。';
    if (pendingAcidFileId) sendAcidCommand({ type: 'load-file', fileId: pendingAcidFileId });
  } else if (message.type === 'file-loaded') {
    pendingAcidFileId = null;
    renderAcidFiles();
    acidModuleStatus.textContent = '保存パッチを開きました（' + message.bpm + ' BPM）。RUNで再生できます。';
  } else if (message.type === 'tempo-set') {
    acidModuleStatus.textContent = '303＋909を' + message.bpm + ' BPMにしました。保存するなら中のFILE → SAVE。';
  } else if (message.type === 'tempo-read') {
    try {
      const updated = withStrudelBpm(currentCode(), message.bpm);
      activeEditor.editor.setCode(updated);
      closeAcidModule();
      status.textContent = '303＋909の' + message.bpm + ' BPMをStrudelコードへ反映しました。Playで確認し、残すなら「この端末に保存」。';
      document.querySelector('.workspace').scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (error) {
      acidModuleStatus.textContent = error.message || 'コードのテンポを変更できませんでした。';
    }
  } else if (message.type === 'error') {
    pendingAcidFileId = null;
    acidModuleStatus.textContent = message.message || 'パッチを読み込めませんでした。';
  }
});
acidPatchesRefresh.addEventListener('click', renderAcidFiles);
window.addEventListener('storage', (event) => {
  if (event.key === 'acidbros_files' || event.key === 'acidbros_current_file') renderAcidFiles();
});
acidTempoToMachine.addEventListener('click', () => {
  const bpm = strudelBpm(currentCode());
  if (bpm !== null) sendAcidCommand({ type: 'set-tempo', bpm });
});
acidTempoToCode.addEventListener('click', () => sendAcidCommand({ type: 'read-tempo' }));

function acidSliderDeclarations(code) {
  if (code.includes('DECK_MIX_V1') || !code.includes('ACID_FADER_BANK_V1')) return null;
  const declarations = ACID_FADER_KEYS.map((key) => {
    const expression = new RegExp('\\bconst\\s+' + key + '\\s*=\\s*slider\\(\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*\\)');
    const match = expression.exec(code);
    return match && { index: match.index, value: match[1], min: match[2], max: match[3], step: match[4] };
  });
  if (declarations.some((item) => !item) || declarations.some((item, index) => index && item.index <= declarations[index - 1].index)) return null;
  return declarations;
}

function inlineSliders() {
  return [...editorHost.querySelectorAll('.cm-slider input[type="range"]')];
}

function syncAcidFaders() {
  const declarations = acidSliderDeclarations(currentCode());
  acidFaderPanel.hidden = !declarations;
  if (!declarations) return;
  const offset = managedSliderValue(currentCode(), SINGLE_LEVEL) === null ? 0 : 1;
  const ready = wantsPlayback && inlineSliders().length >= offset + ACID_FADER_KEYS.length;
  acidFaderHelp.textContent = ready
    ? '演奏中。フェーダーを動かすと次の音から変わり、値はコードに残ります。'
    : 'Play後にフェーダーが有効になります。値はコードにも残ります。';
  acidFaders.forEach((fader, index) => {
    const setting = declarations[index];
    fader.min = setting.min;
    fader.max = setting.max;
    fader.step = setting.step;
    fader.value = setting.value;
    fader.disabled = !ready;
    const suffix = fader.dataset.acidFader === 'CUTOFF' ? ' Hz'
      : fader.dataset.acidFader === 'DECAY' ? ' s' : '';
    fader.parentElement.querySelector('output').textContent = fader.value + suffix;
  });
}

function queueControlSync() {
  if (faderSyncQueued) return;
  faderSyncQueued = true;
  requestAnimationFrame(() => {
    faderSyncQueued = false;
    syncAcidFaders();
    syncMixFaders();
    syncAcidBridgeControls();
  });
}

acidFaders.forEach((fader, index) => {
  fader.addEventListener('input', () => {
    if (!wantsPlayback || !acidSliderDeclarations(currentCode())) return;
    const offset = managedSliderValue(currentCode(), SINGLE_LEVEL) === null ? 0 : 1;
    const slider = inlineSliders()[offset + index];
    if (!slider) return;
    slider.value = fader.value;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    queueControlSync();
  });
});

function currentCode() {
  return activeEditor?.editor?.code || '';
}

function readStoredMap(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeStoredMap(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* still playable without storage */ }
}

function workLevelKey(selection) {
  return selection?.kind === 'published' || selection?.kind === 'draft'
    ? selection.kind + ':' + selection.id : null;
}

function savedWorkLevel(selection, fallback = 1) {
  const key = workLevelKey(selection);
  const saved = key && readStoredMap(LEVEL_KEY)[key];
  return saved === undefined ? fallback : clampLevel(saved);
}

function deckPairFromCode(code) {
  const match = /^\/\/ DECK_MIX_V1 ([a-z0-9-]+) \+ ([a-z0-9-]+)/m.exec(code);
  return match && { a: match[1], b: match[2] };
}

function savedDeckSettings(a, b) {
  const value = readStoredMap(DECK_KEY)[a + '|' + b];
  if (value && typeof value === 'object') {
    return { a: clampLevel(value.a), b: clampLevel(value.b), cross: clampLevel(value.cross) };
  }
  return {
    a: clampLevel(savedWorkLevel({ kind: 'published', id: a }) * 0.65),
    b: clampLevel(savedWorkLevel({ kind: 'published', id: b }) * 0.65),
    cross: 0.5,
  };
}

function persistManagedSettings() {
  const code = currentCode();
  const single = managedSliderValue(code, SINGLE_LEVEL);
  const workKey = workLevelKey(activeSelection);
  if (single !== null && workKey) {
    const map = readStoredMap(LEVEL_KEY);
    map[workKey] = single;
    writeStoredMap(LEVEL_KEY, map);
  }
  const pair = deckPairFromCode(code);
  if (pair) {
    const a = managedSliderValue(code, DECK_A_LEVEL);
    const b = managedSliderValue(code, DECK_B_LEVEL);
    const cross = managedSliderValue(code, DECK_XFADE);
    if (a !== null && b !== null && cross !== null) {
      const map = readStoredMap(DECK_KEY);
      map[pair.a + '|' + pair.b] = { a, b, cross };
      writeStoredMap(DECK_KEY, map);
    }
  }
}

function syncMixFaders() {
  const code = currentCode();
  const single = managedSliderValue(code, SINGLE_LEVEL);
  const isDeck = Boolean(deckPairFromCode(code));
  singleLevelPanel.hidden = isDeck || single === null;
  deckFadersPanel.hidden = !isDeck;
  if (single !== null && !isDeck) {
    singleLevelFader.value = single;
    singleLevelOutput.textContent = Math.round(single * 100) + '%';
    singleLevelFader.disabled = busy || (wantsPlayback && !inlineSliders()[0]);
  }
  if (isDeck) {
    const names = { a: DECK_A_LEVEL, b: DECK_B_LEVEL, cross: DECK_XFADE };
    const indices = { a: 0, b: 1, cross: 2 };
    for (const fader of deckFaders) {
      const key = fader.dataset.deckFader;
      const value = managedSliderValue(code, names[key]);
      fader.disabled = value === null || busy || (wantsPlayback && !inlineSliders()[indices[key]]);
      if (value !== null) {
        fader.value = value;
        fader.closest('label').querySelector('output').textContent = Math.round(value * 100) + '%';
      }
    }
  }
}

function applyManagedFader(name, value, sliderIndex) {
  if (!activeEditor?.editor || managedSliderValue(currentCode(), name) === null) return;
  if (wantsPlayback) {
    const slider = inlineSliders()[sliderIndex];
    if (!slider) return;
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    activeEditor.editor.setCode(replaceManagedSliderValue(currentCode(), name, value));
  }
  requestAnimationFrame(() => {
    persistManagedSettings();
    queueControlSync();
  });
}

singleLevelFader.addEventListener('input', () => applyManagedFader(SINGLE_LEVEL, singleLevelFader.value, 0));
const deckNameByFader = { a: DECK_A_LEVEL, b: DECK_B_LEVEL, cross: DECK_XFADE };
const deckIndexByFader = { a: 0, b: 1, cross: 2 };
deckFaders.forEach((fader) => fader.addEventListener('input', () => {
  const key = fader.dataset.deckFader;
  applyManagedFader(deckNameByFader[key], fader.value, deckIndexByFader[key]);
}));
editorHost.addEventListener('input', () => {
  queueControlSync();
  requestAnimationFrame(persistManagedSettings);
});

function hasUnsavedChanges() {
  return Boolean(activeSelection && comparableCode(currentCode()) !== comparableCode(loadedCode));
}

function askConfirmation(message, acceptLabel) {
  confirmMessage.textContent = message;
  confirmAccept.textContent = acceptLabel;
  confirmDialog.returnValue = '';
  return new Promise((resolve) => {
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'yes'), { once: true });
    confirmDialog.showModal();
  });
}

async function mayReplaceCode() {
  return !hasUnsavedChanges() || await askConfirmation(
    'いまの編集は保存されていません。切り替えると消えます。', '保存せず続ける'
  );
}

function setEditorCode(code) {
  if (!wantsPlayback) activeEditor?.editor?.stop();
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
  queueControlSync();
}

async function evaluateCurrent(message) {
  const token = ++playbackToken;
  try {
    await activeEditor.editor.evaluate();
    if (token !== playbackToken) {
      if (!wantsPlayback) activeEditor.editor.stop();
      return;
    }
    wantsPlayback = true;
    status.textContent = message;
    queueControlSync();
  } catch (error) {
    if (token !== playbackToken) return;
    wantsPlayback = false;
    activeEditor.editor.stop();
    queueControlSync();
    throw error;
  }
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
  url.searchParams.delete('deck');
  if (id) url.searchParams.set('work', id);
  else url.searchParams.delete('work');
  window.history.replaceState(null, '', url);
}

function setDeckUrl(a, b) {
  const url = new URL(window.location.href);
  url.searchParams.delete('work');
  url.searchParams.set('deck', a + ',' + b);
  window.history.replaceState(null, '', url);
}

async function openPublished(item) {
  if (busy) return;
  busy = true;
  try {
    if (!await mayReplaceCode()) return;
    draftForm.hidden = true;
    status.textContent = item.title + ' を読み込み中…';
    const response = await fetch(item.path, { cache: 'no-store' });
    if (!response.ok) throw new Error('コードの取得に失敗しました (' + response.status + ')');
    const pattern = await response.text();
    if (!pattern.trim()) throw new Error('保存済みのコードが空です');
    await customElements.whenDefined('strudel-editor');
    setEditorCode(singleWorkCode(pattern, savedWorkLevel({ kind: 'published', id: item.id })));
    setCurrentSelection({
      kind: 'published', id: item.id, label: item.title, detail: item.label,
    });
    deckASelect.value = item.id;
    if (deckBSelect.value === item.id) {
      deckBSelect.value = catalog.items.find((candidate) => candidate.id !== item.id)?.id || '';
    }
    setWorkUrl(item.id);
    const acidHint = item.id === 'acid-303-909'
      ? ' Play後に縦フェーダーで音を変えられます。'
      : item.id === 'acid-303-909-v1' ? ' コード冒頭の青いつまみで音を変えられます。' : '';
    if (wantsPlayback) {
      await evaluateCurrent('再生中。' + item.title + ' に切り替えました。' + acidHint);
    } else {
      status.textContent = 'コードを開きました。Play で聴けます。切り替えてもこの版は一覧に残ります。' + acidHint;
    }
  } catch (error) {
    status.textContent = error.message || '読み込みに失敗しました';
  } finally {
    busy = false;
    queueControlSync();
  }
}

async function openDeck(aId = deckASelect.value, bId = deckBSelect.value) {
  if (busy) return;
  busy = true;
  try {
    if (!await mayReplaceCode()) return;
    const a = catalog.items.find((item) => item.id === aId);
    const b = catalog.items.find((item) => item.id === bId);
    if (!a || !b) throw new Error('デッキの試作が見つかりません');
    if (a.id === b.id) throw new Error('AとBには別の試作を選んでください');
    status.textContent = '2つの試作を読み込み中…';
    const [aResponse, bResponse] = await Promise.all([
      fetch(a.path, { cache: 'no-store' }), fetch(b.path, { cache: 'no-store' }),
    ]);
    if (!aResponse.ok || !bResponse.ok) throw new Error('デッキのコードを取得できません');
    const [aSource, bSource] = await Promise.all([aResponse.text(), bResponse.text()]);
    await customElements.whenDefined('strudel-editor');
    const code = deckMixCode(
      { id: a.id, source: aSource }, { id: b.id, source: bSource }, savedDeckSettings(a.id, b.id),
    );
    setEditorCode(code);
    setCurrentSelection({ kind: 'deck', id: a.id + '+' + b.id,
      label: a.title + ' × ' + b.title, detail: '2デッキ同期ミックス' });
    deckASelect.value = a.id;
    deckBSelect.value = b.id;
    deckInfo.textContent = 'Aの' + (Number(aSource.match(/^setcpm\((\d+(?:\.\d+)?)\)/m)?.[1]) * 4)
      + ' BPMにBを同期。A/B音量と横フェーダーで混ぜます。';
    setDeckUrl(a.id, b.id);
    if (wantsPlayback) {
      await evaluateCurrent('再生中。' + a.title + ' × ' + b.title + ' を混ぜています。');
    } else {
      status.textContent = '2デッキを開きました。Playで一緒に再生します。';
    }
  } catch (error) {
    status.textContent = error.message || 'デッキを開けませんでした';
  } finally {
    busy = false;
    queueControlSync();
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
    button.addEventListener('click', async () => {
      await openPublished(item);
      if (activeSelection?.kind === 'published' && activeSelection.id === item.id) {
        document.querySelector('.workspace').scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    });
    publishedList.append(button);
  }
}

function renderDeckOptions() {
  for (const select of [deckASelect, deckBSelect]) {
    select.replaceChildren();
    for (const item of catalog.items) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.title;
      select.append(option);
    }
  }
  deckASelect.value = catalog.default_id;
  deckBSelect.value = catalog.items.find((item) => item.id !== catalog.default_id)?.id || '';
  deckOpenButton.disabled = false;
  deckSwapButton.disabled = false;
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
      makeElement('span', 'card-label', new Date(draft.savedAt).toLocaleString('ja-JP')
        + (draft.importedAt ? ' · 読み込んだ版・確認してPlay' : '')),
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
  if (busy) return;
  busy = true;
  try {
    if (!await mayReplaceCode()) return;
    draftForm.hidden = true;
    const draft = readDrafts().find((item) => item.id === id);
    if (!draft) throw new Error('下書きが見つかりません');
    await customElements.whenDefined('strudel-editor');
    if (draft.importedAt) {
      playbackToken++;
      wantsPlayback = false;
      activeEditor?.editor?.stop();
    }
    const draftCode = upgradeLegacyDraftCode(draft.code, savedWorkLevel({ kind: 'draft', id }));
    setEditorCode(replaceManagedSliderValue(
      draftCode, SINGLE_LEVEL, savedWorkLevel({ kind: 'draft', id }, managedSliderValue(draftCode, SINGLE_LEVEL) ?? 1),
    ));
    setCurrentSelection({
      kind: 'draft', id: draft.id, label: draft.title, detail: 'この端末の下書き',
    });
    setWorkUrl(null);
    const pair = deckPairFromCode(draft.code);
    if (pair && catalog.items.some((item) => item.id === pair.a)
        && catalog.items.some((item) => item.id === pair.b)) {
      deckASelect.value = pair.a;
      deckBSelect.value = pair.b;
      deckInfo.textContent = '保存した2デッキのコードを開いています。フェーダーで混ぜられます。';
    }
    if (wantsPlayback) {
      await evaluateCurrent('再生中。下書き「' + draft.title + '」に切り替えました。');
    } else {
      status.textContent = draft.importedAt
        ? '読み込んだ下書きを開きました。コードを確認してからPlayで聴けます。'
        : '下書きを開きました。Play で聴けます。';
    }
  } catch (error) {
    status.textContent = error.message || '下書きを開けませんでした';
  } finally {
    busy = false;
    queueControlSync();
  }
}

function backupCounts(state) {
  return '下書き ' + state.strudel.drafts.length + '件 · 303＋909 ' + state.acidbros.files.length
    + '件 · 音量／2デッキ設定 ' + (Object.keys(state.strudel.levels).length + Object.keys(state.strudel.decks).length) + '件';
}

function backupChanges(stats) {
  return '追加：下書き ' + stats.drafts + '件、303＋909 ' + stats.acidFiles + '件、設定 ' + stats.settings
    + '件。同じ保存版 ' + stats.duplicates + '件は追加しません。';
}

function clearBackupPreview() {
  backupReadToken++;
  pendingBackup = null;
  backupPreview.hidden = true;
  backupFile.value = '';
  backupApply.disabled = true;
}

backupExport.addEventListener('click', () => {
  try {
    const state = readBackupState(window.localStorage);
    const now = new Date().toISOString();
    const url = URL.createObjectURL(new Blob([backupText(state, now)], { type: 'application/json' }));
    const link = makeElement('a');
    link.href = url;
    link.download = 'music-workbench-' + now.slice(0, 19).replace(/:/g, '-') + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    backupStatus.textContent = '書き出しました。' + backupCounts(state) + '。ファイルを別の端末へ渡し、ここで読み込めます。'
      + (hasUnsavedChanges() ? ' いまの未保存のコード変更は含まれていません。' : '');
  } catch (error) {
    backupStatus.textContent = '書き出せませんでした。保存済みデータを確認してください。' + (error.message || '');
  }
});

backupFile.addEventListener('change', async () => {
  const token = ++backupReadToken;
  pendingBackup = null;
  backupPreview.hidden = true;
  backupApply.disabled = true;
  const file = backupFile.files?.[0];
  if (!file) return;
  backupStatus.textContent = 'ファイルの内容を確認中…';
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('8 MB以内のJSONを選んでください');
    const incoming = parseBackup(await file.text());
    if (token !== backupReadToken) return;
    const { stats } = mergeBackup(readBackupState(window.localStorage), incoming);
    pendingBackup = incoming;
    backupSummary.textContent = file.name + ' — ' + backupCounts(incoming);
    backupItems.replaceChildren();
    for (const draft of incoming.strudel.drafts) {
      backupItems.append(makeElement('li', '', 'コード：' + draft.title + ' · ' + new Date(draft.savedAt).toLocaleString('ja-JP')));
    }
    for (const patch of incoming.acidbros.files) {
      backupItems.append(makeElement('li', '', '303＋909：' + patch.name + ' · ' + new Date(patch.modified).toLocaleString('ja-JP')));
    }
    backupItems.hidden = backupItems.children.length === 0;
    backupPreview.hidden = false;
    backupApply.disabled = false;
    backupStatus.textContent = backupChanges(stats) + ' まだこの端末には保存していません。';
  } catch (error) {
    if (token !== backupReadToken) return;
    backupFile.value = '';
    backupStatus.textContent = '読み込めませんでした。' + (error.message || 'ファイルとこの端末の保存設定を確認してください。');
  }
});

backupApply.addEventListener('click', () => {
  if (!pendingBackup) return;
  try {
    // Re-read immediately before adding; preserve saves/settings made after preview.
    const { state, stats } = mergeBackup(readBackupState(window.localStorage), pendingBackup);
    writeBackupState(window.localStorage, state);
    clearBackupPreview();
    renderDrafts();
    renderAcidFiles();
    if (stats.drafts) draftDetails.open = true;
    backupStatus.textContent = backupChanges(stats)
      + ' 一覧から選んで再開できます。設定は作品・組み合わせを開き直すと反映されます。';
  } catch (error) {
    backupStatus.textContent = '追加できませんでした。ブラウザの空き容量や保存設定を確認してください。' + (error.message || '');
  }
});

backupCancel.addEventListener('click', () => {
  clearBackupPreview();
  backupStatus.textContent = '読み込みをキャンセルしました。';
  backupFile.focus();
});

function showDraftForm() {
  const code = currentCode();
  if (!code) return;
  if (code.length > MAX_CODE_LENGTH) {
    status.textContent = 'コードが長すぎて、この端末には保存できません。';
    return;
  }
  draftTitle.value = ((activeSelection?.label || '試作') + ' ' + new Date().toLocaleString('ja-JP')).slice(0, 80);
  draftForm.hidden = false;
  draftTitle.focus();
  draftTitle.select();
}

function saveDraft(event) {
  event.preventDefault();
  const title = draftTitle.value.trim();
  const code = currentCode();
  if (!title || !code) return;
  if (code.length > MAX_CODE_LENGTH) {
    status.textContent = 'コードが長すぎて、この端末には保存できません。';
    return;
  }
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
    draftForm.hidden = true;
    status.textContent = 'この端末に保存しました。下書き一覧からいつでもコードを戻せます。';
  } catch {
    status.textContent = '保存できませんでした。ブラウザの空き容量や保存設定を確認してください。';
  }
}

async function deleteDraft(id) {
  try {
    const drafts = readDrafts();
    const draft = drafts.find((item) => item.id === id);
    if (!draft || !await askConfirmation('「' + draft.title + '」をこの端末から削除しますか？', '削除する')) return;
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
    renderDeckOptions();
    renderDrafts();
    const params = new URL(window.location.href).searchParams;
    const deckRequested = params.get('deck')?.split(',');
    if (deckRequested?.length === 2 && deckRequested.every((id) => catalog.items.some((item) => item.id === id))) {
      await openDeck(deckRequested[0], deckRequested[1]);
      if (params.get('module') === 'acidbros') openAcidModule({ updateUrl: false });
      return;
    }
    const requested = params.get('work');
    const item = catalog.items.find((entry) => entry.id === requested)
      || catalog.items.find((entry) => entry.id === catalog.default_id);
    if (!item) throw new Error('開く試作がありません');
    await openPublished(item);
    if (params.get('module') === 'acidbros') openAcidModule({ updateUrl: false });
  } catch (error) {
    status.textContent = error.message || '試作一覧を読み込めませんでした';
  }
}

deckOpenButton.addEventListener('click', async () => {
  const expected = deckASelect.value + '+' + deckBSelect.value;
  await openDeck();
  if (activeSelection?.kind === 'deck' && activeSelection.id === expected) {
    document.querySelector('.workspace').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
});
deckSwapButton.addEventListener('click', () => {
  const oldA = deckASelect.value;
  deckASelect.value = deckBSelect.value;
  deckBSelect.value = oldA;
  deckInfo.textContent = 'AとBを入れ替えました。「組み合わせを開く」で反映します。';
});
reloadButton.addEventListener('click', () => {
  if (activeSelection?.kind === 'published') {
    const item = catalog.items.find((entry) => entry.id === activeSelection.id);
    if (item) openPublished(item);
  } else if (activeSelection?.kind === 'draft') {
    openDraft(activeSelection.id);
  }
});
saveButton.addEventListener('click', showDraftForm);
draftForm.addEventListener('submit', saveDraft);
cancelDraftButton.addEventListener('click', () => { draftForm.hidden = true; saveButton.focus(); });
playButton.addEventListener('click', async () => {
  if (busy || !activeEditor?.editor) return;
  closeAcidModule();
  busy = true;
  wantsPlayback = true;
  try {
    const acidHint = acidSliderDeclarations(currentCode())
      ? ' 画面の縦フェーダーで音を変えられます。' : '';
    await evaluateCurrent('再生中。別の試作を選ぶと演奏を切り替えられます。' + acidHint);
  } catch (error) {
    status.textContent = error.message || '再生に失敗しました';
  } finally {
    busy = false;
  }
});
updateButton.addEventListener('click', async () => {
  if (busy || !activeEditor?.editor) return;
  closeAcidModule();
  busy = true;
  wantsPlayback = true;
  try {
    await evaluateCurrent('現在のコードを反映しました。再生中です。');
  } catch (error) {
    status.textContent = error.message || 'コードの反映に失敗しました';
  } finally {
    busy = false;
  }
});
stopButton.addEventListener('click', () => {
  closeAcidModule();
  playbackToken++;
  wantsPlayback = false;
  activeEditor?.editor?.stop();
  status.textContent = '停止しました。';
  queueControlSync();
});
function warnUnsavedExit(event) {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
}
window.addEventListener('beforeunload', warnUnsavedExit);

renderAcidFiles();
loadCatalog();
initPwa({
  confirmReload: async () => {
    if (busy || confirmDialog.open) return false;
    const codeWarning = hasUnsavedChanges() ? ' 未保存のコードは消えます。先に「この端末に保存」で残せます。' : '';
    const acidWarning = !acidModuleStage.hidden ? ' 303＋909の調整は先にFILEで保存してください。' : '';
    if ((wantsPlayback || codeWarning || acidWarning) && !await askConfirmation(
      '演奏を止め、アプリを更新して開き直します。' + codeWarning + acidWarning, '更新して開き直す')) return false;
    closeAcidModule({ updateUrl: false });
    playbackToken++;
    wantsPlayback = false;
    activeEditor?.editor?.stop();
    queueControlSync();
    return true;
  },
  reload: () => {
    window.removeEventListener('beforeunload', warnUnsavedExit);
    window.location.reload();
  },
});
