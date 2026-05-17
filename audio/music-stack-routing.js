/* Music-Stack Routing — extracted from engine.js (BL-008).
   Pure data + pure functions (route labels/URLs + Hazama FM review cue + recommendation);
   no engine state, no Tone.js, no DOM. Published as window.MusicStackRoutes. */
(function () {
  // Self-contained copy of engine.js selfReviewNumber (clamp 0..1, round).
  function routeNumber(value, digits = 3) {
    const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
    const factor = 10 ** digits;
    return Math.round(Math.min(1, Math.max(0, safe)) * factor) / factor;
  }

  const MUSIC_STACK_ROUTE_LABELS = Object.freeze({
    music: "Musicで削る",
    chill: "chillで聴く",
    drum_floor: "drum-floorで再生",
    namima: "namimaで空気に逃がす",
    openclaw: "Deskで見る"
  });

  const MUSIC_STACK_ROUTE_URLS = Object.freeze({
    music: "https://quietbriony.github.io/Music/",
    chill: "https://quietbriony.github.io/chill/session.html",
    drum_floor: "https://quietbriony.github.io/drum-floor/",
    namima: "https://quietbriony.github.io/namima/",
    openclaw: "https://quietbriony.github.io/openclaw/"
  });

  function hazamaFmTraceDwell(trace, genre) {
    if (!trace || !genre) return 0;
    const dwell = Number(trace.dwell_ms_by_genre?.[genre]);
    return Number.isFinite(dwell) ? Math.max(0, dwell) : 0;
  }

  function hazamaFmDominantTraceGenre(hazamaFm) {
    const trace = hazamaFm?.listening_trace || {};
    const current = trace.current_genre || hazamaFm?.genre || "any";
    const currentDwell = hazamaFmTraceDwell(trace, current);
    if (currentDwell >= 1000) {
      return { genre: current, dwellMs: currentDwell };
    }
    let dominant = current;
    let dominantDwell = currentDwell;
    const dwellMap = trace.dwell_ms_by_genre || {};
    Object.keys(dwellMap).forEach((genre) => {
      const dwell = hazamaFmTraceDwell(trace, genre);
      if (dwell > dominantDwell) {
        dominant = genre;
        dominantDwell = dwell;
      }
    });
    return { genre: dominant, dwellMs: dominantDwell };
  }

  function hazamaFmReviewCue(hazamaFm) {
    if (!hazamaFm || !hazamaFm.active) return null;
    const trace = hazamaFm.listening_trace || null;
    const currentGenre = trace?.current_genre || hazamaFm.genre || "any";
    const dominant = hazamaFmDominantTraceGenre(hazamaFm);
    const dwellSeconds = Math.round((dominant.dwellMs || 0) / 1000);
    const switchCount = Number(trace?.switch_count) || 0;
    const bpm = Number(trace?.bpm);
    const highBpm = Number.isFinite(bpm) && bpm >= 124;
    const profile = {
      techno: {
        destination: "music",
        target_repo: "Music",
        short_label: "techno balance",
        next_task: highBpm ? "techno-acid-kick-ratchet-listening-pass" : "techno-acid-kick-hat-listening-pass",
        reason: highBpm
          ? "FM techno is in high-BPM review range; check kick/body, acid byoing, sparse hat, and IDM ratchets before another sound patch."
          : "FM techno was saved; check kick/body, acid byoing, and sparse hat before routing groove ideas outward.",
        action: "Musicのfm.htmlでtechnoをもう一度聴き、違和感があればMusic側の小さな音色/密度PRにする。",
        cluster_reference: "drum-floor"
      },
      piano: {
        destination: "chill",
        target_repo: "chill",
        short_label: "piano foreground",
        next_task: "piano-foreground-chill-reference-listening-pass",
        reason: "FM piano was saved; check whether dry piano stays foreground and whether the quiet/trio direction belongs in chill.",
        action: "chill sessionのquiet piano/trio方向と比べ、Music側に残す成分とchillへ寄せる成分を分ける。",
        cluster_reference: "Music"
      },
      ambient: {
        destination: "namima",
        target_repo: "namima",
        short_label: "safe ambient",
        next_task: "namima-safe-ripple-reference-check",
        reason: "FM ambient was saved; check whether the calm water/garden identity should stay namima-specific.",
        action: "namimaを開いてsafe ambientの空気と比べ、Music側のambient washが濃すぎないか確認する。",
        cluster_reference: "Music"
      },
      lofi: {
        destination: "chill",
        target_repo: "chill",
        short_label: "lofi memory",
        next_task: "lofi-tape-memory-restraint-check",
        reason: "FM lofi was saved; check whether crackle and memory should remain a restrained listening layer.",
        action: "Musicでlofiを聴き直し、chill側のlong-form listeningへ渡せる記憶/余白だけを候補化する。",
        cluster_reference: "Music"
      },
      jazz: {
        destination: "chill",
        target_repo: "chill",
        short_label: "jazz pocket",
        next_task: "jazz-brush-walking-bass-pocket-check",
        reason: "FM jazz was saved; check brush/walking-bass feel before deciding whether chill or drum-floor owns the next pass.",
        action: "jazzを聴いて、人間的なpocketはchill、rhythm grammarはdrum-floorとして分けてメモする。",
        cluster_reference: "drum-floor"
      },
      funk: {
        destination: "drum_floor",
        target_repo: "drum-floor",
        short_label: "funk pocket",
        next_task: "funk-clavi-drum-floor-pocket-check",
        reason: "FM funk was saved; check syncopation and body pocket against drum-floor rather than turning Music into every groove.",
        action: "drum-floorでbody pocketを確認し、Music側はclavi/EP色の必要量だけを小さく調整する。",
        cluster_reference: "Music"
      },
      any: {
        destination: "music",
        target_repo: "Music",
        short_label: "core arc",
        next_task: "core-radio-arc-listening-pass",
        reason: "FM any was saved; this is mostly Music Core Rig/radio-brain review rather than a cluster handoff.",
        action: "Musicでlong-form arcを聴き、genre pillではなくCore Rig側の密度/余白を確認する。",
        cluster_reference: "openclaw"
      }
    }[dominant.genre] || null;
    if (!profile) return null;
    return {
      schema: "hazama-fm-review-cue.v1",
      active_genre: currentGenre,
      dominant_genre: dominant.genre,
      dwell_ms: Math.round(dominant.dwellMs || 0),
      dwell_seconds: dwellSeconds,
      switch_count: switchCount,
      destination: profile.destination,
      target_repo: profile.target_repo,
      label: MUSIC_STACK_ROUTE_LABELS[profile.destination] || profile.destination,
      short_label: profile.short_label,
      next_task: profile.next_task,
      reason: profile.reason,
      action: profile.action,
      cluster_reference: profile.cluster_reference,
      confidence: routeNumber(Math.min(0.92, 0.46 + Math.min(dwellSeconds, 90) / 180 + Math.min(switchCount, 4) * 0.03), 2),
      metadata_only: true,
      human_review_required: true
    };
  }

  function routingRecommendation(input = {}) {
    const review = input.selfReview || {};
    const parts = input.parts || {};
    const gradient = input.gradient || {};
    const kits = input.kits || {};
    const activePads = input.activePads || [];
    const fmCue = input.hazamaFmReviewCue || hazamaFmReviewCue(input.hazamaFm);
    const producerHabitCuriosity = input.producerHabitCuriosity || 0;
    const density = routeNumber(input.density ?? (parts.energy * 0.3 + parts.resource * 0.28 + parts.creation * 0.18 + gradient.micro * 0.14 + kits.technoKit * 0.1));
    const pressure = routeNumber(input.pressure ?? (parts.body * 0.26 + parts.energy * 0.24 + parts.resource * 0.16 + gradient.ghost * 0.16 + kits.pressureKit * 0.16 - parts.voidness * 0.12));
    const namimaCalm = routeNumber(input.namimaCalm ?? (parts.circle * 0.3 + parts.observer * 0.28 + parts.voidness * 0.18 + gradient.haze * 0.14 + kits.spaceKit * 0.1));
    const chillMemory = routeNumber(input.chillMemory ?? (gradient.memory * 0.28 + gradient.haze * 0.18 + parts.circle * 0.14 + parts.observer * 0.14 + kits.ambientKit * 0.12 + kits.spaceKit * 0.08));
    const chillDrumSupport = routeNumber(input.chillDrumSupport ?? (density * 0.42 + gradient.ghost * 0.18 + kits.idmKit * 0.12 + kits.technoKit * 0.08 - parts.voidness * 0.18));

    const scores = {
      music: routeNumber(review.densityRisk * 0.34 + review.lowEndRisk * 0.28 + review.brightnessRisk * 0.22 + Math.max(0, 1 - review.restraintScore) * 0.08),
      chill: routeNumber(chillMemory * 0.42 + gradient.memory * 0.18 + kits.ambientKit * 0.12 + parts.circle * 0.1 + Math.max(0, 1 - review.brightnessRisk) * 0.08),
      drum_floor: routeNumber(density * 0.36 + chillDrumSupport * 0.16 + kits.technoKit * 0.16 + kits.idmKit * 0.12 + gradient.ghost * 0.1 - review.lowEndRisk * 0.16 - parts.voidness * 0.08),
      namima: routeNumber(namimaCalm * 0.44 + parts.voidness * 0.16 + gradient.haze * 0.14 + kits.spaceKit * 0.16 + Math.max(0, 1 - review.densityRisk) * 0.05),
      openclaw: routeNumber(Math.max(0, 1 - review.referenceFit) * 0.26 + producerHabitCuriosity * 0.12 + Math.max(review.densityRisk, review.lowEndRisk, review.brightnessRisk) * 0.08)
    };

    let destination = "chill";
    let reason = "ピアノ/ベース/trioで質感を確認する段階。";
    let action = "chill sessionを開いてSTART。DRUMSは必要な時だけ押す。";

    if (review.lowEndRisk > 0.72 || review.densityRisk > 0.78 || review.brightnessRisk > 0.8) {
      destination = "music";
      reason = review.lowEndRisk > 0.72
        ? "低域の圧が強いので、外へ流す前にMusic内で低域を削る。"
        : review.densityRisk > 0.78
          ? "密度が高いので、signature/cellより間を優先する。"
          : "明るい粒が強いので、transientとchromeを柔らかくする。";
      action = "Musicで聴き続け、VOID/DRIFTやOUTPUTを確認してからSYNCし直す。";
    } else if (activePads.includes("void") || kits.spaceKit > 0.54 || scores.namima > Math.max(scores.chill, scores.drum_floor) + 0.05) {
      destination = "namima";
      reason = "空気、水面、透明な尾として受ける方が良い状態。";
      action = "namimaを開いてTap to start。音は自動開始しない。";
    } else if (scores.drum_floor > 0.48 && density > 0.3 && pressure < 0.72 && parts.voidness < 0.58) {
      destination = "drum_floor";
      reason = "中高域のrhythm cueをdrum-floorで確認できる状態。";
      action = "drum-floorを開き、再生でpreviewする。";
    } else if (scores.openclaw > 0.48 && review.referenceFit < 0.38) {
      destination = "openclaw";
      reason = "制作判断がまだ散っているので、OpenClaw Desk (openclaw repo hub) で見立てを確認する。";
      action = "OpenClaw Deskを開き、Musicを磨く/各repoへ流すカードを見る。";
    }
    if (fmCue && fmCue.confidence >= 0.46) {
      destination = fmCue.destination;
      reason = fmCue.reason;
      action = fmCue.action;
    }

    return {
      schema: "music.stack-routing-review.v1",
      destination,
      label: MUSIC_STACK_ROUTE_LABELS[destination] || destination,
      reason,
      action,
      confidence: routeNumber(Math.max(scores[destination] || 0, 0.28), 2),
      scores: {
        music: routeNumber(scores.music, 2),
        chill: routeNumber(scores.chill, 2),
        drum_floor: routeNumber(scores.drum_floor, 2),
        namima: routeNumber(scores.namima, 2),
        openclaw: routeNumber(scores.openclaw, 2)
      },
      fm_review_cue: fmCue,
      manual_start_required: true,
      metadata_only: true
    };
  }

  window.MusicStackRoutes = {
    ROUTE_LABELS: MUSIC_STACK_ROUTE_LABELS,
    ROUTE_URLS: MUSIC_STACK_ROUTE_URLS,
    reviewCue: hazamaFmReviewCue,
    routingRecommendation
  };
})();
