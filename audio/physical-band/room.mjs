// A single small room for the band, built only after START. Four filtered
// delay loops diffuse the hits without convolution or per-note effects.
export function createBandRoom(context, wet = 0.35) {
  const input = context.createGain();
  const highpass = context.createBiquadFilter(); highpass.type = "highpass";
  highpass.frequency.value = 190; highpass.Q.value = 0.707;
  const lowpass = context.createBiquadFilter(); lowpass.type = "lowpass";
  lowpass.frequency.value = 6200; lowpass.Q.value = 0.707;
  const diffuse = [760, 1320].map((frequency) => {
    const node = context.createBiquadFilter(); node.type = "allpass";
    node.frequency.value = frequency; node.Q.value = 0.7; return node;
  });
  const output = context.createGain();
  const nodes = [input, highpass, lowpass, ...diffuse, output];
  input.connect(highpass); highpass.connect(lowpass);
  diffuse[0].connect(diffuse[1]); diffuse[1].connect(output);
  [0.0297, 0.0371, 0.0411, 0.0437].forEach((seconds, i) => {
    const delay = context.createDelay(0.05); delay.delayTime.value = seconds;
    const damping = context.createBiquadFilter(); damping.type = "lowpass";
    damping.frequency.value = 3400; damping.Q.value = 0.707;
    const feedback = context.createGain(); feedback.gain.value = 0.67;
    const pan = context.createStereoPanner(); pan.pan.value = [-0.7, 0.3, -0.3, 0.7][i];
    nodes.push(delay, damping, feedback, pan);
    lowpass.connect(delay); delay.connect(damping);
    damping.connect(feedback); feedback.connect(delay);
    damping.connect(pan); pan.connect(diffuse[0]);
  });
  let amount = 0;
  function setWet(value) {
    if (!Number.isFinite(value)) return;
    amount = Math.max(0, Math.min(1, value));
    output.gain.setTargetAtTime(amount * 0.25, context.currentTime, 0.02);
  }
  setWet(wet);
  return { input, output, nodes, setWet, get wet() { return amount; },
    dispose() { nodes.forEach((node) => node.disconnect()); }
  };
}
