import {
  defaultSet, readTechnoSet, sceneAtCycle, SET_MARKER, SET_PRESETS, SET_SCENES,
  SET_SLIDERS, SET_TRACKS, technoSetCode,
} from './performance-code.js';

const names = { kick: 'KICK', snare: 'SNARE', hh: 'CLOSED HAT', oh: 'OPEN HAT', bell: 'COWBELL', acid: '303' };
const scenes = { intro: '01 INTRO', groove: '02 GROOVE', acid: '03 ACID', break: '04 BREAK', peak: '05 PEAK' };
const noteChoices = ['~', 'g1', 'bb1', 'c2', 'd2', 'eb2', 'f2', 'g2', 'bb2', 'c3'];
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};

export function initPerformance(hooks) {
  const panel = document.querySelector('#performance');
  const fieldset = document.querySelector('#set-controls');
  const note = document.querySelector('#set-status');
  const bpm = document.querySelector('#set-bpm');
  const bank = document.querySelector('#set-bank');
  const auto = document.querySelector('#set-auto');
  const bar = document.querySelector('#set-position');
  const start = document.querySelector('#set-start');
  const sceneList = document.querySelector('#set-scenes');
  const stepList = document.querySelector('#set-step-rows');
  const acidNotes = document.querySelector('#set-acid-notes');
  const mixer = document.querySelector('#set-mixer');
  const presetList = document.querySelector('#set-presets');
  const open = document.querySelector('#performance-open');
  const layerSelects = [...panel.querySelectorAll('[data-set-layer]')];
  let catalog;
  let state;
  let cachedCode;
  let generation = 0;
  let loading = false;
  let view = false;
  const faders = new Map();
  const steps = new Map();
  const muteButtons = new Map();
  const sceneButtons = new Map();
  const noteButtons = [];

  function show(enabled = true) {
    view = enabled;
    panel.hidden = !enabled;
    document.body.classList.toggle('performance-view', enabled);
    open.setAttribute('aria-expanded', String(enabled));
    open.textContent = enabled ? '試作・別の303＋909を見る' : 'テクノ・ライブセットを開く';
  }

  function mutate(change) {
    const current = readTechnoSet(hooks.getCode());
    if (!current || loading || hooks.isBusy()) return;
    change(current);
    hooks.changeCode(technoSetCode(current));
    sync();
  }

  async function loadLayer(id) {
    const item = catalog?.items.find((entry) => entry.id === id);
    if (!item) throw new Error('試作が見つかりません');
    const response = await fetch(item.path, { cache: 'no-store' });
    if (!response.ok) throw new Error('素材コードを読み込めません');
    return { id: item.id, title: item.title, source: await response.text() };
  }

  async function openPreset(id = 'acid-drive') {
    if (!catalog || loading || hooks.isBusy()) return;
    loading = true;
    const token = ++generation;
    note.textContent = 'セットを準備中…';
    try {
      const layers = await Promise.all(['techno-dub', 'namima-test'].map(loadLayer));
      if (token !== generation) return;
      const initial = defaultSet(id, layers);
      if (await hooks.openCode(technoSetCode(initial), SET_PRESETS.find((p) => p.id === id)?.title || 'Techno Set')) {
        show();
        sync();
        panel.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    } catch (error) {
      note.textContent = error.message || 'セットを開けませんでした';
    } finally {
      loading = false;
      sync();
    }
  }

  for (const preset of SET_PRESETS) {
    const button = el('button', preset.title + ' · ' + preset.bpm);
    button.type = 'button';
    button.dataset.setPreset = preset.id;
    button.addEventListener('click', () => openPreset(preset.id));
    presetList.append(button);
  }
  for (const scene of SET_SCENES) {
    const button = el('button', scenes[scene]);
    button.type = 'button';
    button.addEventListener('click', () => mutate((next) => { next.scene = scene; next.auto = false; }));
    sceneButtons.set(scene, button);
    sceneList.append(button);
  }

  for (const track of SET_TRACKS.filter((key) => key !== 'acid')) {
    const row = el('div', '', 'set-step-row');
    row.append(el('span', names[track], 'set-row-title'));
    const buttons = [];
    for (let i = 0; i < 16; i++) {
      const button = el('button', String(i + 1), 'set-step');
      button.type = 'button';
      button.dataset.step = String(i);
      button.setAttribute('aria-label', names[track] + ' ステップ' + (i + 1));
      if (i % 4 === 0) button.classList.add('beat-start');
      button.addEventListener('click', () => mutate((next) => { next.steps[track][i] = !next.steps[track][i]; }));
      buttons.push(button);
      row.append(button);
    }
    steps.set(track, buttons);
    stepList.append(row);
  }
  for (let i = 0; i < 16; i++) {
    const button = el('button', '', 'set-note');
    button.type = 'button';
    button.dataset.step = String(i);
    button.addEventListener('click', (event) => mutate((next) => {
      next.notes[i] = event.shiftKey ? '~' : noteChoices[(noteChoices.indexOf(next.notes[i]) + 1) % noteChoices.length];
    }));
    noteButtons.push(button);
    acidNotes.append(button);
  }

  function addFader(key, target, vertical = false) {
    const [, title, value, min, max, step, suffix] = SET_SLIDERS.find((s) => s[0] === key);
    const label = el('label', '', vertical ? 'set-fader set-fader-vertical' : 'set-fader');
    const output = el('output');
    const input = el('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step; input.value = value;
    input.dataset.setFader = key;
    input.setAttribute('aria-label', title);
    label.append(el('span', title), output, input);
    input.addEventListener('input', () => {
      if (!readTechnoSet(hooks.getCode())) return;
      hooks.fader(key, Number(input.value), SET_SLIDERS.findIndex((s) => s[0] === key));
      // CodeMirror updates its document synchronously, widgets on the next frame.
      requestAnimationFrame(sync);
    });
    faders.set(key, { input, output, suffix });
    target.append(label);
  }

  addFader('MASTER', document.querySelector('#set-master'));
  for (const [key, track] of [['KICK', 'kick'], ['SNARE', 'snare'], ['HATS', 'hh'], ['BELL', 'bell'], ['ACID', 'acid']]) {
    const strip = el('div', '', 'set-channel');
    addFader(key, strip, true);
    const button = el('button', 'MUTE', 'set-mute');
    button.type = 'button';
    button.setAttribute('aria-label', names[track] + ' ミュート');
    button.addEventListener('click', () => mutate((next) => {
      const targets = track === 'hh' ? ['hh', 'oh'] : [track];
      const shouldMute = !next.muted.includes(track);
      next.muted = next.muted.filter((t) => !targets.includes(t));
      if (shouldMute) next.muted.push(...targets);
    }));
    muteButtons.set(track, button);
    strip.append(button);
    mixer.append(strip);
  }
  for (const key of ['CUTOFF', 'RESONANCE', 'DRIVE', 'DECAY']) addFader(key, document.querySelector('#set-acid-faders'), true);
  addFader('BOOM', document.querySelector('#set-boom'));
  for (const key of ['A', 'B', 'CROSS']) addFader(key, document.querySelector('#set-layer-faders'));

  layerSelects.forEach((select, index) => select.addEventListener('change', async () => {
    const id = select.value;
    const token = ++generation;
    loading = true;
    fieldset.disabled = true;
    try {
      const layer = await loadLayer(id);
      if (token !== generation) return;
      loading = false;
      mutate((next) => { next.layers[index] = layer; });
    } catch (error) { note.textContent = error.message || '素材を開けませんでした'; }
    finally { loading = false; sync(); }
  }));
  bpm.addEventListener('change', () => {
    const value = Number(bpm.value);
    if (!Number.isInteger(value) || value < 60 || value > 180) { sync(); return; }
    mutate((next) => { next.bpm = value; });
  });
  bank.addEventListener('change', () => mutate((next) => { next.bank = bank.value; }));
  auto.addEventListener('click', () => mutate((next) => { next.auto = !next.auto; }));
  start.addEventListener('click', () => hooks.isPlaying() ? hooks.stop() : hooks.play());
  document.querySelector('#set-stop').addEventListener('click', hooks.stop);
  document.querySelector('#set-save').addEventListener('click', hooks.save);
  document.querySelector('#set-library').addEventListener('click', () => {
    const visible = document.body.classList.toggle('set-library-visible');
    document.querySelector('#set-library').setAttribute('aria-expanded', String(visible));
    if (visible) document.querySelector('.library').scrollIntoView({ block: 'start' });
  });
  open.addEventListener('click', () => {
    if (view) show(false);
    else if (readTechnoSet(hooks.getCode())) { show(); sync(); }
    else openPreset();
  });

  function sync() {
    const code = hooks.getCode();
    if (code !== cachedCode) {
      cachedCode = code;
      state = readTechnoSet(code);
      if (!state && !code.includes(SET_MARKER) && view) show(false);
    }
    fieldset.disabled = !state || loading || hooks.isBusy();
    start.disabled = !state || loading || hooks.isBusy();
    presetList.querySelectorAll('button').forEach((button) => {
      button.disabled = !catalog || loading || hooks.isBusy();
      button.setAttribute('aria-pressed', String(state?.preset === button.dataset.setPreset));
    });
    if (!state) {
      for (const fader of faders.values()) fader.input.disabled = true;
      if (code.includes(SET_MARKER)) note.textContent = 'コードを直接編集した版です。セットの操作を戻す時は先に保存し、上のセットを選び直してください。';
      return;
    }
    bpm.value = state.bpm;
    bank.value = state.bank;
    auto.setAttribute('aria-pressed', String(state.auto));
    auto.textContent = state.auto ? 'AUTO 展開中 · 64小節' : 'AUTO 展開';
    for (const [key, fader] of faders) {
      fader.input.disabled = loading || hooks.isBusy();
      fader.input.value = state.values[key];
      fader.output.textContent = fader.suffix === '%' ? Math.round(state.values[key] * 100) + '%'
        : state.values[key] + fader.suffix;
    }
    for (const [track, buttons] of steps) buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(state.steps[track][i]));
    });
    noteButtons.forEach((button, i) => {
      button.textContent = (i + 1) + ' ' + state.notes[i].toUpperCase();
      button.setAttribute('aria-label', '303 ステップ' + (i + 1) + ' ' + state.notes[i] + '。押すと次の音、Shiftで休符');
      button.setAttribute('aria-pressed', String(state.notes[i] !== '~'));
    });
    for (const [track, button] of muteButtons) button.setAttribute('aria-pressed', String(state.muted.includes(track)));
    layerSelects.forEach((select, i) => { select.value = state.layers[i].id; });
    note.textContent = state.auto ? '8小節ごとにパートが入り替わります。ステップとフェーダーは演奏中も操作できます。'
      : 'ドラム・303・素材A/Bは同じテンポ。ステップとシーンは次の演奏処理から、フェーダーは次の音から反映。';
  }

  function position() {
    if (!view) return;
    const playing = hooks.isPlaying();
    start.textContent = playing ? '■ セットを止める' : '▶ セットを鳴らす';
    start.setAttribute('aria-pressed', String(playing));
    const cycle = playing ? Math.max(0, hooks.cycle()) : 0;
    const step = playing ? Math.floor((cycle % 1) * 16) : -1;
    bar.textContent = playing ? String(Math.floor(cycle) % 64 + 1).padStart(2, '0') + ' / 64 · ' + (Math.floor((cycle % 1) * 4) + 1) + '拍'
      : 'STOPPED · Spaceで開始/停止';
    const scene = state?.auto ? sceneAtCycle(cycle) : state?.scene;
    for (const [key, button] of sceneButtons) button.setAttribute('aria-pressed', String(key === scene));
    panel.querySelectorAll('[data-step]').forEach((button) => button.classList.toggle('is-current', Number(button.dataset.step) === step));
  }
  // Visual feedback uses the audio scheduler's cycle, never a second sound clock.
  const interval = setInterval(position, 80);
  window.addEventListener('pagehide', () => clearInterval(interval), { once: true });
  window.addEventListener('keydown', (event) => {
    if (!view || document.querySelector('#confirm-dialog').open || event.repeat) return;
    if (event.key === 'Escape') { event.preventDefault(); hooks.stop(); return; }
    if (event.target.closest('input,textarea,select,[contenteditable="true"],.cm-editor')) return;
    // Keep Space's normal button activation, but scene shortcuts still work
    // after clicking Play or a scene instead of requiring a background click.
    if (event.code === 'Space' && !event.target.closest('button')) { event.preventDefault(); start.click(); }
    const index = Number(event.key) - 1;
    if (index >= 0 && index < 5 && /^\d$/.test(event.key)) sceneButtons.get(SET_SCENES[index]).click();
  });

  return {
    show, sync, openPreset,
    setCatalog(next) {
      catalog = next;
      layerSelects.forEach((select) => {
        select.replaceChildren();
        for (const item of catalog.items) {
          const option = el('option', item.title); option.value = item.id; select.append(option);
        }
      });
      sync();
    },
  };
}
