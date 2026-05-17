/* Music Focus Modulation - extracted from engine.js (BL-008).
   Optional brain.fm-style 40 Hz focus AM. Published as window.MusicFocusModulation. */
(function () {
  // fm-75: optional brain.fm-style 40 Hz focus AM.
  // Inserted before the limiter so the tiny modulation stays peak-protected and
  // the hardware/background/recording fan-out remains unchanged.
  const FocusModulationState = {
    enabled: false,
    frequencyHz: 40,
    depth: 0.08,
    currentDepth: 0,
    targetDepth: 0,
    lfo: null,
    rampTimer: null,
    monitorTimer: null,
    suppressedByAiFill: false,
    lastDispatchSignature: ""
  };

  function focusModulationNowMs() {
    return (typeof performance !== "undefined" && typeof performance.now === "function")
      ? performance.now()
      : Date.now();
  }

  function focusModulationAiFillActive() {
    try {
      return !!(typeof window !== "undefined" && window.FmAiFill && window.FmAiFill.status.active);
    } catch (error) {
      return false;
    }
  }

  function ensureFocusModulationLfo() {
    if (FocusModulationState.lfo) return FocusModulationState.lfo;
    try {
      try { focusModGain.gain.value = 0; } catch (error) {}
      const lfo = new Tone.LFO(FocusModulationState.frequencyHz, 1, 1);
      if (lfo.frequency && typeof lfo.frequency.value === "number") {
        lfo.frequency.value = FocusModulationState.frequencyHz;
      }
      lfo.connect(focusModGain.gain);
      lfo.start();
      FocusModulationState.lfo = lfo;
    } catch (error) {
      console.warn("[Music] focus modulation unavailable:", error);
    }
    return FocusModulationState.lfo;
  }

  function disposeFocusModulationLfo() {
    const lfo = FocusModulationState.lfo;
    if (!lfo) return;
    try { lfo.disconnect(focusModGain.gain); } catch (error) {
      try { lfo.disconnect(); } catch (innerError) {}
    }
    try { lfo.stop(); } catch (error) {}
    try { lfo.dispose?.(); } catch (error) {}
    FocusModulationState.lfo = null;
    FocusModulationState.currentDepth = 0;
    FocusModulationState.targetDepth = 0;
    try { focusModGain.gain.value = 1; } catch (error) {}
  }

  function applyFocusModulationDepth(depth) {
    const safeDepth = clampValue(depth, 0, 0.12);
    const lfo = ensureFocusModulationLfo();
    if (!lfo) return;
    try {
      focusModGain.gain.value = 0;
      lfo.min = 1 - safeDepth;
      lfo.max = 1;
      FocusModulationState.currentDepth = safeDepth;
    } catch (error) {
      console.warn("[Music] focus modulation depth failed:", error);
    }
  }

  function focusModulationStateSignature(state) {
    return [
      state.enabled ? "1" : "0",
      state.active ? "1" : "0",
      state.suppressedByAiFill ? "1" : "0",
      state.currentDepth.toFixed(3),
      state.targetDepth.toFixed(3)
    ].join("|");
  }

  function dispatchFocusModulationState(options = {}) {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
    const detail = getFmFocusModeState();
    const signature = focusModulationStateSignature(detail);
    if (options.force !== true && signature === FocusModulationState.lastDispatchSignature) return;
    FocusModulationState.lastDispatchSignature = signature;
    try {
      window.dispatchEvent(new CustomEvent("music-focus-mode-state", {
        detail
      }));
    } catch (error) {
      // best-effort UI sync only
    }
  }

  function rampFocusModulationDepth(depth, seconds = 3) {
    const numericDepth = Number(depth);
    const targetDepth = clampValue(Number.isFinite(numericDepth) ? numericDepth : 0, 0, 0.12);
    if (FocusModulationState.rampTimer) {
      clearInterval(FocusModulationState.rampTimer);
      FocusModulationState.rampTimer = null;
    }
    const fromDepth = FocusModulationState.currentDepth;
    FocusModulationState.targetDepth = targetDepth;
    if (Math.abs(fromDepth - targetDepth) < 0.001 || seconds <= 0) {
      applyFocusModulationDepth(targetDepth);
      if (targetDepth <= 0.001 && !FocusModulationState.enabled) disposeFocusModulationLfo();
      dispatchFocusModulationState({ force: true });
      return;
    }

    const startedAt = focusModulationNowMs();
    const durationMs = Math.max(80, seconds * 1000);
    FocusModulationState.rampTimer = setInterval(() => {
      const progress = clampValue((focusModulationNowMs() - startedAt) / durationMs, 0, 1);
      const eased = progress * progress * (3 - (2 * progress));
      applyFocusModulationDepth(fromDepth + ((targetDepth - fromDepth) * eased));
      if (progress >= 1) {
        clearInterval(FocusModulationState.rampTimer);
        FocusModulationState.rampTimer = null;
        applyFocusModulationDepth(targetDepth);
        if (targetDepth <= 0.001 && !FocusModulationState.enabled) disposeFocusModulationLfo();
        dispatchFocusModulationState({ force: true });
      }
    }, 50);
    dispatchFocusModulationState({ force: true });
  }

  function focusModulationTargetDepth() {
    const suppressed = focusModulationAiFillActive();
    FocusModulationState.suppressedByAiFill = suppressed;
    return FocusModulationState.enabled && isPlaying && !suppressed
      ? FocusModulationState.depth
      : 0;
  }

  function refreshFocusModulation(options = {}) {
    const targetDepth = focusModulationTargetDepth();
    const rampInSeconds = typeof options.rampInSeconds === "number" ? options.rampInSeconds : 3;
    const rampOutSeconds = typeof options.rampOutSeconds === "number" ? options.rampOutSeconds : 0.45;
    const seconds = options.force === true ? 0 : (targetDepth > FocusModulationState.currentDepth ? rampInSeconds : rampOutSeconds);
    if (Math.abs(FocusModulationState.targetDepth - targetDepth) >= 0.001) {
      rampFocusModulationDepth(targetDepth, seconds);
    } else {
      dispatchFocusModulationState();
    }
  }

  function startFocusModulationMonitor() {
    if (FocusModulationState.monitorTimer) return;
    FocusModulationState.monitorTimer = setInterval(() => {
      refreshFocusModulation({ rampInSeconds: 3, rampOutSeconds: 0.35 });
    }, 500);
  }

  function stopFocusModulationMonitor() {
    if (!FocusModulationState.monitorTimer) return;
    clearInterval(FocusModulationState.monitorTimer);
    FocusModulationState.monitorTimer = null;
  }

  function setFmFocusModeEnabled(enabled, options = {}) {
    const nextEnabled = enabled === true;
    if (typeof options.depth === "number" && Number.isFinite(options.depth)) {
      FocusModulationState.depth = clampValue(options.depth, 0, 0.12);
    }
    if (FocusModulationState.enabled !== nextEnabled) {
      console.log("[FocusMode]", nextEnabled ? "on" : "off", "40Hz depth:", FocusModulationState.depth);
    }
    FocusModulationState.enabled = nextEnabled;
    if (nextEnabled) startFocusModulationMonitor();
    else stopFocusModulationMonitor();
    refreshFocusModulation({
      force: options.force === true,
      rampInSeconds: typeof options.rampInSeconds === "number" ? options.rampInSeconds : 3,
      rampOutSeconds: typeof options.rampOutSeconds === "number" ? options.rampOutSeconds : 0.45
    });
    return getFmFocusModeState();
  }

  function getFmFocusModeState() {
    return {
      enabled: FocusModulationState.enabled,
      active: FocusModulationState.currentDepth > 0.001,
      suppressedByAiFill: FocusModulationState.suppressedByAiFill,
      frequencyHz: FocusModulationState.frequencyHz,
      depth: FocusModulationState.depth,
      currentDepth: FocusModulationState.currentDepth,
      targetDepth: FocusModulationState.targetDepth
    };
  }

  if (typeof window !== "undefined") {
    window.MusicFocusModulation = {
      refresh: refreshFocusModulation,
      setEnabled: setFmFocusModeEnabled,
      getState: getFmFocusModeState
    };
  }
})();
