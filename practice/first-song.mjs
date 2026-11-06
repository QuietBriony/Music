const KEY = 'music-practice-first-song-v1';
export const FIRST_SONGS = {
  guitar: { title: 'きらきら星', song: 'twinkle', detail: 'C・Fmaj7・G7のかんたん伴奏。英語の歌詞付き。', drill: '3つのコードをゆっくり', tips: ['6本の弦を一本ずつ。音を止めてから、次の弦へ。', '図の指番号と同じ指を置きます。まずは「このコードを聴く」で確認しましょう。', 'ガイドかマイクを選んで開始。止まりながらでも大丈夫です。歌詞は譜面と一緒に進みます。'] },
  sanshin: { title: 'てぃんさぐぬ花 · 1節', song: 'tinsagu', detail: '前奏・歌・後奏を含むやさしい63音。工工四と歌詞付き。', drill: '最初の8音をゆっくり', tips: ['本調子の3本を一本ずつ。歌いやすい高さを選べます。', '工工四は一文字が一つの音。まずはガイドを聴いて、最初の8音を繰り返します。', 'ガイドかマイクを選んで開始。前奏の後に歌詞が出ます。「譜面と歌詞を全体で見る」も使えます。'] }
};
export function readFirstSong(value) {
  const clean = {};
  for (const instrument of Object.keys(FIRST_SONGS)) {
    const item = value?.[instrument];
    clean[instrument] = { step: Number.isInteger(item?.step) && item.step >= 0 && item.step <= 4 ? item.step : 0 };
  }
  return clean;
}

export function mountFirstSong({ getInstrument, onStep, onStop, onReveal }) {
  const $ = id => document.getElementById(id);
  let saved; try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* Optional storage. */ }
  const progress = readFirstSong(saved);
  let active = false, busy = false, transition = false, ticket = 0, showLauncher = saved?.showLauncher !== false;
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...progress, showLauncher })); } catch { $('first-song-note').textContent = 'この端末では続きの保存ができません。今の練習は続けられます。'; } };
  function render() {
    const instrument = getInstrument(), course = FIRST_SONGS[instrument], step = progress[instrument].step;
    $('first-song-title').textContent = course.title;
    $('first-song-detail').textContent = course.detail;
    $('first-song-start').textContent = step > 0 && step < 4 ? '続きから始める' : step === 4 ? 'もう一度練習する' : '最初の1曲を始める';
    $('first-song').hidden = !active && !showLauncher;
    $('first-song-launch').hidden = active;
    $('first-song-coach').hidden = !active;
    $('first-song').classList.toggle('is-active', active); document.body.classList.toggle('first-song-active', active);
    $('first-song-heading').textContent = step === 4 ? '今日の練習、おつかれさまでした' : `${step} / 3 · ${['', '調弦する', course.drill, '最後まで通す'][step] || ''}`;
    $('first-song-tip').textContent = step === 4 ? '途中で止まっても大丈夫。難しかった所をもう一度練習したり、好きな曲へ進めます。' : course.tips[step - 1] || '';
    $('first-song-next').textContent = step === 1 ? '準備できた → 音を練習' : step === 2 ? '1曲を通して練習する' : step === 3 ? '今日の練習を終える' : '曲を選ぶ';
    $('first-song-back').hidden = step < 2 || step === 4;
    $('first-song-next').disabled = busy;
    $('first-song-back').disabled = busy;
    $('first-song-start').disabled = busy;
    $('first-song-steps').querySelectorAll('li').forEach((node, i) => { node.setAttribute('aria-current', String(step === i + 1)); node.classList.toggle('visited', step > i + 1); });
  }
  async function go(step) {
    if (busy) return;
    const mine = ++ticket, instrument = getInstrument(); busy = true; transition = true; render();
    try {
      const ok = step === 4 ? (onStop(), true) : await onStep(step, FIRST_SONGS[instrument], { resume: progress[instrument].step === step });
      if (mine !== ticket || getInstrument() !== instrument) return;
      if (ok === false || typeof ok === 'string') { $('first-song-note').textContent = typeof ok === 'string' ? ok : '曲を読み込めませんでした。通信を確認して、もう一度お試しください。'; return; }
      $('first-song-note').textContent = '';
      progress[instrument].step = step; active = true; store();
    } catch { $('first-song-note').textContent = '準備できませんでした。もう一度お試しください。'; }
    finally { if (mine === ticket) { busy = false; transition = false; render(); window.scrollTo({ top: 0, behavior: 'instant' }); } }
  }
  const leave = () => { if (transition) return; ticket++; busy = false; active = false; render(); };
  $('first-song-start').onclick = () => { const step = progress[getInstrument()].step; go(step > 0 && step < 4 ? step : 1); };
  $('first-song-next').onclick = () => { const step = progress[getInstrument()].step; if (step === 4) { leave(); $('browse-songs').click(); } else go(step + 1); };
  $('first-song-back').onclick = () => go(progress[getInstrument()].step - 1);
  $('first-song-close').onclick = () => { onStop(); transition = false; showLauncher = true; onReveal(); leave(); store(); };
  $('first-song-open').onclick = () => { onStop(); transition = false; showLauncher = true; onReveal(); leave(); store(); window.scrollTo({top:0,behavior:'instant'}); };
  for (const selector of ['.view-switch button', '.instrument-switch button', '#browse-songs', '#beginner-path button']) {
    for (const button of document.querySelectorAll(selector)) button.addEventListener('click', () => { transition = false; if(!button.matches('.instrument-switch button'))showLauncher = false; leave(); store(); });
  }
  render(); return { render };
}
