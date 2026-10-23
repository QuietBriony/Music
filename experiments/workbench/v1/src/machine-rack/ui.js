import { createMachineRack, UNITS, SYNTH_CONTROLS, DRUMS } from './model.js';
import { carryMachine } from './handoff.js';
import { createRackAuto } from './auto.js';
import { createRackScenes, MACROS } from '../../../../rack-scenes.js';
import { initVocalBooth } from '../../../../vocal-booth.js';

export function initMachineRack({data,ui,audio,knobs}) {
  const model=createMachineRack({data,ui,knobs});
  const host=document.createElement('section');host.className='wbr-shell';host.lang='ja';
  host.innerHTML=`<nav class="wbr-view"><button type="button" id="wbr-view">モジュールで遊ぶ</button><span>acidBros · 元の303 × 2 ＋ 909</span><button type="button" id="wbr-link" hidden>Strudelと一緒に</button></nav>
    <section id="wbr-panel" hidden aria-label="303と909のモジュール操作">
      <div class="wbr-transport"><button type="button" id="wbr-run">▶ RUN</button><button type="button" id="wbr-stop">■ 停止</button>
        <label>BPM <input id="wbr-bpm" type="number" min="60" max="200" step="1"></label><button type="button" id="wbr-file">FILE · 保存／開く</button></div>
      <p class="wbr-route">303の低音 ＋ 303の返し ＋ 909 → 同じ時計・同じ出力</p>
      <div class="wbr-actions"><button type="button" id="wbr-dice">🎲 組み合わせ</button><button type="button" id="wbr-keep">ここを戻り先に</button><button type="button" id="wbr-restore">戻り先へ戻す</button></div>
      <div class="wbr-auto"><button type="button" id="wbr-auto" aria-pressed="false">303／909 AUTO · OFF</button>
        <label>変化の間隔 <select id="wbr-interval" aria-label="303／909 AUTOの変化間隔"><option value="2">2小節</option><option value="4" selected>4小節</option><option value="8">8小節</option><option value="16">16小節</option></select></label>
        <span id="wbr-auto-status" role="status">固定を残して、少しずつ変化</span></div>
      <p id="wbr-status" role="status">RUN → 気に入った楽器を固定 → ほかをサイコロで変える。</p>
      <section class="wbr-scenes" aria-label="まとめ操作と音色の場面">
        <h2>響きをまとめて遊ぶ</h2><p class="wbr-summary">固定した楽器は守る。音符・打点・音量・BPMを保って、音色だけを動かします。</p>
        <div class="wbr-scene-work"><div id="wbr-macros" class="wbr-macros"></div><div class="wbr-scene-bank">
        <p class="wbr-summary">呼び出す：保存済みのA〜Hを押す。演奏中は次の小節で切替。</p>
        <div id="wbr-scene-slots" class="wbr-scene-slots" aria-label="音色の場面AからHを呼び出す"></div>
        <div class="wbr-scene-edit"><label class="wbr-scene-target">保存先<select id="wbr-scene-target" aria-describedby="wbr-scene-save-help"></select></label><label>場面の名前<input id="wbr-scene-name" maxlength="48" placeholder="例：やわらかい、うねる"></label><button id="wbr-scene-save" type="button">今の音色をAへ保存</button><button id="wbr-scene-remove" type="button" disabled>保存先を空に</button></div>
        <p id="wbr-scene-save-help" class="wbr-summary">保存先を選んでも音は変わりません。今の響きを別の場面にも残せます。</p>
        <p id="wbr-scene-confirm" hidden><span></span><button id="wbr-scene-yes" type="button">実行する</button><button id="wbr-scene-no" type="button">キャンセル</button></p>
        <div class="wbr-auto"><button id="wbr-scene-auto" type="button" aria-pressed="false">場面AUTO · OFF</button><label>巡る間隔<select id="wbr-scene-bars" aria-label="音色の場面を巡る間隔"><option value="4">4小節</option><option value="8" selected>8小節</option><option value="16">16小節</option></select></label></div>
        </div></div><p id="wbr-scene-status" role="status"></p>
        <details class="wbr-guide"><summary>まとめフェーダー・場面の使い方</summary><p>硬さ：303の明るさ・共鳴、キックの硬さ、スネアのざらつき。うねり：303の深さ・長さ、ハットの余韻。空間：2台の303のディレイ量。値は動かす範囲の割合で、元のつまみのHzや秒ではありません。個別操作後の表示は平均の目安です。固定した楽器はまとめ操作と場面切替の対象から外れ、個別フェーダーでは触れます。</p><p>音色を作り、保存先のA〜Hを選んで名前を付けて保存。保存先の選択では音を呼び出しません。上書きは保存ボタンを押した時の音色を切り取り、確認して残します。上の保存済みボタンは呼び出し専用。停止中はすぐ、演奏中は次の小節で切替。呼び出してから音色を触ると「編集あり」と表示します。場面AUTOは保存した2つ以上をA→H順に巡り、従来の303／909 AUTOとは切り替えて使います。ドラッグや手動操作を優先し、次の変化を待ちます。STOPで切替予約を取り消し、音色を保ちます。PATTERN専用です。</p><p>場面はこの端末のブラウザへ保存し、Strudelとの「組み合わせを保存」と設定JSONにも含めます。単独FILEは従来どおりフレーズと現在の音色だけ。場面は音符・打点・音量・BPM・固定・Strudelを切り替えません。音色を変えると音量感が変わるため、必要に応じて音量フェーダーで調整してください。</p></details>
      </section>
      <div id="wbr-cards" class="wbr-cards"></div>
      <details class="wbr-guide"><summary>どうつながる？ 保存・フェーダーの使い方</summary>
        <p>低音は元の303の2号機、返しは1号機。元のサイコロが2台の音程関係・アクセント・スライドを作ります。固定した楽器はサイコロで変わらず、手では音色を触れます。こちらのサイコロと戻す操作では各音量・BPMを保ちます。</p>
        <p>明るさはフィルターの開き、みょんは共鳴。うねりの深さは音の立ち上がりの変化量、長さはその余韻。残響はディレイの量。数値は元の機材のつまみと同じでHzや秒ではありません。音量0で次の発音を抜き、残響は自然に残ります。</p>
        <p>「ここを戻り先に」は今開いているパターンの目印。端末に残すには「FILE · 保存／開く」→ SAVE。16パターンやSONGをつなぐ詳しい編集は「元の操作画面へ」。画面を替えても同じ演奏です。</p>
        <p>この3モジュールは同時に鳴ります。「一緒に鳴らす」ではStrudelと時計・音声接続を共有し、「組み合わせを保存」で両側のフレーズ・音色・固定を名前付き保存できます。単独のFILEは音符・音色、パート固定はこのブラウザの設定に残ります。自由なケーブル配線はありません。</p>
        <p>AUTOは初期OFF。固定したキック・303などを残し、選んだ小節数ごとに1パートのアクセント・スライド・裏拍・音色を少し変え、次の変化で元のフレーズへ戻します。無音のパートを勝手に足さず、音量・BPMも変えません。手動サイコロやフェーダーで触った音を新しい基準にして、次の変化を待ちます。OFFで今の形をキープ、停止中は進みません。組み合わせ保存にはAUTOのON/OFFと間隔も入り、開いても自動で再生しません。</p>
        <p>打点や303の音符を直接打ち替える時は「元の操作画面へ」。909のパートを選び16ステップを編集、303は音符・アクセント・スライドを編集します。同じ演奏が続きます。「モジュールで遊ぶ」で戻れます。音色はこのラックのパート選択とフェーダーでも変えられます。</p>
      </details>
      <details class="wbr-guide"><summary>別の音源も試す · Re-Rebirth</summary>
        <p>303×2・808・909と、ツマミ操作の録音を別サイトで試せます。いまの演奏を停止してから開き、戻る時は向こうも停止。保存棚・時計・録音はこの試奏台とは別です。</p>
        <p><a href="https://rb.varyform.info/" target="_blank" rel="noopener noreferrer">Re-Rebirthを別タブで開く ↗</a> · <a href="https://github.com/varyform/re-rebirth" target="_blank" rel="noopener noreferrer">作者の説明・ソース ↗</a></p>
        <p>初めはPLAYで試聴。PCはSpaceで再生／停止、2でパターン編集。スマホはPATTERNSで楽器を大きく表示できます。今の固定・サイコロ・Strudelとの同期は、こちらの303／909で使います。</p>
      </details>
    </section>`;
  document.body.prepend(host);
  let vocalBooth;
  let active=false,pending=false,queued=false,drum='bd',linkedPlayback=false;
  if (window.parent === window) {
    const style=document.createElement('link'); style.rel='stylesheet'; style.href='/vocal-booth.css'; document.head.append(style);
    const vocalParent=document.createElement('div'); host.append(vocalParent);
    vocalBooth=initVocalBooth({parent:vocalParent,
      getSources:()=>audio.isPlaying && audio.outputGain ? [audio.outputGain] : [],
      snapshot:title=>({strudel:{drafts:[{id:crypto.randomUUID(),title,savedAt:new Date().toISOString(),
        code:`setcpm(${audio.tempo/4})\nsilence`,joint:{version:1,level:1,machine:window.musicMachineLink.capture()}}],levels:{},decks:{}},acidbros:{files:[]}}),
      playPlayback:()=>startPlayback(false), stopPlayback, isBusy:()=>pending,
    });
    const vocalButton=document.createElement('button'); vocalButton.type='button'; vocalButton.textContent='歌詞・録音';
    vocalButton.addEventListener('click',()=>vocalBooth.open());host.querySelector('.wbr-view').append(vocalButton);
  }
  const find=id=>host.querySelector('#wbr-'+id),panel=find('panel'),status=find('status');
  let sceneStorage;try{sceneStorage=window.localStorage;}catch{}
  const scenes=createRackScenes({data,audio,model,storage:sceneStorage,notify:()=>render()});
  const auto=createRackAuto({data,audio,model,scenePlayer:scenes,notify:()=>render()});audio.rackAuto=auto;
  find('link').hidden = window.parent !== window;
  find('link').addEventListener('click', () => {
    try {
      if (vocalBooth?.busy()) throw new Error('録音を終え、未保存テイクをダウンロードしてから切り替えてください。');
      carryMachine(data, window.sessionStorage);
      audio.stop();
      window.location.assign('/?stage=ambient&link=1&carry=1&bpm='+Math.round(audio.tempo));
    } catch (error) { status.textContent = '引き継げませんでした。FILEで保存してください。' + error.message; }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && audio.externalTransport) { event.preventDefault(); audio.stop(); }
  });
  const actionControls=[],faders=[],locks=new Map(),waves=new Map(),summaries=new Map(),drumRows=new Map();
  let kickLock,snareDice,hatsDice;
  let sceneSelected=0,sceneConfirm=null,sceneBankSeen=null;
  const sceneButtons=[],sceneOptions=[],macroInputs=[];
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  function act(fn,message) {
    auto.manual();
    try { const changed=fn();status.textContent=changed===false?'固定中です。変える楽器の固定を外してください。':message; }
    catch(error) { status.textContent=error.message || '操作できませんでした。'; }
    render();
  }
  function button(parent,text,fn,tracked=true) {
    const b=el('button',text);b.type='button';b.addEventListener('click',fn);parent.append(b);if(tracked)actionControls.push(b);return b;
  }
  function addFader(parent,unit,control) {
    const [key,title,,min,max,step]=control;
    const label=el('label',null,'wbr-fader'),out=el('output'),input=el('input');
    Object.assign(input,{type:'range',min,max,step});
    input.setAttribute('aria-label',(UNITS.find(([id])=>id===unit)?.[1]||DRUMS.find(([id])=>id===unit)?.[1])+' '+title);
    label.append(el('span',title),out,input);parent.append(label);
    input.addEventListener('input',()=>act(()=>model.set(unit,key,Number(input.value)),'音色を変更しました。FILE → SAVEで残せます。'));
    faders.push({unit,key,label,input,out});
  }
  for(const macro of MACROS) {
    const label=el('label',null,'wbr-fader'),title=el('span',macro.title),out=el('output'),input=el('input');
    Object.assign(input,{type:'range',min:0,max:100,step:1});input.setAttribute('aria-label','まとめ '+macro.title);
    const help=el('small',macro.help,'wbr-macro-help');help.id='wbr-macro-help-'+macro.id;
    input.setAttribute('aria-describedby',help.id);
    label.title=macro.help;label.append(title,out,el('small','↑ '+macro.high),input,el('small','↓ '+macro.low),help);find('macros').append(label);
    input.addEventListener('input',()=>act(()=>scenes.macro(macro.id,Number(input.value)),'まとめ音色を変更しました。場面へ保存できます。'));
    macroInputs.push({id:macro.id,input,out});
  }
  for(let i=0;i<8;i++) {
    const option=el('option');option.value=String(i);find('scene-target').append(option);sceneOptions.push(option);
    const b=button(find('scene-slots'),'',()=>{
      sceneConfirm=null;find('scene-confirm').hidden=true;
      act(()=>scenes.recall(i),'場面'+String.fromCharCode(65+i)+'の音色を呼び出します。');
    },false);sceneButtons.push(b);
  }
  find('scene-target').addEventListener('change',()=>{
    sceneSelected=Number(find('scene-target').value);sceneConfirm=null;find('scene-confirm').hidden=true;
    find('scene-name').value=scenes.read().bank.slots[sceneSelected]?.name||'';render();
  });
  function confirmScene(action) {
    try {
      const slot=scenes.read().bank.slots[sceneSelected],name=find('scene-name').value;
      const tones=action==='save'?model.toneState():null;
      if(!slot&&action==='save'){act(()=>scenes.save(sceneSelected,name,tones),'音色の場面を保存しました。');return;}
      if(!slot)return;
      sceneConfirm={index:sceneSelected,action,name,tones};find('scene-confirm').hidden=false;
      find('scene-confirm').querySelector('span').textContent=String.fromCharCode(65+sceneSelected)+' · '+slot.name+(action==='save'?'を、今切り取った音色で上書きします。確認中に演奏が変わっても、この音色を保存します。':'を空にします。');
    }catch(error){status.textContent=error.message;}
  }
  find('scene-save').addEventListener('click',()=>confirmScene('save'));
  find('scene-remove').addEventListener('click',()=>confirmScene('remove'));
  find('scene-no').addEventListener('click',()=>{sceneConfirm=null;find('scene-confirm').hidden=true;});
  find('scene-yes').addEventListener('click',()=>{
    if(!sceneConfirm)return;const {index,action,name,tones}=sceneConfirm;sceneConfirm=null;find('scene-confirm').hidden=true;
    act(()=>action==='save'?scenes.save(index,name,tones):scenes.remove(index),'場面の保存を変更しました。');
  });
  find('scene-auto').addEventListener('click',()=>act(()=>{
    const enabled=!scenes.read().bank.auto.enabled;
    if(enabled)auto.configure(false,data.rackAuto.bars);
    scenes.configure(enabled,Number(find('scene-bars').value));
  },'場面AUTOを切り替えました。'));
  find('scene-bars').addEventListener('change',()=>act(()=>scenes.configure(scenes.read().bank.auto.enabled,Number(find('scene-bars').value)),'場面の間隔を変更しました。'));
  for (const [unit,title] of UNITS) {
    const card=el('article',null,'wbr-card'),heading=el('div',null,'wbr-card-heading');
    heading.append(el('h2',title));const lock=button(heading,'固定',()=>act(()=>model.lock(unit),'サイコロの固定を変更しました。'));
    lock.setAttribute('aria-label',title+'のサイコロ固定');lock.setAttribute('aria-pressed','false');locks.set(unit,lock);card.append(heading);
    button(card,'🎲 この楽器だけ',()=>act(()=>model.randomize(unit),title+'を変えました。音量とBPMはそのまま。'));
    const summary=el('p',null,'wbr-summary');summaries.set(unit,summary);card.append(summary);
    if(unit!=='tr909') {
      const waveLabel=el('label',null,'wbr-wave');waveLabel.append(el('span','波形'));
      const wave=el('select');wave.setAttribute('aria-label',title+'の波形');
      for(const [value,name] of [['sawtooth','ノコギリ · 鋭い'],['square','矩形 · 中空']]) {const option=el('option',name);option.value=value;wave.append(option);}
      wave.addEventListener('change',()=>act(()=>model.wave(unit,wave.value),'波形を変更しました。'));waveLabel.append(wave);card.append(waveLabel);waves.set(unit,wave);
      const bank=el('div',null,'wbr-faders');card.append(bank);SYNTH_CONTROLS.forEach(control=>addFader(bank,unit,control));
    } else {
      const quick=el('div',null,'wbr-actions');card.append(quick);
      kickLock=button(quick,'キックを固定',()=>act(()=>model.lockDrum('bd'),'キックの固定を変更しました。手のフェーダーは使えます。'));
      kickLock.setAttribute('aria-label','キックを固定');
      snareDice=button(quick,'🎲 スネアだけ',()=>act(()=>model.randomize('sd'),'スネアだけを変えました。他の打点・音色・音量はそのまま。'));
      hatsDice=button(quick,'🎲 ハットだけ',()=>act(()=>model.randomize('hats'),'固定していない閉／開ハットだけを変えました。他のパートはそのまま。'));
      card.append(el('p','固定は打点と音色をサイコロ・基本4パートから守ります。手動フェーダーは使えます。','wbr-summary'));
      button(card,'基本4パートを組む',()=>act(()=>model.basicDrums(),'固定パートを残し、キック・スネア・閉／開ハットを組みました。音色・音量・303はそのまま。'));
      const parts=el('details',null,'wbr-drum-parts');parts.append(el('summary','全11パート・固定・サイコロ候補'));
      button(parts,'全11パートを候補に',()=>act(()=>model.drumCandidates(DRUMS.map(([id])=>id)),'全11パートを候補にしました。「この楽器だけ」で組み替えます。'));
      for(const [id,title] of DRUMS) {
        const row=el('div',null,'wbr-drum-row'),label=el('label'),box=el('input'),info=el('span');box.type='checkbox';box.setAttribute('aria-label',title+'をサイコロ候補に');
        box.addEventListener('change',()=>act(()=>model.drumCandidates(DRUMS.map(([id])=>id).filter(key=>key===id?box.checked:data.active909Tracks.includes(key))),'サイコロ候補を変えました。今の打点はそのまま。'));
        label.append(box,info);row.append(label);
        const lock=button(row,'固定',()=>act(()=>model.lockDrum(id),title+'の固定を変更しました。'));
        lock.setAttribute('aria-label',title+'のサイコロ固定');
        const dice=button(row,'🎲',()=>act(()=>model.randomize(id),title+'だけを変えました。'));
        dice.setAttribute('aria-label',title+'だけサイコロ');
        parts.append(row);drumRows.set(id,{box,info,title,lock,dice});
      }
      card.append(parts);
      card.append(el('p','下の選択は音色の編集対象です。ソロ再生ではありません。','wbr-summary'));
      const select=el('select');select.id='wbr-drum';select.setAttribute('aria-label','音色を触る打楽器');
      DRUMS.forEach(([id,title])=>{const option=el('option',title);option.value=id;select.append(option);});
      select.addEventListener('change',()=>{drum=select.value;render();});card.append(select);
      const bank=el('div',null,'wbr-faders');card.append(bank);DRUMS.forEach(([id,,controls])=>controls.forEach(control=>addFader(bank,id,control)));
      button(card,'打楽器を追加',()=>{ui.showAddTrackPopover(0,0);});
      const help=el('p','追加するとサイコロの打楽器候補が増えます。選択だけでは打点を足しません。音量0で抜けます。','wbr-summary');card.append(help);
    }
    find('cards').append(card);
  }
  function render() {
    if(!active) return;
    const state=model.read();
    const motion=auto.read();
    const sceneState=scenes.read(),sceneLocked=!state.editable||pending;
    if(sceneBankSeen!==sceneState.bank) {
      if(!sceneBankSeen)sceneSelected=Math.max(0,sceneState.bank.slots.findIndex(slot=>!slot));
      if(JSON.stringify(sceneBankSeen?.slots[sceneSelected])!==JSON.stringify(sceneState.bank.slots[sceneSelected]))find('scene-name').value=sceneState.bank.slots[sceneSelected]?.name||'';
      sceneConfirm=null;find('scene-confirm').hidden=true;
      sceneBankSeen=sceneState.bank;
    }
    for(const {id,input,out} of macroInputs) {
      const value=sceneLocked?null:scenes.macroValue(id);
      input.disabled=sceneLocked||value===null;
      if(value!==null&&document.activeElement!==input)input.value=value;
      out.textContent=!state.editable?'PATTERN専用':pending?'準備中':value===null?'対象が固定中':input.value+'%';
    }
    sceneButtons.forEach((b,i)=>{
      b.disabled=sceneLocked||!sceneState.bank.slots[i];b.setAttribute('aria-pressed',String(sceneState.queued===i||(sceneState.current===i&&!sceneState.edited)));
      b.textContent=String.fromCharCode(65+i)+' · '+(sceneState.bank.slots[i]?.name||'空');
      sceneOptions[i].textContent=b.textContent;
      if(sceneState.queued===i)b.textContent+='（次の小節）';else if(sceneState.current===i)b.textContent+=sceneState.edited?' · 編集あり':' ♪';
    });
    find('scene-target').value=String(sceneSelected);
    find('scene-save').textContent='今の音色を'+String.fromCharCode(65+sceneSelected)+'へ'+(sceneState.bank.slots[sceneSelected]?'上書き':'保存');
    for(const id of ['scene-save','scene-target','scene-name','scene-bars','scene-yes'])find(id).disabled=sceneLocked;
    find('scene-remove').disabled=sceneLocked||!sceneState.bank.slots[sceneSelected];
    find('scene-auto').disabled=sceneLocked||(!sceneState.bank.auto.enabled&&sceneState.bank.slots.filter(Boolean).length<2);
    find('scene-auto').setAttribute('aria-pressed',String(sceneState.bank.auto.enabled));
    find('scene-auto').textContent='場面AUTO · '+(sceneState.bank.auto.enabled?'ON':'OFF');
    find('scene-bars').value=String(sceneState.bank.auto.bars);
    find('scene-status').textContent=sceneState.message+(sceneState.bank.auto.enabled?' · 次の場面まで'+sceneState.remaining+'小節':'');
    find('auto').setAttribute('aria-pressed',String(motion.enabled));
    find('auto').textContent='303／909 AUTO · '+(motion.enabled?'ON':'OFF');
    find('auto').disabled=!state.editable||pending;find('interval').disabled=!state.editable||pending;
    find('interval').value=String(motion.bars);
    find('auto-status').textContent=!state.editable?'PATTERNで使えます':!motion.enabled?(motion.lastChange.startsWith('AUTOを止めました')?motion.lastChange:'今の形をキープ'):!audio.isPlaying?'再生すると'+motion.bars+'小節ごとに変化':
      '次の変化まで '+motion.remaining+'小節'+(motion.lastChange?' · '+motion.lastChange:'');
    actionControls.forEach(b=>{b.disabled=!state.editable||pending;});
    for(const [id,{box,info,title,lock,dice}] of drumRows) {
      const track=state.units.tr909?.tracks[id],hits=track?.steps?.filter(Boolean).length || 0;
      box.checked=state.tracks.includes(id);box.disabled=!state.editable||pending||state.locks.tr909;
      lock.disabled=box.disabled;lock.setAttribute('aria-pressed',String(Boolean(state.drumLocks[id])));lock.textContent=state.drumLocks[id]?'固定中':'固定';
      dice.disabled=box.disabled||Boolean(state.drumLocks[id]);
      info.textContent=title+' · '+hits+'打 · 音量'+Math.round(track?.level || 0)+(track?.level===0?'（無音）':!hits?'（打点なし）':'');
    }
    kickLock.disabled=!state.editable||pending||state.locks.tr909;
    kickLock.setAttribute('aria-pressed',String(Boolean(state.drumLocks.bd)));kickLock.textContent=state.drumLocks.bd?'キック固定中':'キックを固定';
    snareDice.disabled=kickLock.disabled||Boolean(state.drumLocks.sd);
    hatsDice.disabled=kickLock.disabled||Boolean(state.drumLocks.ch&&state.drumLocks.oh);
    for(const id of ['dice','keep','restore']) find(id).disabled=!state.editable||pending||(id==='restore'&&!state.canRestore);
    for(const [id,b] of locks) {b.setAttribute('aria-pressed',String(state.locks[id]));b.textContent=state.locks[id]?'固定中':'固定';}
    for(const [id,select] of waves) {select.disabled=!state.editable||pending;select.value=state.units[id]?.settings.waveform || 'sawtooth';}
    faders.forEach(({unit,key,input,out,label})=>{
      const synth=unit.startsWith('tb303');label.hidden=!synth && unit!==drum;
      const value=synth?state.units[unit]?.settings[key]:state.units.tr909?.tracks[unit]?.[key];
      input.disabled=!state.editable||pending||!Number.isFinite(value);
      if(document.activeElement!==input && Number.isFinite(value)) input.value=value;
      out.textContent=Number.isFinite(value)?String(Math.round(value*10)/10):'—';
    });
    for(const [id,text] of summaries) text.textContent=id==='tr909'
      ? '鳴る設定：'+DRUMS.filter(([id])=>state.units.tr909?.tracks[id]?.level>0 && state.units.tr909.tracks[id].steps.some(Boolean)).length+' / 11パート。サイコロ候補：'+state.tracks.map(t=>DRUMS.find(([id])=>id===t)?.[1]||t).join(' / ')+(state.tracks.length===1?'。1パートだけです。「基本4パートを組む」で増やせます。':'')
      : (state.units[id]?.sequence || []).filter(s=>s.active).length+' / 16音 · '+(state.locks[id]?'このフレーズと音色を保つ':'音色もサイコロで変化');
    const linked=Boolean(audio.externalTransport);
    if (linked && linkedPlayback!==audio.isPlaying) {
      linkedPlayback=audio.isPlaying;
      status.textContent=linkedPlayback?'Strudelと同期演奏中。固定・サイコロ・音色で遊べます。':'全停止しました。フレーズと音色はそのまま。';
    }
    find('run').textContent=linked?'▶ 一緒に再生':'▶ RUN';
    find('stop').textContent=linked?'■ 全停止':'■ 停止';
    host.querySelector('.wbr-route').textContent=linked?'Strudelと同じ時計・同じ音声接続。BPMは上のStrudel側で変更。':'303の低音 ＋ 303の返し ＋ 909 → 同じ時計・同じ出力';
    find('run').disabled=pending;find('bpm').disabled=pending||linked;
    if(document.activeElement!==find('bpm')) find('bpm').value=audio.tempo;
    if(!state.editable) status.textContent='SONGを演奏中の設定です。編集は「元の操作画面へ」からPATTERNを選んでください。';
  }
  function show(enabled) {
    active=enabled;panel.hidden=!enabled;document.body.classList.toggle('workbench-rack-mode',enabled);
    find('view').textContent=enabled?'元の操作画面へ':'モジュールで遊ぶ';find('view').setAttribute('aria-pressed',String(enabled));
    const url=new URL(window.location.href);enabled?url.searchParams.set('rack','1'):url.searchParams.delete('rack');window.history.replaceState(null,'',url);
    render();
  }
  find('view').addEventListener('click',()=>show(!active));
  find('auto').addEventListener('click',()=>auto.configure(!data.rackAuto.enabled,Number(find('interval').value)));
  find('interval').addEventListener('change',()=>auto.configure(data.rackAuto.enabled,Number(find('interval').value)));
  find('dice').addEventListener('click',()=>act(()=>model.randomize(),'固定していない楽器を組み替えました。音量とBPMはそのまま。'));
  find('keep').addEventListener('click',()=>act(()=>model.remember(),'戻り先にしました。端末に残すにはFILE → SAVE。'));
  find('restore').addEventListener('click',()=>act(()=>model.restore(),'フレーズと音色を戻しました。音量とBPMはそのまま。'));
  find('bpm').addEventListener('change',()=>act(()=>{
    const value=Number(find('bpm').value);if(!Number.isInteger(value)||value<60||value>200) throw new Error('BPMは60〜200です。');
    audio.setTempo(value);ui.updateTempoUI();
  },'3モジュールのBPMを変更しました。'));
  let transport=0;
  async function startPlayback(restart=true) {
    if(pending) return;
    const token=++transport;pending=true;status.textContent='音を準備中…';render();
    try { await audio.play(restart);if(token===transport) status.textContent=audio.isPlaying?(audio.externalTransport?'Strudelと同期演奏中。固定・サイコロ・音色で遊べます。':'3モジュールを演奏中。固定・サイコロ・音色で遊べます。'):'もう一度RUNを押して音声接続を確認してください。'; }
    catch(error) {if(token===transport)status.textContent=error.message || '再生できませんでした。';}
    finally {if(token===transport){pending=false;render();}}
  }
  function stopPlayback() {transport++;audio.stop();pending=false;status.textContent='停止しました。フレーズと音色はそのまま残っています。';render();}
  find('run').addEventListener('click',()=>startPlayback());
  find('stop').addEventListener('click',stopPlayback);
  find('file').addEventListener('click',()=>{show(false);document.getElementById('fileManagerBtn').click();});
  const queueRender=()=>{if(!active||queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});};
  for(const name of ['input','change','pointerup']) document.addEventListener(name,event=>{if(!host.contains(event.target))queueRender();});
  document.addEventListener('visibilitychange',queueRender);
  document.addEventListener('workbench-machine-changed',queueRender);
  // Trusted native edits and rack drags take precedence over scheduled changes.
  // Programmatic native knob refreshes must not reset AUTO on every bar.
  document.addEventListener('pointerdown',event=>{
    if(!host.contains(event.target)||event.target.matches('input,select')) auto.touch(true);
  },true);
  for(const name of ['pointerup','pointercancel']) document.addEventListener(name,()=>auto.touch(false),true);
  window.addEventListener('blur',()=>auto.touch(false));
  for(const name of ['input','change','click','keydown']) document.addEventListener(name,event=>{
    if(event.isTrusted&&!host.contains(event.target)) auto.manual();
  },true);
  show(new URLSearchParams(window.location.search).get('rack')==='1');
}
