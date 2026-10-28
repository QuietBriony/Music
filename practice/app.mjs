import { LESSONS, lessonNotes, noteName, frequencyFor, detectPitch, NoteFollower } from './music.mjs?v=3';
import { parseMidi, fetchMidi, MIDI_LIMITS, melodyNotes } from './midi.mjs?v=3';
import { CHORDS, GUITAR_OPEN, shapeMatches, bestShift } from './chords.mjs?v=3';
import { SONGS, scoreNotes } from './scores.mjs?v=3';

const $ = id => document.getElementById(id);
const STORAGE = 'music-practice-settings-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch { /* Private mode / unavailable storage is fine. */ }
let instrument = saved.instrument === 'sanshin' ? 'sanshin' : 'guitar';
let lessonId = LESSONS[instrument].some(item => item.id === saved.lesson) ? saved.lesson : 'open';
let transpose = [0, -1, -2, -3, 2].includes(saved.transpose) ? saved.transpose : 0;
let gate = [0.003, 0.006, 0.014].includes(saved.gate) ? saved.gate : 0.006;
let notes, follower, mode = 'idle', rounds = 0, matchedCount = 0;
let midiModel = null, midiTitle = '', groupId = '', practiceStyle = 'melody', scoreShift = 0, highVoice = false, cues = [];
let loadController = null, loadEpoch = 0, loading = false, selectedFrets = [0, 0, 0, 0, 0, 0];
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
  $('mic-start').disabled = $('touch-start').disabled = loading;
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
function scheduleTone(ctx, midi, duration = 0.55, when = ctx.currentTime, volume = 0.12) {
  if (ctx.state === 'closed') return;
  duration = Math.max(.04, Math.min(8, duration));
  const oscillator = ctx.createOscillator(), gain = ctx.createGain();
  const real = new Float32Array(5), imaginary = new Float32Array([0, 1, 0.25, 0.1, 0.04]);
  oscillator.setPeriodicWave(ctx.createPeriodicWave(real, imaginary));
  oscillator.frequency.value = frequencyFor(midi);
  const now = Math.max(ctx.currentTime, when);
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(ctx.destination);
  voices.add(oscillator);
  oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(now); oscillator.stop(now + duration + 0.015);
}
async function tone(midi, duration = 0.55) {
  const ticket = epoch;
  const ctx = await audio();
  if (ticket !== epoch || ctx.state === 'closed') return;
  scheduleTone(ctx, midi, duration);
}
function noteLabel(note) {
  return instrument === 'sanshin' ? `${note.symbol}・${note.position}・${noteName(note.midi)}` : `${note.string}弦・${note.fret === 0 ? '開放弦' : `${note.fret}フレット`}・${noteName(note.midi)}`;
}
function currentChord(note = notes?.[Math.min(follower?.index || 0, notes.length - 1)]) {
  return note?.chord || cues.filter(c => c.time <= (note?.time ?? 0)).at(-1)?.chord || 'G';
}
function renderChord(note) {
  if (instrument !== 'guitar') return;
  const name = currentChord(note), shape = CHORDS[name];
  $('chord-name').textContent = name;
  const x = i => 25 + i * 24;
  let svg = '<svg viewBox="0 0 170 142" role="img" aria-label="'+name+'の押さえ方。数字は指番号">';
  for (let i=0;i<6;i++) svg += `<line x1="${x(i)}" x2="${x(i)}" y1="31" y2="123"/><text x="${x(i)}" y="139">${6-i}</text>`;
  for (let f=0;f<=4;f++) svg += `<line x1="25" x2="145" y1="${31+f*23}" y2="${31+f*23}"${f===0?' class="nut"':''}/>`;
  shape.frets.forEach((f,i) => { svg += f <= 0 ? `<text x="${x(i)}" y="20">${f<0?'×':'○'}</text>` : `<circle cx="${x(i)}" cy="${31+(f-.5)*23}" r="9"/><text class="finger" x="${x(i)}" y="${35+(f-.5)*23}">${shape.fingers[i]}</text>`; });
  $('chord-diagram').innerHTML = svg + '</svg>';
  $('chord-instruction').textContent = `${name}：${shape.frets.map((f,i)=>`${6-i}弦${f<0?'は弾かない':f===0?'は開放':f+'フレット'}`).join('、')}。`;
  renderFrets();
}
function renderFrets() {
  $('fretboard').innerHTML = selectedFrets.map((chosen,i) => `<div class="fret-row"><span>${6-i}弦</span>${[-1,0,1,2,3].map(f=>`<button data-string="${i}" data-fret="${f}" aria-label="${6-i}弦 ${f<0?'ミュート':f===0?'開放':f+'フレット'}" aria-pressed="${chosen===f}">${f<0?'×':f===0?'○':f}</button>`).join('')}</div>`).join('');
  $('shape-status').textContent = `画面の形：${Object.keys(CHORDS).find(name=>shapeMatches(selectedFrets,name)) || '編集中'} · 6弦 → 1弦`;
}
function cancelLoad() { loadEpoch++; loadController?.abort(); loadController = null; if(loading)$('midi-status').textContent='MIDIの読込を取り消しました。'; loading = false; }
async function loadScore(read, title, id = 'import') {
  cancelLoad(); stopAll(); loading = true; const ticket = loadEpoch;
  loadController = new AbortController();
  $('mic-start').disabled = $('touch-start').disabled = true; $('stop').disabled = false;
  $('midi-status').textContent = 'MIDIを読んでいます…';
  try {
    const data = await read(loadController.signal);
    if (ticket !== loadEpoch) return;
    const parsed = parseMidi(data), groups = parsed.groups.filter(g=>!g.percussion);
    let chosen = groups.find(g=> { try { melodyNotes(parsed,g.id); return true; } catch { return false; } }) || groups[0];
    let high = false, raw;
    try { raw = melodyNotes(parsed,chosen.id); } catch { high = true; raw = melodyNotes(parsed,chosen.id,true); }
    const shift = bestShift(raw,instrument);
    // Validate before replacing the last usable score.
    scoreNotes(parsed,chosen.id,instrument,{shift,tuning:transpose,highVoice:high});
    midiModel = parsed; groupId = chosen.id; scoreShift = shift; highVoice = high; midiTitle = title;
    practiceStyle = 'melody'; lessonId = id; loading = false; $('loop-enabled').checked = false;
    setup(); $('midi-status').textContent = `${title}を読み込みました。${high?'重なった音は各発音時の最高音で読んでいます。':''}${shift?`音域に合わせて${shift>0?'+':''}${shift}半音移調しました。`:''}`;
  } catch(error) {
    if (ticket !== loadEpoch) return;
    loading = false; stopAll(); render(); $('lesson').value = lessonId;
    $('midi-status').textContent = error.message?.startsWith('MIDI') || error.message?.includes('音域') ? error.message : 'MIDIを取得できませんでした。URLの公開設定・通信を確認するか、.midファイルを選んでください。';
  }
}
function applyMidiOptions() {
  cancelLoad();
  const previous = [groupId,scoreShift,highVoice,practiceStyle];
  try {
    groupId=$('midi-track').value; scoreShift=Number($('midi-shift').value); highVoice=$('high-voice').checked; practiceStyle=$('practice-style').value;
    scoreNotes(midiModel,groupId,instrument,{shift:scoreShift,tuning:transpose,highVoice,chords:practiceStyle==='chords'});
    $('loop-enabled').checked=false; setup();
  } catch(error) {
    [groupId,scoreShift,highVoice,practiceStyle]=previous;
    $('midi-track').value=groupId; $('midi-shift').value=scoreShift; $('high-voice').checked=highVoice; $('practice-style').value=practiceStyle;
    stopAll(); render(); $('midi-status').textContent=error.message;
  }
}
function renderScore() {
  const current = mode === 'demo' ? demoIndex : follower.done ? -1 : follower.index;
  const [start, end] = bounds();
  const classes = index => `${index === current ? ' current' : ''}${index < follower.index ? ' passed' : ''}${index < start || index >= end ? ' outside' : ''}${index === demoIndex ? ' preview' : ''}`;
  if (practiceStyle === 'chords' && midiModel && instrument === 'guitar') {
    $('score').innerHTML = `<div class="chord-score">${notes.map((n,i) => `<button class="${classes(i)}" data-index="${i}" aria-label="${i+1}音目 ${n.chord} ${noteLabel(n)}">${n.chord}<small>${n.string}弦 · ${n.fret}</small></button>`).join('')}</div>`;
  } else if (instrument === 'sanshin') {
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
  const guiding = mode === 'demo', done = follower.done && !guiding;
  const index = guiding && demoIndex >= 0 ? demoIndex : Math.min(follower.index, follower.end - 1);
  const n = notes[index];
  $('target').classList.toggle('kanji', instrument === 'sanshin');
  $('target-main').textContent = done ? '✓' : instrument === 'sanshin' ? n.symbol : n.fret;
  $('target-name').textContent = done ? 'できました' : noteName(n.midi);
  $('position').textContent = done ? `${matchedCount}音、弾けました。` : instrument === 'sanshin' ? n.position : `${n.chord ? `${n.chord}を押さえて / ` : ''}${n.string}弦 / ${n.fret === 0 ? '開放弦' : `${n.fret}フレット`}`;
  $('progress-text').textContent = `${done ? follower.end : index + 1} / ${notes.length}${rounds ? ` · ${rounds}周` : ''}`;
  $('progress').max = follower.end - follower.start; $('progress').value = (guiding ? index : follower.index) - follower.start;
  $('reference').disabled = done || loading;
  renderChord(n);
  renderScore();
}
function setup() {
  stopAll();
  if (midiModel) {
    const result = scoreNotes(midiModel, groupId, instrument, { shift: scoreShift, tuning: transpose, highVoice, chords: practiceStyle === 'chords' });
    notes = result.notes; cues = result.cues;
  } else { notes = lessonNotes(instrument, lessonId, transpose); cues = []; }
  $('guitar').setAttribute('aria-pressed', String(instrument === 'guitar'));
  $('sanshin').setAttribute('aria-pressed', String(instrument === 'sanshin'));
  $('lesson').innerHTML = `<option value="${SONGS[instrument].id}">${SONGS[instrument].title}</option>` + LESSONS[instrument].map(l => `<option value="${l.id}">${l.title}</option>`).join('') + (lessonId === 'import' ? '<option value="import">読み込んだMIDI</option>' : '');
  $('lesson').value = lessonId; $('tuning').value = transpose; $('sensitivity').value = gate;
  $('tuning-label').hidden = instrument !== 'sanshin';
  $('lesson-detail').textContent = midiModel ? `${midiTitle} · ${notes.length}音 · ${midiModel.timeSignature.join('/')}拍子 · MIDIの長さ・テンポで再生${midiModel.warnings.length ? `。${midiModel.warnings.join(' ')}` : ''}` : LESSONS[instrument].find(l => l.id === lessonId).detail;
  $('score-heading').textContent = instrument === 'sanshin' ? '工工四' : practiceStyle === 'chords' && midiModel ? 'コードを一弦ずつ' : 'TAB譜';
  $('score-help').textContent = instrument === 'sanshin' ? '右の列から下へ。文字を押すと、その位置から練習できます。' : practiceStyle === 'chords' && midiModel ? 'コードを押さえたまま、下に示す弦を一本ずつ。画面のストロークでは同じコードの弦をまとめて進めます。' : '数字はフレット。0は開放弦。音符を押すと、その位置から練習できます。';
  for (const id of ['loop-start', 'loop-end']) $(id).innerHTML = notes.map((n, i) => `<option value="${i}">${i + 1}</option>`).join('');
  $('loop-end').value = notes.length - 1;
  $('chord-panel').hidden = instrument !== 'guitar';
  $('style-label').hidden = instrument !== 'guitar' || !midiModel;
  $('practice-style').value = practiceStyle;
  $('midi-options').hidden = !midiModel;
  if (midiModel) {
    $('midi-track').replaceChildren(...midiModel.groups.filter(g => !g.percussion).map(g => new Option(`${g.name} · ch ${g.channel+1} · ${g.notes.length}音`,g.id)));
    $('midi-track').value = groupId; $('midi-shift').value = scoreShift; $('high-voice').checked = highVoice;
  }
  $('song-credit').hidden = !midiModel || lessonId === 'import';
  if (midiModel && lessonId !== 'import') { $('credit-text').textContent = SONGS[instrument].credit; $('credit-link').href = SONGS[instrument].source; }
  $('touch-keys').hidden = practiceStyle === 'chords' && !!midiModel;
  $('touch-description').textContent = practiceStyle === 'chords' && midiModel ? '下の指板で弦を押さえて「ストローク」。正しい形なら次のコードへ進みます。' : '下の音を押して進めます。マイク判定とは別の体験です。';
  rounds = matchedCount = 0; newFollower();
  const unique = [...new Map(notes.map(n => [`${n.string}-${n.fret}`, n])).values()];
  $('touch-keys').innerHTML = unique.map((n, i) => `<button data-key="${i}" aria-label="${noteLabel(n)}">${instrument === 'sanshin' ? n.symbol : noteName(n.midi)}<small>${instrument === 'sanshin' ? noteName(n.midi) : `${n.string}弦 / ${n.fret}`}</small></button>`).join('');
  $('touch-keys').onclick = event => {
    const button = event.target.closest('[data-key]');
    if (!button || mode !== 'touch' || follower.done) return;
    const played = unique[Number(button.dataset.key)];
    tone(played.midi).catch(error => feedback(error.message));
    if (played.midi === notes[follower.index]?.midi) advance(follower.accept(performance.now()));
    else feedback('もう一度。大きく表示されている音を選んでみましょう。');
  };
  $('input-label').textContent = '準備できたら始めましょう';
  feedback(practiceStyle === 'chords' && midiModel ? 'マイクではコードを押さえたまま、大きく表示する弦を一本ずつ弾きます。' : 'マイクか画面を選んで始めましょう。'); save(); render();
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
  if (loading) return;
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
  if (loading) return;
  stopAll();
  if (follower.done) { matchedCount = rounds = 0; newFollower(); }
  mode = 'touch'; $('touch-panel').hidden = false; $('stop').disabled = false;
  $('input-label').textContent = '画面で練習中'; feedback('譜面の音を、右のボタンから選んでみましょう。'); render();
  if (practiceStyle === 'chords' && midiModel) { $('fret-details').open = true; feedback('コード図を見ながら弦を押さえ、「ストローク」を押しましょう。'); }
  if (matchMedia('(max-width:650px)').matches) $('touch-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function demo() {
  if (loading) return;
  if (mode === 'demo') { stopAll(); render(); feedback('お手本を止めました。'); return; }
  stopAll(); mode = 'demo'; $('stop').disabled = false;
  const ticket = epoch, [start, end] = bounds(), speed = Number($('tempo').value) / 85;
  $('input-label').textContent = 'ガイドを再生中'; $('demo').textContent = '■ ガイドを止める';
  feedback('ガイドに合わせて弾きましょう。この練習ではマイクの採点を止めています。');
  try {
    const ctx = await audio(); if (ticket !== epoch) return;
    const fallback = 60/85, base = midiModel ? (start===0?0:notes[start].time) : start*fallback;
    const events = notes.slice(start,end).map((n,i)=>({index:start+i,midi:n.midi,time:((n.time??((start+i)*fallback))-base)/speed,duration:(n.duration??.5)/speed}));
    const last=notes[end-1], span=((last.time??((end-1)*fallback))+(last.stepSeconds??fallback)-base)/speed;
    const backing = instrument==='guitar' && practiceStyle==='melody' && $('backing').checked ? cues.filter(c=>c.time>=base && c.time<base+span*speed).map(c=>({time:(c.time-base)/speed,chord:c.chord})) : [];
    let began=ctx.currentTime+.06, scheduled=0, chordScheduled=0, visual=-1, cycle=1;
    const pump=()=>{
      if(ticket!==epoch)return;
      const elapsed=ctx.currentTime-began;
      if(elapsed>=span){
        if(!$('loop-enabled').checked){stopAll();render();feedback('ガイドが終わりました。マイクか画面で練習できます。');return;}
        began+=span; scheduled=chordScheduled=0;visual=-1;cycle++; feedback(`ガイド ${cycle}周目。一緒に弾いてみましょう。`);
      }
      const now=ctx.currentTime-began;
      while(scheduled<events.length && events[scheduled].time<now+.12){const e=events[scheduled++];scheduleTone(ctx,e.midi,e.duration,began+e.time);}
      while(chordScheduled<backing.length && backing[chordScheduled].time<now+.12){const e=backing[chordScheduled++];CHORDS[e.chord].frets.forEach((f,i)=>{if(f>=0)scheduleTone(ctx,GUITAR_OPEN[i]+f,.7,began+e.time+i*.025,.024);});}
      let index=-1; for(let i=0;i<events.length;i++){if(events[i].time<=now)index=i;else break;}
      if(index>=0 && index!==visual){visual=index;demoIndex=events[index].index;render();}
      demoTimer=setTimeout(pump,25);
    };pump();
  } catch(error) { if(ticket===epoch){stopAll();render();feedback(error.message);} }
}

for (const id of ['guitar', 'sanshin']) $(id).onclick = () => { cancelLoad(); instrument = id; midiModel=null; practiceStyle='melody'; lessonId = 'open'; $('loop-enabled').checked = false; setup(); $('midi-status').textContent=''; };
$('lesson').onchange = () => {
  const id=$('lesson').value;
  if(id===SONGS[instrument].id){const song=SONGS[instrument];loadScore(signal=>fetchMidi(`./songs/${song.file}`,{signal}),song.title,id);}
  else if(id!=='import'){cancelLoad();midiModel=null;practiceStyle='melody';lessonId=id;setup();}
};
$('midi-file').onchange = () => { const file=$('midi-file').files[0]; if(!file)return; if(file.size>MIDI_LIMITS.bytes){$('midi-status').textContent='1 MB以下のMIDIを選んでください。';return;} loadScore(()=>file.arrayBuffer(),file.name); $('midi-file').value=''; };
$('midi-url-form').onsubmit = event => { event.preventDefault(); const url=$('midi-url').value.trim(); if(url)loadScore(signal=>fetchMidi(url,{signal}),'URLからのMIDI'); };
for(const id of ['midi-track','midi-shift','high-voice','practice-style'])$(id).onchange=applyMidiOptions;
$('fretboard').onclick=event=>{const b=event.target.closest('[data-fret]');if(!b)return;selectedFrets[Number(b.dataset.string)]=Number(b.dataset.fret);renderFrets();};
$('chord-choices').onclick=event=>{const b=event.target.closest('[data-chord]');if(!b)return;selectedFrets=[...CHORDS[b.dataset.chord].frets];renderFrets();};
$('strum').onclick=async()=>{
  if(loading)return;
  if(mode==='mic'||mode==='pending'||mode==='demo'){stopAll();render();}
  const ticket=epoch;
  try{const ctx=await audio();if(ticket!==epoch)return;selectedFrets.forEach((f,i)=>{if(f>=0)scheduleTone(ctx,GUITAR_OPEN[i]+f,.8,ctx.currentTime+i*.035,.055);});$('stop').disabled=false;
    if(mode==='touch' && practiceStyle==='chords' && midiModel && !follower.done){
      const target=notes[follower.index], cueIndex=target.cueIndex;
      if(shapeMatches(selectedFrets,target.chord)){
        // One virtual strum accepts this cue; the microphone still checks each string separately.
        const remaining=notes.slice(follower.index,follower.end).filter(n=>n.cueIndex===cueIndex).length;
        for(let i=0;i<remaining;i++)advance(follower.accept(performance.now()));
      }else feedback(`${target.chord}の図を見て、押さえる位置と弾かない弦を確かめましょう。`);
    }else feedback('画面のコードを鳴らしました。コードを練習する時は「コード」→「画面で試す」へ。');
  }catch(error){if(ticket===epoch)feedback(error.message);}
};
$('tuning').onchange = () => { cancelLoad(); transpose = Number($('tuning').value); setup(); };
$('sensitivity').onchange = () => { cancelLoad(); gate = Number($('sensitivity').value); stopAll(); newFollower(); save(); render(); feedback('感度を変えました。マイクで始めると反映されます。'); };
for (const id of ['loop-enabled', 'loop-start', 'loop-end']) $(id).onchange = () => {
  cancelLoad();
  if (Number($('loop-start').value) > Number($('loop-end').value)) { if (id === 'loop-start') $('loop-end').value = $('loop-start').value; else $('loop-start').value = $('loop-end').value; }
  stopAll(); newFollower(); matchedCount = rounds = 0; render(); feedback('練習する範囲を変えました。もう一度始めましょう。');
};
$('mic-start').onclick = startMic; $('touch-start').onclick = startTouch; $('demo').onclick = demo;
$('stop').onclick = () => { cancelLoad(); stopAll(); render(); feedback('止めました。続きから始められます。'); };
$('restart').onclick = () => { cancelLoad(); stopAll(); newFollower(); matchedCount = rounds = 0; render(); feedback('最初に戻りました。マイクか画面で始めましょう。'); };
$('tempo').onchange = () => { if (mode === 'demo') { stopAll(); render(); feedback('速さを変えました。お手本をもう一度再生できます。'); } };
$('score').onclick = event => {
  const button = event.target.closest('[data-index]');
  if (!button) return;
  cancelLoad(); stopAll(); const index = Number(button.dataset.index), [start, end] = bounds();
  if (index < start || index >= end) $('loop-enabled').checked = false;
  newFollower(index); matchedCount = rounds = 0; render(); feedback(`${index + 1}音目から始められます。`);
};
$('reference').onclick = async () => {
  if (follower.done || loading) return;
  if (mode === 'demo') { stopAll(); render(); }
  const ticket = epoch;
  suppressUntil = performance.now() + 1250; follower.candidateAt = null;
  feedback('お手本を再生中。マイク判定は少し待ちます。');
  try { await tone(notes[follower.index].midi); } catch (error) { if (ticket === epoch) feedback(error.message); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelLoad(); stopAll(); render(); feedback('画面を離れたので停止しました。もう一度始めてください。'); } });
window.addEventListener('pagehide', () => {cancelLoad();stopAll();});
$('midi-shift').replaceChildren(...Array.from({length:49},(_,i)=>new Option(i-24===0?'0（元の調）':`${i-24>0?'+':''}${i-24}`,i-24)));
setup();

let installPrompt = null;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
$('install').onclick = async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; $('install').hidden = true; } };
window.addEventListener('appinstalled', () => { $('install').hidden = true; });
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(registration => {
    const ready = async () => {
      try {
        const cache = await caches.open('music-practice-v3');
        if (await cache.match(new URL('./app.mjs?v=3', location.href).href) && await cache.match(new URL('./songs/twinkle.mid', location.href).href) && await cache.match(new URL('./songs/amazing-grace.mid', location.href).href)) $('offline-state').textContent = 'オフライン準備OK';
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
