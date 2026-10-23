/* Human Fly dub arrangement: source-time automation and four finite echoes.
 * Original stem data, bass/drum attacks and the shared recording path remain.
 * No feedback loop, oscillator, new recording, worker or analysis at runtime. */
(function (root) {
  "use strict";
  const PARTS = ["vocals", "other"];
  const BASE = { vocals: 0.82, other: 0.76 };
  const SEND = { vocals: 0.045, other: 0.025 };
  const TAPS = [0.48, 0.27, 0.15, 0.08];
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
    const bar = 240 / bpm;
    const curves = Object.fromEntries(PARTS.map(p => [p, {
      dry: [[0, BASE[p]]], send: [[0, SEND[p]]]
    }]));
    function window(points, start, end, low, normal) {
      if (start < RAMP || end + RAMP >= duration) return;
      points.push([start - RAMP, normal], [start, low], [end, low], [end + RAMP, normal]);
    }
    // Seven deliberate breaks over the 116-bar arrangement. The rhythm
    // section stays intact; the phrase preceding each break feeds the echo.
    for (let phrase = 8; (phrase + 8) * bar < duration; phrase += 16) {
      window(curves.vocals.dry, (phrase + 6) * bar, (phrase + 8) * bar, 0, BASE.vocals);
      window(curves.other.dry, (phrase + 7) * bar, (phrase + 8) * bar, 0.08, BASE.other);
      window(curves.vocals.send, (phrase + 5.75) * bar, (phrase + 6) * bar, 0.70, SEND.vocals);
      window(curves.other.send, (phrase + 6.75) * bar, (phrase + 7) * bar, 0.48, SEND.other);
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
    const nodes = [], sends = {}, exits = {}, connections = [];
    let disposed = false, timer = null, settings = null, curves = null;
    const keep = n => { nodes.push(n); return n; };
    const gain = value => { const n = keep(context.createGain()); n.gain.value = value; return n; };
    const filter = (type, frequency) => { const n = keep(context.createBiquadFilter()); n.type = type; n.frequency.value = frequency; n.Q.value = 0.707; return n; };
    const delays = [];
    for (const part of PARTS) {
      const send = gain(0), hp = filter("highpass", part === "vocals" ? 340 : 280), wet = gain(1);
      sends[part] = send; exits[part] = wet;
      inputs[part].connect(send); connections.push([inputs[part], send]); send.connect(hp); wet.connect(output);
      let previous = hp;
      for (let i = 0; i < TAPS.length; i++) {
        const delay = keep(context.createDelay(1));
        const darken = filter("lowpass", 3800 - i * 550), tap = gain(TAPS[i]);
        previous.connect(delay); delay.connect(darken); darken.connect(tap); tap.connect(wet);
        delays.push(delay); previous = darken;
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
        for (const delay of delays) delay.delayTime.value = 45 / (options.bpm * options.rate);
        for (const part of PARTS) {
          automate(direct[part].gain, curves[part].dry, options);
          automate(sends[part].gain, curves[part].send, options);
        }
      },
      setMuted(part, muted) {
        if (!exits[part]) return;
        const p = exits[part].gain, now = context.currentTime;
        p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(muted ? 0 : 1, now + 0.015);
      },
      diagnostics() {
        return { active: !disposed, nodes: disposed ? 0 : nodes.length, taps: TAPS.length,
          lastEchoSeconds: settings ? 180 / (settings.bpm * settings.rate) : 0,
          settings, direct: Object.fromEntries(PARTS.map(p => [p, direct[p].gain.value])),
          sends: Object.fromEntries(PARTS.map(p => [p, sends[p].gain.value])) };
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
