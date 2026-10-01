// One shared guitar amp per part: pickup/preamp, soft clipping and cabinet EQ.
// No convolution, oversampling, oscillator or per-note effects graph.
export const GUITAR_TONES = ["acoustic", "crunch", "drive"];
export function ampCurve(tone) {
  if (!GUITAR_TONES.includes(tone)) throw new Error("Unknown guitar tone");
  const drive = tone === "drive" ? 14 : (tone === "crunch" ? 5 : 1);
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) {
    const x = 2 * i / (curve.length - 1) - 1;
    curve[i] = tone === "acoustic" ? x : Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

export function createGuitarAmp(context, tone = "crunch") {
  const input = context.createGain();
  const pickup = context.createBiquadFilter(); pickup.type = "highpass";
  const shape = context.createWaveShaper(); shape.oversample = "none";
  const presence = context.createBiquadFilter(); presence.type = "peaking";
  const cabinet = context.createBiquadFilter(); cabinet.type = "lowpass";
  const cabinet2 = context.createBiquadFilter(); cabinet2.type = "lowpass";
  const output = context.createGain();
  const nodes = [input, pickup, shape, presence, cabinet, cabinet2, output];
  nodes.slice(0, -1).forEach((node, i) => node.connect(nodes[i + 1]));
  function setTone(next) {
    shape.curve = ampCurve(next);
    const clean = next === "acoustic";
    pickup.frequency.value = clean ? 35 : 85;
    presence.frequency.value = 1600; presence.Q.value = 0.75;
    presence.gain.value = clean ? 0 : 2.5;
    cabinet.frequency.value = cabinet2.frequency.value = clean ? 6800 : (next === "drive" ? 3600 : 4300);
    cabinet.Q.value = cabinet2.Q.value = 0.707;
    output.gain.setTargetAtTime(clean ? 1 : (next === "drive" ? 0.27 : 0.38), context.currentTime, 0.015);
  }
  setTone(tone);
  return { input, output, nodes, setTone, dispose() { nodes.forEach((node) => node.disconnect()); } };
}
