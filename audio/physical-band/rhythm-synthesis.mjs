// Original finite modal/spectral models. No recordings or learned weights.
// Parameters describe a candidate timbre, not a fit of a particular instrument.
function validate(rate, velocity) {
  if (!Number.isFinite(rate) || rate < 16000 || rate > 48000) throw new Error("Invalid rhythm sample rate");
  if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) throw new Error("Invalid rhythm velocity");
}
function random(seed) {
  let state = seed >>> 0 || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function mode(frequency, tau, amplitude, rate, phase = 0) {
  const r = Math.exp(-1 / (tau * rate)), w = 2 * Math.PI * frequency / rate;
  return { re: amplitude * Math.cos(phase), im: amplitude * Math.sin(phase), c: r * Math.cos(w), s: r * Math.sin(w) };
}
function advance(modes) {
  let value = 0;
  for (const m of modes) {
    value += m.im;
    const re = m.re * m.c - m.im * m.s;
    m.im = m.re * m.s + m.im * m.c; m.re = re;
  }
  return value;
}

export function renderElectricBass({ note, duration, velocity = 1, technique = "finger" }, rate = 32000) {
  validate(rate, velocity);
  if (!Number.isFinite(note) || note < 24 || note > 60) throw new Error("Invalid bass note");
  if (!Number.isFinite(duration) || duration < 0.02 || duration > 3) throw new Error("Invalid bass duration");
  if (!["finger", "mute"].includes(technique)) throw new Error("Invalid bass technique");
  const f0 = 440 * 2 ** ((note - 69) / 12), muted = technique === "mute";
  const t60 = (muted ? 0.55 : 10.5) / (1 + 0.12 * (note - 28) / 12);
  const cutoff = muted ? 700 : 2100, modes = [];
  for (let h = 1; h <= 48; h++) {
    const f = f0 * h * Math.sqrt((1 + 0.000008 * h * h) / 1.000008);
    if (f >= Math.min(6500, rate * 0.4)) break;
    const amplitude = Math.sin(h * Math.PI * 0.22) * Math.sin(h * Math.PI * 0.28)
      / h / Math.sqrt(1 + (f / cutoff) ** 4);
    const tau = t60 / Math.log(1000) / (1 + 0.018 * (h - 1) ** 2);
    modes.push(mode(f, tau, amplitude, rate));
  }
  const output = new Float32Array(Math.ceil(duration * rate));
  for (let i = 0; i < output.length; i++) {
    // Soft finger release; the low fundamental is retained as upper modes fade.
    const envelope = Math.min(1, i / (rate * 0.004)) * Math.min(1, (output.length - 1 - i) / (rate * 0.04));
    output[i] = advance(modes) * envelope * velocity;
  }
  return output;
}

export const ACOUSTIC_DRUMS = Object.freeze({ kick: 0.95, snare: 1.1, hat: 0.18, tom: 1.25, ride: 2.7, crash: 3 });
export function renderAcousticDrum({ drum, velocity = 1 }, rate = 32000, seed = 1) {
  validate(rate, velocity);
  if (!Object.hasOwn(ACOUSTIC_DRUMS, drum)) throw new Error("Invalid acoustic drum");
  const output = new Float32Array(Math.ceil(ACOUSTIC_DRUMS[drum] * rate));
  const rand = random(seed), modes = [];
  const metal = ["hat", "ride", "crash"].includes(drum);
  if (metal) {
    const base = drum === "hat" ? 3200 : (drum === "ride" ? 650 : 380);
    const count = drum === "hat" ? 20 : 48;
    for (let i = 0; i < count; i++) {
      const f = base * (1 + i * 0.11) ** 1.65 * (0.96 + rand() * 0.08);
      if (f > Math.min(rate * 0.4, 11500)) continue;
      const tau = (drum === "hat" ? 0.037 : (drum === "ride" ? 0.6 : 0.85)) / (1 + f / 6500);
      modes.push(mode(f, tau, 0.1 / Math.sqrt(count) * (0.65 + rand() * 0.7), rate, rand() * Math.PI * 2));
    }
    if (drum === "ride") modes.push(mode(1750, 0.42, 0.11, rate));
  } else {
    const base = { kick: 58, snare: 185, tom: 105 }[drum];
    // A few head/cavity modes, with a separate tension transient below.
    for (const [i, ratio] of [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.16, 3.5].entries()) {
      const tau = ({ kick: 0.18, snare: 0.16, tom: 0.27 }[drum]) / (1 + i * 0.22);
      modes.push(mode(base * ratio, tau, (i ? 0.17 : 0.28) / (1 + i * 0.8), rate));
    }
  }
  const lowHz = metal ? 11000 : (drum === "kick" ? 4200 : 7800);
  const highHz = metal ? (drum === "hat" ? 4300 : 1900) : (drum === "snare" ? 650 : 1200);
  const lp = 1 - Math.exp(-2 * Math.PI * Math.min(lowHz, rate * 0.4) / rate);
  const hp = 1 - Math.exp(-2 * Math.PI * Math.min(highHz, rate * 0.3) / rate);
  let low = 0, baseNoise = 0, phase = 0;
  for (let i = 0; i < output.length; i++) {
    const t = i / rate;
    let body = advance(modes);
    const noise = rand() * 2 - 1;
    low += lp * (noise - low); baseNoise += hp * (low - baseNoise);
    const colour = low - baseNoise;
    let air;
    if (drum === "snare") {
      // Fast wire impact plus a lower-level settling rattle; ghost hits excite less wire.
      air = colour * (0.42 + 0.28 * velocity) * (Math.exp(-t / 0.085) + 0.24 * Math.exp(-t / 0.24))
        * (0.78 + 0.22 * Math.cos(2 * Math.PI * 185 * t));
    } else if (metal) {
      const tau = { hat: 0.028, ride: 0.42, crash: 0.7 }[drum];
      air = colour * (drum === "ride" ? 0.16 : 0.4) * Math.exp(-t / tau);
    } else {
      air = colour * (drum === "kick" ? 0.08 : 0.045) * Math.exp(-t / 0.012);
      // A struck membrane initially has extra tension. This is a controlled
      // pitch relaxation, not a solved nonlinear membrane / shell simulation.
      const f0 = drum === "kick" ? 58 : 105;
      phase += 2 * Math.PI * f0 * (1 + 0.62 * Math.exp(-t / 0.022)) / rate;
      body += Math.sin(phase) * (drum === "kick" ? 0.4 : 0.16) * Math.exp(-t / (drum === "kick" ? 0.19 : 0.24));
    }
    const envelope = Math.min(1, i / (rate * 0.0008)) * Math.min(1, (output.length - 1 - i) / (rate * 0.025));
    output[i] = (body + air) * envelope * velocity;
  }
  return output;
}
