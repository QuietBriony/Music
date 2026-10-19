/* Recorded-stem mix. Direct inputs must precede legacy EQ and song boosts.
 * Native Web Audio only; no samples, modulation, feedback or network access.
 * The same factory is rendered offline for full-song measurement. */
(function (root) {
  "use strict";
  const PARTS = ["vocals", "drums", "bass", "other"];
  const LEVELS = { vocals: 0.84, drums: 1, bass: 0.97, other: 1 };
  const SENDS = { vocals: 0.18, drums: 0.10, bass: 0.04, other: 0.13 };
  // v428: lower only the added common reflections; retain recorded attacks/tails.
  // Comparison and limits: docs/stem-room-refinement-20261019.json.
  // Short common reflections: keep the original direct signal and stereo
  // image intact. A mono-compatible room does not widen the extracted bleed.
  const TAPS = [[0.019, 0.34], [0.031, 0.26], [0.047, 0.20],
    [0.067, 0.115], [0.097, 0.06], [0.139, 0.025]];
  const SONG_DB = Object.freeze({"tabasco": -0.2, "hey": 0.2, "i-got-a-feeling": -1.2, "under-the-moon": 1.1, "electric-sheep": -0.6, "human-fly": 0.9, "sister": 1.1});
  const validLevel = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0.8;
  function create(context) {
    const nodes = [], inputs = {}, faders = {}, levels = {};
    const keep = node => { nodes.push(node); return node; };
    const gain = value => { const n = keep(context.createGain()); n.gain.value = value; return n; };
    const filter = (type, frequency, db = 0, q = 0.707) => {
      const n = keep(context.createBiquadFilter()); n.type = type;
      n.frequency.value = frequency; n.gain.value = db; n.Q.value = q; return n;
    };
    const sum = gain(1), room = gain(0.65);
    const roomHp = filter("highpass", 200), roomLp = filter("lowpass", 4800);
    room.connect(roomHp); roomHp.connect(roomLp);
    for (const [seconds, amount] of TAPS) {
      const delay = keep(context.createDelay(0.15)), tap = gain(amount);
      delay.delayTime.value = seconds;
      roomLp.connect(delay); delay.connect(tap); tap.connect(sum);
    }
    for (const part of PARTS) {
      const input = gain(1), fader = gain(LEVELS[part]), send = gain(SENDS[part]);
      inputs[part] = input; faders[part] = fader; levels[part] = 0.8;
      if (part === "vocals") {
        const hp = filter("highpass", 65), presence = filter("peaking", 2800, -1.2, 0.8);
        input.connect(hp); hp.connect(presence); presence.connect(fader);
      } else input.connect(fader);
      // Both dry and room follow the same fader/mute, so minus-one stays honest.
      fader.connect(sum); fader.connect(send); send.connect(room);
    }
    const hp = filter("highpass", 26), mud = filter("peaking", 230, -1.2, 0.8);
    const air = filter("highshelf", 3200, -0.5), output = gain(1);
    sum.connect(hp); hp.connect(mud); mud.connect(air); air.connect(output);
    const set = (param, value) => {
      const now = context.currentTime;
      param.cancelScheduledValues(now);
      if (context.state !== "running") param.setValueAtTime(value, now);
      else { param.setValueAtTime(param.value, now); param.linearRampToValueAtTime(value, now + 0.04); }
    };
    return {
      inputs, output,
      setLevel(part, value) {
        if (!faders[part]) return;
        levels[part] = validLevel(value);
        set(faders[part].gain, LEVELS[part] * levels[part] / 0.8);
      },
      setSong(song) { set(output.gain, 10 ** ((Object.hasOwn(SONG_DB, song) ? SONG_DB[song] : 0) / 20)); },
      diagnostics() { return { levels: { ...levels }, gains: Object.fromEntries(PARTS.map(p => [p, faders[p].gain.value])),
        output: output.gain.value, nodes: nodes.length, roomLastReflectionSeconds: 0.139, source: "pre-trim-pre-eq" }; },
      dispose() { for (const node of nodes) node.disconnect(); }
    };
  }
  root.RecordedStemMix = Object.freeze({ create, validLevel });
})(globalThis);
