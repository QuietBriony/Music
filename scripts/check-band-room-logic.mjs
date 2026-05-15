import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("band-room.js", "utf8");
const bandsRegistry = JSON.parse(readFileSync("presets/bands.json", "utf8"));

const inertElement = () => ({
  addEventListener() {},
  appendChild() {},
  classList: { add() {}, remove() {}, toggle() {} },
  dataset: {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  remove() {},
  setAttribute() {},
  style: {},
  value: "",
  textContent: ""
});

const documentMock = {
  addEventListener() {},
  body: inertElement(),
  createElement() { return inertElement(); },
  documentElement: inertElement(),
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; }
};

const windowMock = {
  addEventListener() {},
  dispatchEvent() {},
  document: documentMock,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  Tone: {}
};

const sandbox = {
  clearInterval() {},
  clearTimeout() {},
  console,
  document: documentMock,
  localStorage: windowMock.localStorage,
  navigator: windowMock.navigator,
  requestAnimationFrame() { return 0; },
  cancelAnimationFrame() {},
  setInterval() { return 0; },
  setTimeout() { return 0; },
  window: windowMock
};
sandbox.globalThis = sandbox;

vm.runInNewContext(source, sandbox, { filename: "band-room.js" });

const chordRoot = windowMock.BandRoomTestHooks?.chordRoot;
assert.equal(typeof chordRoot, "function", "BandRoomTestHooks.chordRoot should be exposed");
assert.equal(chordRoot("C"), "C2");
assert.equal(chordRoot("G"), "G2");
assert.equal(chordRoot("Bbmaj7"), "A#2");
assert.equal(chordRoot("F#m7"), "F#2");
assert.equal(chordRoot("not-a-chord"), "G2");

const normalizedDrumFloorSection = windowMock.BandRoomTestHooks?.normalizedDrumFloorSection;
assert.equal(typeof normalizedDrumFloorSection, "function", "normalizedDrumFloorSection should be exposed");
assert.equal(normalizedDrumFloorSection("chant-a"), "chorus");
assert.equal(normalizedDrumFloorSection("bridge"), "bridge");
assert.equal(normalizedDrumFloorSection("outro"), "end");
assert.equal(normalizedDrumFloorSection("verse-1"), "verse");

const firstSongIdForBand = windowMock.BandRoomTestHooks?.firstSongIdForBand;
const adjacentSongIdInBand = windowMock.BandRoomTestHooks?.adjacentSongIdInBand;
assert.equal(typeof firstSongIdForBand, "function", "firstSongIdForBand should be exposed");
assert.equal(typeof adjacentSongIdInBand, "function", "adjacentSongIdInBand should be exposed");

const tabascoBand = {
  songs: [
    { id: "tabasco" },
    { id: "hey" },
    { id: "i-got-a-feeling" }
  ]
};
assert.equal(firstSongIdForBand(tabascoBand), "tabasco");
assert.equal(firstSongIdForBand({ songs: [] }), null);
assert.equal(adjacentSongIdInBand(tabascoBand, "tabasco", 1), "hey");
assert.equal(adjacentSongIdInBand(tabascoBand, "hey", -1), "tabasco");
assert.equal(adjacentSongIdInBand(tabascoBand, "i-got-a-feeling", 1), null);
assert.equal(adjacentSongIdInBand(tabascoBand, "missing", 1), null);

assert.match(source, /currentSongId:\s*"tabasco"/, "Band Room should reload to track 01");
assert.match(
  source,
  /new Tone\.Player\(\{\s*url,\s*autostart:\s*false,\s*fadeIn:\s*0\.15,\s*fadeOut:\s*0\.30,\s*loop:\s*false/,
  "Stem players should not loop the same song"
);
assert.match(source, /queueMicrotask/, "Auto-advance should not depend on requestAnimationFrame");
assert.match(source, /function fullSongDurationGuardSec\(\)/, "Band Room should guard album advance with full song duration");
assert.match(source, /function autoAdvanceDelayMsForFullSong\(\)/, "Band Room should delay auto-advance until the full stem/catalog duration has played");
assert.match(source, /songCatalogDurationSec\(\)/, "Band Room should read catalog song durations for album playback");
assert.match(source, /function audioClockSeconds\(\)/, "Band Room should use the AudioContext clock for playback elapsed");
assert.match(source, /playbackStartedAtAudioSec/, "Band Room should not auto-advance from wall-clock time while iOS audio is suspended");
assert.match(source, /if \(shouldDelayAutoAdvanceForFullSong\(\)\)/, "Band Room should re-check the full-song guard immediately before switching tracks");
assert.match(source, /state\.loadedStemDurationSec\s*=\s*loadedStemDurationSec\(\)/, "Band Room should measure loaded stem duration");
assert.match(
  source,
  /stopPlayback\(\{\s*keepBackgroundBridge:\s*true,\s*updateMedia:\s*false\s*\}\)/,
  "Auto-advance should keep the background media bridge alive"
);
assert.match(source, /function recoverPlaybackAfterSuspend\(/, "Band Room should recover playback after mobile suspend");
assert.match(source, /function resyncStemPlaybackToClock\(/, "Band Room should resync stems after background resume");
assert.match(source, /function scheduleBackgroundBridgeRearm\(/, "Band Room should rearm hidden audio bridge if it is lost");
assert.match(source, /function checkBackgroundBridgeHealth\(/, "Band Room should detect stale hidden audio bridge state");
assert.match(source, /audio\.paused \|\| audio\.ended \|\| !audio\.srcObject \|\| audio\.readyState === 0/, "Band Room bridge health should catch paused/ended/stale hidden audio");
assert.match(source, /return isAppleMobileDevice\(\);/, "Band Room should prefer the hidden media bridge on all iPhone browsers");
assert.match(source, /window\.addEventListener\("pageshow"/, "Band Room should recover playback on pageshow");
assert.match(source, /setHandler\("nexttrack"[\s\S]*selectAdjacentSong\(1\)/, "Media nexttrack should follow album flow");
assert.match(source, /setHandler\("previoustrack"[\s\S]*selectAdjacentSong\(-1\)/, "Media previoustrack should follow album flow");
assert.match(source, /let songSwitchSeq = 0/, "Song switches should have a generation guard");
assert.match(source, /loadSong\(songId, \{ switchSeq \}\)/, "Song switching should pass the generation guard into loadSong");
assert.match(source, /clearLoopRange\(\);\s*refreshLoopVisuals\(\);/, "Song switches should clear stale A/B loops");
assert.match(source, /const DRUM_FLOOR_URL = "https:\/\/quietbriony\.github\.io\/drum-floor\/"/, "Band Room should link to Drum Floor");
assert.match(source, /const MUSIC_STACK_PACKET_STORAGE_KEY = "qb:music-stack:latest-packet:v1"/, "Band Room should publish to the shared Music Stack packet key");
assert.match(source, /source_repo:\s*"Music"[\s\S]*mode:\s*"band_room"/, "Band Room drum-floor handoff should stay compatible with Music packet receivers");
assert.match(source, /destination:\s*"drum_floor"[\s\S]*manual_start_required:\s*true[\s\S]*metadata_only:\s*true/, "Drum Floor handoff should be metadata-only and human-gated");
assert.doesNotMatch(source, /stem_urls\s*:/, "Drum Floor handoff should not send stem/audio URLs");
assert.match(source, /function linkedGenreFromUrl\(\)/, "Band Room should read FM pattern query links");
assert.match(source, /pattern"\) \|\| params\.get\("genrePattern"\) \|\| params\.get\("brPattern"\)/, "Band Room should accept explicit FM pattern query params");
assert.match(source, /br-fm-suggestion-inject[\s\S]*loadGenrePattern\(genre\)/, "FM suggestion CTA should inject only on user action");
assert.match(source, /function linkedSongFromUrl\(\)/, "Band Room should read Drum Floor return song links");
assert.match(source, /params\.get\("from"\) !== "drum-floor"/, "Band Room song return should only apply from Drum Floor");
assert.match(source, /params\.get\("song"\) \|\| params\.get\("songId"\)/, "Band Room should accept Drum Floor song query params");
assert.match(source, /sourceSong\.band_id\) url\.searchParams\.set\("band"/, "Band Room should include band id in Drum Floor links");
assert.match(source, /const linkedSong = linkedSongFromUrl\(\)/, "Band Room boot should apply Drum Floor return song links");
assert.match(source, /lyrics_doc:\s*"docs\/tabasco-lyrics-final\.md"/, "Band Room fallback should use the final singable lyric sheet");

const tabascoLyricsDoc = bandsRegistry.bands?.tabasco?.lyrics_doc;
assert.equal(tabascoLyricsDoc, "docs/tabasco-lyrics-final.md", "Band Room should display one final Tabasco lyric sheet");
const finalLyrics = readFileSync(tabascoLyricsDoc, "utf8");
const escapeLyricTitle = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
["TABASCO", "Hey", "I got a feeling", "Under the Moon", "Electric Sheep", "Human Fly", "Sister"].forEach((title) => {
  assert.match(finalLyrics, new RegExp(`^##\\s+\\d+\\s+${escapeLyricTitle(title)}`, "m"), `Final lyrics should include ${title}`);
});
assert.doesNotMatch(finalLyrics, /v2\.1|v3|draft|cut-up|候補|template/i, "Final lyrics should not surface draft/candidate language");

const savePrefsBody = source.match(/function savePrefs\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(savePrefsBody, /songId\s*:/, "Saved prefs should not restore the last song");

const durationShortfalls = [];
Object.values(bandsRegistry.bands || {}).forEach((band) => {
  const pattern = band.drum_frames_pattern || "";
  (band.songs || []).forEach((song) => {
    const framePath = pattern.replace("{songid}", song.id);
    if (!framePath || !existsSync(framePath)) return;
    const frame = JSON.parse(readFileSync(framePath, "utf8"));
    const bpm = Number(frame.bpm || song.bpm || 117);
    const structureBars = (frame.structure || []).reduce((sum, section) => sum + (Number(section.bars) || 0), 0);
    const structureDuration = structureBars > 0 && bpm > 0 ? structureBars * (60 / bpm * 4) : 0;
    const catalogDuration = Number(song.duration_s) || 0;
    if (catalogDuration > structureDuration + 8) {
      durationShortfalls.push({
        song: song.id,
        catalogDuration,
        structureDuration: Math.round(structureDuration)
      });
    }
  });
});
assert.ok(durationShortfalls.length > 0, "Fixture should include songs whose structure is shorter than full audio");
assert.ok(durationShortfalls.some((item) => item.song === "hey"), "HEY should be covered by the full-song guard regression");

console.log("Band Room logic check passed");
