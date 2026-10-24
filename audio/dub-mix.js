/* Human Fly dub arrangement: source-time automation and four finite echoes.
 * Original stem data, bass/drum attacks and the shared recording path remain.
 * No feedback loop, oscillator, new recording, worker or analysis at runtime. */
(function (root) {
  "use strict";
  const PARTS = ["vocals", "other"];
  const BASE = { vocals: 0.82, other: 0.76 };
  const TAPS = [0.45, 0.26, 0.14, 0.07];
  const ECHO_BEATS = { vocals: 0.75, other: 1 };
  const PANS = { vocals: [-0.18, 0.18, -0.12, 0.12], other: [0.25, -0.25, 0.16, -0.16] };
  // Recorded-source seconds: [vocal exit, vocal return, bright other attack,
  // other return]. Six vocal exits have >=18 dB measured energy drops;
  // the instrumental scene has no vocal throw. These are not word labels.
  const CUES = [[28.61,30.97,28.7725,31.09],[59.99,62.0334,60.4975,62.1534],[94.25,95.7826,94.7325,95.9026],[123.95,126.5043,124.5075,126.6243],[null,null,160.4175,161.5504],[194.81,198.39,195.2275,198.51],[224.19,226.59,224.5175,226.71]];
  const RAMP = 0.04;
  function validate({ bpm, duration, rate = 1, offset = 0, at = 0 }) {
    if (!Number.isFinite(bpm) || bpm < 110 || bpm > 125 ||
        !Number.isFinite(duration) || duration < 1 || duration > 600 ||
        !Number.isFinite(rate) || rate < 0.5 || rate > 1.5 ||
        !Number.isFinite(offset) || offset < 0 || offset > duration ||
        !Number.isFinite(at) || at < 0) throw new Error("Invalid Human Fly dub timeline");
  }
  function plan(bpm, duration) {
    validate({ bpm, duration });
    const curves = Object.fromEntries(PARTS.map(p => [p, {
      dry: [[0, BASE[p]]], send: [[0, 0]], wet: [[0, 0.6]]
    }]));
    function window(points, start, end, low, normal, fadeIn = 0.08, fadeOut = 0.14) {
      if (start < fadeIn || end + fadeOut >= duration) return;
      points.push([start - fadeIn, normal], [start, low], [end, low], [end + fadeOut, normal]);
    }
    for (const [exit, back, attack, guitarBack] of CUES) {
      if (exit !== null) {
        window(curves.vocals.dry, exit + 0.10, back - 0.14, 0, BASE.vocals);
        window(curves.vocals.send, exit - 0.34, exit + 0.01, 0.68, 0, 0.06, 0.06);
        window(curves.vocals.wet, exit + 0.10, back - 0.14, 1, 0.6);
      }
      // Let the measured attack and 230 ms of its body ring before pulling
      // the guitar down. The quarter-note answer follows the vocal's dotted
      // eighth echo; both grow darker and return behind the direct sound.
      window(curves.other.dry, attack + 0.31, guitarBack - 0.14, 0.06, BASE.other);
      window(curves.other.send, attack + 0.03, attack + 0.18, 0.58, 0, 0.055, 0.11);
      window(curves.other.wet, attack + 0.31, guitarBack - 0.14, 1, 0.6);
    }
    return curves;
  }
  function valueAt(points, second) {
    for (let i = 1; i < points.length; i++) {
      if (second > points[i][0]) continue;
      const [a, x] = points[i - 1], [b, y] = points[i];
      return x + (y - x) * Math.max(0, Math.min(1, (second - a) / (b - a)));
    }
    return points.at(-1)[1];
  }
  function create(context, { inputs, direct, output }) {
    const nodes = [], sends = {}, exits = {}, ducks = {}, connections = [];
    let disposed = false, timer = null, settings = null, curves = null;
    const keep = n => { nodes.push(n); return n; };
    const gain = value => { const n = keep(context.createGain()); n.gain.value = value; return n; };
    const filter = (type, frequency) => { const n = keep(context.createBiquadFilter()); n.type = type; n.frequency.value = frequency; n.Q.value = 0.707; return n; };
    const delays = [];
    for (const part of PARTS) {
      const send = gain(0), hp = filter("highpass", part === "vocals" ? 340 : 420), wet = gain(1), duck = gain(0.6);
      sends[part] = send; exits[part] = wet; ducks[part] = duck; duck.connect(wet);
      inputs[part].connect(send); connections.push([inputs[part], send]); send.connect(hp); wet.connect(output);
      let previous = hp;
      for (let i = 0; i < TAPS.length; i++) {
        const delay = keep(context.createDelay(1.2));
        const darken = filter("lowpass", 3900 - i * 550), tap = gain(TAPS[i]);
        const pan = typeof context.createStereoPanner === "function" ? keep(context.createStereoPanner()) : gain(1);
        if (pan.pan) pan.pan.value = PANS[part][i];
        previous.connect(delay); delay.connect(darken); darken.connect(tap); tap.connect(pan); pan.connect(duck);
        delays.push({ node: delay, part }); previous = darken;
      }
    }
    function automate(param, points, { at, offset, rate }) {
      const now = context.currentTime, first = Math.max(now, at);
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
      // Direct A/B switches ramp; future starts can adopt their exact value.
      const begins = first > now + RAMP ? first : first + RAMP;
      param.linearRampToValueAtTime(valueAt(points, offset + Math.max(0, begins - at) * rate), begins);
      for (const [second, value] of points) {
        const time = at + (second - offset) / rate;
        if (time > begins) param.linearRampToValueAtTime(value, time);
      }
    }
    function destroy() {
      disposed = true;
      if (timer !== null) { clearTimeout(timer); timer = null; }
      for (const [input, target] of connections.splice(0)) { try { input.disconnect(target); } catch {} }
      for (const node of nodes) node.disconnect();
    }
    return {
      schedule(options) {
        if (disposed) throw new Error("Disposed dub mix");
        validate(options); settings = { ...options }; curves = plan(options.bpm, options.duration);
        for (const { node, part } of delays) node.delayTime.value = 60 * ECHO_BEATS[part] / (options.bpm * options.rate);
        for (const part of PARTS) {
          automate(direct[part].gain, curves[part].dry, options);
          automate(sends[part].gain, curves[part].send, options);
          automate(ducks[part].gain, curves[part].wet, options);
        }
      },
      setMuted(part, muted) {
        if (!exits[part]) return;
        const p = exits[part].gain, now = context.currentTime;
        p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(muted ? 0 : 1, now + 0.015);
      },
      diagnostics() {
        return { revision: 2, active: !disposed, nodes: disposed ? 0 : nodes.length, taps: TAPS.length,
          echoBeats: { ...ECHO_BEATS }, lastEchoSeconds: settings ? 240 / (settings.bpm * settings.rate) : 0,
          settings, direct: Object.fromEntries(PARTS.map(p => [p, direct[p].gain.value])),
          sends: Object.fromEntries(PARTS.map(p => [p, sends[p].gain.value])),
          wet: Object.fromEntries(PARTS.map(p => [p, ducks[p].gain.value])) };
      },
      destroy,
      dispose() {
        if (disposed) return; disposed = true;
        for (const part of PARTS) {
          sends[part].gain.cancelScheduledValues(context.currentTime);
          sends[part].gain.setValueAtTime(0, context.currentTime);
          const p = exits[part].gain;
          p.cancelScheduledValues(context.currentTime); p.setValueAtTime(p.value, context.currentTime);
          p.linearRampToValueAtTime(0, context.currentTime + 0.015);
        }
        if (context.state === "running") timer = setTimeout(destroy, 35);
        else destroy();
      }
    };
  }
  root.RecordedDubMix = Object.freeze({ create, plan, valueAt, validate });
})(globalThis);
