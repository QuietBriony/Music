import { VocalRecorder, recordingExtension } from './vocal-recorder.js';
import { openTakeStore, takeBytes } from './vocal-store.js';
import { backupText } from './session-backup.js';

const DRAFT_KEY = 'music-workbench-vocal-draft-v1';
const time = ms => Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2,'0');
export function initVocalBooth({ parent, getSources, snapshot, stopPlayback, isBusy = () => false }) {
  const host = document.createElement('details'); host.className = 'vocal-booth'; host.id = 'vocal-booth';
  host.innerHTML = `<summary>歌詞・録音 <span>声を重ねて、テイクを残す</span></summary>
    <div class="vocal-content">
      <p class="vocal-lead">① 演奏を再生 → ② ヘッドホンでマイクを準備 → ③ 歌詞を見ながら録音</p>
      <div class="vocal-grid"><div class="vocal-page">
        <label>作品・テイク名<input id="vocal-title" maxlength="80" placeholder="例：残響の住所 · take 1"></label>
        <label>歌詞・入り方のメモ<textarea id="vocal-lyrics" maxlength="50000" rows="13" placeholder="歌詞を貼り付けるか、TXTを読み込みます。\n\n[Intro · 4小節] 息を整える\n[Verse · 16小節] 2拍を大きく感じて語る\n[Hook · 8小節] 短い言葉を繰り返す\n[Outro · 4小節] 声を抜いて余韻"></textarea></label>
        <div class="vocal-actions"><label class="vocal-file">歌詞TXTを読み込む<input id="vocal-file" type="file" accept=".txt,text/plain"></label><button type="button" id="vocal-text-export">歌詞TXTを保存</button></div>
        <p id="vocal-draft-status" role="status">歌詞と名前は、このブラウザに自動保存。公開・送信しません。</p>
      </div><div class="vocal-controls">
        <label>録音するもの<select id="vocal-mode"><option value="voice">演奏 ＋ 声（声だけ／演奏だけも残す）</option><option value="backing">演奏だけ（マイク不要）</option></select></label>
        <div class="vocal-actions"><button type="button" id="vocal-arm">マイクを準備</button><button type="button" id="vocal-disarm" disabled>マイクを切る</button></div>
        <label>録音する声の音量 <output id="vocal-gain-value">100%</output><input id="vocal-gain" type="range" min="0" max="2" step="0.01" value="1" aria-label="録音する声の音量"></label>
        <label>声の入力 <meter id="vocal-meter" min="0" max="1" low="0.05" high="0.85" optimum="0.35" value="0"></meter><span id="vocal-meter-label">マイクOFF</span></label>
        <div class="vocal-actions"><button type="button" id="vocal-record">● 録音開始</button><button type="button" id="vocal-stop" disabled>■ 録音を終える</button><output id="vocal-clock">0:00 / 5:00</output></div>
        <p id="vocal-status" role="status">まず好きなフレーズを固定して再生。録音中もAUTO・サイコロ・フェーダーで遊べます。</p>
        <details class="vocal-guide"><summary>語り・ラップを録るコツと保存先</summary>
          <p>速いビートは半分の速さで数え、1行を1〜2小節で。まずキックと低音を固定、返しの303を少し下げ、AUTOは8小節。短い語り → ラップ → 同じ言葉の繰り返し → 演奏だけ、の順に試します。</p>
          <p>有線ヘッドホン推奨。声はスピーカーへ返さず録音だけに入ります。入力メーターが張り付く時は声の音量やマイクとの距離を調整。声だけのファイルはこの音量フェーダーの前で録ります。</p>
          <p>ミックスは余裕を持たせるため70%で録音します。自動音量補正ではありません。声だけと演奏だけは後でDAW等で合わせられますが、端末の入力遅延・各ファイルの開始位置は微調整が必要です。</p>
          <p>1テイク5分、棚は12件／250 MBまで。画面を閉じる・ロック・裏へ移すと録音は終了します。再生設定は録音開始時のスナップショットで、途中の操作履歴ではありません。</p>
          <p>テイクはこの端末のブラウザ内。通常のアプリ更新では保持しますが、サイトデータ削除で消えます。音声・歌詞TXT・演奏設定JSONをダウンロードして保管してください。JSONは試奏台の「持ち運び・バックアップ」で読み込めます。通常のバックアップには音声と歌詞を含めません。</p>
          <p>作品として歌詞を整理する時は既存の<a href="https://music-stack.pages.dev/lyric-lab.html" target="_blank" rel="noreferrer">歌詞棚</a>も使えます。画面を切り替える前に録音を終え、歌詞TXTを保存してください。</p>
        </details>
      </div></div>
      <section class="vocal-takes" aria-label="この端末の録音テイク"><h3>テイクを聴き比べる</h3>
        <div class="vocal-actions"><label>録音テイク<select id="vocal-takes"><option value="">まだ録音がありません</option></select></label><button id="vocal-refresh" type="button">棚を更新</button></div>
        <div id="vocal-take-detail" hidden><p id="vocal-take-info"></p><audio id="vocal-player" controls preload="none"></audio>
          <div id="vocal-downloads" class="vocal-actions"></div>
          <div class="vocal-actions"><button type="button" id="vocal-use-text">このテイクの歌詞を編集欄へ戻す</button><button type="button" id="vocal-delete">このテイクを削除</button></div>
          <p id="vocal-delete-confirm" hidden>この端末のテイクを削除します。<button type="button" id="vocal-delete-yes">削除する</button><button type="button" id="vocal-delete-no">キャンセル</button></p>
        </div>
      </section>
    </div>`;
  parent.append(host);
  const $ = id => host.querySelector('#vocal-' + id);
  const store = openTakeStore(window.indexedDB); const pending = new Map();
  let takes = [], selected = null, urls = [], timer;
  const say = text => { $('status').textContent = text; };
  const draft = () => ({title:$('title').value.trim() || '声のスケッチ', lyrics:$('lyrics').value});
  function saveText() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft())); $('draft-status').textContent = '名前・歌詞をこのブラウザに保存しました。公開・送信しません。'; }
    catch { $('draft-status').textContent = '名前・歌詞を自動保存できません。歌詞TXTを保存してください。'; }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    $('title').value = typeof saved.title === 'string' ? saved.title.slice(0,80) : '';
    $('lyrics').value = typeof saved.lyrics === 'string' ? saved.lyrics.slice(0,50000) : '';
  } catch { $('draft-status').textContent = '歌詞の保存欄を読めません。TXTで保管してください。'; }
  $('title').addEventListener('input', saveText); $('lyrics').addEventListener('input', saveText);
  function addDownload(parent, text, blob, name) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob); urls.push(url);
    a.textContent = text; a.href = url; a.download = name; parent.append(a);
  }
  function downloadText() {
    const a = document.createElement('a'), data = draft();
    const url = URL.createObjectURL(new Blob([data.title + '\n\n' + data.lyrics], {type:'text/plain;charset=utf-8'}));
    a.href = url; a.download = 'music-lyrics.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url),60000);
  }
  $('text-export').addEventListener('click', downloadText);
  $('file').addEventListener('change', async () => {
    const file = $('file').files?.[0]; if (!file) return;
    try {
      if (file.size > 200000) throw new Error('歌詞TXTは200 KB以内で用意してください。');
      const text = await file.text(); if (text.length > 50000) throw new Error('歌詞は5万文字以内です。');
      // Keep existing lyrics; importing appends instead of silently replacing them.
      const combined = [$('lyrics').value, text].filter(Boolean).join('\n\n');
      if (combined.length > 50000) throw new Error('今の歌詞と合わせると5万文字を超えます。先にTXTで保存して整理してください。');
      $('lyrics').value = combined; saveText();
    } catch (error) { say(error.message); } finally { $('file').value = ''; }
  });
  const recorder = new VocalRecorder({getSources, mediaDevices:navigator.mediaDevices, Recorder:window.MediaRecorder, audioSession:navigator.audioSession,
    onChange: render,
    async onTake(take) {
      pending.set(take.id,take);
      try { await store.put(take); pending.delete(take.id); say(take.reason + '。テイクをこの端末に保存しました。'); }
      catch (error) { say('端末保存に失敗。この画面を閉じず、下の音声をダウンロードしてください。' + error.message); }
      await refreshTakes(take.id);
    },
  });
  function render() {
    const active = recorder.active, requesting = recorder.state === 'requesting';
    $('mode').disabled = active || requesting;
    $('arm').disabled = active || requesting || $('mode').value !== 'voice';
    $('disarm').disabled = !recorder.stream && !requesting;
    $('record').disabled = active || requesting;
    $('stop').disabled = recorder.state !== 'recording';
    $('record').textContent = recorder.state === 'recording' ? '● 録音中' : recorder.state === 'finishing' ? '保存中…' : '● 録音開始';
    host.classList.toggle('is-recording', active);
    if (!host.open && !active && !recorder.stream) clearInterval(timer);
    if (requesting) say('ブラウザのマイク許可を待っています。「マイクを切る」で中止できます。');
    if (recorder.state === 'armed') say('マイク準備OK。声のメーターを確認して「録音開始」。声はスピーカーへ返しません。');
  }
  $('gain').addEventListener('input', () => { recorder.level($('gain').value); $('gain-value').textContent = Math.round(recorder.voiceLevel*100)+'%'; });
  $('arm').addEventListener('click', async () => { try { await recorder.arm(); } catch(error) { say('マイクを準備できませんでした。' + error.message); } });
  $('disarm').addEventListener('click', () => { recorder.disarm(); if (!recorder.active) say('マイクを切りました。'); });
  $('mode').addEventListener('change', () => { recorder.disarm(); render(); });
  $('record').addEventListener('click', () => {
    try {
      if (isBusy()) throw new Error('演奏の準備完了を待ってから録音してください。');
      if (pending.size) throw new Error('未保存のテイクがあります。先に音声・歌詞・設定をダウンロードし、棚を整理してください。');
      $('player').pause();
      const session=snapshot(draft().title); backupText(session); // Validate portable restore before recording.
      recorder.start({withVoice:$('mode').value === 'voice', metadata:{...draft(), session, capturedAt:'start'}});
      say($('mode').value === 'voice' ? '録音中。歌詞を見ながら声を重ねてください。終わったら「録音を終える」。'
        : '演奏を録音中。AUTO・サイコロ・フェーダーで遊べます。終わったら「録音を終える」。');
    } catch(error) { say(error.message); }
  });
  $('stop').addEventListener('click', () => recorder.stop());
  function selectTake() {
    $('player').pause(); $('player').removeAttribute('src'); $('player').load();
    urls.forEach(url => URL.revokeObjectURL(url)); urls = [];
    selected = takes.find(take => take.id === $('takes').value);
    $('take-detail').hidden = !selected; $('delete-confirm').hidden = true;
    if (!selected) return;
    const take = selected, base = 'music-take-' + take.createdAt.replaceAll(/[:.]/g,'-');
    $('take-info').textContent = take.title + ' · ' + time(take.durationMs) + ' · ' + (takeBytes(take)/1024/1024).toFixed(1) + ' MB'
      + (pending.has(take.id) ? ' · 未保存：ダウンロードしてください' : ' · この端末に保存済み') + (take.partial ? ' · 一部録音エラー' : '');
    const mixURL = URL.createObjectURL(take.audio.mix); urls.push(mixURL); $('player').src = mixURL;
    $('downloads').replaceChildren();
    for (const [key,label] of [['mix','ミックス音声'],['voice','声だけ'],['backing','演奏だけ']]) {
      if (take.audio[key]) addDownload($('downloads'),label,take.audio[key],base+'-'+key+'.'+recordingExtension(take.audio[key].type));
    }
    addDownload($('downloads'),'歌詞TXT',new Blob([take.title+'\n\n'+take.lyrics],{type:'text/plain;charset=utf-8'}),base+'-lyrics.txt');
    addDownload($('downloads'),'演奏設定JSON',new Blob([backupText(take.session)],{type:'application/json'}),base+'-session.json');
  }
  async function refreshTakes(id = $('takes').value) {
    try { takes = await store.list(); } catch (error) { say('テイク棚を読み込めません。' + error.message); takes = []; }
    takes.push(...pending.values()); takes.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    $('takes').replaceChildren();
    if (!takes.length) { const o=document.createElement('option'); o.textContent='まだ録音がありません'; o.value=''; $('takes').append(o); }
    for (const take of takes) { const o=document.createElement('option'); o.value=take.id; o.textContent=take.title+' · '+new Date(take.createdAt).toLocaleString('ja-JP'); $('takes').append(o); }
    $('takes').value = takes.some(t=>t.id===id) ? id : (takes[0]?.id || ''); selectTake();
  }
  $('takes').addEventListener('change', selectTake); $('refresh').addEventListener('click',()=>refreshTakes());
  $('player').addEventListener('play', () => {
    if (recorder.active || recorder.state === 'requesting') { $('player').pause(); say('録音を終えてからテイクを聴けます。'); return; }
    recorder.disarm(); stopPlayback();
  });
  $('use-text').addEventListener('click', () => {
    if (!selected) return;
    // Never discard text: a different draft is appended for comparison.
    const combined = $('lyrics').value && $('lyrics').value !== selected.lyrics ? $('lyrics').value+'\n\n'+selected.lyrics : selected.lyrics;
    if (combined.length > 50000) { say('歌詞が長すぎます。先にTXTで保存してください。'); return; }
    $('lyrics').value=combined; $('title').value=selected.title; saveText();
  });
  $('delete').addEventListener('click',()=>{ $('delete-confirm').hidden=false; });
  $('delete-no').addEventListener('click',()=>{ $('delete-confirm').hidden=true; });
  $('delete-yes').addEventListener('click',async()=>{
    if (!selected) return;
    try { await store.remove(selected.id); pending.delete(selected.id); await refreshTakes(); }
    catch (error) { say('削除できませんでした。'+error.message); }
  });
  host.addEventListener('toggle', () => {
    clearInterval(timer);
    if (host.open || recorder.active || recorder.stream) {
      timer = setInterval(() => {
        recorder.refresh(); const peak=recorder.peak(); $('meter').value=Math.min(1,peak);
        $('meter-label').textContent=!recorder.stream?'マイクOFF':peak>=.95?'大きすぎます · 声を下げる':peak>.01?'声を受信中':'入力待ち';
        if (recorder.active) $('clock').textContent=time(Date.now()-recorder.startedAt)+' / 5:00';
      },150);
    }
    if (host.open) refreshTakes();
  });
  window.addEventListener('beforeunload', event => {
    if (recorder.active || pending.size) { event.preventDefault(); event.returnValue=''; }
  });
  document.addEventListener('visibilitychange', () => { if(document.hidden) recorder.disarm(); });
  window.addEventListener('pagehide', () => recorder.disarm());
  render();
  return { open() { host.open=true; host.scrollIntoView({block:'start'}); },
    refresh:()=>recorder.refresh(), busy:()=>recorder.active || recorder.state==='requesting' || pending.size>0 };
}
