/**
 * Human Groove Governor
 *
 * A small browser-native timing and density shaper for Music Core Rig.
 * It keeps the main pulse predictable while allowing IDM/ambient details to
 * drift, repair, and thin out before they become machine-like.
 */
(function () {
  const GOLDEN_RATIO = 1.61803398875;
  const GOLDEN_RATIO_INVERSE = 1 / GOLDEN_RATIO;

  const DEFAULT_STATE = {
    cycle: 0,
    collapse: 0,
    naturalness: 0.68,
    density: 0.34,
    grain: 0.28,
    syncopation: 0.42,
    repair: 0.12,
    jitterMs: 4,
    phiPhase: 0,
    lag: 0,
    lag2: 0,
    lag4: 0,
    lag8: 0
  };

  const ROLE_SEEDS = {
    rest: 0.11,
    kick: 0.19,
    bass: 0.31,
    hat: 0.43,
    texture: 0.59,
    glass: 0.71,
    detail: 0.83
  };

  let state = { ...DEFAULT_STATE };

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function clamp01(value) {
    return clamp(value, 0, 1);
  }

  function unit(value, fallback = 0) {
    if (!Number.isFinite(value)) return fallback;
    return clamp01(value);
  }

  function approach(current, target, step) {
    return current + (target - current) * clamp01(step);
  }

  function fractionalPart(value) {
    return value - Math.floor(value);
  }

  function signedWave(value) {
    return Math.sin(value * Math.PI * 2);
  }

  function roundedSnapshot() {
    const round = (value) => Math.round(value * 1000) / 1000;
    return {
      cycle: state.cycle,
      collapse: round(state.collapse),
      naturalness: round(state.naturalness),
      density: round(state.density),
      grain: round(state.grain),
      syncopation: round(state.syncopation),
      repair: round(state.repair),
      jitterMs: round(state.jitterMs),
      phiPhase: round(state.phiPhase)
    };
  }

  function reset() {
    state = { ...DEFAULT_STATE };
    return roundedSnapshot();
  }

  function advanceShortLag(cycle) {
    const noise = (Math.random() * 2 - 1) * 0.18;
    const phi = signedWave((cycle + 1) * GOLDEN_RATIO_INVERSE) * 0.07;
    const nextLag = clamp(state.lag * 0.56 + state.lag2 * 0.18 + state.lag4 * 0.1 + noise + phi, -1, 1);
    state.lag8 = state.lag4;
    state.lag4 = state.lag2;
    state.lag2 = state.lag;
    state.lag = nextLag;
  }

  function advancePhrase(context = {}) {
    const cycle = Number.isFinite(context.cycle) ? context.cycle : state.cycle + 1;
    const energy = unit(context.energy, 0.4);
    const wave = unit(context.wave, 0.4);
    const creation = unit(context.creation, 0.5);
    const resource = unit(context.resource, 0.5);
    const micro = unit(context.micro, 0.3);
    const chaos = unit(context.chaos, 0);
    const circle = unit(context.circle, 0.6);
    const observer = unit(context.observer, 0.5);
    const voidness = unit(context.voidness, 0.2);
    const eventLoad = unit(context.eventLoad, 0);
    const lowGuard = unit(context.lowGuard, 0);
    const drift = unit(context.drift, 0);
    const repeat = unit(context.repeat, 0);
    const ambient = unit(context.ambient, 0.4);
    const idm = unit(context.idm, 0.3);

    advanceShortLag(cycle);

    const collapse = clamp01(
      creation * 0.30 +
        wave * 0.24 +
        resource * 0.20 +
        micro * 0.16 +
        chaos * 0.14 -
        circle * 0.18 -
        observer * 0.12 -
        voidness * 0.10
    );
    const syncTarget = clamp01(
      0.28 +
        wave * 0.18 +
        creation * 0.16 +
        resource * 0.11 +
        micro * 0.15 +
        idm * 0.08 +
        drift * 0.08 +
        repeat * 0.05 -
        voidness * 0.08
    );
    const sweet = clamp01(1 - Math.abs(syncTarget - 0.56) / 0.46);
    const overComplex = clamp01((syncTarget + collapse * 0.48 + eventLoad * 0.5 - 0.78) / 0.42);
    const repair = clamp01(overComplex * 0.58 + eventLoad * 0.24 + lowGuard * 0.18 + (1 - sweet) * 0.1);
    const density = clamp01(
      0.12 +
        energy * 0.15 +
        resource * 0.24 +
        creation * 0.18 +
        syncTarget * 0.12 +
        sweet * 0.08 -
        voidness * 0.18 -
        repair * 0.16
    );
    const grain = clamp01(0.14 + creation * 0.26 + micro * 0.28 + wave * 0.14 + collapse * 0.18 - repair * 0.08);
    const naturalness = clamp01(0.34 + sweet * 0.32 + ambient * 0.08 + observer * 0.1 + circle * 0.08 - repair * 0.22 - lowGuard * 0.08);
    const jitterMs = clamp(3 + wave * 9 + grain * 8 + collapse * 10 + drift * 7 - repair * 5, 1.5, collapse > 0.68 ? 32 : 18);

    state.cycle = cycle;
    state.collapse = approach(state.collapse, collapse, 0.42);
    state.naturalness = approach(state.naturalness, naturalness, 0.34);
    state.density = approach(state.density, density, 0.36);
    state.grain = approach(state.grain, grain, 0.38);
    state.syncopation = approach(state.syncopation, syncTarget, 0.36);
    state.repair = approach(state.repair, repair, 0.4);
    state.jitterMs = approach(state.jitterMs, jitterMs, 0.42);
    state.phiPhase = fractionalPart((cycle + 1) * GOLDEN_RATIO_INVERSE + state.lag * 0.037);

    return roundedSnapshot();
  }

  function shapeStep(context = {}) {
    const role = ROLE_SEEDS[context.role] == null ? "detail" : context.role;
    const step = Number.isFinite(context.step) ? context.step : 0;
    const cycle = Number.isFinite(context.cycle) ? context.cycle : state.cycle;
    const isAccent = !!context.isAccentStep;
    const isOffbeat = step % 2 === 1;
    const isWeakGrid = step % 4 === 1 || step % 4 === 3;
    const seed = ROLE_SEEDS[role];
    const phase = fractionalPart(state.phiPhase + seed + (step + 1) * GOLDEN_RATIO_INVERSE + cycle * 0.013);
    const correlated = clamp(state.lag * 0.62 + state.lag2 * 0.22 + state.lag4 * 0.11 + state.lag8 * 0.05, -1, 1);
    const sign = clamp(signedWave(phase) * 0.64 + correlated * 0.5, -1, 1);
    const sweet = clamp01(1 - Math.abs(state.syncopation - 0.56) / 0.46);
    const tooComplex = clamp01((state.syncopation + state.grain * 0.34 + state.collapse * 0.42 - 0.82) / 0.42);
    const offbeatLift = isOffbeat || isWeakGrid ? 1 + state.syncopation * 0.16 : 1 - state.syncopation * 0.05;

    let maxJitterMs = state.jitterMs;
    let probabilityScale = 1;
    let velocityScale = 1;
    let restLift = 0;
    let densityScale = 1;
    let grainScale = 1;

    if (role === "rest") {
      restLift = clamp(state.repair * 0.16 + tooComplex * 0.1 - sweet * 0.025, -0.035, 0.24);
      maxJitterMs = 0;
    } else if (role === "kick") {
      maxJitterMs = Math.min(6, state.jitterMs * 0.36);
      probabilityScale = clamp(0.98 - state.repair * 0.08 + (isAccent ? 0.025 : 0), 0.86, 1.04);
      velocityScale = clamp(0.98 - state.repair * 0.04 + (isAccent ? 0.03 : 0), 0.88, 1.05);
      densityScale = clamp(0.98 - tooComplex * 0.06, 0.88, 1.02);
    } else if (role === "bass") {
      maxJitterMs = Math.min(6, state.jitterMs * 0.42);
      probabilityScale = clamp(0.96 + state.density * 0.05 - state.repair * 0.08, 0.84, 1.05);
      velocityScale = clamp(0.97 + state.naturalness * 0.04 - state.repair * 0.05, 0.86, 1.05);
      densityScale = clamp(0.95 + state.density * 0.08 - tooComplex * 0.08, 0.84, 1.04);
    } else if (role === "hat") {
      maxJitterMs = Math.min(state.collapse > 0.7 ? 32 : 18, Math.max(4, state.jitterMs));
      probabilityScale = clamp((0.9 + state.density * 0.18 + sweet * 0.12 - state.repair * 0.28) * offbeatLift, 0.52, 1.18);
      velocityScale = clamp(0.86 + state.naturalness * 0.12 + sweet * 0.08 - state.repair * 0.16, 0.62, 1.1);
      densityScale = clamp(0.86 + state.density * 0.28 - tooComplex * 0.22, 0.58, 1.14);
      grainScale = clamp(0.9 + state.grain * 0.22 - state.repair * 0.14, 0.68, 1.16);
    } else {
      maxJitterMs = Math.min(state.collapse > 0.64 ? 32 : 18, Math.max(4, state.jitterMs * 1.08));
      probabilityScale = clamp((0.84 + state.grain * 0.28 + sweet * 0.14 + state.density * 0.08 - state.repair * 0.34) * offbeatLift, 0.44, 1.22);
      velocityScale = clamp(0.82 + state.naturalness * 0.16 + state.grain * 0.08 - state.repair * 0.2, 0.56, 1.12);
      densityScale = clamp(0.82 + state.density * 0.26 + state.grain * 0.08 - tooComplex * 0.28, 0.5, 1.18);
      grainScale = clamp(0.88 + state.grain * 0.3 - state.repair * 0.16, 0.58, 1.2);
    }

    const offsetMs = ((sign + 1) * 0.5) * maxJitterMs;

    return {
      role,
      timeOffsetSec: offsetMs / 1000,
      probabilityScale,
      velocityScale,
      restLift,
      densityScale,
      grainScale,
      collapse: state.collapse,
      naturalness: state.naturalness
    };
  }

  window.HumanGrooveGovernor = {
    reset,
    advancePhrase,
    shapeStep,
    getState: roundedSnapshot,
    get state() {
      return roundedSnapshot();
    }
  };
})();
