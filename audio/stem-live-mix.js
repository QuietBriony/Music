/* Recorded-stem mix. Direct inputs must precede legacy EQ and song boosts.
 * Native Web Audio; ordinary reflections stay separate from optional Dub.
 * The same factory is rendered offline for full-song measurement. */
(function (root) {
  "use strict";
  const PARTS = ["vocals", "drums", "bass", "other"];
  const LEVELS = { vocals: 0.84, drums: 1, bass: 0.97, other: 1 };
  const SENDS = { vocals: 0.24, drums: 0.10, bass: 0.04, other: 0.13 };
  // v436: keep the direct balance and close reflections. A short diffuse
  // return gives vocal endings room without extending the Dub repeat bus.
  // Comparison and limits: docs/stem-vocal-space-20261026.json.
  const TAPS = [[0.019, 0.34], [0.031, 0.26], [0.047, 0.20],
    [0.067, 0.115], [0.097, 0.06], [0.139, 0.025]];
  // Finite, deterministic room: preserve the close reflections, diffuse the
  // late return instead of extending discrete echoes. No downloaded IR.
  const ROOM_SECONDS = 0.72, ROOM_TAIL_ENERGY = 0.22;
  const roomBuffers = new WeakMap();
  function roomImpulse(context) {
    const cached = roomBuffers.get(context);
    if (cached && cached.sampleRate === context.sampleRate) return cached;
    const rate = context.sampleRate, n = Math.ceil(rate * ROOM_SECONDS);
    const buffer = context.createBuffer(2, n, rate);
    let seed = 0x71e3b94d;
    const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
    const tail = [new Float32Array(n), new Float32Array(n)];
    const state = [0, 0], energy = [0, 0];
    for (let i = Math.ceil(rate * 0.052); i < n; i++) {
      const t = i / rate, age = t - 0.052, shared = noise();
      const envelope = Math.min(1, age / 0.018) * Math.exp(-6.9078 * age / 0.48) * Math.min(1, (ROOM_SECONDS - t) / 0.02);
      // The late reflections darken as they decay. Most energy is shared
      // between channels, leaving a modest stereo field and a stable centre.
      const alpha = 1 - Math.exp(-2 * Math.PI * (3600 - 2100 * Math.min(1, age / 0.5)) / rate);
      for (let ch = 0; ch < 2; ch++) {
        state[ch] += alpha * (0.8 * shared + 0.6 * noise() - state[ch]);
        const v = state[ch] * envelope; tail[ch][i] = v; energy[ch] += v * v;
      }
    }
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch), scale = Math.sqrt(ROOM_TAIL_ENERGY / energy[ch]);
      for (let i = 0; i < n; i++) data[i] = tail[ch][i] * scale;
      for (const [seconds, amount] of TAPS) data[Math.round(seconds * rate)] += amount;
    }
    roomBuffers.set(context, buffer); return buffer;
  }
  const SONG_DB = Object.freeze({"tabasco": -0.2, "hey": 0.2, "i-got-a-feeling": -1.2, "under-the-moon": 1.1, "electric-sheep": -0.6, "human-fly": 0.9, "sister": 1.1});
  const validLevel = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0.8;
  function create(context) {
    const nodes = [], inputs = {}, faders = {}, levels = {}, direct = {}, roomSends = {}, processors = {}, sourceGates = {}, tones = {}, toneGains = {}, bypassGains = {};
    let dub = null, retiredDub = null, dubBuffers = null, roomActive = true, roomRateFallback = false;
    const muted = { vocals: false, drums: false, bass: false, other: false };
    const keep = node => { nodes.push(node); return node; };
    const gain = value => { const n = keep(context.createGain()); n.gain.value = value; return n; };
    const filter = (type, frequency, db = 0, q = 0.707) => {
      const n = keep(context.createBiquadFilter()); n.type = type;
      n.frequency.value = frequency; n.gain.value = db; n.Q.value = q; return n;
    };
    // Acquire the optional native capability before connecting other nodes.
    const roomVerb = keep(context.createConvolver());
    const sum = gain(1), room = gain(0.65);
    const roomHp = filter("highpass", 200), roomLp = filter("lowpass", 4800);
    room.connect(roomHp); roomHp.connect(roomLp);
    const roomReturn = gain(1);
    roomVerb.normalize = false;
    let impulse = roomImpulse(context);
    const isRateMismatch = error => error?.name === "NotSupportedError" && /sample.?rate/i.test(String(error.message || ""));
    function installRoomImpulse() {
      roomVerb.buffer = null;
      impulse = roomImpulse(context);
      try {
        roomVerb.buffer = impulse;
        roomRateFallback = false;
      } catch (error) {
        if (!isRateMismatch(error)) throw error;
        // Some iOS audio sessions change rate while starting or changing route.
        // Keep the direct mix audible if WebKit still rejects the fresh buffer.
        roomRateFallback = true;
      }
    }
    installRoomImpulse();
    roomLp.connect(roomVerb); roomVerb.connect(roomReturn); roomReturn.connect(sum);
    function resetRoom() {
      // Clear earlier words/hits on a transport jump or minus-one change.
      // Rebuild the IR only when the context rate changes. WebKit requires a
      // convolver buffer at the current rate, including after audio resume.
      installRoomImpulse();
      const now = context.currentTime;
      roomReturn.gain.cancelScheduledValues(now);
      if (context.state === "running") {
        roomReturn.gain.setValueAtTime(0, now);
        roomReturn.gain.linearRampToValueAtTime(roomActive && !roomRateFallback ? 1 : 0, now + 0.02);
      } else roomReturn.gain.setValueAtTime(roomActive && !roomRateFallback ? 1 : 0, now);
    }
    for (const part of PARTS) {
      const input = gain(1), fader = gain(LEVELS[part]), send = gain(SENDS[part]);
      inputs[part] = input; faders[part] = fader; levels[part] = 0.8;
      if (part === "vocals") {
        const hp = filter("highpass", 65), presence = filter("peaking", 2800, -1.2, 0.8);
        input.connect(hp); hp.connect(presence); presence.connect(fader); processors[part] = hp;
      } else { input.connect(fader); processors[part] = fader; }
      // Both dry and room follow the same fader/mute, so minus-one stays honest.
      roomSends[part] = send;
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
    function syncRoomSend(part) {
      const param = roomSends[part].gain;
      if (muted[part] || levels[part] === 0) {
        // A muted source may still be fading upstream. Stop feeding that
        // fade into the new room after its previous history was cleared.
        param.cancelScheduledValues(context.currentTime);
        param.setValueAtTime(0, context.currentTime);
      } else set(param, SENDS[part]);
    }
    function stopDub() {
      resetRoom();
      retiredDub?.destroy(); retiredDub = dub;
      dub?.dispose(); dub = null; dubBuffers = null;
      for (const route of Object.values(direct)) set(route.gain, 1);
      for (const route of Object.values(sourceGates)) set(route.gain, 1);
      for (const part of Object.keys(tones)) {
        set(toneGains[part].gain, 0); set(bypassGains[part].gain, 1);
        set(tones[part].frequency, tones[part].frequency.value);
      }
    }
    function startDub(options, buffers = dubBuffers) {
      root.RecordedDubMix.validate(options);
      root.RecordedDubArrangement.validateBuffers(buffers,options);
      stopDub();
      dubBuffers = buffers;
      // Source gates replace the continuing recording only during a loop.
      // Loop sources join before the same EQ/fader; mute and zero still apply.
      for (const part of PARTS) {
        if (direct[part]) continue;
        const fader = faders[part], send = roomSends[part], route = gain(1);
        const tone = filter("lowpass", context.sampleRate * 0.45, 0, 0.5);
        tones[part] = tone; toneGains[part] = gain(0); bypassGains[part] = gain(1);
        fader.disconnect(sum); fader.disconnect(send);
        fader.connect(tone); tone.connect(toneGains[part]); toneGains[part].connect(route);
        fader.connect(bypassGains[part]); bypassGains[part].connect(route);
        route.connect(sum); route.connect(send); direct[part] = route;
        const source = gain(1); sourceGates[part] = source;
        inputs[part].disconnect(processors[part]); inputs[part].connect(source); source.connect(processors[part]);
      }
      // Equal linear fades retain the exact unfiltered ordinary route.
      for (const part of PARTS) { set(toneGains[part].gain, 1); set(bypassGains[part].gain, 0); }
      dub = root.RecordedDubMix.create(context, { inputs: faders, direct, sources: sourceGates, tones,
        loopTargets: processors, buffers: dubBuffers,
        muted: Object.fromEntries(PARTS.map(p=>[p,muted[p]||levels[p]===0])), output: sum });
      dub.schedule(options);
      for (const part of Object.keys(direct)) dub.setMuted(part, muted[part] || levels[part] === 0);
    }
    function flushDub() {
      if (!dub) return;
      const options = dub.diagnostics().settings, at = Math.max(context.currentTime, options.at);
      const offset = options.offset + Math.max(0, at - options.at) * options.rate;
      if (offset >= options.duration) stopDub();
      else startDub({ ...options, at, offset }, dubBuffers);
    }
    return {
      inputs, output,
      setLevel(part, value) {
        if (!faders[part]) return;
        const wasZero = levels[part] === 0;
        levels[part] = validLevel(value);
        set(faders[part].gain, LEVELS[part] * levels[part] / 0.8);
        if (wasZero !== (levels[part] === 0)) { syncRoomSend(part); resetRoom(); }
        if (direct[part] && wasZero !== (levels[part] === 0)) flushDub();
      },
      startDub, stopDub, resetRoom,
      setRoomActive(value) { roomActive = Boolean(value); resetRoom(); },
      setDubMuted(part, value) {
        if (!Object.hasOwn(muted, part)) return;
        if (muted[part] === Boolean(value)) return;
        muted[part] = Boolean(value); syncRoomSend(part); resetRoom(); flushDub();
      },
      setSong(song) { set(output.gain, 10 ** ((Object.hasOwn(SONG_DB, song) ? SONG_DB[song] : 0) / 20)); },
      diagnostics() { return { levels: { ...levels }, gains: Object.fromEntries(PARTS.map(p => [p, faders[p].gain.value])),
        output: output.gain.value, nodes: nodes.length, roomActive, roomLastReflectionSeconds: ROOM_SECONDS, roomBytes: impulse.length * 8, roomVocalSend: SENDS.vocals, source: "pre-trim-pre-eq",
        roomRateFallback, roomSampleRate: impulse.sampleRate, dub: dub?.diagnostics() || null,
        dubToneHz: Object.fromEntries(Object.entries(tones).map(([p, n]) => [p, n.frequency.value])) }; },
      dispose() { dub?.destroy(); retiredDub?.destroy(); dub = null; retiredDub = null; dubBuffers = null; roomVerb.buffer = null; for (const node of nodes) node.disconnect(); }
    };
  }
  root.RecordedStemMix = Object.freeze({ create, validLevel });
})(globalThis);
