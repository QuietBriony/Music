/* Music Hazama Feedback - extracted from engine.js (BL-008). Builds + postMessage-publishes the music-runtime-feedback telemetry payload to a Hazama opener/parent window. Published as window.MusicHazamaFeedback. */
(function () {
  function feedbackNumber(value, digits = 3) {
    const safe = Number.isFinite(value) ? value : 0;
    const factor = 10 ** digits;
    return Math.round(safe * factor) / factor;
  }

  function hazamaRuntimeFeedbackEnabled() {
    return !!(HazamaBridgeState.loaded || HazamaBridgeState.active);
  }

  function sourceFamilyFeedback() {
    const family = typeof TimbreFamilyState !== "undefined" ? TimbreFamilyState : {};
    const inner = family.inner || {};
    const profile = inner.profile || "";
    const oneHot = (name, fallback) => feedbackNumber(profile === name ? Math.max(0.62, fallback) : fallback);

    return {
      hazeBed: oneHot("hazeBed", clampValue((family.voiceDust || 0) * 0.44 + (GradientState.haze || 0) * 0.42 + (DepthState.bed || 0) * 0.14, 0, 1)),
      chromeHymn: oneHot("chromeHymn", clampValue((family.voiceDust || 0) * 0.35 + (GradientState.chrome || 0) * 0.48 + (DepthState.tail || 0) * 0.17, 0, 1)),
      memoryRefrain: oneHot("memoryRefrain", clampValue((family.pianoMemory || 0) * 0.52 + (GradientState.memory || 0) * 0.34 + (MotifMemoryState.strength || 0) * 0.14, 0, 1)),
      coldPulse: oneHot("coldPulse", clampValue((family.chain || 0) * 0.42 + GenreBlendState.techno * 0.26 + GenreBlendState.idm * 0.16 + acidPerformanceAmount() * 0.16, 0, 1)),
      ghostBody: oneHot("ghostBody", clampValue((family.drumSkin || 0) * 0.28 + (family.sub808 || 0) * 0.28 + (GradientState.ghost || 0) * 0.32 + GenreBlendState.pressure * 0.12, 0, 1)),
      acidBiyon: feedbackNumber(clampValue(family.acidBiyon || 0, 0, 1)),
      sub808: feedbackNumber(clampValue(family.sub808 || 0, 0, 1)),
      reedBuzz: feedbackNumber(clampValue(family.reedBuzz || 0, 0, 1))
    };
  }

  function buildHazamaRuntimeFeedbackPayload(kind = "heartbeat", state = window.MusicRuntimeState || null) {
    const family = sourceFamilyFeedback();
    return {
      type: "music-runtime-feedback",
      version: 1,
      provider: "music",
      target: "hazama",
      runtime: {
        playing: !!isPlaying,
        auto: !!(UCM.auto.enabled || hazamaAutoFollowActive()),
        autoFollow: hazamaAutoFollowActive(),
        bpm: Math.round(EngineParams.bpm || 0),
        mode: EngineParams.mode,
        outputLevel: Math.round(OutputState.level || 0),
        culture: {
          selected: CultureGrammarState.selected || "auto",
          active: CultureGrammarState.active || "ambient_room",
          label: CultureGrammarState.label || "AUTO",
          strength: feedbackNumber(CultureGrammarState.strength || 0)
        },
        proposal: {
          mode: OddLogicDirectorState.mode || "auto",
          active: !!OddLogicDirectorState.active,
          label: OddLogicDirectorState.label || "",
          want: OddLogicDirectorState.want || "",
          move: OddLogicDirectorState.move || "",
          intensity: feedbackNumber(OddLogicDirectorState.intensity || 0)
        },
        albumArc: {
          active: !!albumArcActive(),
          chapter: currentAlbumArcChapter()?.name || "",
          label: currentAlbumArcChapter()?.label || "",
          progress: feedbackNumber(AlbumArcState.progress || 0)
        },
        acid: {
          enabled: !!AcidLockState.enabled,
          performance: feedbackNumber(acidPerformanceAmount()),
          indicator: feedbackNumber(AcidLockState.indicator || 0),
          transient: feedbackNumber(AcidLockState.transient || 0),
          transientSource: AcidLockState.transientSource || "",
          arcDrive: feedbackNumber(albumArcAcidDrive())
        },
        hazama: {
          active: !!HazamaBridgeState.active,
          autoFollow: hazamaAutoFollowActive(),
          connectionState: hazamaConnectionState(),
          controlAction: HazamaBridgeState.controlAction || "",
          name: HazamaBridgeState.name || "",
          stage: HazamaBridgeState.stage || "",
          depthId: HazamaBridgeState.depthId || ""
        },
        color: {
          genre: {
            ambient: feedbackNumber(GenreBlendState.ambient),
            idm: feedbackNumber(GenreBlendState.idm),
            techno: feedbackNumber(GenreBlendState.techno),
            pressure: feedbackNumber(GenreBlendState.pressure)
          },
          gradient: {
            haze: feedbackNumber(GradientState.haze),
            memory: feedbackNumber(GradientState.memory),
            micro: feedbackNumber(GradientState.micro),
            ghost: feedbackNumber(GradientState.ghost),
            chrome: feedbackNumber(GradientState.chrome),
            organic: feedbackNumber(GradientState.organic)
          },
          families: family
        },
        event: {
          kind,
          at: Date.now()
        }
      },
      capabilities: {
        feedbackVersion: 1,
        albumArc: true,
        acidDrive: true,
        sourceFamilies: true,
        cultureGrammar: true,
        oddLogicProposal: true,
        hazamaControl: true
      }
    };
  }

  function postHazamaRuntimeFeedback(payload) {
    if (typeof window === "undefined" || !payload) return false;
    const targets = [];
    if (window.opener && !window.opener.closed) targets.push(window.opener);
    if (window.parent && window.parent !== window) targets.push(window.parent);
    if (!targets.length) return false;

    let sent = false;
    for (const target of targets) {
      for (const origin of HAZAMA_RUNTIME_FEEDBACK_TARGET_ORIGINS) {
        try {
          target.postMessage(payload, origin);
          sent = true;
        } catch (error) {}
      }
    }
    return sent;
  }

  function hazamaRuntimeFeedbackSignature() {
    const family = typeof TimbreFamilyState !== "undefined" ? TimbreFamilyState : {};
    const inner = family.inner || {};
    return [
      isPlaying ? "1" : "0",
      UCM.auto.enabled ? "auto" : (hazamaAutoFollowActive() ? "hazama" : "manual"),
      Math.round((EngineParams.bpm || 0) / 2) * 2,
      albumArcActive() ? currentAlbumArcChapter()?.label || "" : "live",
      CultureGrammarState.selected || "auto",
      CultureGrammarState.active || "",
      OddLogicDirectorState.mode || "auto",
      OddLogicDirectorState.move || "",
      Math.round((OddLogicDirectorState.intensity || 0) * 10),
      Math.round(acidPerformanceAmount() * 10),
      inner.profile || "",
      dominantInnerSourceFamily(inner)
    ].join("|");
  }

  function sendHazamaRuntimeFeedback(kind = "heartbeat", options = {}) {
    if (!hazamaRuntimeFeedbackEnabled()) return false;
    const now = Date.now();
    if (!options.force && now - HazamaRuntimeFeedbackState.lastSentAt < 1100) return false;

    const payload = buildHazamaRuntimeFeedbackPayload(kind, options.state);
    HazamaRuntimeFeedbackState.sequence += 1;
    payload.runtime.sequence = HazamaRuntimeFeedbackState.sequence;
    const sent = postHazamaRuntimeFeedback(payload);
    HazamaRuntimeFeedbackState.lastSentAt = now;
    if (kind === "heartbeat") HazamaRuntimeFeedbackState.lastHeartbeatAt = now;
    HazamaRuntimeFeedbackState.lastSignature = hazamaRuntimeFeedbackSignature();
    return sent;
  }

  function maybeSendHazamaRuntimeFeedback(state) {
    if (!hazamaRuntimeFeedbackEnabled()) return;
    const now = Date.now();
    const signature = hazamaRuntimeFeedbackSignature();
    if (now - HazamaRuntimeFeedbackState.lastHeartbeatAt >= 8000) {
      sendHazamaRuntimeFeedback("heartbeat", { state, force: true });
    } else if (signature !== HazamaRuntimeFeedbackState.lastSignature && now - HazamaRuntimeFeedbackState.lastSentAt >= 1400) {
      sendHazamaRuntimeFeedback("change", { state, force: true });
    }
  }

  function requestHazamaRuntimeFeedback(kind = "change") {
    sendHazamaRuntimeFeedback(kind, { force: true });
  }

  if (typeof window !== "undefined") {
    window.MusicHazamaFeedback = {
      maybeSend: maybeSendHazamaRuntimeFeedback,
      request: requestHazamaRuntimeFeedback
    };
  }
})();
