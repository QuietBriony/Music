import { TB303 } from '../audio/TB303.js';
import { TR909 } from '../audio/TR909.js';
import { BinaryFormatDecoder } from '../data/BinaryFormatDecoder.js';
import { FileManager } from '../data/FileManager.js';
import { captureMachineState, decodeMachineState, applyMachineState } from '../../../../machine-state.js';

// A same-origin, explicit host connection. Original Data/UI/FILE and voice
// implementations are retained; the standalone sequencer never runs linked.
export function createMachineLink({ audio, ui, data }) {
  let callbacks = null, generation = 0, preparing = null, ready = false;
  let sharedContext = null, bank = null, level = .55;
  let refreshingTempo = false;
  const notice = () => document.dispatchEvent(new Event('workbench-machine-changed'));
  function showTempo() {
    // Native knob rendering emits an input event (and rounds its value).
    // Never feed that event back into another render or into the host clock.
    if (refreshingTempo) return;
    refreshingTempo = true;
    try { ui.updateTempoUI(); } finally { refreshingTempo = false; }
  }
  function retireVoices() {
    audio.stopInternal();
    audio.master?.disconnect();
    for (const voice of audio.instruments.values()) {
      for (const key of ['delayNode', 'feedbackGain', 'wetGain']) voice[key]?.disconnect();
    }
  }
  function stop() {
    generation++;
    if (audio.outputGain && audio.ctx) {
      audio.outputGain.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.outputGain.gain.setValueAtTime(0, audio.ctx.currentTime);
    }
    retireVoices();
    notice();
  }
  function renewVoices() {
    // Old scheduled notes feed a disconnected bus, even after a rapid Stop/Play.
    retireVoices();
    const ctx = audio.ctx;
    audio.master = ctx.createDynamicsCompressor();
    audio.master.threshold.value = -8; audio.master.ratio.value = 12;
    audio.master.connect(audio.analyser);
    const drums = new TR909(ctx, audio.master);
    for (const key of ['noiseBuffer', 'samples', 'customSamples']) drums[key] = bank[key];
    drums.customSampleMap = { ...data.customSampleMap }; drums.initVoices(); drums.refreshCustomSamples();
    audio.instruments = new Map([
      ['tb303_1', new TB303(ctx, audio.master)], ['tb303_2', new TB303(ctx, audio.master)], ['tr909', drums],
    ]);
    audio.isPlaying = true;
    if (data.mode === 'song' && !data.keepSoundSettings && data.song.length) data.applyPatternSettings(data.song[0]);
    ui.refreshParamCache?.(data.currentPatternId);
    notice();
  }
  const transport = {
    play: () => callbacks?.play(),
    stop: () => callbacks?.stop(),
    // Linked tempo belongs to Strudel; native tempo controls cannot start drift.
    tempo: value => { if (value !== audio.tempo) showTempo(); notice(); },
  };
  return {
    capture: () => captureMachineState(data,audio),
    validate: snapshot => { decodeMachineState(snapshot,BinaryFormatDecoder); },
    restore(snapshot) {
      const decoded=decodeMachineState(snapshot,BinaryFormatDecoder);
      const previous=decodeMachineState(captureMachineState(data,audio),BinaryFormatDecoder);
      stop();
      try { applyMachineState({data,audio,ui},decoded); showTempo(); }
      catch(error) { applyMachineState({data,audio,ui},previous); showTempo(); throw error; }
      // A combined save is an independent snapshot, not an edit of a named FILE.
      FileManager.currentFileId=null;
      data.saveSettings();
      notice();
    },
    connect(host) {
      if (callbacks) return;
      stop(); callbacks = host; audio.externalTransport = transport; notice();
    },
    async prepare(context) {
      if (!callbacks) throw new Error('303／909の接続が解除されています');
      const token = generation;
      if (!ready && !preparing) preparing = (async () => {
        await audio.initPromise;
        if (audio.ctx !== context) {
          retireVoices();
          audio.outputGain?.disconnect(); audio.analyser?.disconnect(); audio.clockNode?.disconnect();
          if (audio.ctx && audio.ctx !== sharedContext) await audio.ctx.close();
          audio.ctx = context; sharedContext = context; audio.isInitialized = false;
          audio.clockNode = null; audio.useWorklet = false;
        }
        await audio.init();
        bank = audio.instruments.get('tr909');
        ready = true;
      })().finally(() => { preparing = null; });
      await preparing;
      if (!callbacks || token !== generation) return false;
      if (!audio.isPlaying) renewVoices();
      return true;
    },
    tick(time, step, cps) {
      if (!callbacks || !ready || !audio.isPlaying || !Number.isFinite(time) || !(cps > 0)) return;
      const bpm = Math.round(cps * 240 * 1e6) / 1e6;
      if (audio.tempo !== bpm) { audio.tempo = bpm; showTempo(); notice(); }
      // Native swing delays odd sixteenths without moving the shared bar start.
      const swing = step % 2 ? Math.max(-.45, Math.min(.45, (audio.swing - 50) / 50)) / (16 * cps) : 0;
      audio.outputGain.gain.setValueAtTime(.8 * level, time);
      audio.handleTick({ time: time + swing, step });
    },
    setLevel(value) {
      level = Math.max(0, Math.min(1, Number(value) || 0));
      if (audio.outputGain && audio.isPlaying) {
        audio.outputGain.gain.cancelScheduledValues(audio.ctx.currentTime);
        audio.outputGain.gain.setTargetAtTime(.8 * level, audio.ctx.currentTime, .015);
      }
    },
    stop,
    async disconnect() {
      callbacks = null; stop();
      await preparing;
      if (callbacks) return; // A quick reconnect keeps this frame and its bank.
      retireVoices(); audio.outputGain?.disconnect(); audio.analyser?.disconnect(); audio.clockNode?.disconnect();
      audio.ctx = null; audio.isInitialized = false; audio.useWorklet = false; audio.clockNode = null;
      audio.externalTransport = null; ready = false; sharedContext = null; bank = null;
      notice(); // Never close the AudioContext owned by Strudel.
    },
  };
}
