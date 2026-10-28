import { LESSONS, lessonNotes, noteName, frequencyFor, detectPitch, NoteFollower } from './music.mjs?v=2';

const $ = id => document.getElementById(id);
const STORAGE = 'music-practice-settings-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch { /* Private mode / unavailable storage is fine. */ }
let instrument = saved.instrument === 'sanshin' ? 'sanshin' : 'guitar';
let lessonId = LESSONS[instrument].some(item => item.id === saved.lesson) ? saved.lesson : 'open';
let transpose = [0, -1, -2, -3, 2].includes(saved.transpose) ? saved.transpose : 0;
let gate = [0.003, 0.006, 0.014].includes(saved.gate) ? saved.gate : 0.006;
let notes, follower, mode = 'idle', rounds = 0, matchedCount = 0;
let context = null, micStream = null, analyser = null, source = null, silent = null;
let epoch = 0, meterTimer = null, demoTimer = null, suppressUntil = 0, flashUntil = 0, demoIndex = -1;
const voices = new Set();
const feedback = text => { if ($('feedback').textContent !== text) $('feedback').textContent = text; };
function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify({ instrument, lesson: lessonId, transpose, gate })); } catch { /* Storage is optional. */ }
}
function bounds() { return $('loop-enabled').checked ? [Number($('loop-start').value), Number($('loop-end').value) + 1] : [0, notes.length]; }
function newFollower(index) {
  const [start, end] = bounds();
  follower = new NoteFollower(notes, { start, end, gate });
  if (Number.isInteger(index) && index >= start && index < end) follower.reset(index);
}
function stopVoices() {
  for (const voice of voices) { try { voice.stop(); voice.disconnect(); } catch { /* Already ended. */ } }
  voices.clear();
}
function stopAll() {
  epoch++;
  clearInterval(meterTimer); clearTimeout(demoTimer); meterTimer = demoTimer = null;
  if (micStream) micStream.getTracks().forEach(track => track.stop());
  micStream = null;
  for (const node of [source, analyser, silent]) { try { node?.disconnect(); } catch { /* Disconnected. */ } }
  source = analyser = silent = null;
  stopVoices();
  const oldContext = context; context = null;
  if (oldContext && oldContext.state !== 'closed') oldContext.close().catch(() => {});
  mode = 'idle'; demoIndex = -1; $('stop').disabled = true;
  $('mic-start').disabled = $('touch-start').disabled = false;
  $('input-label').textContent = '停止中'; $('demo').textContent = '♪ ガイドに合わせて弾く';
  $('level').style.width = '0%'; $('heard').textContent = '—'; $('cents').textContent = '—'; $('needle').style.left = '50%';
  $('touch-panel').hidden = true;
}
async function audio() {
  if (!context || context.state === 'closed') {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('このブラウザは音声機能に対応していません。');
    context = new Audio({ latencyHint: 'interactive' });
  }
  const active = context;
  await active.resume();
  return active;
}
async function tone(midi, duration = 0.55) {
  const ticket = epoch;
  const ctx = await audio();
  if (ticket !== epoch || ctx.state === 'closed') return;
  const oscillator = ctx.createOscillator(), gain = ctx.createGain();
  const real = new Float32Array(5), imaginary = new Float32Array([0, 1, 0.25, 0.1, 0.04]);
  oscillator.setPeriodicWave(ctx.createPeriodicWave(real, imaginary));
  oscillator.frequency.value = frequencyFor(midi);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(ctx.destination);
  voices.add(oscillator);
  oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(now); oscillator.stop(now + duration + 0.015);
}
function noteLabel(note) {
  return instrument === 'sanshin' ? `${note.symbol}・${note.position}・${noteName(note.midi)}` : `${note.string}弦・${note.fret === 0 ? '開放弦' : `${note.fret}フレット`}・${noteName(note.midi)}`;
}
function renderScore() {
  const current = follower.done ? -1 : follower.index;
  const [start, end] = bounds();
  const classes = index => `${index === current ? ' current' : ''}${index < follower.index ? ' passed' : ''}${index < start || index >= end ? ' outside' : ''}${index === demoIndex ? ' preview' : ''}`;
  if (instrument === 'sanshin') {
    $('score').innerHTML = `<div class="kunkun">${notes.map((n, i) => `<button class="${classes(i)}" data-index="${i}" aria-label="${i + 1}音目、${noteLabel(n)}"${i === current ? ' aria-current="step"' : ''}>${n.symbol}<small>${i + 1}</small></button>`).join('')}</div>`;
  } else {
    let html = '';
    for (let block = 0; block < notes.length; block += 6) {
      html += '<div class="tab-block"><div style="display:grid;grid-template-rows:repeat(6,27px)">' + ['e', 'B', 'G', 'D', 'A', 'E'].map(n => `<span class="tab-label">${n}</span>`).join('') + '</div>';
      for (let column = block; column < block + 6; column++) {
        const n = notes[column];
        const strings = [1, 2, 3, 4, 5, 6].map(s => `<span>${n?.string === s ? `<em>${n.fret}</em>` : ''}</span>`).join('');
        html += n ? `<button class="tab-column${classes(column)}" data-index="${column}" aria-label="${column + 1}音目、${noteLabel(n)}"${column === current ? ' aria-current="step"' : ''}>${strings}</button>` : `<div class="tab-column" aria-hidden="true">${strings}</div>`;
      }
      html += '</div>';
    }
    $('score').innerHTML = html;
  }
}
function render() {
  const n = notes[Math.min(follower.index, follower.end - 1)];
  $('target').classList.toggle('kanji', instrument === 'sanshin');
  $('target-main').textContent = follower.done ? '✓' : instrument === 'sanshin' ? n.symbol : n.fret;
  $('target-name').textContent = follower.done ? 'できました' : noteName(n.midi);
  $('position').textContent = follower.done ? `${matchedCount}音、弾けました。` : instrument === 'sanshin' ? n.position : `${n.string}弦 / ${n.fret === 0 ? '開放弦' : `${n.fret}フレット`}`;
  $('progress-text').textContent = `${follower.done ? follower.end : follower.index + 1} / ${notes.length}${rounds ? ` · ${rounds}周` : ''}`;
  $('progress').max = follower.end - follower.start; $('progress').value = follower.index - follower.start;
  $('reference').disabled = follower.done;
  renderScore();
}
function setup() {
  stopAll();
  notes = lessonNotes(instrument, lessonId, transpose);
  $('guitar').setAttribute('aria-pressed', String(instrument === 'guitar'));
  $('sanshin').setAttribute('aria-pressed', String(instrument === 'sanshin'));
  $('lesson').innerHTML = LESSONS[instrument].map(l => `<option value="${l.id}">${l.title}</option>`).join('');
  $('lesson').value = lessonId; $('tuning').value = transpose; $('sensitivity').value = gate;
  $('tuning-label').hidden = instrument !== 'sanshin';
  $('lesson-detail').textContent = LESSONS[instrument].find(l => l.id === lessonId).detail;
  $('score-heading').textContent = instrument === 'sanshin' ? '工工四' : 'TAB譜';
  $('score-help').textContent = instrument === 'sanshin' ? '右の列から下へ。文字を押すと、その位置から練習できます。' : '数字はフレット。0は開放弦。音符を押すと、その位置から練習できます。';
  for (const id of ['loop-start', 'loop-end']) $(id).innerHTML = notes.map((n, i) => `<option value="${i}">${i + 1}</option>`).join('');
  $('loop-end').value = notes.length - 1;
  rounds = matchedCount = 0; newFollower();
  const unique = [...new Map(notes.map(n => [`${n.string}-${n.fret}`, n])).values()];
  $('touch-keys').innerHTML = unique.map((n, i) => `<button data-key="${i}" aria-label="${noteLabel(n)}">${instrument === 'sanshin' ? n.symbol : noteName(n.midi)}<small>${instrument === 'sanshin' ? noteName(n.midi) : `${n.string}弦 / ${n.fret}`}</small></button>`).join('');
  $('touch-keys').onclick = event => {
    const button = event.target.closest('[data-key]');
    if (!button || mode !== 'touch') return;
    const played = unique[Number(button.dataset.key)];
    tone(played.midi).catch(error => feedback(error.message));
    if (played.midi === notes[follower.index]?.midi) advance(follower.accept(performance.now()));
    else feedback('もう一度。大きく表示されている音を選んでみましょう。');
  };
  $('input-label').textContent = '準備できたら始めましょう';
  feedback('マイクか画面を選んで始めましょう。'); save(); render();
}
function advance(result) {
  if (!result.matched) return;
  matchedCount++; flashUntil = performance.now() + 300;
  if (result.done && $('loop-enabled').checked) {
    rounds++;
    const previous = follower;
    newFollower();
    // Preserve the preceding attack across a loop boundary, including repeated notes.
    follower.lastMidi = previous.lastMidi; follower.acceptedAt = previous.acceptedAt; follower.armed = false; follower.lastRms = previous.lastRms;
    feedback(`弾けました。${rounds + 1}周目へ。`);
  } else if (result.done) {
    const finishedMode = mode;
    stopAll();
    $('input-label').textContent = finishedMode === 'touch' ? '画面での練習が完了' : 'マイクでの練習が完了';
    feedback('できました！ もう一度始めるか、次の練習を選びましょう。');
  } else feedback('弾けました。次の音へ。');
  render();
}
async function startMic() {
  stopAll();
  if (follower.done) { matchedCount = rounds = 0; newFollower(); }
  follower.candidateAt = null; follower.lastRms = 0; follower.armed = true;
  const ticket = epoch;
  mode = 'pending'; $('stop').disabled = false; $('mic-start').disabled = $('touch-start').disabled = true;
  $('input-label').textContent = 'マイクの許可を待っています'; feedback('マイクの使用を許可してください。'); render();
  let acquired = null;
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('マイクはHTTPSのページかlocalhostで使えます。「画面で試す」も利用できます。');
    const ctx = await audio();
    if (ticket !== epoch) return;
    acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    if (ticket !== epoch) { acquired.getTracks().forEach(track => track.stop()); return; }
    micStream = acquired; source = ctx.createMediaStreamSource(acquired);
    analyser = ctx.createAnalyser(); analyser.fftSize = 4096;
    silent = ctx.createGain(); silent.gain.value = 0;
    source.connect(analyser); analyser.connect(silent).connect(ctx.destination);
    for (const track of acquired.getTracks()) track.addEventListener('ended', () => { if (micStream === acquired) { stopAll(); render(); feedback('マイクが切断されました。もう一度始めてください。'); } });
    mode = 'mic'; $('input-label').textContent = 'マイクで聴いています'; $('mic-start').disabled = false; $('touch-start').disabled = false;
    feedback('大きく表示されている音を、一音ずつ弾いてください。');
    const buffer = new Float32Array(analyser.fftSize);
    meterTimer = setInterval(() => {
      if (mode !== 'mic' || !analyser) return;
      analyser.getFloatTimeDomainData(buffer);
      const now = performance.now(), detection = detectPitch(buffer, ctx.sampleRate, gate);
      $('level').style.width = `${Math.min(100, detection.rms * 700)}%`;
      if (now < suppressUntil) return;
      $('heard').textContent = detection.frequency ? noteName(Math.round(69 + 12 * Math.log2(detection.frequency / 440))) : '—';
      const result = follower.feed(detection, now);
      $('cents').textContent = Number.isFinite(result.cents) ? `${result.cents > 0 ? '+' : ''}${Math.round(result.cents)} cent` : '—';
      $('needle').style.left = `${50 + Math.max(-48, Math.min(48, (result.cents || 0) * 0.5))}%`;
      if (result.matched) advance(result);
      else if (now > flashUntil) feedback({ listening: '一音ずつ、弾いてみましょう。', hold: 'その音です。少しだけ安定させましょう。', high: '今の音は高めです。弦・押さえる位置・調弦を確かめましょう。', low: '今の音は低めです。弦・押さえる位置・調弦を確かめましょう。', pluck: '同じ音です。前の音を止めて、もう一度弾いてください。' }[result.status] || '次の音を弾いてください。');
    }, 45);
  } catch (error) {
    if (ticket !== epoch) { acquired?.getTracks().forEach(track => track.stop()); return; }
    acquired?.getTracks().forEach(track => track.stop());
    stopAll(); render();
    feedback(error.name === 'NotAllowedError' ? 'マイクが許可されていません。ブラウザの設定で許可するか、「画面で試す」を選べます。' : error.name === 'NotFoundError' ? 'マイクが見つかりません。「画面で試す」からも練習できます。' : error.name === 'NotReadableError' ? 'マイクを開けませんでした。他のアプリの使用状況を確かめて、もう一度お試しください。' : error.message || 'マイクを開始できませんでした。');
  }
}
function startTouch() {
  stopAll();
  if (follower.done) { matchedCount = rounds = 0; newFollower(); }
  mode = 'touch'; $('touch-panel').hidden = false; $('stop').disabled = false;
  $('input-label').textContent = '画面で練習中'; feedback('譜面の音を、右のボタンから選んでみましょう。'); render();
  if (matchMedia('(max-width:650px)').matches) $('touch-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function demo() {
  if (mode === 'demo') { stopAll(); render(); feedback('お手本を止めました。'); return; }
  stopAll(); mode = 'demo'; $('stop').disabled = false;
  const ticket = epoch, [start, end] = bounds(), interval = 60000 / Number($('tempo').value);
  $('input-label').textContent = 'ガイドを再生中'; $('demo').textContent = '■ ガイドを止める';
  feedback('ガイドに合わせて弾きましょう。この練習ではマイクの採点を止めています。');
  let index = start, cycle = 1;
  const next = async () => {
    if (ticket !== epoch) return;
    if (index >= end) {
      if ($('loop-enabled').checked) {
        index = start; cycle++;
        feedback(`ガイド ${cycle}周目。音を聴きながら、一緒に弾いてみましょう。`);
      } else { stopAll(); render(); feedback('ガイドが終わりました。マイクか画面で練習できます。'); return; }
    }
    demoIndex = index; renderScore();
    try { await tone(notes[index++].midi, Math.min(0.65, interval / 1100)); }
    catch (error) { if (ticket === epoch) { stopAll(); render(); feedback(error.message); } return; }
    if (ticket === epoch) demoTimer = setTimeout(next, interval);
  };
  await next();
}

for (const id of ['guitar', 'sanshin']) $(id).onclick = () => { instrument = id; lessonId = 'open'; $('loop-enabled').checked = false; setup(); };
$('lesson').onchange = () => { lessonId = $('lesson').value; setup(); };
$('tuning').onchange = () => { transpose = Number($('tuning').value); setup(); };
$('sensitivity').onchange = () => { gate = Number($('sensitivity').value); stopAll(); newFollower(); save(); render(); feedback('感度を変えました。マイクで始めると反映されます。'); };
for (const id of ['loop-enabled', 'loop-start', 'loop-end']) $(id).onchange = () => {
  if (Number($('loop-start').value) > Number($('loop-end').value)) { if (id === 'loop-start') $('loop-end').value = $('loop-start').value; else $('loop-start').value = $('loop-end').value; }
  stopAll(); newFollower(); matchedCount = rounds = 0; render(); feedback('練習する範囲を変えました。もう一度始めましょう。');
};
$('mic-start').onclick = startMic; $('touch-start').onclick = startTouch; $('demo').onclick = demo;
$('stop').onclick = () => { stopAll(); render(); feedback('止めました。続きから始められます。'); };
$('restart').onclick = () => { stopAll(); newFollower(); matchedCount = rounds = 0; render(); feedback('最初に戻りました。マイクか画面で始めましょう。'); };
$('tempo').onchange = () => { if (mode === 'demo') { stopAll(); render(); feedback('速さを変えました。お手本をもう一度再生できます。'); } };
$('score').onclick = event => {
  const button = event.target.closest('[data-index]');
  if (!button) return;
  stopAll(); const index = Number(button.dataset.index), [start, end] = bounds();
  if (index < start || index >= end) $('loop-enabled').checked = false;
  newFollower(index); matchedCount = rounds = 0; render(); feedback(`${index + 1}音目から始められます。`);
};
$('reference').onclick = async () => {
  if (follower.done) return;
  if (mode === 'demo') { stopAll(); render(); }
  const ticket = epoch;
  suppressUntil = performance.now() + 1250; follower.candidateAt = null;
  feedback('お手本を再生中。マイク判定は少し待ちます。');
  try { await tone(notes[follower.index].midi); } catch (error) { if (ticket === epoch) feedback(error.message); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAll(); render(); feedback('画面を離れたので停止しました。もう一度始めてください。'); } });
window.addEventListener('pagehide', stopAll);
setup();

let installPrompt = null;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
$('install').onclick = async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; $('install').hidden = true; } };
window.addEventListener('appinstalled', () => { $('install').hidden = true; });
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(registration => {
    const ready = async () => {
      try {
        const cache = await caches.open('music-practice-v2');
        if (await cache.match(new URL('./app.mjs?v=2', location.href).href)) $('offline-state').textContent = 'オフライン準備OK';
      } catch { $('offline-state').textContent = 'オンラインで利用できます'; }
    };
    const watch = worker => {
      if (!worker) return;
      if (worker.state === 'activated') ready();
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') ready();
        if (worker.state === 'redundant') $('offline-state').textContent = 'オンラインで利用できます';
      });
    };
    if (registration.active) ready();
    watch(registration.installing || registration.waiting);
    registration.addEventListener('updatefound', () => watch(registration.installing));
    registration.update().catch(() => {});
  }).catch(() => { $('offline-state').textContent = 'オンラインで利用できます'; });
} else $('offline-state').textContent = 'オンラインで利用できます';
