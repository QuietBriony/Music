// Navigation and discovery only. Selecting a song never starts audio or capture.
export function mountPracticeShell({ studies, onSong, onStop }) {
  const $ = id => document.getElementById(id);
  const dialog = $('song-browser');
  const search = $('song-search');
  document.querySelector('.sing-workspace').append(document.querySelector('.sing-performance-controls'));
  // Keep the position beside the song; sensitivity settings stay optional.
  document.querySelector('.sing-progress-summary').append($('sing-progress'));
  for (const selector of ['.sing-legend', '.sing-capo-label', '#sing-capo-note']) {
    $('sing-settings').append(document.querySelector(selector));
  }
  let filter = 'all';
  let opener = null;
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  function render() {
    const query = normalize(search.value).split(' ').filter(Boolean);
    const items = Object.entries(studies).flatMap(([instrument, songs]) => songs.map(song => ({ ...song, instrument })));
    const matches = items.filter(song => (filter === 'all' || song.instrument === filter) && query.every(word => normalize(`${song.title} ${song.artist}`).includes(word)));
    const nodes = matches.map(song => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'song-result';
      const title = document.createElement('strong'); title.textContent = song.title;
      const detail = document.createElement('span'); detail.textContent = `${song.instrument === 'guitar' ? 'ギター · コード図' : '三線 · 工工四の教材'} / ${song.artist}`;
      button.append(title, detail);
      button.onclick = () => { dialog.close(); onSong(song.instrument, song.id); };
      return button;
    });
    $('song-results').replaceChildren(...nodes);
    $('song-result-count').textContent = matches.length ? `${matches.length}曲から選べます` : '見つかりませんでした。曲名の一部か、歌手名で探してみてください。';
  }
  $('browse-songs').onclick = event => {
    onStop(); opener = event.currentTarget; filter = document.body.dataset.instrument || 'all';
    search.value = ''; $('song-filter').value = filter; render(); dialog.showModal();
  };
  $('song-browser-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
  search.oninput = render;
  $('song-filter').onchange = event => { filter = event.target.value; render(); };
  $('beginner-resources').addEventListener('click', () => { $('reading-help').open = true; });
  for (const button of document.querySelectorAll('.view-switch button')) {
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'instant' }));
  }
  const nav = document.querySelector('.view-switch');
  const size = () => document.documentElement.style.setProperty('--practice-nav-height', `${Math.ceil(nav.getBoundingClientRect().height)}px`);
  const observer = new ResizeObserver(size); observer.observe(nav); size();
}
