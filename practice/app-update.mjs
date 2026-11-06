export const PRACTICE_VERSION = '36';

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
    worker.postMessage({ type: 'PRACTICE_VERSION' }, [channel.port2]);
  });
}

export function mountPracticeUpdates({ onPause }) {
  const state = document.getElementById('offline-state'), panel = document.getElementById('practice-update');
  const button = document.getElementById('practice-update-now');
  if (!('serviceWorker' in navigator) || !window.isSecureContext) { state.textContent = 'オンラインで利用できます'; return; }
  let registration, requested = false, announced = false;
  const current = async () => {
    const version = await workerVersion(navigator.serviceWorker.controller);
    if (version === PRACTICE_VERSION) {
      state.textContent = 'オフライン準備OK';
      navigator.serviceWorker.controller.postMessage({ type: 'PRACTICE_CLEAN', version });
    }
    return version;
  };
  const offer = () => { announced = true; panel.hidden = false; };
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    const version = await current();
    if (requested) { onPause(); location.reload(); }
    else if (version && version !== PRACTICE_VERSION) offer();
  });
  button.onclick = () => {
    onPause(); requested = true; button.disabled = true; button.textContent = '更新しています…';
    if (registration?.waiting) registration.waiting.postMessage({ type: 'PRACTICE_ACTIVATE' });
    else location.reload();
  };
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(async reg => {
    registration = reg;
    const waiting = async () => {
      const worker = reg.waiting; if (!worker) return;
      const version = await workerVersion(worker);
      if (reg.waiting !== worker || !version) return;
      // First migration: the document is already this version, but an older SW controls it.
      if (!announced && version === PRACTICE_VERSION && await workerVersion(navigator.serviceWorker.controller) !== PRACTICE_VERSION) {
        reg.waiting.postMessage({ type: 'PRACTICE_ACTIVATE' });
      } else offer();
    };
    const watch = worker => worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') waiting();
      if (worker.state === 'activated') current();
      if (worker.state === 'redundant') state.textContent = 'オンラインで利用できます';
    });
    reg.addEventListener('updatefound', () => watch(reg.installing)); watch(reg.installing);
    await current(); await waiting(); reg.update().catch(() => {});
  }).catch(() => { state.textContent = 'オンラインで利用できます'; });
}
