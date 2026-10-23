import { createPremixPlayer } from "./premix-player.mjs?v=3";

const original = document.documentElement.dataset.brSurface === "original";
const $ = (id) => document.getElementById(id);
function navigation(band, song, mode) {
  for (const a of document.querySelectorAll("#br-listening-mode a[data-mode]")) {
    const isOriginal = a.dataset.mode === "original";
    const useTabasco = isOriginal && band !== "tabasco";
    a.href = `band-room.html?band=${encodeURIComponent(useTabasco ? "tabasco" : band)}&song=${encodeURIComponent(useTabasco ? "human-fly" : song)}&mode=${a.dataset.mode}`;
    a.textContent = isOriginal && useTabasco ? "Tabascoのライブ原音" : a.dataset.label;
    if (a.dataset.mode === mode) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}
const query = new URLSearchParams(location.search);
navigation(query.get("band") || query.get("bandId") || "tabasco", query.get("song") || query.get("songId") || "human-fly", original ? "original" : query.get("mode") || "stems");
window.addEventListener("band-room:selection", ({ detail }) => navigation(detail.band, detail.song, detail.mode));

if (original) boot().catch(() => {
  $("br-premix-status").textContent = "曲一覧を読み込めませんでした。接続を確認してページを開き直してください。";
});

async function boot() {
  // New path also works under an old SW whose cached bands.json has no premixes.
  const response = await fetch("presets/tabasco-premix/provenance.json");
  if (!response.ok) throw new Error("catalog");
  const songs = (await response.json()).files.map((f) => ({
    id: f.song_id, title: f.title, track: f.track,
    original_mix: { url: f.path, duration_s: f.duration_s }
  }));
  if (songs.length !== 7) throw new Error("catalog");
  const select = $("br-premix-song"), play = $("br-premix-play"), seek = $("br-premix-seek"), volume = $("br-premix-volume");
  const media = $("br-premix-audio"), mastering = $("br-premix-mastering");
  const preferenceKey = "br.premix.mastering.v1";
  let context, player;
  const time = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  function render(state) {
    play.textContent = state.phase === "playing" ? "一時停止" : state.phase === "loading" ? "読み込みを中止" : "再生";
    seek.max = String(state.duration);
    if (document.activeElement !== seek) seek.value = String(state.position);
    $("br-premix-time").textContent = `${time(state.position)} / ${time(state.duration)}`;
    $("br-premix-volume-value").value = `${Math.round(state.volume * 100)}%`;
    mastering.value = state.profile;
    $("br-premix-status").textContent = state.error || ({ loading: "原音を準備しています…", playing: state.profile === "live" ? "ライブ補正で再生中" : "元の仮ミックスを再生中（比較用の音量調整のみ）", idle: "再生で原音を読み込みます。", ended: "曲が終わりました。" }[state.phase] || "");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = state.phase === "playing" ? "playing" : "paused";
      try { navigator.mediaSession.setPositionState({ duration: state.duration, playbackRate: 1, position: Math.min(state.duration, state.position) }); } catch {}
    }
  }
  player = createPremixPlayer({ media, onChange: render, getContext() {
    context ||= window.Tone?.getContext?.().rawContext || new (window.AudioContext || window.webkitAudioContext)();
    return context;
  } });
  for (const song of songs) select.add(new Option(`${song.track} · ${song.title}`, song.id));
  function choose(id) {
    const song = songs.find((s) => s.id === id) || songs[0];
    select.value = song.id; player.select(song);
    navigation("tabasco", song.id, "original");
    const url = new URL(location.href);
    url.searchParams.set("band", "tabasco"); url.searchParams.set("song", song.id); url.searchParams.set("mode", "original");
    history.replaceState(null, "", url);
    if ("mediaSession" in navigator && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: "Air Rock Connect Box", album: "Tabasco. LIVE · 仮ミックス" });
  }
  function toggle() {
    const phase = player.snapshot().phase;
    if (phase === "playing" || phase === "loading") player.pause();
    else player.play();
  }
  function adjacent(direction) {
    const index = songs.findIndex((s) => s.id === select.value);
    choose(songs[(index + direction + songs.length) % songs.length].id);
  }
  choose(query.get("song") || query.get("songId") || songs[0].id);
  try { player.setProfile(localStorage.getItem(preferenceKey)); } catch {}
  mastering.disabled = false;
  mastering.addEventListener("change", () => {
    player.setProfile(mastering.value);
    try { localStorage.setItem(preferenceKey, mastering.value); } catch {}
  });
  play.disabled = false; $("br-premix-stop").disabled = false; select.disabled = false;
  play.addEventListener("click", toggle);
  $("br-premix-stop").addEventListener("click", () => player.stop());
  select.addEventListener("change", () => choose(select.value));
  seek.addEventListener("input", () => player.seek(seek.value));
  volume.addEventListener("input", () => player.setVolume(Number(volume.value) / 100));
  $("br-premix-prev").addEventListener("click", () => adjacent(-1));
  $("br-premix-next").addEventListener("click", () => adjacent(1));
  window.addEventListener("pagehide", () => player.pause());
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.target.closest("input,textarea,select,button,a,[contenteditable]")) return;
    event.preventDefault(); toggle();
  });
  // OS transport controls use this stream. Track changes stay stopped.
  if ("mediaSession" in navigator) {
    for (const [name, fn] of Object.entries({ play: () => player.play(), pause: () => player.pause(), stop: () => player.stop(),
      previoustrack: () => adjacent(-1), nexttrack: () => adjacent(1),
      seekto: (d) => player.seek(d.seekTime), seekbackward: (d) => player.seek(player.snapshot().position - (d.seekOffset || 10)),
      seekforward: (d) => player.seek(player.snapshot().position + (d.seekOffset || 10)) })) {
      try { navigator.mediaSession.setActionHandler(name, fn); } catch {}
    }
  }
  $("br-subtitle").textContent = "Tabasco. LIVE · 分離前の仮ミックス";
  $("br-boot-status").textContent = "v431 · ライブ原音";
}
