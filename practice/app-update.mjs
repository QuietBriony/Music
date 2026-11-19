export const PRACTICE_VERSION = '46';

// An old HTML document can outlive a deployment. Do not mount the new UI into it.
export async function ensurePracticeShell(version = PRACTICE_VERSION) {
  const declared = document.querySelector('meta[name="practice-version"]')?.content;
  if (declared === version) {
    const clean = new URL(location.href);
    if (clean.searchParams.has('practice-update')) {
      clean.searchParams.delete('practice-update'); history.replaceState(null, '', clean);
    }
    return true;
  }
  const panel = document.createElement('main');
  panel.style.cssText = 'max-width:480px;margin:15vh auto;padding:24px;font:16px/1.8 system-ui;color:#203d30;background:#fffdf8;border:1px solid #bdcdbb;border-radius:16px';
  const title = document.createElement('h1'), message = document.createElement('p'), retry = document.createElement('button');
  title.textContent = '練習画面を更新しています';
  message.textContent = '保存した歌詞や練習位置はそのまま残ります。';
  retry.textContent = 'もう一度読み込む'; retry.style.cssText = 'padding:12px 18px;font:inherit';
  panel.append(title, message, retry); document.body.replaceChildren(panel);
  const recover = async () => {
    retry.disabled = true;
    try {
      const url = new URL(location.href); url.searchParams.set('practice-update', version);
      const response = await fetch(url, { cache: 'no-store' });
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (!response.ok || html.querySelector('meta[name="practice-version"]')?.content !== version) throw Error('not ready');
      location.replace(url.href);
    } catch {
      title.textContent = '更新を待っています';
      message.textContent = '通信を確認して、もう一度読み込んでください。保存内容を消す必要はありません。';
      retry.disabled = false;
    }
  };
  retry.onclick = recover;
  if (new URL(location.href).searchParams.get('practice-update') !== version) await recover();
  return false;
}

function workerVersion(worker) {
  return new Promise(resolve => {
    if (!worker) return resolve(null);
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 1200);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data?.version); };
    try { worker.postMessage({ type: 'PRACTICE_VERSION' }, [channel.port2]); }
    catch { clearTimeout(timer); channel.port1.close(); resolve(null); }
  });
}

export function mountPracticeUpdates({ onPause, onInfo = () => {} }) {
  const state = document.getElementById('offline-state'), panel = document.getElementById('practice-update');
  const button = document.getElementById('practice-update-now');
  const info = document.getElementById('practice-info-dialog'), result = document.getElementById('practice-update-result');
  const checkButton = document.getElementById('practice-update-check'), label = document.getElementById('practice-update-label');
  const strip = document.querySelector?.('#practice-app-info');
  const describe = text => { if (result) result.textContent = text; };
  for (const id of ['practice-app-version', 'practice-info-version']) {
    const el = document.getElementById(id); if (el) el.textContent = `${id === 'practice-app-version' ? '' : '使用中 '}v${PRACTICE_VERSION}`;
  }
  let registration, requested = false, announced = false, checking = null, lastCheck = 0, activationTimer, networkAbort, connecting;
  const watched = new WeakSet();
  // A modal occupies the browser's top layer. Keep the notice inside the last
  // opened dialog so a full-screen score cannot cover an available update.
  let home, dialogs = [];
  const place = () => {
    if (!home || panel.hidden) return;
    const dialog = dialogs.filter(d => d.open).at(-1);
    if (dialog) { if (panel.parentNode !== dialog) dialog.prepend(panel); }
    else if (panel.previousSibling !== home) home.after(panel);
  };
  if (info && typeof MutationObserver !== 'undefined') {
    home = document.createComment('Practice update notice'); panel.before(home);
    dialogs = [...document.querySelectorAll('dialog[open]')];
    new MutationObserver(changes => {
      for (const change of changes) if (change.target.tagName === 'DIALOG') {
        dialogs = dialogs.filter(d => d !== change.target);
        if (change.target.open) dialogs.push(change.target);
      }
      place();
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  }
  const offer = version => {
    announced = true; panel.hidden = false; button.disabled = false; button.textContent = '更新して再開';
    if (label) label.textContent = `新しい版${version ? ` v${version}` : ''}を使えます。入力中の歌詞は保存してから更新してください。`;
    if (strip) strip.dataset.update = 'true';
    describe(`新しい版${version ? ` v${version}` : ''}を使えます。「更新して再開」で切り替えられます。`); place();
  };
  const current = async () => {
    const controller = navigator.serviceWorker.controller, version = await workerVersion(controller);
    if (version === PRACTICE_VERSION && controller === navigator.serviceWorker.controller) {
      state.textContent = 'オフライン準備OK';
      try { controller.postMessage({ type: 'PRACTICE_CLEAN', version }); } catch { /* The controller may be leaving. */ }
    }
    return version;
  };
  const waiting = async () => {
    const worker = registration?.waiting; if (!worker) return false;
    const version = await workerVersion(worker);
    if (registration.waiting !== worker || !version) return false;
    if (!announced && version === PRACTICE_VERSION && await workerVersion(navigator.serviceWorker.controller) !== PRACTICE_VERSION) {
      worker.postMessage({ type: 'PRACTICE_ACTIVATE' });
    } else if (version !== PRACTICE_VERSION) offer(version);
    return version !== PRACTICE_VERSION;
  };
  const supported = 'serviceWorker' in navigator && window.isSecureContext;
  async function check({ manual = false, force = false } = {}) {
    if (checking) return checking;
    if (!manual && !force && Date.now() - lastCheck < 30000) return;
    lastCheck = Date.now();
    checking = (async () => {
      if (checkButton) checkButton.disabled = true;
      describe('新しい版を確認しています…');
      if (supported) {
        current();
        if (await waiting()) return;
      }
      if (navigator.onLine === false) { describe('オフラインのため更新を確認できません。保存した練習はそのまま使えます。'); return; }
      if (supported) { if (!registration) connect(); registration?.update().catch(() => {}); }
      const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 6000);
      networkAbort = abort;
      try {
        // Navigation intentionally keeps an immutable offline snapshot. A GET
        // with an unknown query is not navigation and bypasses that snapshot.
        const url = new URL('./', location.href); url.searchParams.set('practice-release-check', `${PRACTICE_VERSION}-${Date.now()}`);
        const response = await fetch(url, { cache: 'no-store', mode: 'same-origin', signal: abort.signal });
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const version = html.querySelector('meta[name="practice-version"]')?.content;
        if (!response.ok || !/^\d{1,6}$/.test(version || '')) throw Error('No release version');
        if (supported && await waiting()) return;
        if (version === PRACTICE_VERSION) describe(`v${PRACTICE_VERSION} は最新です。`);
        else if (Number(version) > Number(PRACTICE_VERSION)) describe(`新しい版 v${version} を準備しています。切り替える準備ができると「更新して再開」が表示されます。`);
        else describe('配信の切り替え中です。今の版で練習を続けられます。しばらくしてから確認してください。');
      } catch { describe('通信できず更新を確認できませんでした。今の版と保存した練習はそのまま使えます。'); }
      finally { clearTimeout(timer); if (networkAbort === abort) networkAbort = null; }
    })().finally(() => { checking = null; if (checkButton) checkButton.disabled = false; });
    return checking;
  }
  for (const trigger of document.querySelectorAll?.('[data-practice-info]') || []) trigger.onclick = () => {
    if (!info.open) info.showModal(); onInfo(); check({ manual: true });
  };
  const close = document.getElementById('practice-info-close'); if (close) close.onclick = () => info.close();
  if (checkButton) checkButton.onclick = () => check({ manual: true });
  const reload = document.getElementById('practice-reload'); if (reload) reload.onclick = () => {
    if (registration?.waiting || announced) button.click();
    else { onPause(); location.reload(); }
  };
  button.onclick = () => {
    onPause(); requested = true; button.disabled = true; button.textContent = '更新しています…';
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'PRACTICE_ACTIVATE' });
      clearTimeout(activationTimer); activationTimer = setTimeout(() => {
        if (!requested) return;
        requested = false; button.disabled = false; button.textContent = 'もう一度更新';
        describe('切り替えを確認できませんでした。もう一度更新してください。保存内容を消す必要はありません。');
      }, 8000);
    }
    else location.reload();
  };
  const resume = event => {
    if (document.visibilityState === 'hidden') { networkAbort?.abort(); return; }
    check({ force: ['visibilitychange', 'pageshow', 'online'].includes(event?.type) });
  };
  document.addEventListener?.('visibilitychange', resume);
  for (const event of ['focus', 'pageshow', 'online']) window.addEventListener?.(event, resume);
  for (const event of ['offline', 'pagehide']) window.addEventListener?.(event, () => networkAbort?.abort());
  window.setInterval?.(resume, 300000);
  if (!supported) { state.textContent = 'オンラインで利用できます'; return { check }; }
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    const version = await current();
    if (requested) { clearTimeout(activationTimer); onPause(); location.reload(); }
    else if (version && version !== PRACTICE_VERSION) offer(version);
  });
  // WebKit may keep register() pending while offline. An already controlling
  // worker can confirm the installed snapshot without a network registration.
  current();
  function connect() {
    if (connecting) return connecting;
    // Reuse the installed registration offline; do not ask WebKit to fetch
    // sw.js or a release probe while the saved app is reopening without Wi-Fi.
    connecting = Promise.resolve().then(() => navigator.onLine === false
      ? navigator.serviceWorker.getRegistration?.('./')
      : navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })).then(async reg => {
      if (!reg) return;
      registration = reg;
      if (!watched.has(reg)) {
        watched.add(reg);
        const watch = worker => worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') waiting();
          if (worker.state === 'activated') current();
          if (worker.state === 'redundant') state.textContent = 'オンラインで利用できます';
        });
        reg.addEventListener('updatefound', () => watch(reg.installing)); watch(reg.installing);
      }
      await current(); await waiting(); check({ force: true });
    }).catch(async () => { if (await current() !== PRACTICE_VERSION) state.textContent = 'オンラインで利用できます'; }).finally(() => { connecting = null; });
    return connecting;
  }
  connect();
  return { check };
}
