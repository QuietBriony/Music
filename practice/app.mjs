import { mountScoreStrip } from './score-strip.mjs?v=28';
import { MicInputBoost,mountMicGainControls } from './mic-input.mjs?v=28';
import { mountGuitarPlaylist } from './guitar-playlist.mjs?v=28';
import { mountSanshinPlaylist } from './sanshin-playlist.mjs?v=28';
import { mountHandGuide } from './hand-guide.mjs?v=28';
import { LESSONS, lessonNotes, noteName, frequencyFor, detectPitch, NoteFollower } from './music.mjs?v=28';
import { parseMidi, fetchMidi, MIDI_LIMITS, melodyNotes } from './midi.mjs?v=28';
import { CHORDS, CHORD_GROUPS, PROGRESSIONS, GUITAR_OPEN, shapeMatches, bestShift } from './chords.mjs?v=28';
import { SONGS, scoreNotes, chordExercise } from './scores.mjs?v=28';
import { SANSHIN_TUNINGS,sanshinTuning,tuningLabel,tuningStrings, tuningGate, detectTuningPitch, TunerTracker } from './tuner.mjs?v=28';
import { mountFullScore } from './full-score.mjs?v=28';
import { mountLearning,STUDIES } from './learning.mjs?v=28';
import { guitarShape,drawChord,fillFingerList,strumInstruction,fingerLines,mountGuitarGuides } from './chord-guide.mjs?v=28';
import { detectChord, ChordGate,chordAttackLevel } from './polyphonic.mjs?v=28';
import { mountLyrics } from './lyrics.mjs?v=28';
import { LYRIC_PRESETS } from './lyric-presets.mjs?v=28';
import { PracticeProgress,progressKey } from './progress.mjs?v=28';
import { mountSingalong } from './singalong.mjs?v=28';
import { pluckDuration, schedulePluck } from './instrument-voice.mjs?v=28';

import { renderSanshinTarget } from './sanshin-view.mjs?v=28';
import { mountSanshinGuide } from './sanshin-guide.mjs?v=28';

const $ = id => document.getElementById(id);
mountGuitarGuides();
const tunerTracker=new TunerTracker();
const STORAGE = 'music-practice-settings-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch { /* Private mode / unavailable storage is fine. */ }
let instrument = saved.instrument === 'sanshin' ? 'sanshin' : 'guitar';
let view = saved.view==='practice'?'practice':'tuner', tunerIndex=0;
let lessonId = LESSONS[instrument].some(item => item.id === saved.lesson) ? saved.lesson : 'open';
let transpose = [0, -1, -2, -3, 2].includes(saved.transpose) ? saved.transpose : 0;
let tuningKind=Object.hasOwn(SANSHIN_TUNINGS,saved.tuningKind)?saved.tuningKind:'honchoshi';
let gate = [0.003, 0.006, 0.014].includes(saved.gate) ? saved.gate : 0.006;
let notes, follower, mode = 'idle', rounds = 0, matchedCount = 0;
let midiModel = null, midiTitle = '', groupId = '', practiceStyle = 'melody', scoreShift = 0, highVoice = false, cues = [];
let loadController = null, loadEpoch = 0, loading = false, selectedFrets = [0, 0, 0, 0, 0, 0];
let sessionId='',sessionTitle='',focused=false,scorePage=null,lastScorePage=0;
let chordCheck=saved.chordCheckRevision===2&&saved.chordCheck==='strings'?'strings':'strum';
const practiceShape=name=>guitarShape(name,chordCheck==='strum');
const chordReference=()=>view==='practice'&&instrument==='guitar'&&practiceStyle==='chords'&&!!midiModel&&chordCheck==='strum';
const practiceMatches=(frets,name)=>shapeMatches(frets,name)||chordCheck==='strum'&&practiceShape(name)?.frets.every((f,i)=>f===frets[i]);
let singalongOpen=saved.singalong===true;
let practiceSnapshot=saved.practiceSnapshot||{lesson:saved.lesson,practiceStyle:saved.practiceStyle,chordNames:saved.chordNames,chordTitle:saved.chordTitle};
const chordGate=new ChordGate();
const progressStore=new PracticeProgress({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
let progressId='',restoredProgress=null;
let context = null, micStream = null, analyser = null, source = null, silent = null, inputBoost=null;
let epoch = 0, meterTimer = null, demoTimer = null, suppressUntil = 0, flashUntil = 0, demoIndex = -1;
const voices = new Set();
let referenceVoice = null, referenceActive = false, referenceTicket = 0;
const referenceVoices=new Set();
const feedback = text => { if ($('feedback').textContent !== text) $('feedback').textContent = text; };
const tunerInputStatus = text => {if($('tuner-input-status').textContent!==text)$('tuner-input-status').textContent=text;};
function save() {
  if(view==='practice')practiceSnapshot={instrument,lesson:lessonId,practiceStyle,chordNames:lessonId==='chord'?midiModel.markers.map(c=>c.chord):null,chordTitle:lessonId==='chord'?midiTitle:null,sessionId,sessionTitle,easyPractice:midiModel?.easy===true};
  try { localStorage.setItem(STORAGE, JSON.stringify({ uiVersion:23, view, instrument, lesson:lessonId, transpose, tuningKind, gate, practiceStyle,chordCheck,chordCheckRevision:2,practiceSnapshot,tempo:Number($('tempo').value),countIn:$('count-in').checked,backing:$('backing').checked,singalong:singalongOpen })); } catch { /* Storage is optional. */ }
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
  follower = new NoteFollower(notes, { start, end, gate: instrument==='sanshin'?tuningGate(gate):gate, dropout:120 });
  if (Number.isInteger(index) && index >= start && index < end) follower.reset(index);
}
function stopVoices() {
  for (const voice of voices) { try { voice.stop(); voice.disconnect(); } catch { /* Already ended. */ } }
  voices.clear();
}
function stopReference() {
  referenceTicket++; referenceActive = false;
  const previous = referenceVoice; referenceVoice = null;
  for(const voice of referenceVoices){voices.delete(voice);try{voice.stop();voice.disconnect();}catch{}}referenceVoices.clear();
  if (previous) { voices.delete(previous); try { previous.stop(); previous.disconnect(); } catch { /* Already ended. */ } }
  $('reference').textContent = chordReference()?'♪ このコードを聴く':'♪ この音を聴く';
  $('reference').setAttribute('aria-pressed', 'false');
  // Let the loudspeaker's last sound die away before accepting a real pluck.
  suppressUntil = performance.now() + 350;
  chordGate.reset(); if (follower) follower.candidateAt = null;
  if (mode === 'idle') {
    $('input-label').textContent = '停止中';
    $('stop').disabled = voices.size === 0;
    if (!referenceVoice && $('stop').disabled && context) {
      const old = context; context = null;
      if (old.state !== 'closed') old.close().catch(() => {});
    }
  }
}
function stopAll() {
  epoch++;
  clearInterval(meterTimer); clearTimeout(demoTimer); meterTimer = demoTimer = null;
  if (micStream) micStream.getTracks().forEach(track => track.stop());
  micStream = null;
  for (const node of [source, analyser, silent]) { try { node?.disconnect(); } catch { /* Disconnected. */ } }
  source = analyser = silent = null;inputBoost?.disconnect();inputBoost=null;
  stopReference(); stopVoices(); suppressUntil = 0;
  const oldContext = context; context = null;
  if (oldContext && oldContext.state !== 'closed') oldContext.close().catch(() => {});
  mode = 'idle'; demoIndex = -1; $('stop').disabled = true;
  document.body.dataset.mode=mode;if(mode!=='mic')$('practice-input-status').textContent='小さな音は「音を拾う強さ」で補正できます。周りの音も拾う場合は「通常」へ。';
  $('mic-start').disabled = $('touch-start').disabled = loading;
  $('input-label').textContent = '停止中'; $('demo').textContent = '♪ ガイドに合わせて弾く';
  $('level').style.width = '0%'; $('heard').textContent = '—'; $('cents').textContent = '—'; $('needle').style.left = '50%';
  $('touch-panel').hidden = true;
  resetTunerDisplay();
}
function resetTunerDisplay(){
  tunerTracker.reset();$('needle').hidden=view==='tuner';$('detected-frequency').textContent='— Hz';
  if(view==='tuner'){$('heard').textContent='—';$('cents').textContent='—';$('tuner-verdict').textContent='一本、鳴らしてください';$('practice-stage').dataset.held='false';}
  tunerInputStatus(mode==='mic'?'一本だけ弾いてください。':'マイクを始めると、入力の状態がここに出ます。');
  $('practice-stage').dataset.tuning='waiting';
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
function scheduleTone(ctx, midi, duration = 0.55, when = ctx.currentTime, volume = 0.12, reference = false) {
  if (ctx.state === 'closed') return null;
  const voice = schedulePluck(ctx, { instrument, midi, duration: pluckDuration(instrument, duration, reference), when, volume });
  if (!voice) return null;
  // A long imported score must not accumulate unbounded ringing voices.
  if (voices.size >= 48) { const oldest = voices.values().next().value; try { oldest.stop(); } catch { /* Already ended. */ } voices.delete(oldest); }
  voices.add(voice);
  voice.addEventListener('ended', () => voices.delete(voice), { once: true });
  return voice;
}
function scheduleClick(ctx, midi, duration, when, volume) {
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
  const name = currentChord(note), shape = practiceShape(name);
  $('chord-name').textContent = name;
  $('chord-hand-open').textContent=`${name}・手の形`;$('chord-hand-open').setAttribute('aria-label',`${name}の手の形を見る`);
  $('chord-diagram').replaceChildren(drawChord(name,shape));fillFingerList($('native-fingers'),shape);$('native-strum-guide').textContent=strumInstruction(shape);
  $('chord-instruction').textContent = `${name}：${shape.frets.map((f,i)=>`${6-i}弦${f<0?'は弾かない':f===0?'は開放':f+'フレット'}`).join('、')}。`;
  const barre=fingerLines(shape).find(s=>s.barre)?.barre;$('chord-barre').textContent=barre?`セーハ：人差し指で${barre.fret}フレットの${barre.from}〜${barre.to}弦をまとめて押さえます。`:'セーハなしで押さえられる形です。';
  for(const button of $('chord-library').querySelectorAll('[data-practice-chord]'))button.setAttribute('aria-pressed',String(button.dataset.practiceChord===name));
  $('set-shape').textContent=`${name}の形を指板に置く`;
  renderFrets();
}
function renderFrets() {
  $('fretboard').innerHTML = selectedFrets.map((chosen,i) => `<div class="fret-row"><span>${6-i}弦</span>${[-1,0,1,2,3,4,5,6].map(f=>`<button data-string="${i}" data-fret="${f}" aria-label="${6-i}弦 ${f<0?'ミュート':f===0?'開放':f+'フレット'}" aria-pressed="${chosen===f}">${f<0?'×':f===0?'○':f}</button>`).join('')}</div>`).join('');
  $('shape-status').textContent = `画面の形：${Object.keys(CHORDS).find(name=>practiceMatches(selectedFrets,name)) || '編集中'} · 6弦 → 1弦`;
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
    return true;
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
const scoreStrip=mountScoreStrip($('score'));
function renderScore() {
  if(view==='tuner')return;
  const current=mode==='demo'?demoIndex:follower.done?-1:follower.index,[start,end]=bounds();
  fullScore.update({notes,instrument,strum:chordCheck==='strum',easy:midiModel?.easy===true,chords:practiceStyle==='chords'&&!!midiModel&&instrument==='guitar',guitarDiagram:instrument==='guitar'&&practiceStyle==='chords'&&midiModel?$('chord-diagram').firstElementChild:null,guitarInstruction:instrument==='guitar'&&practiceStyle==='chords'&&midiModel?fingerLines(practiceShape(currentChord(notes[Math.max(0,Math.min(notes.length-1,current<0?follower.end-1:current))]))).map(s=>s.text).join(' / '):'',title:$('session-title').textContent,index:Math.max(0,Math.min(notes.length-1,current<0?follower.end-1:current)),start,end,mode,tuning:transpose});
  const grouped=practiceStyle==='chords'&&midiModel&&instrument==='guitar';
  const entries=notes.flatMap((n,i)=>!grouped||i===0||n.cueIndex!==notes[i-1].cueIndex?[{n,index:i}]:[]);
  entries.forEach((e,i)=>e.end=entries[i+1]?.index??notes.length);
  const active=follower.done&&mode!=='demo'?entries.length-1:Math.max(0,entries.findIndex(e=>current>=e.index&&current<e.end)),size=6;
  const page=Math.max(0,Math.min(Math.ceil(entries.length/size)-1,scorePage??Math.floor(active/size)));lastScorePage=page;
  const visible=entries.slice(page*size,page*size+size);
  $('loop-visible').textContent=instrument==='sanshin'?`${visible[0].index+1}〜${visible.at(-1).end}音を繰り返す`:'表示中を繰り返す';
  $('loop-visible').dataset.start=visible[0].index;$('loop-visible').dataset.end=visible.at(-1).end;
  $('loop-summary').textContent=$('loop-enabled').checked?grouped?`${notes[start].cueIndex+1}〜${notes[end-1].cueIndex+1}コードを反復`:`${start+1}〜${end}音を反復`:'全体を練習';
  $('loop-all').hidden=!$('loop-enabled').checked;
  $('score-range').textContent=`${page*size+1}〜${Math.min(entries.length,(page+1)*size)} / ${entries.length}${grouped?' コード':'音'}`;
  $('score').classList.toggle('score-continuous',instrument==='sanshin');$('score-follow').hidden=instrument!=='sanshin'||scorePage===null;
  $('score-prev').disabled=page===0;$('score-next').disabled=(page+1)*size>=entries.length;
  const classes=e=>`${current>=e.index&&current<e.end?' current':''}${e.end<=follower.index?' passed':''}${e.end<=start||e.index>=end?' outside':''}${mode==='demo'&&current>=e.index&&current<e.end?' preview':''}`;
  const length=n=>Number.isFinite(n.beats)?`${Number(n.beats.toFixed(2))}拍`:'';
  if(grouped){
    $('score').innerHTML=`<div class="chord-score">${visible.map(e=>`<button class="${classes(e)}" data-index="${e.index}" aria-label="${e.n.chord}のコード、${e.index+1}音目から">${e.n.chord}<small>${chordCheck==='strum'?'ジャーンと1回':notes.slice(e.index,e.end).length+'本の弦'}</small></button>`).join('')}</div>`;
  }else if(instrument==='sanshin'){
    scoreStrip.update({notes,current:current<0?notes.length-1:current,accepted:follower.index,start,end,page:scorePage});
    $('score-range').textContent=scorePage===null?`${active+1} / ${entries.length}音 · 先の音まで表示`:`${page*size+1}音目から · 手動表示`;
  }else{
    let html='<div class="tab-block"><div class="tab-string-labels">'+['e','B','G','D','A','E'].map(n=>`<span class="tab-label">${n}</span>`).join('')+'</div>';
    for(const e of visible){const n=e.n,strings=[1,2,3,4,5,6].map(string=>`<span>${n.string===string?`<em>${n.fret}</em>`:''}</span>`).join('');html+=`<button class="tab-column${classes(e)}" data-index="${e.index}" aria-label="${e.index+1}音目、${noteLabel(n)} ${length(n)}">${strings}<small class="note-length">${length(n)}</small></button>`;}
    html+='</div>';$('score').innerHTML=html;
  }
}

function render() {
  document.body.dataset.mode=mode;if(mode!=='mic')$('practice-input-status').textContent='小さな音は「音を拾う強さ」で補正できます。周りの音も拾う場合は「通常」へ。';document.body.dataset.chordCheck=chordCheck;document.body.dataset.chords=String(practiceStyle==='chords'&&!!midiModel);
  $('touch-chord-actions').hidden=!(mode==='touch'&&practiceStyle==='chords'&&!!midiModel);
  if(view==='tuner'){
    const n=notes[tunerIndex];$('target').classList.toggle('kanji',instrument==='sanshin');
    $('target-main').textContent=n.symbol||noteName(n.midi).replace(/\d/g,'');$('target-name').textContent=`${noteName(n.midi)} · ${frequencyFor(n.midi).toFixed(1)} Hz`;
    $('position').textContent=`${n.position}（左手は押さえない）`;$('reference').disabled=false;
    if(instrument==='sanshin')renderSanshinTarget($('sanshin-target'),n,null);
    for(const b of $('tuner-strings').querySelectorAll('[data-tune]'))b.setAttribute('aria-pressed',String(Number(b.dataset.tune)===tunerIndex));return;
  }
  const guiding = mode === 'demo', done = follower.done && !guiding;
  const index = guiding && demoIndex >= 0 ? demoIndex : Math.min(follower.index, follower.end - 1);
  const n = notes[index];
  if(!referenceActive)$('reference').textContent=chordReference()?'♪ このコードを聴く':'♪ この音を聴く';
  const easyDisplay=midiModel?.easy&&mode!=='mic'&&mode!=='pending';
  const fullChord=instrument==='guitar'&&practiceStyle==='chords'&&midiModel&&(chordCheck==='strum'||easyDisplay);
  const chordMode=instrument==='guitar'&&practiceStyle==='chords'&&!!midiModel,chordCount=chordMode?new Set(notes.map(n=>n.cueIndex)).size:0;
  $('target-heading').textContent=chordMode?'今のコード':'次に弾く音';$('target').classList.toggle('kanji', instrument === 'sanshin');
  $('target-main').textContent = done ? '✓' : instrument === 'sanshin' ? n.symbol : fullChord?n.chord:n.fret;
  $('target-name').textContent = done ? 'できました' : fullChord?'コード':noteName(n.midi);
  $('position').textContent = done ? chordMode?`${chordCount}コードを確認しました。`:`${matchedCount}音、弾けました。` : instrument === 'sanshin' ? '工工四の文字と歌詞を見ながら弾きます。' : fullChord?easyDisplay?'4つ数えて、1で下へ1回。':'図の指を置いて、ジャーンと1回。':focused?`${n.chord?n.chord+' / ':''}${n.string}弦 ${n.fret===0?'開放':n.fret+'F'}`:`${n.chord ? `${n.chord}を押さえて / ` : ''}${n.string}弦 / ${n.fret === 0 ? '開放弦' : `${n.fret}フレット`}`;
  $('progress-text').textContent = chordMode?`${done?chordCount:n.cueIndex+1} / ${chordCount} コード${rounds?` · ${rounds}周`:''}`:`${done ? follower.end : index + 1} / ${notes.length}${rounds ? ` · ${rounds}周` : ''}`;
  if(chordMode)$('score-heading').textContent=easyDisplay?'コードを4拍ずつ':fullChord?'コード譜（推定）':'コードを一弦ずつ';
  $('progress').max = follower.end - follower.start; $('progress').value = (guiding ? index : follower.index) - follower.start;
  $('reference').disabled = done || loading;
  renderChord(n);
  if(instrument==='sanshin')renderSanshinTarget($('sanshin-target'),n,done?null:notes[index+1<follower.end?index+1:$('loop-enabled').checked?follower.start:-1],done);
  renderScore();
  lyricEditor.position(n.time??index*60/85);
}
function setup() {
  stopAll();
  progressId='';restoredProgress=null;
  scorePage=null;if(view==='tuner')setFocus(false);
  if(view==='tuner'){
    notes=tuningStrings(instrument,transpose,tuningKind);cues=[];tunerIndex=Math.min(tunerIndex,notes.length-1);
  }else if (midiModel) {
    const result = scoreNotes(midiModel, groupId, instrument, { shift: scoreShift, tuning: transpose, highVoice, chords: practiceStyle === 'chords' });
    notes = result.notes; cues = result.cues;
  } else { notes = lessonNotes(instrument, lessonId, transpose); cues = []; }
  $('guitar').setAttribute('aria-pressed', String(instrument === 'guitar'));
  $('sanshin').setAttribute('aria-pressed', String(instrument === 'sanshin'));
  document.body.dataset.view=view;$('view-tuner').setAttribute('aria-pressed',String(view==='tuner'));$('view-practice').setAttribute('aria-pressed',String(view==='practice'));
  document.body.dataset.instrument=instrument;
  document.body.dataset.diagram=String(instrument==='guitar'&&cues.length>0);
  $('sanshin-panel').hidden=instrument!=='sanshin';
  $('sanshin-credit').hidden=instrument!=='sanshin'||lessonId!=='tinsagu';
  $('full-score-open').hidden=view!=='practice';$('full-score-open').textContent=instrument==='sanshin'?'工工四を全体で見る':'譜面と歌詞を全体で見る';
  $('mic-start').textContent=view==='tuner'?'マイクで調弦を始める':'マイクで始める';$('touch-start').hidden=view==='tuner';$('target-heading').textContent=view==='tuner'?'合わせる音':'次に弾く音';
  $('tuner-strings').innerHTML=tuningStrings(instrument,transpose,tuningKind).map((n,i)=>`<button data-tune="${i}" aria-pressed="${i===tunerIndex}">${n.label}<small>${frequencyFor(n.midi).toFixed(1)} Hz</small></button>`).join('');
  const shownKind=view==='tuner'?tuningKind:'honchoshi',t=sanshinTuning(shownKind);
  $('tuning-heading').textContent=`${t.name}の高さ`;
  for(const option of $('tuning').options)option.textContent=tuningLabel(Number(option.value),shownKind);
  $('tuner-kind').value=tuningKind;$('tuner-kind-label').hidden=$('tuning-source').hidden=instrument!=='sanshin';
  $('tuning-reminder').hidden=instrument!=='sanshin'||view!=='practice'||tuningKind==='honchoshi';
  $('tuner-detail').textContent=instrument==='guitar'?'標準調弦 E2・A2・D3・G3・B3・E4。太い6弦から一本ずつ。':`${tuningLabel(transpose,tuningKind)}（${sanshinTuning(tuningKind).reading}）。男弦→中弦→女弦の順。${sanshinTuning(tuningKind).tip} B・E・Bは本調子。二揚げはB・F♯・B、三下げはB・E・Aです。`;
  $('lesson').innerHTML = '<optgroup label="曲のプリセット">'+SONGS[instrument].map(song=>`<option value="${song.id}">${song.title}</option>`).join('')+'</optgroup><optgroup label="基礎練習">'+LESSONS[instrument].map(l => `<option value="${l.id}">${l.title}</option>`).join('')+'</optgroup>' + (lessonId === 'import' ? '<option value="import">読み込んだMIDI</option>' : lessonId==='chord'?'<option value="chord">選んだコードの練習</option>':'');
  $('lesson').value = lessonId; $('tuning').value = transpose; $('sensitivity').value = gate;$('tuner-sensitivity').value=gate;
  $('tuning-label').hidden = instrument !== 'sanshin';
  const selectedSong=SONGS[instrument].find(song=>song.id===lessonId);
  $('lesson-detail').textContent = midiModel ? `${selectedSong?.detail||midiTitle} · ${practiceStyle==='chords'?`${cues.length}回のコード`: `${notes.length}音`}${midiModel.warnings.length ? `。${midiModel.warnings.join(' ')}` : ''}` : LESSONS[instrument].find(l => l.id === lessonId).detail;
  $('score-heading').textContent = instrument === 'sanshin' ? '工工四' : practiceStyle === 'chords' && midiModel ? 'コードを一弦ずつ' : 'TAB譜';
  $('score-help').textContent = instrument === 'sanshin' ? '右の列から下へ、次は左へ。先の音も並べて表示し、今の音に合わせて滑らかに送ります。文字を押すとその位置へ。' : practiceStyle === 'chords' && midiModel ? chordCheck==='strum'?'図の形でコードをジャーンと弾くと、次のコードへ。余韻を止める必要はありません。':'音を細かく確かめるモードです。コードを押さえたまま、指定の弦を一本ずつ。' : '数字はフレット。0は開放弦。音符を押すと、その位置から練習できます。';
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
    $('session-title').textContent=title;lyricEditor.use(sessionId,title);lyricEditor.hint(midiModel?.easy?{primary:'1・2・3・4と数え、1で下へ1回。切り替えは止まって大丈夫。',secondary:sessionId==='beginner:guitar'?'指を置いたら一本ずつ。鳴る位置を確かめて、次の形へ。':'カポなし。原曲より低い練習用のキーです。'}:null);restorePosition();
    $('session-help').textContent=lessonId==='chord'?'コードを確かめ、譜面と歌詞を一緒に進めます。':'マイクは正解まで待ち、ガイドは曲の速さで進みます。';
  }else{$('session-title').textContent='一本ずつ調弦する';renderResume();}
  renderPickers();
  feedback(view==='tuner'?'合わせる弦を選び、一本だけ鳴らしてください。マイクで高い・低いを確認できます。':restoredProgress?'前回の練習位置を表示しました。マイクか画面を選ぶと続けられます。':practiceStyle === 'chords' && midiModel ? chordCheck==='strum'?'コードを押さえてジャーン。余韻を止めずに次のコードへ進めます（試験）。':'マイクではコードを押さえたまま、大きく表示する弦を一本ずつ弾きます。' : 'マイクか画面を選んで始めましょう。'); save(); render();
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
  const name=notes[follower.index].chord;let result;for(let i=0;i<remaining;i++)result=follower.accept(performance.now());
  matchedCount+=remaining-1;advance(result);if(mode==='mic')feedback(`○ ${name} OK。余韻は止めず、次のコードを弾いてください。`);
}
async function startMic() {
  if (loading) return;
  stopAll();
  focusPractice();if(view==='tuner')$('tuner-verdict').closest('.listening').scrollIntoView({block:'start',behavior:'smooth'});chordGate.reset();
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
    // Starting capture can interrupt an iPad audio session. Verify it is running
    // again before claiming the microphone is listening; cancellation stays final.
    if(ctx.state!=='running'){
      let resumeTimer;try{await Promise.race([ctx.resume(),new Promise((_,reject)=>{resumeTimer=setTimeout(()=>reject(new Error('音声が一時停止しています。「マイクで調弦を始める」をもう一度押してください。')),2000);})]);}finally{clearTimeout(resumeTimer);}
      if(ticket!==epoch){acquired.getTracks().forEach(track=>track.stop());return;}
      if(ctx.state!=='running')throw new Error('音声を再開できませんでした。もう一度マイクを始めてください。');
    }
    micStream = acquired; source = ctx.createMediaStreamSource(acquired);
    const poly=view==='practice'&&instrument==='guitar'&&practiceStyle==='chords'&&!!midiModel&&chordCheck==='strum';
    analyser = ctx.createAnalyser(); analyser.fftSize = 8192;analyser.smoothingTimeConstant=poly?.1:0;
    silent = ctx.createGain(); silent.gain.value = 0;
    if(view==='practice')inputBoost=new MicInputBoost(ctx,source,analyser);else source.connect(analyser); analyser.connect(silent).connect(ctx.destination);
    for (const track of acquired.getTracks()) track.addEventListener('ended', () => { if (micStream === acquired) { stopAll(); render(); feedback('マイクが切断されました。もう一度始めてください。'); } });
    mode = 'mic'; $('input-label').textContent = 'マイクで聴いています'; $('mic-start').disabled = false; $('touch-start').disabled = false;
    render();
    feedback(poly?'コードを押さえてジャーン。余韻を止めずに次のコードへ進めます（試験）。':'大きく表示されている音を、一音ずつ弾いてください。');
    const buffer = new Float32Array(analyser.fftSize),spectrum=new Float32Array(analyser.frequencyBinCount);
    meterTimer = setInterval(() => {
      if (mode !== 'mic' || !analyser) return;
      if(ctx.state!=='running'){stopAll();render();feedback('音声が一時停止しました。マイクをもう一度始めてください。');return;}
      analyser.getFloatTimeDomainData(buffer);
      if(poly){
        const now=performance.now(),rms=Math.sqrt(buffer.reduce((sum,value)=>sum+value*value,0)/buffer.length);$('level').style.width=`${Math.min(100,rms*700)}%`;
        const inputHint=rms<gate?'入力が小さめです。「音を拾う強さ」を上げるか、楽器へ近づけてください。':'和音を聴いています。前の音を止めず、次のコードへ弾き替えられます。';if($('practice-input-status').textContent!==inputHint)$('practice-input-status').textContent=inputHint;
        if(inputBoost?.settling(chordGate,rms,now))return;
        if(now<suppressUntil){chordGate.reset();return;}
        analyser.getFloatFrequencyData(spectrum);const detected=detectChord(spectrum,ctx.sampleRate,analyser.fftSize,{rms,gate,expected:notes[follower.index]?.chord,previous:chordGate.last});
        $('heard').textContent=detected.name||'—';$('cents').textContent=detected.name?`${Math.round(detected.confidence*100)}%`:'—';
        if(chordGate.feed(detected,notes[follower.index]?.chord,now,rms,gate,chordAttackLevel(buffer)))acceptChordCue();
        else if(now>flashUntil)feedback(detected.name?`${detected.name}らしく聞こえています。目標のコードを安定して鳴らしましょう。`:'コードを鳴らしてください。音が曖昧なときは進めません。');return;
      }
      const now = performance.now(), detection = view==='tuner'?detectTuningPitch(buffer,ctx.sampleRate,gate):detectPitch(buffer, ctx.sampleRate, instrument==='sanshin'?tuningGate(gate):gate);
      $('level').style.width = `${Math.min(100, detection.rms * 700)}%`;
      if(view==='practice'){const hint=detection.rms<(instrument==='sanshin'?tuningGate(gate):gate)?'入力が小さめです。「音を拾う強さ」を上げるか、楽器へ少し近づけてください。':detection.rms>.6?'入力は十分届いています。拾う強さを下げても使えます。':detection.frequency?'音程を捉えています。':'音は届いています。ほかの弦を止めて、一本ずつ弾いてください。';if($('practice-input-status').textContent!==hint)$('practice-input-status').textContent=hint;if(inputBoost?.settling(follower,detection.rms,now))return;}
      if (now < suppressUntil) {if(view==='tuner'){resetTunerDisplay();$('practice-stage').dataset.tuning='waiting';tunerInputStatus(referenceActive?'お手本の再生中です。止めてから自分の弦を鳴らします。':'お手本の余韻が消えるのを待っています。');}return;}
      $('heard').textContent = detection.frequency ? noteName(Math.round(69 + 12 * Math.log2(detection.frequency / 440))) : '—';
      if(view==='tuner'){
        const result=tunerTracker.feed(detection,notes[tunerIndex].midi,gate,now),valid=Number.isFinite(result.cents);
        $('heard').textContent=result.frequency?noteName(Math.round(69+12*Math.log2(result.frequency/440))):'—';
        $('detected-frequency').textContent=result.frequency?`${result.frequency.toFixed(1)} Hz`:'— Hz';
        $('cents').textContent=valid?`${result.cents>0?'+':''}${Math.round(result.cents)} cent`:'—';
        $('needle').hidden=!valid;$('practice-stage').dataset.tuning=result.status;$('practice-stage').dataset.held=String(!!result.held);
        $('needle').style.left=`${50+Math.max(-48,Math.min(48,(result.cents||0)*.35))}%`;
        const direction=result.direction==='high'?'少し高めです。糸巻きを少し緩めて、もう一度。':'少し低めです。糸巻きを少し張って、もう一度。';
        const labels={waiting:'一本、鳴らしてください',settling:'音を確認中',matched:'○ OK',near:'あと少し',high:'高い ↓',low:'低い ↑',check:'弦・音名を確認',held:'前の音を表示'};
        $('tuner-verdict').textContent=labels[result.status];
        if(result.held){
          tunerInputStatus('直前に拾った音と針を保持しています。今の音程を測るには、もう一度一本だけ弾いてください。');
          feedback(result.status==='matched'?'○ 直前の音は合っています。もう一度鳴らして確かめましょう。':result.status==='held'?'前の音を残しています。少し回したら、弾き直して針を確かめましょう。':result.status==='settling'?'音を捉えました。もう一度鳴らして確かめましょう。':'最後の音を残しています。'+(result.status==='check'?'選ぶ弦と音名・オクターブを確かめましょう。':direction));
        }else{
          tunerInputStatus(valid?'いまの音を測っています。音が弱くなっても表示は残ります。':result.reason==='quiet'?'音が小さめです。一本だけ弾くか、感度を「小さな音」にしてみましょう。':'音は届いています。ほかの弦を止めて、一本だけ弾いてください。');
          feedback({waiting:'選んだ弦を一本、軽く弾いてみましょう。',settling:'音を捉えました。そのまま余韻を聴かせてください。',matched:'○ 合っています！ 少し待って、もう一度鳴らして確かめましょう。',near:'あと少し。'+direction,high:direction,low:direction,check:'選ぶ弦と音名・オクターブを確かめてください。大きく回さず、少しずつ合わせます。'}[result.status]+(result.trend==='closer'&&result.status!=='matched'?' 目標に近づいています。':''));
        }return;
      }
      const result = follower.feed(detection, now);
      $('cents').textContent = Number.isFinite(result.cents) ? `${result.cents > 0 ? '+' : ''}${Math.round(result.cents)} cent` : '—';
      $('needle').style.left = `${50 + Math.max(-48, Math.min(48, (result.cents || 0) * 0.5))}%`;
      if (result.matched) advance(result);
      else if (now > flashUntil) feedback({ listening: '一音ずつ、弾いてみましょう。', hold: 'その音です。少しだけ安定させましょう。', high: '今の音は高めです。弦・押さえる位置・調弦を確かめましょう。', low: '今の音は低めです。弦・押さえる位置・調弦を確かめましょう。', pluck: '同じ音です。前の音を止めて、もう一度弾いてください。' }[result.status] || '次の音を弾いてください。');
    }, poly?80:view==='tuner'?60:45);
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
    const origin=ctx.currentTime+.06;for(let i=0;i<count;i++)scheduleClick(ctx,i===0?84:79,.045,origin+i*beat,.04);
    let began=origin+count*beat, scheduled=0, chordScheduled=0, visual=-1, cycle=1,counted=!count;
    const pump=()=>{
      if(ticket!==epoch)return;
      const elapsed=ctx.currentTime-began;
      if(elapsed>=span){
        if(!$('loop-enabled').checked){
          if(voices.size){feedback('最後の音の余韻を聴いています。');demoTimer=setTimeout(pump,25);return;}
          stopAll();render();feedback('ガイドが終わりました。マイクか画面で練習できます。');return;
        }
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
$('view-singalong').onclick=()=>instrument==='sanshin'?sanshinGuide.open('jidai'):singalong.open();$('singalong-song-start').onclick=()=>singalong.open('tokiyo');
$('focus-mode').onclick=()=>setFocus(!focused);
$('open-fretboard').onclick=()=>{setFocus(false);$('fret-details').open=true;$('fret-details').scrollIntoView({block:'center',behavior:'smooth'});};
$('resume-focus').onclick=()=>{focusPractice();render();};
$('resume-practice').onclick=()=>{if(follower.done){newFollower();matchedCount=rounds=0;storeProgress();}focusPractice();render();feedback('マイクか画面を選んで、ここから始められます。');};
$('edit-lyrics').onclick=()=>{setFocus(false);lyricEditor.open();};
$('score-prev').onclick=()=>{scorePage=Math.max(0,lastScorePage-1);renderScore();};
$('score-next').onclick=()=>{scorePage=lastScorePage+1;renderScore();};
$('score-follow').onclick=()=>{scorePage=null;renderScore();};
$('tuner-kind').onchange=()=>{cancelLoad();tuningKind=$('tuner-kind').value;setup();};
$('tuning-honchoshi').onclick=()=>{tuningKind='honchoshi';$('view-tuner').click();};
$('chord-check').onchange=()=>{chordCheck=$('chord-check').value;stopAll();chordGate.reset();save();render();feedback(chordCheck==='strum'?'ジャーンと弾くと、次のコードへ進みます。指の位置は図で確認してください（和音判定は試験中）。':'コードを押さえ、大きく表示する弦を一本ずつ弾きます。');};
$('tuner-clear').onclick=()=>{resetTunerDisplay();feedback('表示を消しました。選んだ弦を一本鳴らしてください。');};
$('tuner-strings').onclick=event=>{const b=event.target.closest('[data-tune]');if(b){if(referenceActive)stopReference();tunerIndex=Number(b.dataset.tune);resetTunerDisplay();render();feedback('選んだ弦を一本だけ鳴らして、針と高低を確かめましょう。');}};
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
$('set-shape').onclick=()=>{selectedFrets=[...practiceShape($('chord-name').textContent).frets];renderFrets();};
$('strum').onclick=async()=>{
  if(loading)return;
  if(mode==='mic'||mode==='pending'||mode==='demo'){stopAll();render();}
  const ticket=epoch;
  try{const ctx=await audio();if(ticket!==epoch)return;selectedFrets.forEach((f,i)=>{if(f>=0)scheduleTone(ctx,GUITAR_OPEN[i]+f,.8,ctx.currentTime+i*.035,.055);});$('stop').disabled=false;
    if(mode==='touch' && practiceStyle==='chords' && midiModel && !follower.done){
      const target=notes[follower.index];
      if(practiceMatches(selectedFrets,target.chord)){
        acceptChordCue();
      }else feedback(`${target.chord}の図を見て、押さえる位置と弾かない弦を確かめましょう。`);
    }else feedback('画面のコードを鳴らしました。コードを練習する時は「コード」→「画面で試す」へ。');
  }catch(error){if(ticket===epoch)feedback(error.message);}
};
$('tuning').onchange = () => { cancelLoad(); transpose = Number($('tuning').value); setup(); };
$('sensitivity').onchange = () => {cancelLoad();gate=Number($('sensitivity').value);$('tuner-sensitivity').value=gate;if(view==='tuner'){resetTunerDisplay();save();feedback('感度を変えました。選んだ弦を一本だけ鳴らしてください。');}else{stopAll();newFollower();save();render();feedback('感度を変えました。マイクで始めると反映されます。');}};
$('tuner-sensitivity').onchange=()=>{$('sensitivity').value=$('tuner-sensitivity').value;$('sensitivity').onchange();};
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
function seekScore(index){
  if(!Number.isInteger(index)||index<0||index>=notes.length)return;
  cancelLoad(); stopAll(); const [start, end] = bounds();
  if (index < start || index >= end) $('loop-enabled').checked = false;
  scorePage=null;newFollower(index); matchedCount = rounds = 0;storeProgress(); render(); feedback(`${index + 1}音目から始められます。`);
}
$('score').onclick = event => {const button=event.target.closest('[data-index]');if(button)seekScore(Number(button.dataset.index));};
$('reference').onclick = async () => {
  if (follower.done || loading) return;
  if (referenceActive) { stopReference(); feedback(chordReference()?'お手本を止めました。図の形でコードをジャーンと弾いてみましょう。':'お手本を止めました。弦を一本だけ弾いて確かめましょう。'); return; }
  if (mode === 'demo') { stopAll(); render(); }
  const ticket = epoch, request = ++referenceTicket;
  referenceActive = true; suppressUntil = Infinity; follower.candidateAt = null; chordGate.reset();
  $('reference').textContent = '■ お手本を止める'; $('reference').setAttribute('aria-pressed', 'true'); $('stop').disabled = false;
  if (mode === 'idle') $('input-label').textContent = 'お手本を再生中';
  $('heard').textContent = '—'; $('cents').textContent = '—';
  feedback('弦の響きと余韻を聴いてみましょう。お手本が鳴る間はマイク判定を待ちます。');
  try {
    const ctx = await audio();
    if (ticket !== epoch || request !== referenceTicket || !referenceActive || ctx.state === 'closed') return;
    const target=notes[view==='tuner'?tunerIndex:follower.index],shape=chordReference()?practiceShape(target.chord):null,midis=shape?shape.frets.flatMap((f,i)=>f<0?[]:[GUITAR_OPEN[i]+f]):[target.midi];
    midis.forEach((midi,i)=>{const voice=scheduleTone(ctx,midi,.55,ctx.currentTime+i*.024,.18/Math.sqrt(midis.length),true);if(voice){referenceVoices.add(voice);referenceVoice=voice;}});
    if (!referenceVoice) throw new Error('お手本を再生できませんでした。もう一度お試しください。');
    referenceVoice.addEventListener('ended', () => {
      if (ticket !== epoch || request !== referenceTicket) return;
      referenceVoice = null; stopReference();
      feedback(chordReference()?'図の形を押さえ、コードをジャーンと弾いてみましょう。':mode === 'mic' ? '余韻が消えたら、弦を一本だけ弾いて確かめましょう。' : 'もう一度聴くか、マイクで弦の音を確かめられます。');
    }, { once: true });
  } catch (error) { if (ticket === epoch && request === referenceTicket) { stopReference(); feedback(error.message); } }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelLoad(); stopAll(); render(); feedback('画面を離れたので停止しました。もう一度始めてください。'); } });
window.addEventListener('pagehide', () => {cancelLoad();stopAll();});
$('midi-shift').replaceChildren(...Array.from({length:49},(_,i)=>new Option(i-24===0?'0（元の調）':`${i-24>0?'+':''}${i-24}`,i-24)));
const renderLearning=mountLearning({onPractice:startChordExercise,onBasics:(identity,title)=>{cancelLoad();view='practice';sessionId=identity;sessionTitle=title;midiModel=null;practiceStyle='melody';lessonId='open';$('loop-enabled').checked=false;setup();},onLeave:()=>{cancelLoad();stopAll();render();},onSingalong:id=>instrument==='sanshin'?(id==='tinsagu'?startSanshinSong():sanshinGuide.open(id)):singalong.open(id)});
const lyricEditor=mountLyrics({defaults:LYRIC_PRESETS,onDisplay:display=>{scoreStrip.lyrics(display.sheet);fullScore.lyrics(display);},onImport:async value=>{
  cancelLoad();stopAll();const ticket=loadEpoch;
  const identity=`chordpro:${await contentKey(new TextEncoder().encode(value.names.join(',')+'\n'+value.text))}`;
  if(ticket!==loadEpoch)return false;
  startChordExercise(value.names,value.title,identity);lyricEditor.import(value);render();return true;
}});
const singalong=mountSingalong({onWarmup:study=>{singalong.close();const stage=study.stages?.[0];startChordExercise(stage?.names||study.names,study.practiceTitle||`${study.title} · ${stage?.title||'導入コード'}`,stage?`study:${study.id}:0`:`study:${study.id}`,{easy:!!stage});focusPractice();render();},onHandGuide:options=>handGuide.open(options),onTakeOver:()=>{cancelLoad();stopAll();setFocus(false);},onChange:open=>{singalongOpen=open;$('view-tuner').setAttribute('aria-pressed',String(!open&&view==='tuner'));$('view-practice').setAttribute('aria-pressed',String(!open&&view==='practice'));save();}});
const fullScore=mountFullScore({onSeek:seekScore,onStop:()=>{stopAll();render();},onGuide:all=>{if(all){$('loop-enabled').checked=false;newFollower();storeProgress();render();}return demo();},onMic:()=>startMic(),onTuning:value=>{$('tuning').value=value;$('tuning').onchange();}});
$('full-score-tuning').replaceChildren(...[...$('tuning').options].map(option=>option.cloneNode(true)));
$('full-score-open').onclick=()=>{if(view!=='practice'||loading)return;if(instrument==='sanshin')$('full-score-credit').replaceChildren(...($('sanshin-credit').hidden?[]:[...$('sanshin-credit').childNodes].map(node=>node.cloneNode(true))));else{const song=SONGS.guitar.find(s=>s.id===lessonId);$('full-score-credit').textContent=song?.credit||'自分のコード順・歌詞で練習。入力はこの端末に保存。';if(song?.source){const a=document.createElement('a');a.href=song.source;a.textContent=' 原譜・出所 ↗';a.target='_blank';a.rel='noopener';$('full-score-credit').append(a);}}fullScore.open();};
const sanshinGuide=mountSanshinGuide({onTakeOver:()=>{cancelLoad();stopAll();singalong.close();render();}});
async function startSanshinSong(){
  sanshinGuide.close();singalong.close();cancelLoad();view='practice';
  const pending=selectSong('tinsagu','melody'),ticket=loadEpoch,loaded=await pending;
  if(loaded&&ticket===loadEpoch&&instrument==='sanshin'&&lessonId==='tinsagu'&&!loading){focusPractice();render();return true;}
  return false;
}
function prepareSlowLoop(end=notes.length-1){
  $('tempo').value='60';$('count-in').checked=true;
  $('loop-start').value='0';$('loop-end').value=String(Math.min(end,notes.length-1));$('loop-enabled').checked=true;$('loop-enabled').onchange();save();focusPractice();
  feedback('ゆっくり・4カウントで準備しました。まず「この音を聴く」で確認し、ガイドかマイクで始めましょう。');
}
$('beginner-tune').onclick=()=>{setFocus(false);$('view-tuner').click();$('tuner-strings').scrollIntoView({block:'center',behavior:'smooth'});};
$('beginner-drill').onclick=()=>{
  singalong.close();cancelLoad();
  if(instrument==='guitar')startChordExercise(['Em','Am','Em','Am'],'EmとAm · ゆっくり切り替える','beginner:guitar',{easy:true});
  else{view='practice';sessionId='beginner:sanshin';sessionTitle='合・四・工 · 一本ずつ';midiModel=null;practiceStyle='melody';lessonId='open';$('loop-enabled').checked=false;setup();}
  prepareSlowLoop();
};
$('beginner-song').onclick=async()=>{
  if(instrument==='guitar'){startChordExercise(['C','Am','C','Am'],'時間よ止まれ · CとAmから','study:tokiyo:0',{easy:true});prepareSlowLoop();}
  else if(await startSanshinSong())prepareSlowLoop(7);
};
$('beginner-resources').onclick=()=>{cancelLoad();stopAll();render();};
mountMicGainControls(['mic-boost','sing-mic-boost'],value=>{inputBoost?.set(value);singalong.setMicGain(value);if(mode==='mic'&&view==='practice')feedback('拾う強さを変えました。もう一度弾いてください。');});
mountGuitarPlaylist({onOpen:id=>singalong.open(id),onLeave:()=>{cancelLoad();stopAll();render();}});
$('guitar-playlist-source').onclick=()=>{cancelLoad();stopAll();render();};
mountSanshinPlaylist({onOpen:async id=>{if(id==='tinsagu'){if(await startSanshinSong())$('full-score-open').click();}else sanshinGuide.open(id);},onLeave:()=>{cancelLoad();stopAll();render();}});
$('playlist-source').onclick=()=>{cancelLoad();stopAll();render();};
$('sanshin-start-tinsagu').onclick=startSanshinSong;
$('sanshin-full-tinsagu').onclick=async()=>{if(await startSanshinSong())$('full-score-open').click();};
$('sanshin-video-tinsagu').onclick=()=>sanshinGuide.open('tinsagu');
$('sanshin-start-jidai').onclick=()=>sanshinGuide.open('jidai');
$('sanshin-help').onclick=()=>sanshinGuide.open(null,notes[mode==='demo'?Math.max(0,demoIndex):view==='tuner'?tunerIndex:Math.min(follower.index,follower.end-1)]?.symbol);
const handGuide=mountHandGuide({pausePractice:()=>{cancelLoad();stopAll();singalong.pause();}});
$('chord-hand-open').onclick=()=>{const name=$('chord-name').textContent,note=notes[Math.min(follower.index,notes.length-1)],last=notes[follower.end-1],next=cues.find(c=>c.time>(note?.time??0)&&c.time<=(last?.time??0)&&c.chord!==name);handGuide.open({name,shape:practiceShape(name),capo:0,next:next?{name:next.chord,shape:practiceShape(next.chord)}:null});};
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
        const cache = await caches.open('music-practice-v28');
        const paths=['./app.mjs?v=28',...new Set(Object.values(SONGS).flat().map(song=>`./songs/${song.file}`))];
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
