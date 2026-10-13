import { VocalRecorder, recordingExtension } from './vocal-recorder.js';
import { openTakeStore, takeBytes } from './vocal-store.js';
import { backupText } from './session-backup.js';
import { BUILTIN_LYRICS, createLyricDrafts, lyricSections } from './vocal-lyrics.js';

const time = ms => Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2,'0');
export function initVocalBooth({ parent, getSources, snapshot, stopPlayback, isBusy = () => false }) {
  const host = document.createElement('details'); host.className = 'vocal-booth'; host.id = 'vocal-booth';
  host.innerHTML = `<summary>歌詞・録音 <span>声を重ねて、テイクを残す</span></summary>
    <div class="vocal-content">
      <p class="vocal-lead">① 演奏を再生 → ② ヘッドホンでマイクを準備 → ③ 歌詞を見ながら録音</p>
      <div class="vocal-grid"><div class="vocal-page">
        <label>歌詞を選ぶ<select id="vocal-song"><option value="custom">自分の下書き</option></select></label>
        <p id="vocal-song-note" class="vocal-note"></p>
        <div class="vocal-actions"><button type="button" id="vocal-read">歌詞を大きく表示</button></div>
        <details id="vocal-edit"><summary>歌詞・名前を編集</summary>
        <label>作品・テイク名<input id="vocal-title" maxlength="80" placeholder="例：残響の住所 · take 1"></label>
        <label>歌詞・入り方のメモ<textarea id="vocal-lyrics" maxlength="50000" rows="13" placeholder="歌詞を貼り付けるか、TXTを読み込みます。\n\n[Intro · 4小節] 息を整える\n[Verse · 16小節] 2拍を大きく感じて語る\n[Hook · 8小節] 短い言葉を繰り返す\n[Outro · 4小節] 声を抜いて余韻"></textarea></label>
        </details>
        <div class="vocal-actions"><button type="button" id="vocal-text-export">歌詞TXTを保存</button></div>
        <details><summary>手持ちの歌詞TXTを追加する</summary><label class="vocal-file">歌詞TXTを読み込む<input id="vocal-file" type="file" accept=".txt,text/plain"></label></details>
        <p id="vocal-draft-status" role="status">内蔵歌詞はファイル不要。書き換えた歌詞と名前はこのブラウザだけに自動保存します。</p>
      </div><div class="vocal-controls">
        <div id="vocal-capture-home"><div id="vocal-capture">
        <details id="vocal-setup" class="vocal-setup" open><summary>マイク・録音の準備 <span id="vocal-setup-state">マイクOFF</span></summary>
        <label>録音するもの<select id="vocal-mode"><option value="voice">演奏 ＋ 声（声だけ／演奏だけも残す）</option><option value="backing">演奏だけ（マイク不要）</option></select></label>
        <div id="vocal-mic">
        <div class="vocal-actions"><button type="button" id="vocal-arm">マイクを準備</button><button type="button" id="vocal-disarm" disabled>マイクを切る</button></div>
        <label>録音する声の音量 <output id="vocal-gain-value">100%</output><input id="vocal-gain" type="range" min="0" max="2" step="0.01" value="1" aria-label="録音する声の音量"></label>
        <label>声の入力 <meter id="vocal-meter" min="0" max="1" low="0.05" high="0.85" optimum="0.35" value="0"></meter><span id="vocal-meter-label">マイクOFF</span></label>
        </div>
        </details>
        <div id="vocal-transport">
          <div class="vocal-actions"><button type="button" id="vocal-record">● 録音開始</button><button type="button" id="vocal-stop" disabled>■ 録音を終える</button><output id="vocal-clock">0:00 / 5:00</output></div>
          <p id="vocal-status" role="status">演奏を再生し、「マイクを準備」。演奏だけなら「録音するもの」を切り替えます。</p>
          <button type="button" id="vocal-review" hidden>録ったテイクを確認 ↓</button>
        </div></div></div>
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
        <div id="vocal-take-detail" hidden><p id="vocal-take-info"></p>
          <div class="vocal-actions"><label>聴く音<select id="vocal-listen-part"></select></label><button type="button" id="vocal-audition">▶ テイクを聴く</button></div>
          <audio id="vocal-player" controls preload="metadata" aria-label="録音テイクの再生"></audio>
          <p id="vocal-listen-note" class="vocal-note" role="status"></p>
          <div class="vocal-actions"><button type="button" id="vocal-next">歌詞へ戻る・次のテイク</button></div>
          <details id="vocal-export"><summary>音声・歌詞・演奏設定を取り出す</summary>
          <div id="vocal-downloads" class="vocal-actions"></div>
          </details>
          <div class="vocal-actions"><button type="button" id="vocal-use-text">このテイクの歌詞を編集欄へ戻す</button><button type="button" id="vocal-delete">このテイクを削除</button></div>
          <p id="vocal-delete-confirm" hidden>この端末のテイクを削除します。<button type="button" id="vocal-delete-yes">削除する</button><button type="button" id="vocal-delete-no">キャンセル</button></p>
        </div>
      </section>
    </div>
    <dialog id="vocal-reader" class="vocal-reader" aria-labelledby="vocal-reader-title">
      <div class="vocal-reader-head"><h3 id="vocal-reader-title"></h3><button type="button" id="vocal-reader-close" autofocus>編集・演奏に戻る</button></div>
      <label class="vocal-reader-jump">読む場所<select id="vocal-section" aria-label="歌詞の読む場所"></select></label>
      <div id="vocal-reader-text" class="vocal-reader-text" tabindex="0" role="region" aria-label="読む歌詞"></div>
      <div id="vocal-reader-transport"></div>
    </dialog>`;
  parent.append(host);
  const $ = id => host.querySelector('#vocal-' + id);
  const store = openTakeStore(window.indexedDB); const pending = new Map();
  let takes = [], selected = null, urls = [], partURLs = {}, timer, draftUnsaved = false;
  let latestTakeId = '', refreshGeneration = 0, readerReturn = 'read';
  const say = text => { $('status').textContent = text; };
  const draft = () => ({title:$('title').value.trim() || '声のスケッチ', lyrics:$('lyrics').value});
  const editableDraft = () => ({title:$('title').value, lyrics:$('lyrics').value});
  let lyricDrafts;
  for (const song of BUILTIN_LYRICS) {
    const option=document.createElement('option'); option.value=song.id; option.textContent=song.title+'（内蔵）'; $('song').append(option);
  }
  function showDraft(data) {
    $('title').value=data.title; $('lyrics').value=data.lyrics; $('song').value=lyricDrafts.selected;
    $('song-note').textContent=BUILTIN_LYRICS.find(song=>song.id===lyricDrafts.selected)?.note
      || '自由に書ける下書き。歌詞を切り替えても、ここへ戻すと続きから編集できます。';
  }
  function saveText() {
    try {
      const saved=lyricDrafts.save(editableDraft()); draftUnsaved=false;
      if (saved.title !== $('title').value || saved.lyrics !== $('lyrics').value) showDraft(saved);
      $('draft-status').textContent = 'この歌詞の編集を端末に保存しました。書き換えた内容は公開・送信しません。';
    } catch (error) {
      draftUnsaved=true;
      $('draft-status').textContent = error.code === 'LYRIC_CONFLICT' ? error.message : '名前・歌詞を自動保存できません。歌詞TXTを保存してください。';
    }
  }
  try {
    lyricDrafts = createLyricDrafts(localStorage);
  } catch {
    lyricDrafts = createLyricDrafts({getItem:()=>null, setItem:()=>{throw new Error('保存欄を利用できません');}});
    $('draft-status').textContent = '歌詞の保存欄を読めません。編集はTXTで保管してください。';
  }
  showDraft(lyricDrafts.current());
  $('song').addEventListener('change', () => {
    try {
      showDraft(lyricDrafts.choose($('song').value, editableDraft()));
      draftUnsaved=false;
      $('draft-status').textContent='歌詞を切り替えました。前の編集も端末に保存済み。選び直すと戻せます。';
    } catch (error) {
      draftUnsaved=true;
      $('song').value=lyricDrafts.selected;
      $('draft-status').textContent=error.code === 'LYRIC_CONFLICT' ? error.message : '今の歌詞を保存できないため切替を止めました。先に歌詞TXTを保存してください。';
    }
  });
  $('title').addEventListener('input', saveText); $('lyrics').addEventListener('input', saveText);
  function openReader() {
    $('reader-title').textContent=draft().title;
    $('reader-text').replaceChildren(); $('section').replaceChildren();
    const sections=lyricSections($('lyrics').value || '歌詞を選ぶか、編集欄に書いてから開いてください。');
    let sectionNumber=0;
    sections.forEach((section,index) => {
      const block=document.createElement('div'); block.className='vocal-reader-section'; block.textContent=section.text;
      $('reader-text').append(block);
      const option=document.createElement('option'); option.value=String(index);
      option.textContent=section.heading ? `${++sectionNumber}. ${section.heading}` : 'はじめから'; $('section').append(option);
    });
    $('section').disabled=sections.length < 2;
    $('setup').open=$('mode').value === 'voice' && !recorder.stream && !recorder.active;
    $('reader-transport').append($('capture'));
    $('reader').showModal(); $('reader-text').scrollTop=0;
  }
  $('read').addEventListener('click', openReader);
  $('section').addEventListener('change', () => {
    const block=$('reader-text').children[Number($('section').value)];
    if (block) $('reader-text').scrollTop += block.getBoundingClientRect().top - $('reader-text').getBoundingClientRect().top - 8;
  });
  $('reader-close').addEventListener('click', () => $('reader').close());
  $('reader').addEventListener('close', () => {
    $('capture-home').append($('capture')); $('setup').open=true;
    $(readerReturn).focus(); $(readerReturn).scrollIntoView({block:'center'}); readerReturn='read';
  });
  // Reading keys scroll/close the dialog, not the background live set or MIDI mappings.
  for (const type of ['keydown','keyup']) $('reader').addEventListener(type, event => event.stopPropagation());
  function addDownload(parent, text, blob, name) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob); urls.push(url);
    a.textContent = text; a.href = url; a.download = name; parent.append(a);
    return url;
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
      if (recorder.active) throw new Error('録音を終えてから歌詞を追加してください。');
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
      await refreshTakes(take.id, take);
      latestTakeId=take.id; $('review').hidden=false;
    },
  });
  function render() {
    const active = recorder.active, requesting = recorder.state === 'requesting';
    $('mode').disabled = active || requesting;
    $('mic').hidden = $('mode').value !== 'voice';
    $('arm').disabled = active || requesting || $('mode').value !== 'voice';
    $('disarm').disabled = !recorder.stream && !requesting;
    $('record').disabled = active || requesting || ($('mode').value === 'voice' && !recorder.stream);
    $('stop').disabled = recorder.state !== 'recording';
    for (const id of ['review','audition','listen-part','next']) $(id).disabled=active || requesting;
    $('audition').disabled ||= !partURLs[$('listen-part').value];
    for (const id of ['song','title','lyrics','file','use-text']) $(id).disabled=active;
    $('record').textContent = recorder.state === 'recording' ? '● 録音中' : recorder.state === 'finishing' ? '保存中…' : '● 録音開始';
    $('setup-state').textContent=requesting ? '許可待ち' : recorder.stream ? 'マイクON' : $('mode').value === 'backing' ? '演奏だけ' : 'マイクOFF';
    host.classList.toggle('is-recording', active);
    if (!host.open && !active && !recorder.stream) clearInterval(timer);
    if (requesting) say('ブラウザのマイク許可を待っています。「マイクを切る」で中止できます。');
    if (recorder.state === 'armed') say('マイク準備OK。声のメーターを確認して「録音開始」。声はスピーカーへ返しません。');
  }
  $('gain').addEventListener('input', () => { recorder.level($('gain').value); $('gain-value').textContent = Math.round(recorder.voiceLevel*100)+'%'; });
  $('arm').addEventListener('click', async () => { try { await recorder.arm(); } catch(error) { say('マイクを準備できませんでした。' + error.message); } });
  $('disarm').addEventListener('click', () => { recorder.disarm(); if (!recorder.active) say('マイクを切りました。'); });
  $('mode').addEventListener('change', () => {
    recorder.disarm(); render();
    say($('mode').value === 'voice' ? 'ヘッドホンをつなぎ、「マイクを準備」を押してください。' : '演奏だけを録ります。ビートを再生してから「録音開始」。');
  });
  $('record').addEventListener('click', () => {
    try {
      if (isBusy()) throw new Error('演奏の準備完了を待ってから録音してください。');
      if (pending.size) throw new Error('未保存のテイクがあります。先に音声・歌詞・設定をダウンロードし、棚を整理してください。');
      $('player').pause();
      const session=snapshot(draft().title); backupText(session); // Validate portable restore before recording.
      recorder.start({withVoice:$('mode').value === 'voice', metadata:{...draft(), session, capturedAt:'start'}});
      $('review').hidden=true;
      $('clock').textContent='0:00 / 5:00';
      if ($('reader').open) $('setup').open=false;
      say($('mode').value === 'voice' ? '録音中。歌詞を見ながら声を重ねてください。終わったら「録音を終える」。'
        : '演奏を録音中。AUTO・サイコロ・フェーダーで遊べます。終わったら「録音を終える」。');
    } catch(error) { say(error.message); }
  });
  $('stop').addEventListener('click', () => recorder.stop());
  $('review').addEventListener('click', () => {
    if (recorder.active || !takes.some(take=>take.id===latestTakeId)) return;
    $('takes').value=latestTakeId; selectTake();
    if ($('reader').open) { readerReturn='takes'; $('reader').close(); }
    else { $('takes').focus(); $('takes').scrollIntoView({block:'center'}); }
  });
  $('next').addEventListener('click', () => {
    $('player').pause();
    say('今の歌詞で次を録れます。演奏が止まっていたら、演奏画面で再生してから録音してください。前のテイクは棚に残ります。');
    openReader();
  });
  function selectPart() {
    $('player').pause(); $('player').removeAttribute('src');
    const key=$('listen-part').value;
    if (partURLs[key]) $('player').src=partURLs[key];
    $('player').load();
    $('listen-note').textContent = key === 'voice' ? '声だけの原音。録音時の声フェーダーを通す前の音です。'
      : key === 'backing' ? '演奏だけ。声は含みません。ミックスの録音音量補正（70%）を通す前の音です。'
      : key ? '再生するとライブ演奏を止めて、このテイクを聴けます。音を切り替えると先頭から。'
      : '再生できる音声がありません。歌詞と演奏設定は取り出せます。';
    $('audition').disabled=!partURLs[key] || recorder.active || recorder.state==='requesting';
  }
  function selectTake() {
    const next=takes.find(take => take.id === $('takes').value);
    // A shelf refresh must not rewind a take that is being auditioned.
    if (selected && selected.id === next?.id) return;
    $('player').pause(); $('player').removeAttribute('src'); $('player').load();
    urls.forEach(url => URL.revokeObjectURL(url)); urls = []; partURLs={};
    selected = next;
    $('take-detail').hidden = !selected; $('delete-confirm').hidden = true;
    if (!selected) return;
    const take = selected, base = 'music-take-' + take.createdAt.replaceAll(/[:.]/g,'-');
    $('export').open=pending.has(take.id);
    $('take-info').textContent = take.title + ' · ' + time(take.durationMs) + ' · ' + (takeBytes(take)/1024/1024).toFixed(1) + ' MB'
      + (pending.has(take.id) ? ' · 未保存：ダウンロードしてください' : ' · この端末に保存済み') + (take.partial ? ' · 一部録音エラー' : '');
    $('downloads').replaceChildren(); $('listen-part').replaceChildren();
    for (const [key,label] of [['mix','ミックス音声'],['voice','声だけ'],['backing','演奏だけ']]) {
      if (!take.audio[key]?.size) continue;
      partURLs[key]=addDownload($('downloads'),label,take.audio[key],base+'-'+key+'.'+recordingExtension(take.audio[key].type));
      const option=document.createElement('option'); option.value=key;
      option.textContent=key==='mix' && !take.audio.voice ? '演奏（今回の録音）' : label; $('listen-part').append(option);
    }
    addDownload($('downloads'),'歌詞TXT',new Blob([take.title+'\n\n'+take.lyrics],{type:'text/plain;charset=utf-8'}),base+'-lyrics.txt');
    addDownload($('downloads'),'演奏設定JSON',new Blob([backupText(take.session)],{type:'application/json'}),base+'-session.json');
    selectPart();
  }
  async function refreshTakes(id, addedTake) {
    const generation=++refreshGeneration;
    let stored;
    try { stored = await store.list(); } catch (error) { say('テイク棚を読み込めません。' + error.message); stored = takes; }
    if (generation !== refreshGeneration) return;
    id ??= $('takes').value;
    takes=[...new Map([...stored, ...pending.values(), ...(addedTake ? [addedTake] : [])].map(take=>[take.id,take])).values()];
    takes.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    $('takes').replaceChildren();
    if (!takes.length) { const o=document.createElement('option'); o.textContent='まだ録音がありません'; o.value=''; $('takes').append(o); }
    for (const take of takes) { const o=document.createElement('option'); o.value=take.id; o.textContent=take.title+' · '+new Date(take.createdAt).toLocaleString('ja-JP'); $('takes').append(o); }
    $('takes').value = takes.some(t=>t.id===id) ? id : (takes[0]?.id || ''); selectTake();
    if (!takes.some(take=>take.id===latestTakeId)) $('review').hidden=true;
  }
  $('takes').addEventListener('change', selectTake); $('refresh').addEventListener('click',()=>refreshTakes());
  $('listen-part').addEventListener('change', selectPart);
  $('audition').addEventListener('click', async () => {
    if (recorder.active || recorder.state==='requesting') return;
    if (!$('player').paused) { $('player').pause(); return; }
    try { await $('player').play(); }
    catch { $('listen-note').textContent='このブラウザでは再生できません。音声を取り出して別のプレーヤーで開いてください。'; }
  });
  for (const type of ['play','pause','ended','emptied']) $('player').addEventListener(type, () => {
    $('audition').textContent=$('player').paused ? '▶ テイクを聴く' : 'Ⅱ 試聴を一時停止';
  });
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
    $('edit').open=true;
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
    if (recorder.active || pending.size || draftUnsaved) { event.preventDefault(); event.returnValue=''; }
  });
  document.addEventListener('visibilitychange', () => { if(document.hidden) recorder.disarm(); });
  window.addEventListener('pagehide', () => recorder.disarm());
  render();
  return { open() { host.open=true; host.scrollIntoView({block:'start'}); },
    refresh:()=>recorder.refresh(), busy:()=>recorder.active || recorder.state==='requesting' || pending.size>0 };
}
