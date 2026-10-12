// Optional, local-only taps. Never reroute or close the instruments' output.
export const MAX_TAKE_MS = 5 * 60 * 1000;
export const MAX_TAKE_BYTES = 40 * 1024 * 1024;
export function recordingType(Recorder) {
  if (!Recorder) throw new Error('このブラウザは録音に対応していません。');
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
    .find(type => Recorder.isTypeSupported?.(type)) || '';
}
export function recordingExtension(type) {
  return type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('webm') ? 'webm' : 'audio';
}
const disconnect = (source, target) => { try { source.disconnect(target); } catch {} };

export class VocalRecorder {
  constructor({ getSources, mediaDevices, Recorder, audioSession, onChange = () => {}, onTake = () => {} }) {
    Object.assign(this, { getSources, mediaDevices, Recorder, audioSession, onChange, onTake });
    this.state = 'idle'; this.generation = 0; this.taps = new Set(); this.voiceLevel = 1;
  }
  get active() { return ['starting', 'recording', 'finishing'].includes(this.state); }
  context() {
    const sources = this.getSources();
    const ctx = sources[0]?.context;
    if (!ctx || ctx.state !== 'running' || sources.some(n => n.context !== ctx)) {
      throw new Error('先に演奏を再生してください。録音は鳴っている試奏台の音を使います。');
    }
    return ctx;
  }
  async arm() {
    if (this.active || this.state === 'requesting') return;
    recordingType(this.Recorder);
    const ctx = this.context(), token = ++this.generation;
    this.releaseMic(); this.state = 'requesting'; this.onChange();
    let stream;
    try {
      try { if (this.audioSession) { this.previousSession = this.audioSession.type; this.audioSession.type = 'play-and-record'; } } catch {}
      if (!this.mediaDevices?.getUserMedia) throw new Error('マイクはHTTPSまたはlocalhostで開いてください。');
      stream = await this.mediaDevices.getUserMedia({ audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      }, video: false });
      if (token !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      if (ctx !== this.context()) throw new Error('音声接続が変わりました。マイクを準備し直してください。');
      this.stream = stream; this.ctx = ctx;
      this.mic = ctx.createMediaStreamSource(stream);
      this.micGain = ctx.createGain(); this.micGain.gain.value = this.voiceLevel;
      this.meter = ctx.createAnalyser(); this.meter.fftSize = 256;
      this.meterData = new Float32Array(256);
      this.mic.connect(this.micGain); this.micGain.connect(this.meter);
      // No microphone connection to speakers: avoids echo and feedback.
      this.ended = () => { if (this.active) this.stop('マイクが切断されたため録音を終了'); else this.disarm(); };
      stream.getTracks().forEach(t => t.addEventListener('ended', this.ended));
      this.state = 'armed'; this.onChange();
    } catch (error) {
      stream?.getTracks().forEach(t => t.stop());
      if (token === this.generation) { this.releaseMic(); this.state = 'idle'; this.onChange(); throw error; }
    }
  }
  level(value) {
    this.voiceLevel = Math.max(0, Math.min(2, Number(value) || 0));
    if (this.micGain) this.micGain.gain.setTargetAtTime(this.voiceLevel, this.ctx.currentTime, .015);
  }
  peak() {
    if (!this.meter) return 0;
    this.meter.getFloatTimeDomainData(this.meterData);
    return this.meterData.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
  }
  releaseMic() {
    this.stream?.getTracks().forEach(t => { t.removeEventListener('ended', this.ended); t.stop(); });
    for (const node of [this.mic, this.micGain, this.meter]) node?.disconnect();
    this.stream = this.mic = this.micGain = this.meter = null;
    try { if (this.previousSession && this.audioSession?.type === 'play-and-record') this.audioSession.type = this.previousSession; } catch {}
    this.previousSession = null;
  }
  disarm() {
    ++this.generation;
    if (this.active) { this.stop('録音を終了'); return; }
    this.releaseMic(); this.state = 'idle'; this.onChange();
  }
  refresh() {
    if (this.state !== 'recording') return;
    const sources = this.getSources();
    if (!sources.length || sources.some(n => n.context !== this.ctx) || this.ctx.state !== 'running') {
      this.stop('演奏の停止・音声中断により録音を終了'); return;
    }
    for (const source of this.taps) if (!sources.includes(source)) {
      disconnect(source, this.backing); this.taps.delete(source);
    }
    for (const source of sources) if (!this.taps.has(source)) {
      source.connect(this.backing); this.taps.add(source);
    }
  }
  start({ withVoice = true, metadata }) {
    if (this.active) return;
    const mimeType = recordingType(this.Recorder), ctx = this.context();
    if (withVoice && (!this.stream || this.ctx !== ctx || this.stream.getAudioTracks().every(t => t.readyState !== 'live'))) {
      throw new Error('「マイクを準備」を押し、声のメーターを確認してください。');
    }
    if (!withVoice) this.releaseMic();
    this.ctx = ctx; this.state = 'starting'; this.bytes = 0; this.reason = '';
    this.metadata = structuredClone(metadata);
    this.recorders = []; this.nodes = [];
    try {
      this.backing = ctx.createGain(); this.nodes.push(this.backing);
      const mix = ctx.createGain(); this.nodes.push(mix);
      // Headroom in the recording only. The listening mix is unchanged.
      mix.gain.value = .7; this.backing.connect(mix);
      if (withVoice) this.micGain.connect(mix);
      const inputs = withVoice ? [['mix', mix], ['voice', this.mic], ['backing', this.backing]] : [['mix', mix]];
      for (const [name, source] of inputs) {
        const destination = ctx.createMediaStreamDestination(); this.nodes.push(destination);
        source.connect(destination);
        const recorder = new this.Recorder(destination.stream, { ...(mimeType ? {mimeType} : {}), audioBitsPerSecond: 160000 });
        const item = { name, recorder, chunks: [], destination };
        item.done = new Promise(resolve => { recorder.onstop = resolve; });
        recorder.ondataavailable = event => {
          if (event.data.size) { item.chunks.push(event.data); this.bytes += event.data.size; }
          if (this.bytes > MAX_TAKE_BYTES) this.stop('容量上限で録音を終了');
        };
        recorder.onerror = () => { item.failed = true; this.stop('録音エラー。取得できた音を残しました'); };
        this.recorders.push(item);
      }
      // Build every encoder before starting any, so setup failure creates no half-take.
      this.startedAt = Date.now();
      for (const item of this.recorders) item.recorder.start(1000);
      this.state = 'recording'; this.refresh();
      this.timer = setTimeout(() => this.stop('5分の上限で録音を終了'), MAX_TAKE_MS);
      this.onChange();
    } catch (error) {
      for (const item of this.recorders) if (item.recorder.state !== 'inactive') item.recorder.stop();
      this.cleanup(); this.state = 'idle'; this.onChange(); throw error;
    }
  }
  stop(reason = '録音を終了') {
    if (this.state !== 'recording') return this.finishing;
    this.state = 'finishing'; this.reason = reason; clearTimeout(this.timer);
    const durationMs = Date.now() - this.startedAt;
    for (const item of this.recorders) if (item.recorder.state !== 'inactive') item.recorder.stop();
    this.onChange();
    this.finishing = Promise.all(this.recorders.map(item => item.done)).then(async () => {
      const audio = Object.fromEntries(this.recorders.map(item => [item.name,
        new Blob(item.chunks, {type: item.recorder.mimeType || item.chunks[0]?.type || ''})]));
      const take = { ...this.metadata, id: crypto.randomUUID(), createdAt: new Date(this.startedAt).toISOString(),
        durationMs, audio, reason, partial: this.recorders.some(item => item.failed), voiceLevel: this.voiceLevel };
      this.cleanup();
      try { await this.onTake(take); }
      finally { this.state = 'idle'; this.onChange(); }
      return take;
    });
    return this.finishing;
  }
  cleanup() {
    clearTimeout(this.timer);
    for (const source of this.taps) disconnect(source, this.backing);
    this.taps.clear();
    this.recorders?.forEach(item => item.destination.stream.getTracks().forEach(t => t.stop()));
    this.nodes?.forEach(node => node.disconnect());
    this.releaseMic(); this.nodes = []; this.recorders = [];
  }
}
