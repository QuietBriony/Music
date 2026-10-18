// One streaming media element; lightweight mastering and matched original A/B.
import { createPremixMastering } from "./premix-mastering.mjs?v=1";
export { PREMIX_GAIN_DB, PREMIX_GAIN } from "./premix-mastering.mjs?v=1";

export function premixMediaUrl(path, pageHref = globalThis.location?.href || "http://localhost/") {
  const host = new URL(pageHref).hostname;
  // Pages currently returns full 200 responses to Range. Reuse our existing
  // GitHub Pages copy, whose 206 + CORS responses allow seeking on phones.
  return host === "music-stack.pages.dev" || host.endsWith(".music-stack.pages.dev")
    ? new URL(path, "https://quietbriony.github.io/Music/").href : path;
}

export function createPremixPlayer({ media, getContext, onChange = () => {} }) {
  let context, source, output, mastering, song, token = 0, volume = 1, graphReady = false;
  let profile = "live";
  let phase = "idle", error = "", offset = 0, loaded = false;
  media.preload = "none";
  media.crossOrigin = "anonymous"; // Set before src so cross-host Web Audio is not muted.
  const snapshot = () => ({ songId: song?.id, phase, error, volume, profile,
    position: loaded && media.readyState > 0 ? media.currentTime : offset,
    duration: loaded && Number.isFinite(media.duration) ? media.duration : song?.original_mix.duration_s || 0 });
  const notify = () => onChange(snapshot());
  function gain(value) {
    if (!output) return;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setValueAtTime(value, context.currentTime);
  }
  function pause() {
    ++token;
    gain(0);
    media.pause();
    phase = "idle";
    notify();
  }
  function seek(second) {
    const value = Number(second);
    if (!Number.isFinite(value)) return;
    offset = Math.max(0, Math.min(snapshot().duration, value));
    if (loaded && media.readyState > 0) media.currentTime = offset;
    notify();
  }
  function stop() { pause(); seek(0); }
  function select(next) {
    if (!next?.id || !/^presets\/tabasco-premix\/[a-z-]+\.m4a$/.test(next.original_mix?.url || "")) {
      throw new Error("原音の登録情報が不正です。");
    }
    pause();
    loaded = false; offset = 0; error = ""; song = next;
    mastering?.configure(song.id, profile, false);
    media.removeAttribute("src"); media.load();
    notify();
  }
  async function play() {
    if (!song || phase === "loading" || phase === "playing") return;
    const run = ++token;
    phase = "loading"; error = ""; notify();
    try {
      if (!context) {
        context = getContext();
        source = context.createMediaElementSource(media);
        output = context.createGain(); output.gain.value = 0;
        mastering = createPremixMastering(context, source, output, { songId: song.id, profile });
        output.connect(context.destination);
        graphReady = true;
        context.addEventListener("statechange", () => {
          if (context.state !== "running" && phase === "playing") pause();
        });
      }
      if (!graphReady) throw new Error("音声出力を準備できません。ページを開き直してください。");
      if (!loaded) { loaded = true; media.src = premixMediaUrl(song.original_mix.url); }
      if (media.ended) seek(0);
      gain(volume);
      // Both calls remain inside the user's gesture, including iOS.
      const resume = context.resume();
      const playing = media.play();
      await Promise.all([resume, playing]);
      // A stale promise must neither restart a stopped track nor pause a newer one.
      if (run !== token) return;
      if (context.state !== "running") throw new Error("再生ボタンをもう一度押してください。");
      phase = "playing"; notify();
    } catch (cause) {
      if (run !== token) return;
      pause();
      error = cause?.message || "原音を読み込めませんでした。";
      phase = "error"; notify();
    }
  }
  media.addEventListener("loadedmetadata", () => { if (loaded) seek(offset); });
  media.addEventListener("timeupdate", notify);
  media.addEventListener("pause", () => {
    if (media.paused && phase === "playing") pause();
  });
  media.addEventListener("ended", () => { pause(); phase = "ended"; notify(); });
  media.addEventListener("error", () => {
    if (!loaded || !media.error) return;
    pause(); error = "仮ミックスを読み込めません。接続を確認して再生し直してください。";
    loaded = false; phase = "error"; notify();
  });
  function setVolume(value) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    volume = Math.max(0, Math.min(1, next));
    gain(phase === "playing" || phase === "loading" ? volume : 0);
    notify();
  }
  function setProfile(value) {
    profile = value === "original" ? "original" : "live";
    mastering?.configure(song?.id, profile);
    notify();
  }
  return { play, pause, stop, seek, select, setVolume, setProfile, snapshot };
}
