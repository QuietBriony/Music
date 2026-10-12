import { createMachineRack, UNITS, SYNTH_CONTROLS, DRUMS } from './model.js';
import { carryMachine } from './handoff.js';

export function initMachineRack({data,ui,audio,knobs}) {
  const model=createMachineRack({data,ui,knobs});
  const host=document.createElement('section');host.className='wbr-shell';host.lang='ja';
  host.innerHTML=`<nav class="wbr-view"><button type="button" id="wbr-view">モジュールで遊ぶ</button><span>acidBros · 元の303 × 2 ＋ 909</span><button type="button" id="wbr-link" hidden>Strudelと一緒に</button></nav>
    <section id="wbr-panel" hidden aria-label="303と909のモジュール操作">
      <div class="wbr-transport"><button type="button" id="wbr-run">▶ RUN</button><button type="button" id="wbr-stop">■ 停止</button>
        <label>BPM <input id="wbr-bpm" type="number" min="60" max="200" step="1"></label><button type="button" id="wbr-file">FILE · 保存／開く</button></div>
      <p class="wbr-route">303の低音 ＋ 303の返し ＋ 909 → 同じ時計・同じ出力</p>
      <div class="wbr-actions"><button type="button" id="wbr-dice">🎲 組み合わせ</button><button type="button" id="wbr-keep">ここを戻り先に</button><button type="button" id="wbr-restore">戻り先へ戻す</button></div>
      <p id="wbr-status" role="status">RUN → 気に入った楽器を固定 → ほかをサイコロで変える。</p>
      <div id="wbr-cards" class="wbr-cards"></div>
      <details class="wbr-guide"><summary>どうつながる？ 保存・フェーダーの使い方</summary>
        <p>低音は元の303の2号機、返しは1号機。元のサイコロが2台の音程関係・アクセント・スライドを作ります。固定した楽器はサイコロで変わらず、手では音色を触れます。こちらのサイコロと戻す操作では各音量・BPMを保ちます。</p>
        <p>明るさはフィルターの開き、みょんは共鳴。うねりの深さは音の立ち上がりの変化量、長さはその余韻。残響はディレイの量。数値は元の機材のつまみと同じでHzや秒ではありません。音量0で次の発音を抜き、残響は自然に残ります。</p>
        <p>「ここを戻り先に」は今開いているパターンの目印。端末に残すには「FILE · 保存／開く」→ SAVE。16パターンやSONGをつなぐ詳しい編集は「元の操作画面へ」。画面を替えても同じ演奏です。</p>
        <p>この3モジュールは同時に鳴ります。Workbenchの「一緒に鳴らす」ではStrudelと時計・音声接続を共有します。保存はStrudelのコードと、こちらのFILEの2つ。自由なケーブル配線はありません。</p>
      </details>
    </section>`;
  document.body.prepend(host);
  const find=id=>host.querySelector('#wbr-'+id),panel=find('panel'),status=find('status');
  find('link').hidden = window.parent !== window;
  find('link').addEventListener('click', () => {
    try {
      carryMachine(data, window.sessionStorage);
      audio.stop();
      window.location.assign('/?stage=ambient&link=1&carry=1&bpm='+Math.round(audio.tempo));
    } catch (error) { status.textContent = '引き継げませんでした。FILEで保存してください。' + error.message; }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && audio.externalTransport) { event.preventDefault(); audio.stop(); }
  });
  const actionControls=[],faders=[],locks=new Map(),waves=new Map(),summaries=new Map();
  let active=false,pending=false,queued=false,drum='bd',linkedPlayback=false;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  function act(fn,message) {
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
    actionControls.forEach(b=>{b.disabled=!state.editable||pending;});
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
      ? 'サイコロ候補：'+state.tracks.map(t=>DRUMS.find(([id])=>id===t)?.[1]||t).join(' / ')
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
  find('dice').addEventListener('click',()=>act(()=>model.randomize(),'固定していない楽器を組み替えました。音量とBPMはそのまま。'));
  find('keep').addEventListener('click',()=>act(()=>model.remember(),'戻り先にしました。端末に残すにはFILE → SAVE。'));
  find('restore').addEventListener('click',()=>act(()=>model.restore(),'フレーズと音色を戻しました。音量とBPMはそのまま。'));
  find('bpm').addEventListener('change',()=>act(()=>{
    const value=Number(find('bpm').value);if(!Number.isInteger(value)||value<60||value>200) throw new Error('BPMは60〜200です。');
    audio.setTempo(value);ui.updateTempoUI();
  },'3モジュールのBPMを変更しました。'));
  let transport=0;
  find('run').addEventListener('click',async()=>{
    const token=++transport;pending=true;status.textContent='音を準備中…';render();
    try { await audio.play(true);if(token===transport) status.textContent=audio.isPlaying?(audio.externalTransport?'Strudelと同期演奏中。固定・サイコロ・音色で遊べます。':'3モジュールを演奏中。固定・サイコロ・音色で遊べます。'):'もう一度RUNを押して音声接続を確認してください。'; }
    catch(error) {if(token===transport)status.textContent=error.message || '再生できませんでした。';}
    finally {if(token===transport){pending=false;render();}}
  });
  find('stop').addEventListener('click',()=>{transport++;audio.stop();pending=false;status.textContent='停止しました。フレーズと音色はそのまま残っています。';render();});
  find('file').addEventListener('click',()=>{show(false);document.getElementById('fileManagerBtn').click();});
  const queueRender=()=>{if(!active||queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});};
  for(const name of ['input','change','pointerup']) document.addEventListener(name,event=>{if(!host.contains(event.target))queueRender();});
  document.addEventListener('visibilitychange',queueRender);
  document.addEventListener('workbench-machine-changed',queueRender);
  show(new URLSearchParams(window.location.search).get('rack')==='1');
}
