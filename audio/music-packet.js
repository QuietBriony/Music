/* Music Packet - extracted from engine.js (BL-008). Builds/publishes the metadata-only Music session + orchestra packets for cross-repo routing. Published as window.MusicPacketKit. */
(function () {
  function packetNumber(value, min = 0, max = 1, digits = 3) {
    const numeric = Number(value);
    const safe = Number.isFinite(numeric) ? numeric : min;
    const factor = 10 ** digits;
    return Math.round(clampValue(safe, min, max) * factor) / factor;
  }

  function packetPercent(value) {
    return packetNumber(value, 0, 100, 1);
  }

  function packetUnit(value) {
    return packetNumber(value, 0, 1, 3);
  }

  function dedupePacketLabels(labels) {
    return Array.from(new Set(labels.filter(Boolean)));
  }

  function recorderDurationSeconds() {
    if (RecorderState.recorder && RecorderState.recorder.state === "recording" && RecorderState.startedAt) {
      return packetNumber((Date.now() - RecorderState.startedAt) / 1000, 0, 36000, 1);
    }
    return 0;
  }

  function dominantPacketKey(map, fallback = "ambient") {
    const entries = Object.entries(map || {});
    if (!entries.length) return fallback;
    return entries.reduce((best, item) => (Number(item[1]) || 0) > (Number(best[1]) || 0) ? item : best, entries[0])[0] || fallback;
  }

  function packetSectionName(activePads) {
    if (activePads.includes("void")) return "void";
    if (activePads.includes("punch")) return "punch";
    if (activePads.includes("repeat")) return "repeat";
    if (activePads.includes("drift")) return "drift";
    if (albumArcActive()) return String(currentAlbumArcChapter()?.name || "album_arc").toLowerCase();
    return UCM.auto.enabled ? "self_running" : "manual";
  }

  function packetModeName() {
    if (UCM.auto.enabled) return "self_running";
    const morph = dominantReferenceMorphStyle();
    if (morph && morph !== "haze") return "reference_gradient";
    return EngineParams.mode || "ambient";
  }

  function packetIntentArrays(activePads, gradient, kits, parts) {
    const dominantKit = dominantPacketKey(kits, "ambientKit");
    const timbre = ["metadata-only"];
    if (gradient.haze > 0.36 || kits.ambientKit > 0.44) timbre.push("haze-bed");
    if (gradient.memory > 0.34) timbre.push("memory-point");
    if (gradient.micro > 0.34 || kits.idmKit > 0.36) timbre.push("micro-particle");
    if (gradient.ghost > 0.34 || kits.pressureKit > 0.34) timbre.push("ghost-pressure");
    if (gradient.chrome > 0.36 || kits.spaceKit > 0.42) timbre.push("chrome-air");
    if (gradient.organic > 0.34) timbre.push("organic-dust");

    const rhythm = [];
    if (kits.ambientKit > 0.48 || parts.energy < 0.3) rhythm.push("low-activity");
    if (kits.idmKit > 0.34) rhythm.push("broken-repeat");
    if (kits.technoKit > 0.34) rhythm.push("dry-grid");
    if (kits.pressureKit > 0.34 || activePads.includes("punch")) rhythm.push("body-snap");
    if (activePads.includes("repeat")) rhythm.push("manual-repeat");
    if (!rhythm.length) rhythm.push("soft-pulse");

    const space = [];
    if (kits.spaceKit > 0.38 || activePads.includes("void")) space.push("transparent-tail");
    if (gradient.haze > 0.4) space.push("wide-haze");
    if (gradient.chrome > 0.38) space.push("clear-air");
    if (parts.voidness > 0.52) space.push("void-room");
    if (!space.length) space.push("room-safe");

    const structure = [packetSectionName(activePads)];
    if (UCM.auto.enabled) structure.push("automix");
    if (albumArcActive()) structure.push("album-arc");
    if (HazamaBridgeState.loaded) structure.push("hazama-follow");
    if (MusicRadioBrainState.active) structure.push(`radio-${MusicRadioBrainState.active}`);

    const gesture = activePads.length ? activePads.map((name) => `pad-${name}`) : ["listen"];
    if (dominantKit) gesture.push(`kit-${dominantKit.replace(/Kit$/, "")}`);

    return {
      timbre: dedupePacketLabels(timbre),
      rhythm: dedupePacketLabels(rhythm),
      space: dedupePacketLabels(space),
      structure: dedupePacketLabels(structure),
      gesture: dedupePacketLabels(gesture),
      safety: ["metadata-only", "human-review-required", "no-audio", "no-samples", "no-lyrics"]
    };
  }

  function makeMusicSessionPacketFileName(sessionId) {
    return `${sessionId || makeMusicSessionId()}.json`;
  }

  function hazamaFmFlavorPacketState() {
    if (typeof window === "undefined" || !window.GenreFlavor) return null;
    let state = null;
    try {
      state = window.GenreFlavor.state;
    } catch (error) {
      return {
        available: true,
        active: false,
        genre: null,
        source: null,
        scheduled: 0,
        role: "state unavailable",
        edge: "Hazama FM flavor layer could not be read",
        feedback_hint: "retry after FM start",
        integration_mode: "metadata-only",
        review_only: true
      };
    }
    if (!state || typeof state !== "object") return null;
    const scheduled = Number(state.scheduled);
    const engineMix = hazamaFmEngineMix();
    let listeningTrace = null;
    try {
      const traceApi = window.HazamaFmListeningTrace;
      if (traceApi && typeof traceApi.snapshot === "function") {
        listeningTrace = traceApi.snapshot();
      }
    } catch (error) {
      listeningTrace = null;
    }
    let conversation = null;
    try {
      conversation = hazamaFmConversationPacketState(window.HazamaFlavorState?.conversation);
    } catch (error) {
      conversation = null;
    }
    const draftState = {
      available: true,
      active: !!state.started,
      genre: typeof state.genre === "string" ? state.genre : null,
      source: typeof state.source === "string" ? state.source : null,
      scheduled: Number.isFinite(scheduled) ? scheduled : 0,
      role: typeof state.role === "string" ? state.role : null,
      edge: typeof state.edge === "string" ? state.edge : null,
      feedback_hint: typeof state.feedback === "string" ? state.feedback : null,
      engine_translation: engineMix.genre
        ? {
            profile: engineMix.genre,
            engine_gain: engineMix.engineGain,
            pad_db: engineMix.padDb,
            glass_db: engineMix.glassDb,
            piano_memory_db: engineMix.pianoMemoryDb,
            reverb_wet: engineMix.reverbWet,
            delay_wet: engineMix.delayWet
        }
        : null,
      listening_trace: listeningTrace,
      conversation,
      integration_mode: "metadata-only",
      review_only: true
    };
    draftState.review_cue = hazamaFmReviewCue(draftState);
    return draftState;
  }

  function hazamaFmConversationPacketState(conversation) {
    if (!conversation || typeof conversation !== "object") return null;
    const role = String(conversation.role || "");
    const motif = String(conversation.motif || "");
    const allowedRoles = new Set([
      "bass-call",
      "comp-answer",
      "drum-comment",
      "space",
      "lead-call",
      "bass-answer",
      "comp-lift",
      "recap"
    ]);
    const allowedMotifs = new Set(["up-third", "fall-fourth", "neighbor", "octave-skip"]);
    if (!allowedRoles.has(role)) return null;
    return {
      version: Number(conversation.version) || 1,
      bar: Math.max(0, Math.round(Number(conversation.bar) || 0)),
      role,
      motif: allowedMotifs.has(motif) ? motif : "neighbor",
      transform: String(conversation.transform || "as-is").slice(0, 32),
      densityBias: packetUnit(conversation.densityBias),
      restGate: packetUnit(conversation.restGate),
      metadata_only: true,
      review_only: true
    };
  }

  function buildMusicSessionPacket(options = {}) {
    const createdAt = options.createdAt instanceof Date ? options.createdAt : new Date();
    const parts = currentGradientParts();
    const gradient = {
      haze: packetUnit(GradientState.haze),
      memory: packetUnit(GradientState.memory),
      micro: packetUnit(GradientState.micro),
      ghost: packetUnit(GradientState.ghost),
      chrome: packetUnit(GradientState.chrome),
      organic: packetUnit(GradientState.organic)
    };
    const kits = genreTimbreKitRuntimeState();
    const activePads = activePerformancePadNames();
    const activePad = activePads[0] || null;
    const density = packetUnit(parts.energy * 0.3 + parts.resource * 0.28 + parts.creation * 0.18 + gradient.micro * 0.14 + kits.technoKit * 0.1);
    const pressure = packetUnit(parts.body * 0.26 + parts.energy * 0.24 + parts.resource * 0.16 + gradient.ghost * 0.16 + kits.pressureKit * 0.16 - parts.voidness * 0.12);
    const section = packetSectionName(activePads);
    const namimaCalm = packetUnit(parts.circle * 0.3 + parts.observer * 0.28 + parts.voidness * 0.18 + gradient.haze * 0.14 + kits.spaceKit * 0.1);
    const chillMemory = packetUnit(gradient.memory * 0.28 + gradient.haze * 0.18 + parts.circle * 0.14 + parts.observer * 0.14 + kits.ambientKit * 0.12 + kits.spaceKit * 0.08);
    const chillTouch = packetUnit(0.14 + parts.energy * 0.24 + gradient.micro * 0.12 + kits.idmKit * 0.08 + parts.wave * 0.06 - parts.voidness * 0.12);
    const chillPhrase = packetUnit(0.12 + parts.creation * 0.24 + gradient.memory * 0.18 + gradient.ghost * 0.08 + RdjGrowthState.tender * 0.06);
    const chillRoom = packetUnit(0.52 + parts.voidness * 0.18 + parts.observer * 0.14 + gradient.haze * 0.1 + kits.spaceKit * 0.1 - parts.energy * 0.12);
    const chillDrumSupport = packetUnit(density * 0.42 + gradient.ghost * 0.18 + kits.idmKit * 0.12 + kits.technoKit * 0.08 - parts.voidness * 0.18);
    const chillSoftMelody = gradient.memory > 0.42 && parts.creation > 0.32 && parts.voidness < 0.58 && !activePads.includes("void");
    const chillReference = activePads.includes("drift") || (gradient.memory > 0.58 && parts.creation < 0.34)
      ? "soft-solo-drift"
      : gradient.chrome > 0.46 || activePads.includes("void")
        ? "rainy-lofi-room"
        : chillSoftMelody
          ? "soft-melody-piano"
          : "piano-jazz-chill";
    const selfReview = musicSelfReviewRuntimeState();
    const radioBrain = musicRadioBrainPacketState();
    const hazamaFm = hazamaFmFlavorPacketState();
    const hazamaFmCue = hazamaFm?.review_cue || hazamaFmReviewCue(hazamaFm);
    const stackRouting = musicStackRoutingRecommendation({
      selfReview,
      parts,
      gradient,
      kits,
      activePads,
      density,
      pressure,
      namimaCalm,
      chillMemory,
      chillDrumSupport,
      hazamaFm,
      hazamaFmReviewCue: hazamaFmCue
    });
    if (hazamaFm && !hazamaFm.review_cue) hazamaFm.review_cue = hazamaFmCue;
    const hazamaTrace = hazamaFm?.listening_trace || null;
    const hazamaGenre = hazamaTrace?.current_genre || hazamaFm?.genre || "";
    const hazamaEnergy = hazamaTrace?.current_energy || "";
    const hazamaBpm = Number(hazamaTrace?.bpm);
    const hazamaDwellMs = Number(hazamaTrace?.dwell_ms_by_genre?.[hazamaGenre]);
    const hazamaDrumBpm = Number.isFinite(hazamaBpm)
      ? Math.round(clampValue(hazamaBpm, 54, 190))
      : null;

    return {
      version: 1,
      source_repo: "Music",
      created_at: createdAt.toISOString(),
      session_id: options.sessionId || makeMusicSessionId(createdAt),
      mode: packetModeName(),
      reference_gradient: {
        weights: gradient
      },
      ucm_state: {
        energy: packetPercent(UCM_CUR.energy),
        wave: packetPercent(UCM_CUR.wave),
        mind: packetPercent(UCM_CUR.mind),
        creation: packetPercent(UCM_CUR.creation),
        void: packetPercent(UCM_CUR.void),
        circle: packetPercent(UCM_CUR.circle),
        body: packetPercent(UCM_CUR.body),
        resource: packetPercent(UCM_CUR.resource),
        observer: packetPercent(UCM_CUR.observer)
      },
      output_state: {
        output_level: packetPercent(OutputState.level),
        recorder_duration: recorderDurationSeconds(),
        review_boost: packetUnit((MixGovernorState.eventLoad || 0) * 0.65 + (ProducerHabitState.curiosity || 0) * 0.35)
      },
      performance_state: {
        active_pad: activePad,
        recent_pads: activePads,
        manual_influence_active: isManualPerformanceInfluenceActive(),
        automix_enabled: !!UCM.auto.enabled,
        mic_follow: micFollowPacketState(),
        radio_brain: radioBrain,
        hazama_fm: hazamaFm
      },
      music_intent: packetIntentArrays(activePads, gradient, kits, parts),
      routing: {
        drum_floor: {
          enabled: density > 0.18 && !activePads.includes("void"),
          groove_intent: {
            style: kits.technoKit > 0.42 ? "dry_grid" : kits.idmKit > 0.34 ? "broken_organic" : kits.pressureKit > 0.34 ? "ghost_pressure" : "soft_pocket",
            ghost_notes: gradient.ghost,
            micro: gradient.micro,
            articulation: activePads.includes("punch") ? "body_snap" : activePads.includes("repeat") ? "dry_repeat" : "human_pocket",
            review_only: true
          },
          density,
          pressure,
          section,
          bpm: hazamaDrumBpm,
          hazama_fm: hazamaFm
            ? {
                genre: hazamaGenre || null,
                energy: hazamaEnergy || null,
                bpm: hazamaDrumBpm,
                dwell_ms: Number.isFinite(hazamaDwellMs) ? Math.round(hazamaDwellMs) : 0,
                review_cue: hazamaFmCue?.short_label || null,
                metadata_only: true
              }
            : null,
          review_reason: stackRouting.destination === "drum_floor" ? stackRouting.reason : "必要な時だけ手動previewするdrum候補。",
          review_only: true
        },
        namima: {
          enabled: namimaCalm > 0.16,
          mood_intent: {
            mood: parts.voidness > 0.54 ? "transparent_void" : gradient.haze > 0.42 ? "garden_haze" : "calm_water",
            safe_energy_cap: packetUnit(0.38 + (1 - parts.energy) * 0.24 + parts.observer * 0.14),
            air: packetUnit(gradient.chrome * 0.36 + kits.spaceKit * 0.36 + parts.observer * 0.28),
            review_only: true
          },
          family_safe: true,
          water_motion: packetUnit(parts.wave * 0.36 + parts.circle * 0.24 + gradient.organic * 0.2 + namimaCalm * 0.2),
          brightness: packetUnit(0.24 + gradient.chrome * 0.28 + parts.observer * 0.2 + (1 - pressure) * 0.14),
          review_reason: stackRouting.destination === "namima" ? stackRouting.reason : "空気と水面に逃がせるsafe mood候補。",
          review_only: true
        },
        chill: {
          enabled: chillMemory > 0.14,
          trio_intent: {
            reference_id: chillReference,
            touch: chillTouch,
            phrase: chillPhrase,
            room: chillRoom,
            flow_on: true,
            bass_on: true,
            drums_suggested: chillDrumSupport > 0.32 && !activePads.includes("void"),
            pressure_target: pressure > 0.58 || parts.energy > 0.62 ? "safe" : "warm",
            review_only: true
          },
          piano_memory: chillMemory,
          bass_activity: packetUnit(chillPhrase * 0.36 + chillTouch * 0.2 + (1 - chillRoom) * 0.14),
          drum_support: chillDrumSupport,
          section,
          review_reason: stackRouting.destination === "chill" ? stackRouting.reason : "ピアノ/ベース/trioで聴けるsoft候補。",
          review_only: true
        },
        openclaw: {
          enabled: true,
          promotion_status: "draft",
          human_review_required: true,
          next_action: stackRouting,
          self_review: {
            densityRisk: selfReview.densityRisk,
            lowEndRisk: selfReview.lowEndRisk,
            brightnessRisk: selfReview.brightnessRisk,
            restraintScore: selfReview.restraintScore,
            referenceFit: selfReview.referenceFit,
            nextSuggestion: selfReview.nextSuggestion
          },
          review_only: true
        }
      },
      safety: {
        stores_audio: false,
        stores_samples: false,
        stores_lyrics: false,
        metadata_only: true,
        human_review_required: true
      }
    };
  }


  const MUSIC_STACK_PACKET_STORAGE_KEY = "qb:music-stack:latest-packet:v1";
  const MUSIC_STACK_CHANNEL_NAME = "qb:music-stack:v1";
  const MUSIC_ORCHESTRA_PACKET_STORAGE_KEY = "qb:music-stack:latest-orchestra-packet:v1";
  const MUSIC_ORCHESTRA_CHANNEL_NAME = "qb:music-stack:orchestra:v1";

  function makeMusicStackPacketPayload(packet) {
    return {
      schema: "qb.music-stack.packet-sync.v1",
      type: "music-session-packet",
      source: "Music",
      sent_at: new Date().toISOString(),
      packet
    };
  }

  function routeTargetFromSessionPacket(name, sessionPacket) {
    const routing = sessionPacket?.routing || {};
    const route = routing[name] || {};
    const openclawAction = routing.openclaw?.next_action || {};
    const targetDestination = openclawAction.destination || "";
    const selected = targetDestination === name;
    const packetType = {
      drum_floor: "groove-request-packet",
      namima: "mood-request-packet",
      chill: "harvest-sidecar",
      openclaw: "promotion-request"
    }[name] || "review-result";
    const fallbackIntent = {
      drum_floor: "review groove density, pocket, articulation, and phrase hints",
      namima: "review safe ambient mood, ripple density, and public-friendly air",
      chill: "review quiet piano, trio pacing, room, and light-surface intent",
      openclaw: "track mission, review, promotion status, and rollback notes"
    }[name] || "review metadata";
    const routeReason = route.review_reason || openclawAction.reason || fallbackIntent;
    const nextAction = selected
      ? (openclawAction.action || routeReason)
      : routeReason;

    return {
      enabled: name === "openclaw" ? true : !!route.enabled,
      intent: routeReason,
      packet_type: packetType,
      next_action: nextAction,
      human_review_required: true
    };
  }

  function buildMusicOrchestraPacket(options = {}) {
    const sessionPacket = options.sessionPacket || buildMusicSessionPacket(options);
    const nextAction = sessionPacket.routing?.openclaw?.next_action || {};
    const allowedTargets = ["Music", "drum-floor", "namima", "chill", "OpenClaw"];
    const targetRepo = allowedTargets.includes(nextAction.target_repo)
      ? nextAction.target_repo
      : promotionTargetFromDestination(nextAction.destination);
    return {
      version: "music-orchestra-packet.v1",
      source_repo: "Music",
      session_id: sessionPacket.session_id,
      created_at: sessionPacket.created_at,
      music_state: {
        session_packet_version: sessionPacket.version,
        mode: sessionPacket.mode,
        ucm_state: sessionPacket.ucm_state,
        music_intent: sessionPacket.music_intent,
        performance_summary: {
          active_pad: sessionPacket.performance_state?.active_pad || null,
          recent_pads: sessionPacket.performance_state?.recent_pads || [],
          automix_enabled: !!sessionPacket.performance_state?.automix_enabled,
          radio_program: sessionPacket.performance_state?.radio_brain?.program || null,
          hazama_fm_genre: sessionPacket.performance_state?.hazama_fm?.genre || null
        }
      },
      reference_gradient: sessionPacket.reference_gradient?.weights || {},
      mic_follow: sessionPacket.performance_state?.mic_follow || {
        enabled: false,
        status: "unavailable",
        metadata_only: true,
        stores_audio: false
      },
      output: sessionPacket.output_state || {},
      routing: {
        drum_floor: routeTargetFromSessionPacket("drum_floor", sessionPacket),
        namima: routeTargetFromSessionPacket("namima", sessionPacket),
        chill: routeTargetFromSessionPacket("chill", sessionPacket),
        openclaw: routeTargetFromSessionPacket("openclaw", sessionPacket)
      },
      safety: {
        metadata_only: true,
        no_audio: true,
        no_samples: true,
        no_lyrics: true,
        no_workflows: true,
        human_review_required: true,
        notes: "Orchestra packet is a routing/review wrapper around MusicSessionPacket; it does not contain audio, samples, lyrics, raw mic buffers, or automatic promotion authority."
      },
      promotion: {
        status: "draft",
        target_repo: targetRepo,
        reviewer_note: nextAction.reason || "Human listening/review required before repo-specific promotion.",
        rollback: "Ignore this packet or create a new SYNC packet; no runtime state is automatically promoted."
      }
    };
  }


  function makeMusicOrchestraPacketPayload(packet) {
    return {
      schema: "qb.music-stack.orchestra-packet-sync.v1",
      type: "music-orchestra-packet",
      source: "Music",
      sent_at: new Date().toISOString(),
      packet
    };
  }

  function publishMusicStackPacketPayload(payload) {
    if (typeof window === "undefined" || !payload?.packet) return { stored: false, broadcast: false };
    let stored = false;
    let broadcast = false;
    try {
      window.localStorage?.setItem(MUSIC_STACK_PACKET_STORAGE_KEY, JSON.stringify(payload));
      stored = true;
    } catch (error) {
      console.warn("[Music] stack sync localStorage failed:", error);
    }
    try {
      if (typeof window.BroadcastChannel === "function") {
        const channel = new window.BroadcastChannel(MUSIC_STACK_CHANNEL_NAME);
        channel.postMessage(payload);
        channel.close();
        broadcast = true;
      }
    } catch (error) {
      console.warn("[Music] stack sync broadcast failed:", error);
    }
    try {
      window.dispatchEvent(new CustomEvent("music-stack-packet-sync", { detail: payload }));
    } catch (error) {}
    return { stored, broadcast };
  }

  function publishMusicOrchestraPacketPayload(payload) {
    if (typeof window === "undefined" || !payload?.packet) return { stored: false, broadcast: false };
    let stored = false;
    let broadcast = false;
    try {
      window.localStorage?.setItem(MUSIC_ORCHESTRA_PACKET_STORAGE_KEY, JSON.stringify(payload));
      stored = true;
    } catch (error) {
      console.warn("[Music] orchestra packet localStorage failed:", error);
    }
    try {
      if (typeof window.BroadcastChannel === "function") {
        const channel = new window.BroadcastChannel(MUSIC_ORCHESTRA_CHANNEL_NAME);
        channel.postMessage(payload);
        channel.close();
        broadcast = true;
      }
    } catch (error) {
      console.warn("[Music] orchestra packet broadcast failed:", error);
    }
    try {
      window.dispatchEvent(new CustomEvent("music-orchestra-packet-sync", { detail: payload }));
    } catch (error) {}
    return { stored, broadcast };
  }

  function syncMusicSessionPacket(options = {}) {
    const packet = options.packet || buildMusicSessionPacket();
    const payload = makeMusicStackPacketPayload(packet);
    const orchestraPacket = buildMusicOrchestraPacket({ ...options, sessionPacket: packet });
    const orchestraPayload = makeMusicOrchestraPacketPayload(orchestraPacket);
    if (typeof window !== "undefined") {
      window.MusicSessionPacket.last = packet;
      window.MusicSessionPacket.lastSync = payload;
      if (window.MusicOrchestraPacket) {
        window.MusicOrchestraPacket.last = orchestraPacket;
        window.MusicOrchestraPacket.lastSync = orchestraPayload;
      }
    }
    const result = publishMusicStackPacketPayload(payload);
    publishMusicOrchestraPacketPayload(orchestraPayload);
    const route = packet.routing?.openclaw?.next_action;
    const routeLabel = route?.label || route?.destination;
    setRecorderStatus(result.stored || result.broadcast
      ? `SYNC完了${routeLabel ? ` -> ${routeLabel}` : ""}`
      : "SYNCできませんでした");
    updateMusicStackSyncHelp(route, result);
    return {
      ...result,
      payload,
      orchestraPayload
    };
  }


  function downloadMusicSessionPacket() {
    const packet = buildMusicSessionPacket();
    if (typeof window !== "undefined") {
      window.MusicSessionPacket.last = packet;
    }
    if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") return packet;

    const json = `${JSON.stringify(packet, null, 2)}\n`;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = makeMusicSessionPacketFileName(packet.session_id);
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (error) {}
    }, 60000);
    setRecorderStatus("Packet JSON downloaded");
    return packet;
  }

  function downloadMusicOrchestraPacket() {
    const packet = buildMusicOrchestraPacket();
    if (typeof window !== "undefined" && window.MusicOrchestraPacket) {
      window.MusicOrchestraPacket.last = packet;
    }
    if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") return packet;

    const json = `${JSON.stringify(packet, null, 2)}\n`;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = makeMusicSessionPacketFileName(`orchestra-${packet.session_id}`);
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (error) {}
    }, 60000);
    setRecorderStatus("Orchestra packet JSON downloaded");
    return packet;
  }

  function syncMusicOrchestraPacket(options = {}) {
    const packet = options.packet || buildMusicOrchestraPacket(options);
    const payload = makeMusicOrchestraPacketPayload(packet);
    if (typeof window !== "undefined" && window.MusicOrchestraPacket) {
      window.MusicOrchestraPacket.last = packet;
      window.MusicOrchestraPacket.lastSync = payload;
    }
    const result = publishMusicOrchestraPacketPayload(payload);
    return {
      ...result,
      payload
    };
  }


  if (typeof window !== "undefined") {
    window.MusicPacketKit = {
      packetUnit,
      buildMusicSessionPacket,
      syncMusicSessionPacket,
      downloadMusicSessionPacket,
      buildMusicOrchestraPacket,
      syncMusicOrchestraPacket,
      downloadMusicOrchestraPacket,
      MUSIC_STACK_PACKET_STORAGE_KEY,
      MUSIC_STACK_CHANNEL_NAME,
      MUSIC_ORCHESTRA_PACKET_STORAGE_KEY,
      MUSIC_ORCHESTRA_CHANNEL_NAME
    };
  }
})();
