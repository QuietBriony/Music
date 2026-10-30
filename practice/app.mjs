import { LESSONS, lessonNotes, noteName, frequencyFor, detectPitch, NoteFollower } from './music.mjs?v=8';
import { parseMidi, fetchMidi, MIDI_LIMITS, melodyNotes } from './midi.mjs?v=8';
import { CHORDS, CHORD_GROUPS, PROGRESSIONS, GUITAR_OPEN, shapeMatches, bestShift } from './chords.mjs?v=8';
import { SONGS, scoreNotes, chordExercise } from './scores.mjs?v=8';
import { tuningStrings, tunerReading } from './tuner.mjs?v=8';
import { mountLearning,STUDIES } from './learning.mjs?v=8';
import { detectChord, ChordGate } from './polyphonic.mjs?v=8';
import { mountLyrics } from './lyrics.mjs?v=8';
import { LYRIC_PRESETS } from './lyric-presets.mjs?v=8';
import { PracticeProgress,progressKey } from './progress.mjs?v=8';
import { mountSingalong } from './singalong.mjs?v=8';

const $ = id => document.getElementById(id);
const STORAGE = 'music-practice-settings-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch { /* Private mode / unavailable storage is fine. */ }
let instrument = saved.instrument === 'sanshin' ? 'sanshin' : 'guitar';
let view = saved.view==='practice'?'practice':'tuner', tunerIndex=0;
let lessonId = LESSONS[instrument].some(item => item.id === saved.lesson) ? saved.lesson : 'open';
let transpose = [0, -1, -2, -3, 2].includes(saved.transpose) ? saved.transpose : 0;
let gate = [0.003, 0.006, 0.014].includes(saved.gate) ? saved.gate : 0.006;
let notes, follower, mode = 'idle', rounds = 0, matchedCount = 0;
let midiModel = null, midiTitle = '', groupId = '', practiceStyle = 'melody', scoreShift = 0, highVoice = false, cues = [];
let loadController = null, loadEpoch = 0, loading = false, selectedFrets = [0, 0, 0, 0, 0, 0];
let sessionId='',sessionTitle='',focused=false,scorePage=null,lastScorePage=0;
let chordCheck=saved.chordCheck==='strum'?'strum':'strings';
let singalongOpen=saved.singalong===true;
let practiceSnapshot=saved.practiceSnapshot||{lesson:saved.lesson,practiceStyle:saved.practiceStyle,chordNames:saved.chordNames,chordTitle:saved.chordTitle};
const chordGate=new ChordGate();
const progressStore=new PracticeProgress({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
let progressId='',restoredProgress=null;
let context = null, micStream = null, analyser = null, source = null, silent = null;
let epoch = 0, meterTimer = null, demoTimer = null, suppressUntil = 0, flashUntil = 0, demoIndex = -1;
const voices = new Set();
const feedback = text => { if ($('feedback').textContent !== text) $('feedback').textContent = text; };
function save() {
  if(view==='practice')practiceSnapshot={instrument,lesson:lessonId,practiceStyle,chordNames:lessonId==='chord'?midiModel.markers.map(c=>c.chord):null,chordTitle:lessonId==='chord'?midiTitle:null,sessionId,sessionTitle,easyPractice:midiModel?.easy===true};
  try { localStorage.setItem(STORAGE, JSON.stringify({ uiVersion:8, view, instrument, lesson:lessonId, transpose, gate, practiceStyle,chordCheck,practiceSnapshot,tempo:Number($('tempo').value),countIn:$('count-in').checked,backing:$('backing').checked,singalong:singalongOpen })); } catch { /* Storage is optional. */ }
}
function storeProgress(){
 if(view!=='practice'||!progressId||loading||!follower)return;
 const [start,end]=bounds();restoredProgress={count:notes.length,start,end,index:follower.index,done:follower.done,loop:$('loop-enabled').checked,matched:matchedCount,rounds};
 $('progress-storage').textContent=progressStore.set(progressId,restoredProgress)?'練習位置はこの端末に保存しています。':'端末に保存できません。今の画面では練習を続けられます。';
 renderResume();
}
function renderResume(){
 $('resume-card').hidden=view!=='practice'||!restoredProgress;
 if(!restoredProgress)return;
 const n=notes[Math.min(restoredProgress.index,notes.length-1)],chords=practiceStyle==='chords'&&!!midiModel,total=chords?cues.length:notes.length;
 const at=chords?n.cueIndex+1:Math.min(restoredProgress.index+1,notes.length);
 $('resume-position').textContent=restoredProgress.done?`${$('session-title').textContent} · 前回の範囲を完了`:`${$('session-title').textContent} · ${at} / ${total}${chords?'コード':'音'}から`;
 $('resume-practice').textContent=restoredProgress.done?'もう一度練習':'続きから練習';
}
function restorePosition(){
 progressId=progressKey(sessionId,[instrument,practiceStyle,transpose,scoreShift,groupId,highVoice],notes);
 restoredProgress=progressStore.get(progressId,notes.length);
 if(restoredProgress){
  $('loop-enabled').checked=restoredProgress.loop;$('loop-start').value=restoredProgress.start;$('loop-end').value=restoredProgress.end-1;
  newFollower(Math.min(restoredProgress.index,restoredProgress.end-1));follower.index=restoredProgress.index;follower.done=restoredProgress.done;matchedCount=restoredProgress.matched;rounds=restoredProgress.rounds;
 }
 renderResume();
}
function setFocus(value){focused=!!value&&view==='practice';document.body.classList.toggle('focused',focused);$('focus-mode').setAttribute('aria-pressed',String(focused));$('focus-mode').textContent=focused?'曲・設定を見る':'練習に集中';}
function focusPractice(){if(view!=='practice')return;setFocus(true);window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>{if(focused)window.scrollTo({top:0,behavior:'instant'});});}
async function contentKey(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');}
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
  document.body.dataset.mode=mode;
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
function renderPickers() {
  $('easy-song-card').hidden=instrument!=='guitar';
  $('preset-songs').innerHTML=SONGS[instrument].map(song=>`<button data-preset-song="${song.id}" aria-pressed="${lessonId===song.id}"><strong>${song.title}</strong><small>${instrument==='guitar'?song.chords:'工工四で弾く'} →</small></button>`).join('');
  $('chord-library').innerHTML=CHORD_GROUPS.map(group=>`<div class="chord-group"><span>${group.title}</span><div>${group.names.map(name=>`<button data-practice-chord="${name}" aria-pressed="false">${name}${CHORDS[name].barre?'<small>セーハ</small>':''}</button>`).join('')}</div></div>`).join('');
  $('progression-choices').innerHTML=PROGRESSIONS.map(p=>`<button data-progression="${p.id}">${p.title}</button>`).join('');
}
function renderChord(note) {
  if (instrument !== 'guitar') return;
  const name = currentChord(note), shape = CHORDS[name];
  $('chord-name').textContent = name;
  const x = i => 25 + i * 24;
  let svg = '<svg viewBox="0 0 170 166" role="img" aria-label="'+name+'の押さえ方。数字は指番号">';
  for (let i=0;i<6;i++) svg += `<line x1="${x(i)}" x2="${x(i)}" y1="31" y2="145"/><text x="${x(i)}" y="163">${6-i}</text>`;
  for (let f=0;f<=6;f++) svg += `<line x1="25" x2="145" y1="${31+f*19}" y2="${31+f*19}"${f===0?' class="nut"':''}/>`;
  if(shape.barre){const b=shape.barre;svg+=`<line class="barre" x1="${x(6-b.from)}" x2="${x(6-b.to)}" y1="${31+(b.fret-.5)*19}" y2="${31+(b.fret-.5)*19}"/>`;}
  shape.frets.forEach((f,i) => { svg += f <= 0 ? `<text x="${x(i)}" y="20">${f<0?'×':'○'}</text>` : `<circle cx="${x(i)}" cy="${31+(f-.5)*19}" r="8"/><text class="finger" x="${x(i)}" y="${35+(f-.5)*19}">${shape.fingers[i]}</text>`; });
  $('chord-diagram').innerHTML = svg + '</svg>';
  $('chord-instruction').textContent = `${name}：${shape.frets.map((f,i)=>`${6-i}弦${f<0?'は弾かない':f===0?'は開放':f+'フレット'}`).join('、')}。`;
  $('chord-barre').textContent=shape.barre?`セーハ：人差し指で${shape.barre.fret}フレットの${shape.barre.from}〜${shape.barre.to}弦をまとめて押さえます。`:'セーハなしで押さえられる形です。';
  for(const button of $('chord-library').querySelectorAll('[data-practice-chord]'))button.setAttribute('aria-pressed',String(button.dataset.practiceChord===name));
  $('set-shape').textContent=`${name}の形を指板に置く`;
  renderFrets();
}
function renderFrets() {
  $('fretboard').innerHTML = selectedFrets.map((chosen,i) => `<div class="fret-row"><span>${6-i}弦</span>${[-1,0,1,2,3,4,5,6].map(f=>`<button data-string="${i}" data-fret="${f}" aria-label="${6-i}弦 ${f<0?'ミュート':f===0?'開放':f+'フレット'}" aria-pressed="${chosen===f}">${f<0?'×':f===0?'○':f}</button>`).join('')}</div>`).join('');
  $('shape-status').textContent = `画面の形：${Object.keys(CHORDS).find(name=>shapeMatches(selectedFrets,name)) || '編集中'} · 6弦 → 1弦`;
}
function cancelLoad() { loadEpoch++; loadController?.abort(); loadController = null; if(loading)$('midi-status').textContent='MIDIの読込を取り消しました。'; loading = false; }
async function loadScore(read, title, id = 'import', style = 'melody') {
  cancelLoad(); stopAll(); loading = true; const ticket = loadEpoch;
  loadController = new AbortController();
  $('mic-start').disabled = $('touch-start').disabled = true; $('stop').disabled = false;
  $('midi-status').textContent = id==='import'?'MIDIを読んでいます…':`${title}を準備しています…`;
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
    const identity=id==='import'?`midi:${await contentKey(data)}`:`song:${id}`;if(ticket!==loadEpoch)return;
    sessionId=identity;sessionTitle=title;
    midiModel = parsed; groupId = chosen.id; scoreShift = shift; highVoice = high; midiTitle = title;
    practiceStyle = style; lessonId = id; loading = false; $('loop-enabled').checked = false;
    setup(); $('midi-status').textContent = id==='import'?`${title}を読み込みました。${high?'重なった音は各発音時の最高音で読んでいます。':''}${shift?`音域に合わせて${shift>0?'+':''}${shift}半音移調しました。`:''}`:'';
  } catch(error) {
    if (ticket !== loadEpoch) return;
    loading = false; stopAll(); render(); $('lesson').value = lessonId;
    $('midi-status').textContent = error.message?.startsWith('MIDI') || error.message?.includes('音域') ? error.message : 'MIDIを取得できませんでした。URLの公開設定・通信を確認するか、.midファイルを選んでください。';
  }
}
function selectSong(id, style=instrument==='guitar'?'chords':'melody') {
  const song=SONGS[instrument].find(song=>song.id===id);
  if(song)return loadScore(signal=>fetchMidi(`./songs/${song.file}`,{signal}),song.title,id,style);
}
function startChordExercise(names,title,identity,{easy=false,restoring=false}={}) {
  cancelLoad();stopAll();view='practice';instrument='guitar';sessionId=identity||`chords:${names.join(',')}`;sessionTitle=title;midiModel=chordExercise(names);groupId='chords';scoreShift=0;highVoice=false;
  midiModel.easy=easy;practiceStyle='chords';lessonId='chord';midiTitle=title;selectedFrets=[...CHORDS[names[0]].frets];
  if(easy&&!restoring){$('tempo').value='60';$('count-in').checked=true;}
  $('loop-enabled').checked=false;setup();$('midi-status').textContent='';$('fret-details').open=!focused;renderLearning(instrument);if(easy&&!restoring){focusPractice();render();}
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
  if(view==='tuner')return;
  const current=mode==='demo'?demoIndex:follower.done?-1:follower.index,[start,end]=bounds();
  const grouped=practiceStyle==='chords'&&midiModel&&instrument==='guitar';
  const entries=notes.flatMap((n,i)=>!grouped||i===0||n.cueIndex!==notes[i-1].cueIndex?[{n,index:i}]:[]);
  entries.forEach((e,i)=>e.end=entries[i+1]?.index??notes.length);
  const active=follower.done&&mode!=='demo'?entries.length-1:Math.max(0,entries.findIndex(e=>current>=e.index&&current<e.end)),size=6;
  const page=Math.max(0,Math.min(Math.ceil(entries.length/size)-1,scorePage??Math.floor(active/size)));lastScorePage=page;
  const visible=entries.slice(page*size,page*size+size);
  $('loop-visible').dataset.start=visible[0].index;$('loop-visible').dataset.end=visible.at(-1).end;
  $('loop-summary').textContent=$('loop-enabled').checked?grouped?`${notes[start].cueIndex+1}〜${notes[end-1].cueIndex+1}コードを反復`:`${start+1}〜${end}音を反復`:'全体を練習';
  $('loop-all').hidden=!$('loop-enabled').checked;
  $('score-range').textContent=`${page*size+1}〜${Math.min(entries.length,(page+1)*size)} / ${entries.length}${grouped?' コード':'音'}`;
  $('score-prev').disabled=page===0;$('score-next').disabled=(page+1)*size>=entries.length;
  const classes=e=>`${current>=e.index&&current<e.end?' current':''}${e.end<=follower.index?' passed':''}${e.end<=start||e.index>=end?' outside':''}${mode==='demo'&&current>=e.index&&current<e.end?' preview':''}`;
  const length=n=>Number.isFinite(n.beats)?`${Number(n.beats.toFixed(2))}拍`:'';
  if(grouped){
    $('score').innerHTML=`<div class="chord-score">${visible.map(e=>`<button class="${classes(e)}" data-index="${e.index}" aria-label="${e.n.chord}のコード、${e.index+1}音目から">${e.n.chord}<small>${notes.slice(e.index,e.end).length}本の弦</small></button>`).join('')}</div>`;
  }else if(instrument==='sanshin'){
    $('score').innerHTML=`<div class="kunkun">${visible.map(e=>`<button class="${classes(e)}" data-index="${e.index}" aria-label="${e.index+1}音目、${noteLabel(e.n)} ${length(e.n)}">${e.n.symbol}<small>${e.index+1} ${length(e.n)}</small></button>`).join('')}</div>`;
  }else{
    let html='<div class="tab-block"><div class="tab-string-labels">'+['e','B','G','D','A','E'].map(n=>`<span class="tab-label">${n}</span>`).join('')+'</div>';
    for(const e of visible){const n=e.n,strings=[1,2,3,4,5,6].map(string=>`<span>${n.string===string?`<em>${n.fret}</em>`:''}</span>`).join('');html+=`<button class="tab-column${classes(e)}" data-index="${e.index}" aria-label="${e.index+1}音目、${noteLabel(n)} ${length(n)}">${strings}<small class="note-length">${length(n)}</small></button>`;}
    html+='</div>';$('score').innerHTML=html;
  }
}

function render() {
  document.body.dataset.mode=mode;document.body.dataset.chordCheck=chordCheck;document.body.dataset.chords=String(practiceStyle==='chords'&&!!midiModel);
  $('touch-chord-actions').hidden=!(mode==='touch'&&practiceStyle==='chords'&&!!midiModel);
  if(view==='tuner'){
    const n=notes[tunerIndex];$('target').classList.toggle('kanji',instrument==='sanshin');
    $('target-main').textContent=n.symbol||noteName(n.midi).replace(/\d/g,'');$('target-name').textContent=`${noteName(n.midi)} · ${frequencyFor(n.midi).toFixed(1)} Hz`;
    $('position').textContent=`${n.position}（左手は押さえない）`;$('reference').disabled=false;
    for(const b of $('tuner-strings').querySelectorAll('[data-tune]'))b.setAttribute('aria-pressed',String(Number(b.dataset.tune)===tunerIndex));return;
  }
  const guiding = mode === 'demo', done = follower.done && !guiding;
  const index = guiding && demoIndex >= 0 ? demoIndex : Math.min(follower.index, follower.end - 1);
  const n = notes[index];
  const easyDisplay=midiModel?.easy&&mode!=='mic'&&mode!=='pending';
  const fullChord=instrument==='guitar'&&practiceStyle==='chords'&&midiModel&&(chordCheck==='strum'||easyDisplay);
  const chordMode=instrument==='guitar'&&practiceStyle==='chords'&&!!midiModel,chordCount=chordMode?new Set(notes.map(n=>n.cueIndex)).size:0;
  $('target').classList.toggle('kanji', instrument === 'sanshin');
  $('target-main').textContent = done ? '✓' : instrument === 'sanshin' ? n.symbol : fullChord?n.chord:n.fret;
  $('target-name').textContent = done ? 'できました' : fullChord?'コード':noteName(n.midi);
  $('position').textContent = done ? chordMode?`${chordCount}コードを確認しました。`:`${matchedCount}音、弾けました。` : instrument === 'sanshin' ? n.position : fullChord?easyDisplay?'4つ数えて、1で下へ1回。':'押さえてストローク。構成音から推定します。':focused?`${n.chord?n.chord+' / ':''}${n.string}弦 ${n.fret===0?'開放':n.fret+'F'}`:`${n.chord ? `${n.chord}を押さえて / ` : ''}${n.string}弦 / ${n.fret === 0 ? '開放弦' : `${n.fret}フレット`}`;
  $('progress-text').textContent = chordMode?`${done?chordCount:n.cueIndex+1} / ${chordCount} コード${rounds?` · ${rounds}周`:''}`:`${done ? follower.end : index + 1} / ${notes.length}${rounds ? ` · ${rounds}周` : ''}`;
  if(chordMode)$('score-heading').textContent=easyDisplay?'コードを4拍ずつ':fullChord?'コード譜（推定）':'コードを一弦ずつ';
  $('progress').max = follower.end - follower.start; $('progress').value = (guiding ? index : follower.index) - follower.start;
  $('reference').disabled = done || loading;
  renderChord(n);
  renderScore();
  lyricEditor.position(n.time??index*60/85);
}
function setup() {
  stopAll();
  progressId='';restoredProgress=null;
  scorePage=null;if(view==='tuner')setFocus(false);
  if(view==='tuner'){
    notes=tuningStrings(instrument,transpose);cues=[];tunerIndex=Math.min(tunerIndex,notes.length-1);
  }else if (midiModel) {
    const result = scoreNotes(midiModel, groupId, instrument, { shift: scoreShift, tuning: transpose, highVoice, chords: practiceStyle === 'chords' });
    notes = result.notes; cues = result.cues;
  } else { notes = lessonNotes(instrument, lessonId, transpose); cues = []; }
  $('guitar').setAttribute('aria-pressed', String(instrument === 'guitar'));
  $('sanshin').setAttribute('aria-pressed', String(instrument === 'sanshin'));
  document.body.dataset.view=view;$('view-tuner').setAttribute('aria-pressed',String(view==='tuner'));$('view-practice').setAttribute('aria-pressed',String(view==='practice'));
  document.body.dataset.diagram=String(instrument==='guitar'&&cues.length>0);
  $('mic-start').textContent=view==='tuner'?'マイクで調弦を始める':'マイクで始める';$('touch-start').hidden=view==='tuner';$('target-heading').textContent=view==='tuner'?'合わせる音':'次に弾く音';
  $('tuner-strings').innerHTML=tuningStrings(instrument,transpose).map((n,i)=>`<button data-tune="${i}" aria-pressed="${i===tunerIndex}">${n.label}<small>${frequencyFor(n.midi).toFixed(1)} Hz</small></button>`).join('');
  $('tuner-detail').textContent=instrument==='guitar'?'標準調弦 E2・A2・D3・G3・B3・E4。太い6弦から一本ずつ。':'本調子。男弦・中弦・女弦を一本ずつ。女弦は男弦の1オクターブ上です。';
  $('lesson').innerHTML = '<optgroup label="曲のプリセット">'+SONGS[instrument].map(song=>`<option value="${song.id}">${song.title}</option>`).join('')+'</optgroup><optgroup label="基礎練習">'+LESSONS[instrument].map(l => `<option value="${l.id}">${l.title}</option>`).join('')+'</optgroup>' + (lessonId === 'import' ? '<option value="import">読み込んだMIDI</option>' : lessonId==='chord'?'<option value="chord">選んだコードの練習</option>':'');
  $('lesson').value = lessonId; $('tuning').value = transpose; $('sensitivity').value = gate;
  $('tuning-label').hidden = instrument !== 'sanshin';
  const selectedSong=SONGS[instrument].find(song=>song.id===lessonId);
  $('lesson-detail').textContent = midiModel ? `${selectedSong?.detail||midiTitle} · ${practiceStyle==='chords'?`${cues.length}回のコード`: `${notes.length}音`}${midiModel.warnings.length ? `。${midiModel.warnings.join(' ')}` : ''}` : LESSONS[instrument].find(l => l.id === lessonId).detail;
  $('score-heading').textContent = instrument === 'sanshin' ? '工工四' : practiceStyle === 'chords' && midiModel ? 'コードを一弦ずつ' : 'TAB譜';
  $('score-help').textContent = instrument === 'sanshin' ? '右の列から下へ。文字を押すと、その位置から練習できます。' : practiceStyle === 'chords' && midiModel ? 'コードを押さえたまま、下に示す弦を一本ずつ。画面のストロークでは同じコードの弦をまとめて進めます。' : '数字はフレット。0は開放弦。音符を押すと、その位置から練習できます。';
  for (const id of ['loop-start', 'loop-end']) $(id).innerHTML = notes.map((n, i) => `<option value="${i}">${i + 1}</option>`).join('');
  $('loop-end').value = notes.length - 1;
  $('chord-panel').hidden = instrument !== 'guitar'||!cues.length;
  $('guitar-tools').hidden=instrument!=='guitar';
  $('style-label').hidden = instrument !== 'guitar' || !midiModel || lessonId==='chord';
  $('practice-style').value = practiceStyle;
  $('chord-check-label').hidden=instrument!=='guitar'||practiceStyle!=='chords'||!midiModel;$('chord-check').value=chordCheck;
  $('midi-options').hidden = !midiModel || lessonId==='chord';
  if (midiModel) {
    $('midi-track').replaceChildren(...midiModel.groups.filter(g => !g.percussion).map(g => new Option(`${g.name} · ch ${g.channel+1} · ${g.notes.length}音`,g.id)));
    $('midi-track').value = groupId; $('midi-shift').value = scoreShift; $('high-voice').checked = highVoice;
  }
  $('song-credit').hidden = !selectedSong;
  if (selectedSong) { $('credit-text').textContent = selectedSong.credit; $('credit-link').href = selectedSong.source; }
  $('backing').parentElement.hidden=instrument!=='guitar'||!cues.length||practiceStyle!=='melody';
  $('touch-keys').hidden = practiceStyle === 'chords' && !!midiModel;
  $('touch-chord-actions').hidden=!(practiceStyle==='chords'&&midiModel&&instrument==='guitar');
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
  if(view==='practice'){
    sessionId ||= `exercise:${instrument}:${lessonId}`;
    const title=sessionTitle||selectedSong?.title||midiTitle||LESSONS[instrument].find(l=>l.id===lessonId)?.title||'練習';
    $('session-title').textContent=title;lyricEditor.use(sessionId,title);lyricEditor.hint(midiModel?.easy?{primary:'1・2・3・4と数え、1で下へ1回。切り替えは止まって大丈夫。',secondary:'カポなし。原曲より低い練習用のキーです。'}:null);restorePosition();
    $('session-help').textContent=lessonId==='chord'?'コードを確かめ、譜面と歌詞を一緒に進めます。':'マイクは正解まで待ち、ガイドは曲の速さで進みます。';
  }else{$('session-title').textContent='一本ずつ調弦する';renderResume();}
  renderPickers();
  feedback(view==='tuner'?'合わせる弦を選び、一本だけ鳴らしてください。マイクで高い・低いを確認できます。':restoredProgress?'前回の練習位置を表示しました。マイクか画面を選ぶと続けられます。':practiceStyle === 'chords' && midiModel ? chordCheck==='strum'?'コードを押さえてストローク。全体の推定は試験中です。':'マイクではコードを押さえたまま、大きく表示する弦を一本ずつ弾きます。' : 'マイクか画面を選んで始めましょう。'); save(); render();
}
function advance(result) {
  if (!result.matched) return;
  matchedCount++; flashUntil = performance.now() + 300;
  scorePage=null;
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
  storeProgress();render();
}
function acceptChordCue(){
  const cue=notes[follower.index]?.cueIndex;if(cue===undefined||follower.done)return;
  const remaining=notes.slice(follower.index,follower.end).filter(n=>n.cueIndex===cue).length;
  for(let i=0;i<remaining;i++)advance(follower.accept(performance.now()));
}
async function startMic() {
  if (loading) return;
  stopAll();
  focusPractice();chordGate.reset();
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
    const poly=view==='practice'&&instrument==='guitar'&&practiceStyle==='chords'&&!!midiModel&&chordCheck==='strum';
    analyser = ctx.createAnalyser(); analyser.fftSize = poly?16384:4096;analyser.smoothingTimeConstant=poly?.1:0;
    silent = ctx.createGain(); silent.gain.value = 0;
    source.connect(analyser); analyser.connect(silent).connect(ctx.destination);
    for (const track of acquired.getTracks()) track.addEventListener('ended', () => { if (micStream === acquired) { stopAll(); render(); feedback('マイクが切断されました。もう一度始めてください。'); } });
    mode = 'mic'; $('input-label').textContent = 'マイクで聴いています'; $('mic-start').disabled = false; $('touch-start').disabled = false;
    feedback(poly?'コードを押さえてストローク。全体の推定は試験中です。':'大きく表示されている音を、一音ずつ弾いてください。');
    const buffer = new Float32Array(analyser.fftSize),spectrum=new Float32Array(analyser.frequencyBinCount);
    meterTimer = setInterval(() => {
      if (mode !== 'mic' || !analyser) return;
      analyser.getFloatTimeDomainData(buffer);
      if(poly){
        const now=performance.now(),rms=Math.sqrt(buffer.reduce((sum,value)=>sum+value*value,0)/buffer.length);$('level').style.width=`${Math.min(100,rms*700)}%`;
        if(now<suppressUntil){chordGate.reset();return;}
        analyser.getFloatFrequencyData(spectrum);const detected=detectChord(spectrum,ctx.sampleRate,analyser.fftSize,{rms,gate});
        $('heard').textContent=detected.name||'—';$('cents').textContent=detected.name?`${Math.round(detected.confidence*100)}%`:'—';
        if(chordGate.feed(detected,notes[follower.index]?.chord,now,rms,gate))acceptChordCue();
        else if(now>flashUntil)feedback(detected.name?`${detected.name}らしく聞こえています。目標のコードを安定して鳴らしましょう。`:'コードを鳴らしてください。音が曖昧なときは進めません。');return;
      }
      const now = performance.now(), detection = detectPitch(buffer, ctx.sampleRate, gate);
      $('level').style.width = `${Math.min(100, detection.rms * 700)}%`;
      if (now < suppressUntil) return;
      $('heard').textContent = detection.frequency ? noteName(Math.round(69 + 12 * Math.log2(detection.frequency / 440))) : '—';
      if(view==='tuner'){
        const result=tunerReading(detection,notes[tunerIndex].midi,gate);
        $('cents').textContent=Number.isFinite(result.cents)?`${result.cents>0?'+':''}${Math.round(result.cents)} cent`:'—';
        $('needle').style.left=`${50+Math.max(-48,Math.min(48,(result.cents||0)*.5))}%`;
        feedback({waiting:'選んだ弦を一本だけ、もう一度鳴らしてください。',matched:'合っています。余韻が消えたら、もう一度鳴らして確かめましょう。',high:'少し高いです。糸巻きを少し緩め、弾き直して確認しましょう。',low:'少し低いです。糸巻きを少し張り、弾き直して確認しましょう。',check:'弦と目標の音名・オクターブを確かめてください。大きく回さず、少しずつ合わせます。'}[result.status]);return;
      }
      const result = follower.feed(detection, now);
      $('cents').textContent = Number.isFinite(result.cents) ? `${result.cents > 0 ? '+' : ''}${Math.round(result.cents)} cent` : '—';
      $('needle').style.left = `${50 + Math.max(-48, Math.min(48, (result.cents || 0) * 0.5))}%`;
      if (result.matched) advance(result);
      else if (now > flashUntil) feedback({ listening: '一音ずつ、弾いてみましょう。', hold: 'その音です。少しだけ安定させましょう。', high: '今の音は高めです。弦・押さえる位置・調弦を確かめましょう。', low: '今の音は低めです。弦・押さえる位置・調弦を確かめましょう。', pluck: '同じ音です。前の音を止めて、もう一度弾いてください。' }[result.status] || '次の音を弾いてください。');
    }, poly?80:45);
  } catch (error) {
    if (ticket !== epoch) { acquired?.getTracks().forEach(track => track.stop()); return; }
    acquired?.getTracks().forEach(track => track.stop());
    stopAll(); render();
    feedback(error.name === 'NotAllowedError' ? 'マイクが許可されていません。ブラウザの設定で許可するか、「画面で試す」を選べます。' : error.name === 'NotFoundError' ? 'マイクが見つかりません。「画面で試す」からも練習できます。' : error.name === 'NotReadableError' ? 'マイクを開けませんでした。他のアプリの使用状況を確かめて、もう一度お試しください。' : error.message || 'マイクを開始できませんでした。');
  }
}
function startTouch() {
  if (loading || view==='tuner') return;
  stopAll();
  focusPractice();
  if (follower.done) { matchedCount = rounds = 0; newFollower(); }
  mode = 'touch'; $('touch-panel').hidden = false; $('stop').disabled = false;
  $('input-label').textContent = '画面で練習中'; feedback('大きく表示する音を、下のボタンで弾いてみましょう。'); render();
  if (practiceStyle === 'chords' && midiModel) { $('fret-details').open = !focused; feedback('図を見て押さえ、ストローク。'); }
}
async function demo() {
  if (loading || view==='tuner') return;
  if (mode === 'demo') { stopAll(); render(); feedback('お手本を止めました。'); return; }
  stopAll();focusPractice(); mode = 'demo'; $('stop').disabled = false;
  const ticket = epoch, [start, end] = bounds(), speed = Number($('tempo').value) / 85;
  demoIndex=start;scorePage=null;render();
  $('input-label').textContent = 'ガイドを再生中'; $('demo').textContent = '■ ガイドを止める';
  feedback('ガイドに合わせて弾きましょう。この練習ではマイクの採点を止めています。');
  try {
    const ctx = await audio(); if (ticket !== epoch) return;
    const fallback = 60/85, base = midiModel ? (start===0?0:notes[start].time) : start*fallback;
    const events = notes.slice(start,end).map((n,i)=>({index:start+i,midi:n.midi,time:((n.time??((start+i)*fallback))-base)/speed,duration:(n.duration??.5)/speed}));
    const last=notes[end-1], span=((last.time??((end-1)*fallback))+(last.stepSeconds??fallback)-base)/speed;
    const audioEvents=midiModel?.easy&&practiceStyle==='chords'?events.filter((e,i)=>i===0||notes[e.index].cueIndex!==notes[events[i-1].index].cueIndex).flatMap(first=>events.filter(e=>notes[e.index].cueIndex===notes[first.index].cueIndex).map((e,i)=>({...e,time:first.time+i*.03,duration:1.3/speed}))):events;
    const backing = instrument==='guitar' && practiceStyle==='melody' && $('backing').checked ? cues.filter(c=>c.time>=base && c.time<base+span*speed).map(c=>({time:(c.time-base)/speed,chord:c.chord})) : [];
    const beat=(midiModel?.tempos?.[0]?.mpqn/1e6||60/85)/speed,count=$('count-in').checked?4:0;
    const origin=ctx.currentTime+.06;for(let i=0;i<count;i++)scheduleTone(ctx,i===0?84:79,.045,origin+i*beat,.04);
    let began=origin+count*beat, scheduled=0, chordScheduled=0, visual=-1, cycle=1,counted=!count;
    const pump=()=>{
      if(ticket!==epoch)return;
      const elapsed=ctx.currentTime-began;
      if(elapsed>=span){
        if(!$('loop-enabled').checked){stopAll();render();feedback('ガイドが終わりました。マイクか画面で練習できます。');return;}
        began+=span; scheduled=chordScheduled=0;visual=-1;cycle++; feedback(`ガイド ${cycle}周目。一緒に弾いてみましょう。`);
      }
      const now=ctx.currentTime-began;
      if(now<0&&count)feedback(`カウント ${Math.max(1,Math.ceil(-now/beat))}。準備しましょう。`);
      else if(!counted){counted=true;feedback('ガイドに合わせて弾きましょう。マイクの採点は停止しています。');}
      while(scheduled<audioEvents.length && audioEvents[scheduled].time<now+.12){const e=audioEvents[scheduled++];scheduleTone(ctx,e.midi,e.duration,began+e.time,midiModel?.easy ? .045 : .12);}
      while(chordScheduled<backing.length && backing[chordScheduled].time<now+.12){const e=backing[chordScheduled++];CHORDS[e.chord].frets.forEach((f,i)=>{if(f>=0)scheduleTone(ctx,GUITAR_OPEN[i]+f,.7,began+e.time+i*.025,.024);});}
      let index=-1; for(let i=0;i<events.length;i++){if(events[i].time<=now)index=i;else break;}
      if(index>=0 && index!==visual){visual=index;demoIndex=events[index].index;scorePage=null;render();}
      if(now>=0)lyricEditor.position(base+now*speed);
      demoTimer=setTimeout(pump,25);
    };pump();
  } catch(error) { if(ticket===epoch){stopAll();render();feedback(error.message);} }
}

for (const id of ['guitar', 'sanshin']) $(id).onclick = () => { cancelLoad(); instrument = id;sessionId=sessionTitle='';tunerIndex=0;midiModel=null; practiceStyle='melody'; lessonId = 'open'; $('loop-enabled').checked = false; setup();renderLearning(instrument);if(view==='practice')selectSong(SONGS[instrument][0].id); };
$('view-tuner').onclick=()=>{singalong.close();cancelLoad();view='tuner';$('loop-enabled').checked=false;setup();};
$('view-practice').onclick=()=>{singalong.close();cancelLoad();const previous=practiceSnapshot;view='practice';setup();if(!midiModel)restorePractice(previous);};
$('view-singalong').onclick=()=>singalong.open();$('singalong-song-start').onclick=()=>singalong.open('tokiyo');
$('focus-mode').onclick=()=>setFocus(!focused);
$('open-fretboard').onclick=()=>{setFocus(false);$('fret-details').open=true;$('fret-details').scrollIntoView({block:'center',behavior:'smooth'});};
$('resume-focus').onclick=()=>{focusPractice();render();};
$('resume-practice').onclick=()=>{if(follower.done){newFollower();matchedCount=rounds=0;storeProgress();}focusPractice();render();feedback('マイクか画面を選んで、ここから始められます。');};
$('edit-lyrics').onclick=()=>{setFocus(false);lyricEditor.open();};
$('score-prev').onclick=()=>{scorePage=Math.max(0,lastScorePage-1);renderScore();};
$('score-next').onclick=()=>{scorePage=lastScorePage+1;renderScore();};
$('chord-check').onchange=()=>{chordCheck=$('chord-check').value;stopAll();chordGate.reset();save();render();feedback(chordCheck==='strum'?'コード全体の推定は試験機能です。転回形や指の位置は確定できません。':'コードを押さえ、大きく表示する弦を一本ずつ弾きます。');};
$('tuner-strings').onclick=event=>{const b=event.target.closest('[data-tune]');if(b){tunerIndex=Number(b.dataset.tune);render();feedback('選んだ弦を一本だけ鳴らして、針と高低を確かめましょう。');}};
$('preset-songs').onclick=event=>{const button=event.target.closest('[data-preset-song]');if(button)selectSong(button.dataset.presetSong);};
$('easy-song-start').onclick=()=>{$('study-select').value='tokiyo';$('study-select').onchange();const study=STUDIES.guitar.find(s=>s.id==='tokiyo');const stage=study.stages[0];startChordExercise(stage.names,`${study.title} · ${stage.title}`,`study:${study.id}:0`,{easy:true});};
$('chord-library').onclick=event=>{const button=event.target.closest('[data-practice-chord]');if(button)startChordExercise([button.dataset.practiceChord],`${button.dataset.practiceChord}の練習`);};
$('progression-choices').onclick=event=>{const button=event.target.closest('[data-progression]');const p=PROGRESSIONS.find(p=>p.id===button?.dataset.progression);if(p)startChordExercise(p.names,p.title);};
$('lesson').onchange = () => {
  const id=$('lesson').value;
  if(SONGS[instrument].some(song=>song.id===id))selectSong(id);
  else if(id!=='import'&&id!=='chord'){cancelLoad();sessionId=sessionTitle='';midiModel=null;practiceStyle='melody';lessonId=id;setup();$('midi-status').textContent='';}
};
$('midi-file').onchange = () => { const file=$('midi-file').files[0]; if(!file)return; if(file.size>MIDI_LIMITS.bytes){$('midi-status').textContent='1 MB以下のMIDIを選んでください。';return;} loadScore(()=>file.arrayBuffer(),file.name); $('midi-file').value=''; };
$('midi-url-form').onsubmit = event => { event.preventDefault(); const url=$('midi-url').value.trim(); if(url)loadScore(signal=>fetchMidi(url,{signal}),'URLからのMIDI'); };
for(const id of ['midi-track','midi-shift','high-voice','practice-style'])$(id).onchange=applyMidiOptions;
$('fretboard').onclick=event=>{const b=event.target.closest('[data-fret]');if(!b)return;selectedFrets[Number(b.dataset.string)]=Number(b.dataset.fret);renderFrets();};
$('chord-choices').onclick=event=>{const b=event.target.closest('[data-chord]');if(!b)return;selectedFrets=[...CHORDS[b.dataset.chord].frets];renderFrets();};
$('set-shape').onclick=()=>{selectedFrets=[...CHORDS[$('chord-name').textContent].frets];renderFrets();};
$('strum').onclick=async()=>{
  if(loading)return;
  if(mode==='mic'||mode==='pending'||mode==='demo'){stopAll();render();}
  const ticket=epoch;
  try{const ctx=await audio();if(ticket!==epoch)return;selectedFrets.forEach((f,i)=>{if(f>=0)scheduleTone(ctx,GUITAR_OPEN[i]+f,.8,ctx.currentTime+i*.035,.055);});$('stop').disabled=false;
    if(mode==='touch' && practiceStyle==='chords' && midiModel && !follower.done){
      const target=notes[follower.index];
      if(shapeMatches(selectedFrets,target.chord)){
        acceptChordCue();
      }else feedback(`${target.chord}の図を見て、押さえる位置と弾かない弦を確かめましょう。`);
    }else feedback('画面のコードを鳴らしました。コードを練習する時は「コード」→「画面で試す」へ。');
  }catch(error){if(ticket===epoch)feedback(error.message);}
};
$('tuning').onchange = () => { cancelLoad(); transpose = Number($('tuning').value); setup(); };
$('sensitivity').onchange = () => { cancelLoad(); gate = Number($('sensitivity').value); stopAll(); newFollower(); save(); render(); feedback('感度を変えました。マイクで始めると反映されます。'); };
for (const id of ['loop-enabled', 'loop-start', 'loop-end']) $(id).onchange = () => {
  cancelLoad();
  if (Number($('loop-start').value) > Number($('loop-end').value)) { if (id === 'loop-start') $('loop-end').value = $('loop-start').value; else $('loop-start').value = $('loop-end').value; }
  stopAll(); newFollower();scorePage=null; matchedCount = rounds = 0;storeProgress(); render(); feedback('練習する範囲を変えました。もう一度始めましょう。');
};
$('loop-visible').onclick=()=>{const button=$('loop-visible');$('loop-start').value=button.dataset.start;$('loop-end').value=Number(button.dataset.end)-1;$('loop-enabled').checked=true;$('loop-enabled').onchange();};
$('loop-all').onclick=()=>{$('loop-enabled').checked=false;$('loop-enabled').onchange();};
$('mic-start').onclick = startMic; $('touch-start').onclick = startTouch; $('demo').onclick = demo;
$('stop').onclick = () => { cancelLoad(); stopAll(); render(); feedback('止めました。続きから始められます。'); };
$('restart').onclick = () => { cancelLoad(); stopAll(); newFollower();scorePage=null; matchedCount = rounds = 0;storeProgress(); render(); feedback('最初に戻りました。マイクか画面で始めましょう。'); };
$('tempo').onchange = () => {save(); if (mode === 'demo') { stopAll(); render(); feedback('速さを変えました。お手本をもう一度再生できます。'); } };
$('count-in').onchange=$('backing').onchange=save;
$('score').onclick = event => {
  const button = event.target.closest('[data-index]');
  if (!button) return;
  cancelLoad(); stopAll(); const index = Number(button.dataset.index), [start, end] = bounds();
  if (index < start || index >= end) $('loop-enabled').checked = false;
  newFollower(index); matchedCount = rounds = 0;storeProgress(); render(); feedback(`${index + 1}音目から始められます。`);
};
$('reference').onclick = async () => {
  if (follower.done || loading) return;
  if (mode === 'demo') { stopAll(); render(); }
  const ticket = epoch;
  suppressUntil = performance.now() + 1250; follower.candidateAt = null;
  feedback('お手本を再生中。マイク判定は少し待ちます。');
  try { await tone(notes[view==='tuner'?tunerIndex:follower.index].midi);if(ticket===epoch){suppressUntil=performance.now()+1250;chordGate.reset();} } catch (error) { if (ticket === epoch) feedback(error.message); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelLoad(); stopAll(); render(); feedback('画面を離れたので停止しました。もう一度始めてください。'); } });
window.addEventListener('pagehide', () => {cancelLoad();stopAll();});
$('midi-shift').replaceChildren(...Array.from({length:49},(_,i)=>new Option(i-24===0?'0（元の調）':`${i-24>0?'+':''}${i-24}`,i-24)));
const renderLearning=mountLearning({onPractice:startChordExercise,onBasics:(identity,title)=>{cancelLoad();view='practice';sessionId=identity;sessionTitle=title;midiModel=null;practiceStyle='melody';lessonId='open';$('loop-enabled').checked=false;setup();},onLeave:()=>{cancelLoad();stopAll();render();}});
const lyricEditor=mountLyrics({defaults:LYRIC_PRESETS,onImport:async value=>{
  cancelLoad();stopAll();const ticket=loadEpoch;
  const identity=`chordpro:${await contentKey(new TextEncoder().encode(value.names.join(',')+'\n'+value.text))}`;
  if(ticket!==loadEpoch)return false;
  startChordExercise(value.names,value.title,identity);lyricEditor.import(value);render();return true;
}});
const singalong=mountSingalong({onTakeOver:()=>{cancelLoad();stopAll();setFocus(false);},onChange:open=>{singalongOpen=open;$('view-tuner').setAttribute('aria-pressed',String(!open&&view==='tuner'));$('view-practice').setAttribute('aria-pressed',String(!open&&view==='practice'));save();}});
function restorePractice(snapshot){
  if(snapshot?.instrument&&snapshot.instrument!==instrument){selectSong(SONGS[instrument][0].id);return;}
  if(instrument==='guitar'&&snapshot?.lesson==='chord'&&Array.isArray(snapshot.chordNames)&&snapshot.chordNames.length>0&&snapshot.chordNames.length<=64&&snapshot.chordNames.every(name=>Object.hasOwn(CHORDS,name))){startChordExercise(snapshot.chordNames,String(snapshot.chordTitle||'コードの練習').slice(0,80),String(snapshot.sessionId||`chords:${snapshot.chordNames.join(',')}`).slice(0,200),{easy:snapshot.easyPractice===true,restoring:true});return;}
  if(SONGS[instrument].some(song=>song.id===snapshot?.lesson)){selectSong(snapshot.lesson,instrument==='guitar'&&snapshot.practiceStyle==='chords'?'chords':'melody');return;}
  if(LESSONS[instrument].some(l=>l.id===snapshot?.lesson)){lessonId=snapshot.lesson;sessionId=String(snapshot.sessionId||'').slice(0,200);sessionTitle=String(snapshot.sessionTitle||'').slice(0,80);setup();return;}
  selectSong(SONGS[instrument][0].id);
}
$('tempo').value=[60,85,110].includes(saved.tempo)?saved.tempo:85;$('count-in').checked=saved.countIn===true;$('backing').checked=saved.backing!==false;
const initialSnapshot=practiceSnapshot;setup();renderLearning(instrument);if(view==='practice')restorePractice(initialSnapshot);
if(singalongOpen)singalong.open();

let installPrompt = null;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
$('install').onclick = async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; $('install').hidden = true; } };
window.addEventListener('appinstalled', () => { $('install').hidden = true; });
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(registration => {
    const ready = async () => {
      try {
        const cache = await caches.open('music-practice-v8');
        const paths=['./app.mjs?v=8',...new Set(Object.values(SONGS).flat().map(song=>`./songs/${song.file}`))];
        if((await Promise.all(paths.map(path=>cache.match(new URL(path,location.href).href)))).every(Boolean))$('offline-state').textContent = 'オフライン準備OK';
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
