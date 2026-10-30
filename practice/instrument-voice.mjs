// Original, sample-free plucked-string model for the practice app.
// The fundamental stays at concert pitch; upper modes lose energy sooner.
const PROFILES = {
  guitar: { modes: 20, pick: .21, slope: 1.35, decay: 2.15, damping: .38, attack: .0018, noise: .025, body: [[110,.09,.065],[205,.055,.045],[385,.025,.028]] },
  sanshin: { modes: 28, pick: .115, slope: 1.04, decay: 1.35, damping: .22, attack: .0009, noise: .06, body: [[380,.08,.045],[650,.055,.028],[1100,.025,.018]] }
};
const buffers = new WeakMap();

export function pluckDuration(instrument, noteLength = .55, reference = false) {
  const sanshin = instrument === 'sanshin';
  if (reference) return sanshin ? 4.8 : 6.4;
  const length = Number.isFinite(noteLength) ? noteLength : .55;
  return Math.max(sanshin ? 1.8 : 2.6, Math.min(8, length + (sanshin ? 1.25 : 2)));
}

export function renderPluck({ instrument = 'guitar', midi, sampleRate, duration }) {
  if (!Number.isFinite(midi) || midi < 0 || midi > 127 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || !Number.isFinite(duration) || duration < .08 || duration > 10) throw new RangeError('Invalid plucked-string parameters');
  const p = PROFILES[instrument] || PROFILES.guitar;
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  const decay = p.decay * Math.max(.7, Math.min(1.35, (164.814 / frequency) ** .2));
  const addMode = (hz, amplitude, seconds) => {
    if (hz >= sampleRate * .45) return;
    const step = 2 * Math.PI * hz / sampleRate, loss = Math.exp(-1 / (sampleRate * seconds));
    const coefficient = 2 * Math.cos(step) * loss, squared = loss * loss;
    let previous = 0, value = amplitude * Math.sin(step);
    for (let i = 0; i < samples.length; i++) {
      samples[i] += value;
      const next = coefficient * value - squared * previous;
      previous = value; value = next;
    }
  };
  for (let h = 1; h <= p.modes; h++) {
    addMode(frequency * h, Math.sin(Math.PI * h * p.pick) / h ** p.slope, decay / (1 + (h - 1) * p.damping));
  }
  for (const [hz, amplitude, seconds] of p.body) addMode(hz, amplitude, seconds);
  // A short, deterministic pick/bachi transient. No recorded sound is used.
  let seed = (Math.round(midi * 100) + 12345) >>> 0, low = 0;
  for (let i = 0; i < Math.min(samples.length, sampleRate * .06); i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2 ** 31 - 1;
    low += .35 * (noise - low);
    samples[i] += (noise - low) * p.noise * Math.exp(-i / (sampleRate * .008));
  }
  // Two quiet body/room returns, without a feedback loop or a detuned chorus.
  const first = Math.round(sampleRate * .017), second = Math.round(sampleRate * .031);
  for (let i = samples.length - 1; i >= first; i--) samples[i] += .065 * samples[i-first] + (i >= second ? .035 * samples[i-second] : 0);
  const attack = sampleRate * p.attack, release = Math.min(.65, duration * .25) * sampleRate;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const inFade = Math.min(1, i / attack), outFade = Math.min(1, (samples.length - 1 - i) / release);
    samples[i] *= inFade * inFade * (3 - 2 * inFade) * outFade * outFade * (3 - 2 * outFade);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const scale = peak > 0 ? .88 / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  samples[0] = samples[samples.length - 1] = 0;
  return samples;
}

export function schedulePluck(ctx, { instrument = 'guitar', midi, duration, when = ctx.currentTime, volume = .12 }) {
  if (ctx.state === 'closed') return null;
  let bank = buffers.get(ctx);
  if (!bank) { bank = new Map(); buffers.set(ctx, bank); }
  const key = `${instrument}:${midi}:${duration}`;
  let buffer = bank.get(key);
  if (!buffer) {
    const pcm = renderPluck({ instrument, midi, sampleRate: ctx.sampleRate, duration });
    buffer = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buffer.getChannelData(0).set(pcm);
    // Bound memory during imported MIDI playback, including variable note lengths.
    if (bank.size >= 16) bank.delete(bank.keys().next().value);
    bank.set(key, buffer);
  }
  const source = ctx.createBufferSource(), gain = ctx.createGain();
  source.buffer = buffer; gain.gain.value = Math.max(0, Math.min(.25, volume));
  source.connect(gain).connect(ctx.destination);
  source.addEventListener('ended', () => { source.disconnect(); gain.disconnect(); }, { once: true });
  source.start(Math.max(ctx.currentTime, when));
  return source;
}
