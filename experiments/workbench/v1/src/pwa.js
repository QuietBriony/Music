const SOURCE = 'music-workbench-pwa-v1';

function workerRequest(worker, action, progress = () => {}) {
  return new Promise((resolve, reject) => {
    if (!worker) return reject(new Error('アプリの準備中です。少し待ってから試してください。'));
    const channel = new MessageChannel();
    let timer;
    const armTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error('保存が完了しませんでした。ネット接続と空き容量を確認し、もう一度試してください。')), 90_000);
    };
    const finish = (error, result) => {
      clearTimeout(timer);
      channel.port1.close();
      if (error) reject(error); else resolve(result);
    };
    channel.port1.onmessage = ({ data }) => {
      if (data.progress) { armTimeout(); progress(data.progress); }
      else if (data.error) finish(new Error(data.error));
      else finish(null, data.result);
    };
    armTimeout();
    try { worker.postMessage({ source: SOURCE, action }, [channel.port2]); }
    catch (error) { finish(error); }
  });
}

export async function initPwa({ confirmReload, reload }) {
  const summary = document.querySelector('#pwa-summary');
  const detail = document.querySelector('#pwa-status');
  const prepare = document.querySelector('#pwa-prepare');
  const install = document.querySelector('#pwa-install');
  const update = document.querySelector('#pwa-update');
  const updateHint = document.querySelector('#pwa-update-hint');
  const installed = document.querySelector('#pwa-installed');
  let registration, saving = false, updating = false, prompt;
  const isInstalled = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const refreshInstalled = () => {
    installed.hidden = !isInstalled();
    install.hidden = !prompt || isInstalled();
  };
  refreshInstalled();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event;
    refreshInstalled();
  });
  window.addEventListener('appinstalled', () => { prompt = null; refreshInstalled(); });
  install.addEventListener('click', async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    prompt = null;
    refreshInstalled();
  });

  if (document.querySelector('script[src="/__local__/bank-bridge.js"]')) {
    summary.textContent = 'PCローカル版';
    detail.textContent = 'このPCは local:prepare で音を準備する版です。スマホのホーム画面追加は公開URLから行ってください。';
    prepare.hidden = true;
    return;
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    summary.textContent = 'Safari / Chromeで開いて準備';
    detail.textContent = 'このブラウザは端末への保存に対応していません。公開URLをSafariまたはChromeで開いてください。';
    prepare.hidden = true;
    return;
  }

  function waitingUpdate() {
    update.hidden = !registration?.waiting;
    updateHint.hidden = update.hidden;
  }
  async function refreshStatus() {
    if (saving || updating) return;
    try {
      const state = await workerRequest(registration?.active, 'status');
      prepare.disabled = false;
      const ready = state.shellReady && state.soundsReady;
      summary.textContent = ready ? (navigator.onLine ? 'オフライン準備OK' : 'オフラインで使用中') : '音の保存が必要';
      prepare.textContent = ready ? '保存した音を更新する' : 'オフライン用の音を端末に保存';
      detail.textContent = ready
        ? 'このブラウザにアプリと音を保存済み（約' + ((state.appBytes + state.soundBytes) / 1_000_000).toFixed(1)
          + ' MB）。公開8試作と303＋909をネットなしで使えます。音の保存：' + new Date(state.preparedAt).toLocaleString('ja-JP')
        : 'ネット接続中に下のボタンで音を保存してください。ホーム画面に追加した後は、追加したアプリ側でも準備OKを確認します。';
      waitingUpdate();
    } catch (error) {
      summary.textContent = '準備を確認できません';
      detail.textContent = error.message;
      prepare.disabled = !registration?.active;
    }
  }
  prepare.addEventListener('click', async () => {
    if (saving || updating) return;
    saving = true;
    prepare.disabled = true;
    update.disabled = true;
    try {
      // Best effort: browser/OS storage policy can still remove saved data.
      Promise.resolve(navigator.storage?.persist?.()).catch(() => {});
      await workerRequest(registration?.active, 'save-sounds', ({ done, total, label }) => {
        summary.textContent = '音を保存中 ' + done + '/' + total;
        detail.textContent = label ? label + ' を取得しています。' : '保存を確認しています。';
      });
      saving = false;
      await refreshStatus();
    } catch (error) {
      summary.textContent = '音の保存が未完了';
      detail.textContent = error.message;
    } finally {
      saving = false;
      prepare.disabled = false;
      update.disabled = false;
    }
  });
  update.addEventListener('click', async () => {
    if (saving || updating || !registration?.waiting) return;
    if (!await confirmReload()) return;
    updating = true;
    prepare.disabled = true;
    update.disabled = true;
    detail.textContent = 'アプリを更新して開き直します。保存済みの下書き・FILEはそのまま残ります。';
    try {
      const worker = registration.waiting;
      const changed = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          navigator.serviceWorker.removeEventListener('controllerchange', listener);
          reject(new Error('更新を完了できませんでした。ネット接続中に開き直してください。'));
        }, 15_000);
        const listener = () => { clearTimeout(timer); resolve(); };
        navigator.serviceWorker.addEventListener('controllerchange', listener, { once: true });
      });
      await Promise.all([changed, workerRequest(worker, 'activate')]);
      reload();
    } catch (error) {
      updating = false;
      prepare.disabled = false;
      update.disabled = false;
      detail.textContent = error.message;
    }
  });
  window.addEventListener('online', refreshStatus);
  window.addEventListener('offline', refreshStatus);
  navigator.serviceWorker.addEventListener('controllerchange', refreshStatus);
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    waitingUpdate();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', () => {
        waitingUpdate();
        if (registration.active) refreshStatus();
      });
    });
    if (!registration.active) {
      detail.textContent = 'アプリ本体を保存しています。初回だけ少し待ってください。';
      let timer;
      try {
        await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('初回保存が完了しませんでした。ネット接続中に開き直してください。')), 45_000);
        })]);
      } finally { clearTimeout(timer); }
    }
    await refreshStatus();
  } catch (error) {
    summary.textContent = '保存設定を確認';
    detail.textContent = 'オフライン準備に失敗しました。ネット接続とブラウザの保存設定を確認して開き直してください。' + (error.message ? '（' + error.message + '）' : '');
  }
}
