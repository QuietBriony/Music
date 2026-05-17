/* Music-Stack Routing — extracted from engine.js (BL-008).
   Pure data + pure functions (route labels/URLs + Hazama FM review cue);
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

  window.MusicStackRoutes = {
    ROUTE_LABELS: MUSIC_STACK_ROUTE_LABELS,
    ROUTE_URLS: MUSIC_STACK_ROUTE_URLS,
    reviewCue: hazamaFmReviewCue
  };
})();
