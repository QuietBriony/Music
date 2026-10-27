import { defaults, validate, dice, PARTS } from './acid-live-state.mjs?v=1';
import { createAcidLive } from './acid-live.mjs?v=1';

const KEY='music-band-room-human-fly-acid-v1';
const TITLES={bass:'303 · 低音',reply:'303 · 返し'};
const FADERS=[['volume','音量',100,1],['cutoff','明るさ',100,1],['reso','みょん',12,.1],['env','うねり',100,1],['decay','長さ',100,1],['delay','残響',100,1]];
export function createAcidPanel({host,onEnable,onChange,onMix,onTempo,tempo=100,storage}) {
  let config=defaults(),enabled=false,saved=null;
  try { const value=JSON.parse(storage.getItem(KEY));if(value?.song==='tabasco/human-fly')saved=validate(value.state); } catch {}
  host.innerHTML=`<div class="br-acid-actions"><button type="button" data-acid="enable" aria-pressed="false">303 OFF</button><button type="button" data-acid="replace">ベースを303へ</button><button type="button" data-acid="original">元の4パートへ</button></div>
    <label class="br-acid-speed">速さ <input type="range" min="50" max="120" step="1" value="100" data-acid-speed aria-label="曲と303の速さ"><output data-acid-speed-read>100%</output></label>
    <p class="br-help">303 ON → START。原演奏へ重ね、ベースを303へ交代できます。100%が元の速さ。速さを変えると原音・303とも音程も変わります。</p>
    <div class="br-acid-cards">${PARTS.map(p=>`<section class="br-acid-card" aria-label="${TITLES[p]}"><strong>${TITLES[p]}</strong><div class="br-acid-actions"><button type="button" data-acid-dice="${p}">🎲 ${p==='bass'?'低音':'返し'}</button><label><input type="checkbox" data-acid-lock="${p}">フレーズ固定</label></div><p class="br-acid-notes" data-acid-notes="${p}"></p><div class="br-acid-faders">${FADERS.map(([key,label,max,step])=>`<label><span>${label}</span><input type="range" min="0" max="${max}" step="${step}" data-acid-part="${p}" data-acid-param="${key}" aria-label="${TITLES[p]} ${label}"><output></output></label>`).join('')}</div></section>`).join('')}</div>
    <div class="br-acid-actions"><button type="button" data-acid="auto" aria-pressed="false">少しずつ変化 · OFF</button><button type="button" data-acid="save">このAcidを保存</button><button type="button" data-acid="restore">保存を戻す</button></div>
    <p class="br-help">AUTOは8小節ごとに片方のアクセント／スライドだけを変え、次の8小節で元へ戻します。固定はサイコロとAUTOから守り、音色は触れます。</p>
    <p class="br-help">明るさ＝フィルターの開き、みょん＝共鳴、うねり＝音ごとの明るさの変化、長さ＝その余韻、残響＝ディレイ。音符は採譜の和音の根音に追従します。生演奏の細かな揺れを補正する機能ではありません。</p>
    <details><summary>フレーズと設定をコードで見る・変える</summary><textarea class="br-acid-code" aria-label="Acidのフレーズと設定JSON" spellcheck="false"></textarea><button type="button" data-acid="apply">コードを反映</button><p class="br-help">nは0=根音、1=2度、2=4度、3=5度、4=オクターブ。nullは休符。activeとnを揃え、accent／slideをtrueにすると強調／滑り。適用時は2台をまとめて更新します。</p></details>
    <p class="br-help">音源：<a href="experiments/workbench/v1/third_party/acidbros/LICENSE" target="_blank" rel="noopener">acidBros · MIT</a>。このブラウザにフレーズ・音色・固定・AUTOを保存。速さ・元の4パートの消音・録音は保存に含みません。戻しても自動再生しません。</p>
    <p data-acid-status role="status" aria-live="polite">303 OFF。原演奏を聴きながらONにできます。</p>`;
  const find=id=>host.querySelector(`[data-acid="${id}"]`),status=host.querySelector('[data-acid-status]');
  function setTempo(value) {
    const input=host.querySelector('[data-acid-speed]');
    if(document.activeElement!==input)input.value=value;
    host.querySelector('[data-acid-speed-read]').textContent=value+'%';
  }
  setTempo(tempo);
  host.querySelector('[data-acid-speed]').addEventListener('input',event=>{setTempo(Number(event.target.value));onTempo(Number(event.target.value));});
  function setStatus(text) { status.textContent=text; }
  function render() {
    find('enable').textContent=enabled?'303 ON':'303 OFF';find('enable').setAttribute('aria-pressed',String(enabled));
    find('auto').textContent='少しずつ変化 · '+(config.auto?'ON':'OFF');find('auto').setAttribute('aria-pressed',String(config.auto));
    find('restore').disabled=!saved;
    for(const p of PARTS) {
      host.querySelector(`[data-acid-lock="${p}"]`).checked=config.parts[p].locked;
      host.querySelector(`[data-acid-dice="${p}"]`).disabled=config.parts[p].locked;
      host.querySelector(`[data-acid-notes="${p}"]`).textContent=config.parts[p].steps.map(s=>s.active?String(s.n)+(s.accent?'!':'')+(s.slide?'~':''):'·').join(' ');
    }
    for(const input of host.querySelectorAll('[data-acid-param]')) {
      const value=config.parts[input.dataset.acidPart][input.dataset.acidParam];
      // A playing bar/status update never rebuilds or grabs a held fader.
      if(document.activeElement!==input)input.value=value;
      input.nextElementSibling.textContent=Number(value).toFixed(input.step==='0.1'?1:0);
    }
    const code=host.querySelector('textarea');if(document.activeElement!==code)code.value=JSON.stringify(config,null,2);
  }
  function publish(text) { onChange(validate(config));render();if(text)setStatus(text); }
  function enable(value) { enabled=value;render();onEnable(value); }
  find('enable').addEventListener('click',()=>enable(!enabled));
  find('replace').addEventListener('click',()=>{onMix('replace');enable(true);setStatus('元のベースを抜いて303へ。元へ戻すときは「元の4パートへ」。');});
  find('original').addEventListener('click',()=>{enable(false);onMix('original');setStatus('303を止め、元の4パートへ戻しました。');});
  find('auto').addEventListener('click',()=>{config.auto=!config.auto;publish('AUTO '+(config.auto?'ON：固定を守って変化します。':'OFF：元のフレーズを保ちます。'));});
  for(const button of host.querySelectorAll('[data-acid-dice]'))button.addEventListener('click',()=>{config=dice(config,button.dataset.acidDice);publish('フレーズを変えました。音量・音色・もう1台は保っています。');});
  for(const input of host.querySelectorAll('[data-acid-lock]'))input.addEventListener('change',()=>{config.parts[input.dataset.acidLock].locked=input.checked;publish('フレーズの固定を変更しました。');});
  for(const input of host.querySelectorAll('[data-acid-param]'))input.addEventListener('input',()=>{config.parts[input.dataset.acidPart][input.dataset.acidParam]=Number(input.value);publish();});
  find('save').addEventListener('click',()=>{try {const state=validate(config);storage.setItem(KEY,JSON.stringify({song:'tabasco/human-fly',state}));saved=state;render();setStatus('このブラウザにAcidを保存しました。');}catch{setStatus('保存できませんでした。コードをコピーして控えてください。');}});
  find('restore').addEventListener('click',()=>{if(saved){config=validate(saved);publish('保存したフレーズ・音色・固定・AUTOへ戻しました。');}});
  find('apply').addEventListener('click',()=>{try{const next=validate(JSON.parse(host.querySelector('textarea').value));config=next;publish('コードを反映しました。');}catch(e){setStatus('反映できません：'+e.message);}});
  render();
  return {createEngine:createAcidLive,state:()=>validate(config),setStatus,setTempo,
    setEnabled(value){enabled=value;render();},
    playing(info){setStatus(`303演奏中 · ${info.bar}小節目 · ${info.chord} · `+(info.auto?'8小節で小さく変化':'元のフレーズをキープ'));}
  };
}
