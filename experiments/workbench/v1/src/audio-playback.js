// Reuse the existing Strudel audio graph; never make a second sound clock or
// initialize worklets again merely because iOS changed the output route.
export class AudioPlayback {
  constructor(getContext, initAudio, navigator, onState = () => {}) {
    Object.assign(this, { getContext, initAudio, navigator, onState });
    this.initialized = null;
    this.context = null;
    this.resuming = null;
  }

  async prepare() {
    // iOS treats a plain AudioContext as ambient audio by default. Explicit
    // music playback uses the media session's output/volume behavior where
    // supported. Feature detection keeps other browsers unchanged.
    try {
      if (this.navigator.audioSession && this.navigator.audioSession.type !== 'playback') {
        this.navigator.audioSession.type = 'playback';
      }
    } catch { /* Unsupported or read-only session: ordinary Web Audio fallback. */ }
    const context = this.getContext();
    if (!context || context.state === 'closed') throw new Error('音声接続を作れません。編集を保存してアプリを再読込してください');
    if (context !== this.context) {
      this.context?.removeEventListener('statechange', this.onState);
      this.context = context;
      context.addEventListener('statechange', this.onState);
    }
    // Call resume in the user's tap, even when initialization is already cached.
    // Concurrent recovery requests share it; later taps can retry a rejection.
    if (!this.resuming) {
      this.resuming = Promise.resolve(context.resume()).finally(() => { this.resuming = null; });
    }
    if (!this.initialized) {
      this.initialized = Promise.resolve(this.initAudio()).catch(error => {
        this.initialized = null;
        throw error;
      });
    }
    await Promise.all([this.resuming, this.initialized]);
    this.onState();
    if (context.state !== 'running') throw new Error('音声が中断されています。出力先を確認して「音を再接続」を押してください');
  }
}
