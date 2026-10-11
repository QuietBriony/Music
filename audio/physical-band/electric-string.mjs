// Original, bounded modal plucked string. No recorded excitation or audio data.
// A triangular displacement is projected onto string modes and a magnetic
// pickup's local velocity. Design / sources: docs/PHYSICAL-BAND-REHEARSAL.md.
export function renderElectricString(event, sampleRate = 32000) {
  for (const [value, low, high, name] of [
    [sampleRate, 16000, 48000, "sample rate"], [event.note, 40, 84, "note"],
    [event.duration, 0.02, 3, "duration"], [event.velocity, 0, 1, "velocity"]
  ]) {
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(`Invalid electric string ${name}`);
  }
  if (!["open", "palm"].includes(event.technique)) throw new Error("Invalid electric string technique");
  const fundamental = 440 * 2 ** ((event.note - 69) / 12);
  const palm = event.technique === "palm";
  const frames = Math.ceil(event.duration * sampleRate), output = new Float32Array(frames);
  const pick = 0.135, pickup = 0.18;
  const t60 = (palm ? 0.3 : 9.2) / (1 + 0.22 * (event.note - 40) / 12);
  const stiffness = 0.000012 * 2 ** ((event.note - 40) / 24);
  const cutoff = palm ? 1200 : 3600;
  const modes = [];
  for (let harmonic = 1; harmonic <= 64; harmonic++) {
    const frequency = fundamental * harmonic * Math.sqrt((1 + stiffness * harmonic ** 2) / (1 + stiffness));
    if (frequency >= Math.min(sampleRate * 0.4, 9000)) break;
    // Displacement ~ sin(h*pi*pick)/h^2; pickup velocity contributes
    // h*sin(h*pi*pickup). Roll off the excitation before the Nyquist limit.
    const amplitude = Math.sin(harmonic * Math.PI * pick) * Math.sin(harmonic * Math.PI * pickup)
      / harmonic / Math.sqrt(1 + (frequency / cutoff) ** 4);
    // Higher modes lose energy faster, without a delay interpolator imposing
    // unintended loss. A weakly split second polarization adds a changing ring.
    // These bounded parameters are a design, not a fit of a particular guitar.
    for (const [weight, cents, life] of [[0.8, 0, 1], [0.2, 1.6, 1.3]]) {
      const decay = Math.exp(-Math.log(1000) * (1 + 0.009 * (harmonic - 1) ** 2) / (sampleRate * t60 * life));
      const omega = 2 * Math.PI * frequency * 2 ** (cents / 1200) / sampleRate;
      modes.push({ re: amplitude * weight, im: 0, c: Math.cos(omega) * decay, s: Math.sin(omega) * decay });
    }
  }
  for (let frame = 0; frame < frames; frame++) {
    let value = 0;
    for (const mode of modes) {
      value += mode.im;
      const re = mode.re * mode.c - mode.im * mode.s;
      mode.im = mode.re * mode.s + mode.im * mode.c; mode.re = re;
    }
    const onset = Math.min(1, frame / (sampleRate * 0.0015));
    const release = Math.min(1, (frames - 1 - frame) / (sampleRate * 0.035));
    output[frame] = value * onset * release * event.velocity;
  }
  return output;
}
