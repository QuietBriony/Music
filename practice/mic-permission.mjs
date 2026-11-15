const LAST_USED = 'music-practice-mic-last-used-v1';

// A successful capture is useful history, never a replacement for OS consent.
export function mountMicPermissionInfo({ active = () => false } = {}) {
  const state = document.getElementById('mic-permission-state');
  const previous = document.getElementById('mic-permission-previous');
  let permission = null, request = 0, failure = '';
  function render() {
    const granted = permission?.state === 'granted';
    state.textContent = active() ? 'マイクで聴いています' : failure || (granted ? 'この画面ではマイクが許可されています' : permission?.state === 'denied' ? '端末の設定でマイクの許可を確認してください' : 'マイクの許可は、始めるときに端末で確認します');
    let used = false;
    try { used = Number(localStorage.getItem(LAST_USED)) > 0; } catch { /* History is optional. */ }
    previous.textContent = used ? '前回この端末でマイクを使えたことを記録しています。次回の許可を保証する記録ではありません。' : '楽器・調弦・感度はこの端末に保存します。マイクは開始ボタンを押したときにだけ使います。';
  }
  async function refresh() {
    render(); const ticket = ++request;
    if (!navigator.permissions?.query) return;
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      if (ticket !== request) return;
      if (permission) permission.onchange = null;
      failure = ''; permission = result; permission.onchange = () => { failure = ''; render(); }; render();
    } catch { /* Some Safari versions cannot query microphone permission. */ }
  }
  render();
  return {
    refresh,
    used() { failure = ''; try { localStorage.setItem(LAST_USED, String(Date.now())); } catch { /* Optional. */ } render(); },
    stopped() { render(); },
    failed(error) { failure = error?.name === 'NotAllowedError' ? '今回のマイク使用が許可されませんでした。下の案内から端末の設定を確認できます。' : ''; render(); }
  };
}
