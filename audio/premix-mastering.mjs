// Gentle, stereo-linked EQ for the seven surviving premixes. No compression,
// gate, widening, denoising or new audio asset. Full-song measurements:
// docs/premix-mastering-measurement-20261019.json
export const PREMIX_GAIN_DB = -2.2;
export const PREMIX_GAIN = 10 ** (PREMIX_GAIN_DB / 20);
const trims = Object.freeze({
  tabasco: [-1.9, -2.2], hey: [-1.8, -2.2],
  "i-got-a-feeling": [-2.2, -2.5], "under-the-moon": [-1.8, -2.2],
  "electric-sheep": [-2.7, -2.9], "human-fly": [-2.3, -2.7], sister: [-1.7, -2.2]
});
export const PREMIX_EQ = Object.freeze([
  Object.freeze({ type: "highpass", frequency: 26, Q: 0.707, gain: 0 }),
  Object.freeze({ type: "peaking", frequency: 230, Q: 0.8, gain: -1.5 }),
  Object.freeze({ type: "highshelf", frequency: 3200, Q: 0.707, gain: 0.5 })
]);
export function premixMasterSettings(songId) {
  const [liveDb, originalDb] = Object.hasOwn(trims, songId) ? trims[songId] : [-3, -3];
  return { liveDb, originalDb };
}

export function createPremixMastering(context, source, destination, initial = {}) {
  const original = context.createGain(), live = context.createGain();
  original.gain.value = live.gain.value = 0;
  source.connect(original); original.connect(destination);
  let previous = source;
  for (const spec of PREMIX_EQ) {
    const filter = context.createBiquadFilter();
    filter.type = spec.type;
    for (const key of ["frequency", "Q", "gain"]) filter[key].value = spec[key];
    previous.connect(filter); previous = filter;
  }
  previous.connect(live); live.connect(destination);
  function configure(songId, profile, smooth = true) {
    const settings = premixMasterSettings(songId), now = context.currentTime;
    for (const [node, db, enabled] of [[original, settings.originalDb, profile === "original"], [live, settings.liveDb, profile !== "original"]]) {
      const param = node.gain, value = enabled ? 10 ** (db / 20) : 0;
      // Keep continuity even when A/B is switched repeatedly during a ramp.
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(smooth && context.state === "running" ? current : value, now);
      if (smooth && context.state === "running") param.linearRampToValueAtTime(value, now + 0.04);
    }
  }
  configure(initial.songId, initial.profile, false);
  return { configure };
}
