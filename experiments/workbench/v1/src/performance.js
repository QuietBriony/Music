import {
  defaultSet, readTechnoSet, sceneAtCycle, isSetCode, SET_PRESETS, SET_SCENES,
  SET_SLIDERS, SET_TRACKS, technoSetCode, EXTRA_DRUMS, groovePlan, upgradeSet,
  LIVE_MODES, liveFrame, liveMotif, setFromMix,
} from './live-code.js';
import { sliderSettings } from './slider-bridge.js';

const names = { kick: 'KICK', snare: 'SNARE', hh: 'CLOSED HAT', oh: 'OPEN HAT', bell: 'COWBELL', acid: '303',
  response:'303返し',percussion:'追加打楽器',pad:'パッド',...Object.fromEntries(EXTRA_DRUMS) };
const scenes = { intro: '01 INTRO', groove: '02 GROOVE', acid: '03 ACID', break: '04 BREAK', peak: '05 PEAK' };
const softScenes = { intro:'01 空気',groove:'02 重なる',acid:'03 広がる',break:'04 余白',peak:'05 光' };
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
  const groovePanel = document.querySelector('#set-evolution');
  const hold = document.querySelector('#set-hold');
  const variation = document.querySelector('#set-variation');
  const phrase = document.querySelector('#set-phrase');
  const kit = document.querySelector('#set-kit');
  const open = document.querySelector('#performance-open');
  const liveControls = document.querySelector('#set-live-controls');
  const liveMode = document.querySelector('#set-live-mode');
  const livePace = document.querySelector('#set-live-pace');
  const liveEnergy = document.querySelector('#set-live-energy');
  const liveLock = document.querySelector('#set-live-lock');
  const listenToggle = document.querySelector('#set-listen-toggle');
  for (const [id,title] of LIVE_MODES) { const option=el('option',title);option.value=id;liveMode.append(option); }
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
  const extraRows = new Map();

  function show(enabled = true) {
    view = enabled;
    panel.hidden = !enabled;
    document.body.classList.toggle('performance-view', enabled);
    open.setAttribute('aria-expanded', String(enabled));
    open.textContent = 'ライブセット';
    if (!enabled) { document.body.classList.remove('listening-view'); listenToggle.setAttribute('aria-pressed','false'); listenToggle.textContent='聴く画面'; }
    hooks.viewChanged?.();
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

  async function openMix(layers, settings, preservedCode) {
    if (!catalog || loading || hooks.isBusy()) return false;
    loading = true;
    try {
      const initial = setFromMix(layers, settings);
      if (!await hooks.openCode(technoSetCode(initial), layers.map(layer => layer.title).join(' × ') + ' · ライブセット', preservedCode)) return false;
      show();
      panel.scrollIntoView({ behavior: 'auto', block: 'start' });
      return true;
    } finally { loading = false; sync(); }
  }

  function enter() {
    if (isSetCode(hooks.getCode())) { hooks.closeMachine(); show(); sync(); panel.scrollIntoView({ block: 'start' }); }
    else return openPreset();
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
    button.addEventListener('click', () => mutate((next) => { next.scene = scene; next.auto = false; if (next.live) next.live.lock=null; }));
    sceneButtons.set(scene, button);
    sceneList.append(button);
  }

  for (const track of SET_TRACKS.filter((key) => !['acid','response','percussion','pad'].includes(key))) {
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
    if (EXTRA_DRUMS.some(([id]) => id===track)) extraRows.set(track,row);
  }
  for (const [id,title] of EXTRA_DRUMS) {
    const button=el('button',title); button.type='button'; button.dataset.kit=id;
    button.addEventListener('click',() => mutate(next => {
      const selected=next.groove.kit.includes(id);
      next.groove.kit=next.groove.kit.filter(key => key!==id);
      if (!selected) next.groove.kit.push(id);
    }));
    kit.append(button);
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
      if (!isSetCode(hooks.getCode())) return;
      hooks.fader(key, Number(input.value));
      // CodeMirror updates its document synchronously, widgets on the next frame.
      requestAnimationFrame(sync);
    });
    faders.set(key, { input, output, suffix });
    target.append(label);
  }

  addFader('MASTER', document.querySelector('#set-master'));
  for (const [key, track] of [['KICK', 'kick'], ['SNARE', 'snare'], ['HATS', 'hh'], ['BELL', 'bell'], ['ACID', 'acid'],['RESPONSE','response'],['PERC','percussion'],['AIR','pad']]) {
    const strip = el('div', '', 'set-channel');
    if (['response','percussion'].includes(track)) strip.dataset.grooveChannel='true';
    if (track === 'pad') strip.dataset.liveChannel='true';
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
  for (const key of ['SPACE','MOTION']) addFader(key, document.querySelector('#set-groove-faders'));
  hold.addEventListener('click',() => mutate(next => { next.groove.hold=!next.groove.hold; }));
  variation.addEventListener('change',() => mutate(next => { next.groove.variation=Number(variation.value); }));
  document.querySelector('#set-next-variation').addEventListener('click',() => mutate(next => {
    next.groove.seed=(next.groove.seed+1)>>>0 || 1; next.groove.hold=false;
  }));
  document.querySelector('#set-adopt-phrase').addEventListener('click',() => mutate(next => {
    const cycle=Math.max(0,hooks.cycle());
    next.groove.previousNotes=[...next.notes];
    next.notes=next.live ? liveMotif(next.notes,next.groove,liveFrame(next.live,next.groove.seed,cycle,next.auto,next.scene).chapter,cycle).notes
      : groovePlan(next).notes[Math.floor(cycle)%8];
    next.groove.hold=true;
  }));
  document.querySelector('#set-undo-phrase').addEventListener('click',() => mutate(next => {
    if (!next.groove.previousNotes) return;
    next.notes=[...next.groove.previousNotes]; next.groove.previousNotes=null; next.groove.hold=true;
  }));
  document.querySelector('#set-upgrade').addEventListener('click',() => mutate(next => { Object.assign(next,upgradeSet(next)); next.auto=true; }));
  liveMode.addEventListener('change',() => mutate(next => {
    next.live.mode=liveMode.value;
    next.live.pace={techno:8,dub:16,ambient:32}[liveMode.value];
    next.live.lock=null;
    if (liveMode.value==='ambient') { next.live.energy=.35; next.values.AIR=Math.max(.35,next.values.AIR); }
  }));
  livePace.addEventListener('change',() => mutate(next => { next.live.pace=Number(livePace.value); }));
  liveEnergy.addEventListener('change',() => mutate(next => { next.live.energy=Number(liveEnergy.value); }));
  liveLock.addEventListener('click',() => mutate(next => {
    next.live.lock=next.live.lock ? null : liveFrame(next.live,next.groove.seed,hooks.cycle(),next.auto,next.scene).section;
  }));
  listenToggle.addEventListener('click',() => {
    const listening=document.body.classList.toggle('listening-view');
    listenToggle.setAttribute('aria-pressed',String(listening));
    listenToggle.textContent=listening?'操作に戻る':'聴く画面';
    if (listening) panel.scrollIntoView({block:'start'});
  });

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
  open.addEventListener('click', enter);

  function sync() {
    const code = hooks.getCode();
    if (code !== cachedCode) {
      cachedCode = code;
      state = readTechnoSet(code);
      if (!state && !isSetCode(code) && view) show(false);
    }
    const blocked = loading || hooks.isBusy();
    const setCode = isSetCode(code);
    // Structural buttons still require an intact generated score. A named
    // fader can safely patch its literal even when the musical body was edited.
    fieldset.disabled = !setCode || blocked;
    fieldset.querySelectorAll('button,input:not([data-set-fader]),select').forEach(control => {
      control.disabled = !state || blocked;
    });
    groovePanel.disabled = !state || blocked;
    groovePanel.hidden = !state?.groove;
    document.querySelector('#set-upgrade').hidden = !state || Boolean(state.live);
    document.querySelector('#set-legacy-hint').hidden = !state || Boolean(state.live);
    liveControls.hidden=!state?.live;
    phrase.hidden = !state?.groove;
    start.disabled = !setCode || blocked;
    presetList.querySelectorAll('button').forEach((button) => {
      button.disabled = !catalog || loading || hooks.isBusy();
      button.setAttribute('aria-pressed', String(state?.preset === button.dataset.setPreset));
    });
    const settings = setCode ? sliderSettings(code, [...faders.keys()].map(key => 'SET_' + key)) : new Map();
    for (const [key, fader] of faders) {
      const setting = settings.get('SET_' + key);
      fader.input.disabled = !setting || blocked;
      if (!setting) { fader.output.textContent = '—'; continue; }
      Object.assign(fader.input, { min: setting.min, max: setting.max, step: setting.step, value: setting.value });
      fader.output.textContent = fader.suffix === '%' ? Math.round(Number(setting.value) * 100) + '%'
        : setting.value + fader.suffix;
    }
    if (!state) {
      if (setCode) note.textContent = 'コードを手直しした版です。音量・音色の接続が残るフェーダーは使えます。コードの変更は「コードを反映」。打点・展開ボタンを戻す時は先に保存し、セットを選び直してください。';
      return;
    }
    document.querySelector('#set-kit-details').hidden=!state.groove;
    document.querySelector('#set-synth-details').hidden=!state.groove;
    mixer.style.setProperty('--set-channel-count',state.live?'8':state.groove?'7':'5');
    mixer.querySelectorAll('[data-groove-channel]').forEach(n => { n.hidden=!state.groove; });
    mixer.querySelectorAll('[data-live-channel]').forEach(n => { n.hidden=!state.live; });
    extraRows.forEach((row,id) => { row.hidden=!state.groove?.kit.includes(id); });
    if (state.groove) {
      hold.setAttribute('aria-pressed',String(state.groove.hold));
      hold.textContent=state.groove.hold?'音符固定中':'音符を固定';
      variation.value=state.groove.variation;
      document.querySelector('#set-undo-phrase').disabled=!state.groove.previousNotes;
      kit.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(state.groove.kit.includes(button.dataset.kit))));
    }
    bpm.value = state.bpm;
    bank.value = state.bank;
    auto.setAttribute('aria-pressed', String(state.auto));
    auto.textContent = state.live ? state.auto?'LIVE 自動展開中':'LIVE 自動展開' : state.auto ? 'AUTO 展開中 · 64小節' : 'AUTO 展開';
    if (state.live) {
      liveMode.value=state.live.mode; livePace.value=state.live.pace; liveEnergy.value=state.live.energy;
      liveLock.disabled=!state.auto;
      liveLock.setAttribute('aria-pressed',String(Boolean(state.live.lock)));
      liveLock.textContent=state.live.lock?'キープ中 · 流れに戻す':'今の展開をキープ';
    }
    for (const [track, buttons] of steps) buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(Boolean(state.steps[track]?.[i])));
    });
    noteButtons.forEach((button, i) => {
      button.textContent = (i + 1) + ' ' + state.notes[i].toUpperCase();
      button.setAttribute('aria-label', '303 ステップ' + (i + 1) + ' ' + state.notes[i] + '。押すと次の音、Shiftで休符');
      button.setAttribute('aria-pressed', String(state.notes[i] !== '~'));
    });
    for (const [track, button] of muteButtons) button.setAttribute('aria-pressed', String(state.muted.includes(track)));
    layerSelects.forEach((select, i) => { select.value = state.layers[i].id; });
    document.querySelector('#set-layer-summary').textContent = state.layers.map((layer, i) =>
      (i ? 'B：' : 'A：') + layer.title).join(' / ') + ' · ' + state.bpm + ' BPMで一緒に鳴ります。';
    document.querySelector('#set-title').textContent=state.live?.mode==='ambient'?'漂う。重なる。ゆっくり移る。':'鳴らす。抜く。みょんを上げる。';
    document.querySelector('#set-acid-title').textContent = state.layerGain === 1 ? '追加の303風 · LIVE FADERS' : '303風 · LIVE FADERS';
    document.querySelector('#set-mixer-title').textContent = state.layerGain === 1 ? '追加パートを出し入れ' : 'パートを出し入れ';
    note.textContent = state.live ? state.live.mode==='ambient'?'長い和音と柔らかい音色でゆっくり移ります。自動のドラムは入りません。素材A/Bは手動音量を優先。'
      : state.auto?'軸は8小節で帰還。章ごとに小変奏と抜き差しが変わり、音色はゆっくりつながります。手動MUTEを優先。':'手動シーンで演奏中。LIVEを押すと自動の流れへ戻ります。'
      : state.auto ? (state.groove?'軸の音符を4小節反復→小変奏→8小節で帰還。パートは8小節ごとに出し入れ。':'旧版：8小節ごとにパートが入り替わります。')
      : 'ドラム・303・素材A/Bは同じテンポ。ステップとシーンは次の演奏処理から、フェーダーは次の音から反映。';
    if (state.layerGain === 1) {
      document.querySelector('#set-title').textContent = 'A/Bに楽器を足す。';
      note.textContent = SET_TRACKS.every(track => state.muted.includes(track))
        ? 'A/Bのコードと混ぜ具合を引き継ぎました。追加のドラム・303・パッドはミュート中。ミキサーのMUTEを解除すると同じテンポで足せます。'
        : 'A/Bに楽器を重ねています。LIVEは追加パートを展開します。素材A/Bのフレーズと音量はそのままで、手動で混ぜられます。';
    }
  }

  const stepIndicators = [...panel.querySelectorAll('[data-step]')];
  let highlightedStep = -2;
  function position() {
    if (!view || document.hidden) return;
    const playing = hooks.isPlaying();
    start.textContent = playing ? '■ セットを止める' : '▶ セットを鳴らす';
    start.setAttribute('aria-pressed', String(playing));
    const cycle = playing ? Math.max(0, hooks.cycle()) : 0;
    const step = playing ? Math.floor((cycle % 1) * 16) : -1;
    const frame=state?.live ? liveFrame(state.live,state.groove.seed,cycle,state.auto,state.scene) : null;
    const length=frame ? frame.span*8 : 64;
    bar.textContent = playing ? (frame?'第'+(frame.chapter+1)+'章 · ':'') + String(Math.floor(cycle) % length + 1).padStart(2, '0') + ' / '+length+' · ' + (Math.floor((cycle % 1) * 4) + 1) + '拍'
      : 'STOPPED · Spaceで開始/停止';
    const scene = frame?.section || (state?.auto ? sceneAtCycle(cycle) : state?.scene);
    if (state?.groove) phrase.textContent=state.groove.hold || !state.groove.variation ? '音符固定 · 軸を反復'
      : Math.floor(cycle)%8 < 4 ? '軸を反復 · 1〜4小節' : '小変奏 · 5〜8小節 → 軸に帰還';
    const labels=state?.live?.mode==='ambient'?softScenes:scenes;
    for (const [key, button] of sceneButtons) { button.setAttribute('aria-pressed', String(key === scene)); button.textContent=labels[key]; }
    document.querySelector('#set-listen-title').textContent=(state?.live ? LIVE_MODES.find(([id]) => id===state.live.mode)?.[1] : 'セット') || 'LIVE';
    document.querySelector('#set-listen-phase').textContent=playing ? (labels[scene] || '') + (state?.live?.lock?' · キープ':frame?' · あと'+Math.ceil(frame.remaining)+'小節':'') : '再生を押すと始まります';
    document.querySelector('#set-listen-progress').value=frame?.position || 0;
    if (!document.body.classList.contains('listening-view') && step !== highlightedStep) {
      highlightedStep = step;
      stepIndicators.forEach(button => button.classList.toggle('is-current', Number(button.dataset.step) === step));
    }
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
    show, sync, openPreset, openMix, enter,
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
