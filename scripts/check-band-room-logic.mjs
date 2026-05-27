import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("band-room.js", "utf8");
const html = readFileSync("band-room.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const bandRoomManifest = JSON.parse(readFileSync("manifest-band-room.webmanifest", "utf8"));
const bandsRegistry = JSON.parse(readFileSync("presets/bands.json", "utf8"));
const aiRecreationRenderer = readFileSync("scripts/render-bandroom-ai-recreation.py", "utf8");
const aiRecreationDoc = readFileSync("docs/AI-RECREATION-EXPORT.md", "utf8");
const humanFly = bandsRegistry.bands?.tabasco?.songs?.find((s) => s.id === "human-fly");

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

const migratePrefsForCurrentMix = windowMock.BandRoomTestHooks?.migratePrefsForCurrentMix;
assert.equal(typeof migratePrefsForCurrentMix, "function", "migratePrefsForCurrentMix should be exposed");
assert.equal(windowMock.BandRoomTestHooks?.BANDROOM_APP_VERSION, "br-168-ai-recreation-stems", "Band Room should expose the current AI recreation stems version");
assert.equal(windowMock.BandRoomTestHooks?.BANDROOM_STORAGE_SCHEMA_VERSION, 2, "Band Room should expose the current storage schema version");
const migratedMixPrefs = migratePrefsForCurrentMix({
  sliders: {
    "br-vol-stem-drums": "92",
    "br-vol-bass": "72",
    "br-space-reverb": "22",
    "br-space-width": "41"
  }
});
assert.equal(migratedMixPrefs.sliders["br-vol-stem-drums"], "86", "Old default stem drums should migrate");
assert.equal(migratedMixPrefs.sliders["br-vol-bass"], "66", "Old default AI bass should migrate");
assert.equal(migratedMixPrefs.sliders["br-space-reverb"], "16", "Old default master reverb should migrate");
assert.equal(migratedMixPrefs.sliders["br-space-width"], "41", "Custom slider values should not migrate");
assert.equal(migratedMixPrefs.mixPrefsVersion, "v267-bass-electric", "Migrated prefs should record current mix version");

const verticalRoomPreset = source.match(/"vertical-room":\s*\{([^}]*)\}/)?.[1] || "";
assert.ok(verticalRoomPreset, "Band Room should include a vertical-room A/B mastering preset");
assert.match(verticalRoomPreset, /reverb:\s*30/, "vertical-room should push room depth without going ambient");
assert.match(verticalRoomPreset, /width:\s*60/, "vertical-room should keep the center stronger than the wide presets");
assert.match(verticalRoomPreset, /warmth:\s*12/, "vertical-room should add floor/body pressure");
assert.match(verticalRoomPreset, /loudness:\s*-1/, "vertical-room should not raise startup loudness");
assert.doesNotMatch(verticalRoomPreset, /synth_profile|chord_instrument|bass_instrument|guitar_instrument|voice_instrument|kit_source|guitar_on/, "vertical-room should be mastering-only and not alter AI instruments");
assert.match(html, /data-preset="vertical-room">vertical room<\/button>/, "Band Room should expose the vertical-room preset button");
assert.match(html, /band-room\.css\?v=br-81/, "Band Room HTML should reference the current CSS cache marker");
assert.match(html, /band-room\.js\?v=br-168/, "Band Room HTML should reference the current JS cache marker");
assert.match(sw, /hazama-fm-v285/, "Service worker should carry the current Band Room cache version");
assert.match(sw, /band-room\.css\?v=br-81/, "Service worker should precache the current Band Room CSS marker");
assert.match(sw, /band-room\.js\?v=br-168/, "Service worker should precache the current Band Room JS marker");
assert.match(source, /bandIds\.length === 1[\s\S]*br-album-plaque/, "Single-band registry should render a non-button album plaque");
assert.doesNotMatch(html, /@magenta\/music@1\.23\.1\/es6\/core\.js/, "Band Room should lazy-load Magenta only when AI fill is used");
assert.doesNotMatch(html, /@magenta\/music@1\.23\.1\/es6\/music_rnn\.js/, "Band Room should lazy-load Magenta RNN only when AI fill is used");
assert.doesNotMatch(html, /@tonejs\/midi@2\.0\.28\/build\/Midi\.min\.js/, "Band Room should lazy-load @tonejs/midi only when MIDI import is used");
assert.match(source, /async function preparePlaybackAssetsForCurrentMode\(/, "START should delegate to mode-specific asset preparation");
assert.match(source, /async function prepareSynthPlaybackAssets\(/, "AI playback assets should have a dedicated lazy prep path");
assert.match(source, /async function prepareStemPlaybackAssets\(/, "Original stems should have a dedicated prep path");
assert.match(source, /samplerAudioBufferCache/, "AI sampler preload should cache decoded buffers");
assert.match(source, /samplerDecodeConcurrency\(/, "AI sampler preload should use bounded decode concurrency");
assert.match(source, /Object\.keys\(preloaded\)\.length === 0\) return null;/, "Failed AI sampler fetches should fall back without blocking START");
assert.doesNotMatch(
  source,
  /if \(!drumKit\) drumKit = await buildKitForSource\(state\.kitSource\);[\s\S]*await loadStemsForSong\(state\.currentSongId\);/,
  "Original START should not build the broad AI sampler graph and then load stems"
);

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
  /new Tone\.Player\(\{\s*url:\s*candidate\.url,\s*autostart:\s*false,\s*fadeIn:\s*0\.15,\s*fadeOut:\s*0\.30,\s*loop:\s*false/,
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
assert.match(html, /id="br-song-timeline"/, "Band Room should render an ordinary song timeline");
assert.match(html, /id="br-song-seek"/, "Band Room should expose a seek bar");
assert.match(source, /function playbackDurationSec\(\)/, "Band Room should compute one duration for visible timeline and album guard");
assert.match(source, /function seekToPlaybackSecond\(/, "Band Room should seek to arbitrary song positions");
assert.match(source, /function startTransportProgress\(/, "Band Room should keep elapsed time moving while playback runs");
assert.match(source, /pendingSeekOffsetSec/, "Band Room should keep a stopped seek position for the next START");
assert.match(source, /function makePartAgentContext\(/, "Band Room should build source-derived AI part agent context");
assert.match(source, /function bassAgentPlan\(/, "Band Room should give bass its own source-derived agent");
assert.match(source, /function guitarAgentPlan\(/, "Band Room should give guitar its own source-derived agent");
assert.match(source, /function voiceAgentPlan\(/, "Band Room should give vocal guide its own source-derived agent");
assert.match(source, /function chordAgentPlan\(/, "Band Room should give chords their own source-derived agent");
assert.match(source, /sourceAccentSteps\(ctx, \["kick", "snare", "crash", "ghost"\]/, "Guitar agent should react to original drum-frame accents");
assert.match(html, /id="br-stems-variant-select"/, "Band Room should expose a stem variant selector for production AI recreation packs");
assert.match(source, /function stemVariantEntriesForSong\(/, "Band Room should resolve optional per-song stem variants");
assert.match(source, /function stemLoadCandidates\(/, "Band Room should build original fallback candidates for missing variant stems");
assert.match(source, /fallback_to_original !== false/, "Stem variants should fall back to original stems unless explicitly disabled");
assert.match(source, /loadedStemsVariant === variant\.key/, "Stem player cache should be keyed by both song and stem variant");
assert.equal(humanFly?.kit_profile, "cramps-punk", "v213: Tabasco / Human Fly should recommend the cramps-punk kit profile");
assert.equal(bandsRegistry.bands?.tabasco?.stems_variants?.ai_recreation?.stems_dir, "presets/ai-recreation-stems/tabasco", "Human Fly AI recreation stems should use the local generated-stems mount");
assert.equal(bandsRegistry.bands?.tabasco?.stems_variants?.ai_recreation?.stems?.drums, "drums.mp3", "AI recreation variant should point at renderer output stem names");
assert.deepEqual(
  bandsRegistry.bands?.tabasco?.stems_variants?.ai_recreation?.songs,
  ["human-fly"],
  "AI recreation stem variant should stay scoped to the Human Fly pilot"
);
assert.equal(bandsRegistry.bands?.tabasco?.stems_variants?.ai_recreation?.fallback_to_original, true, "AI recreation stem variant should fallback to original missing stems");
assert.match(aiRecreationRenderer, /route": "source-derived-ai-recreation"/, "Offline AI recreation export should identify the same source-derived route");
assert.match(aiRecreationRenderer, /parser\.add_argument\("band_id"/, "Offline AI recreation export should accept positional band id");
assert.match(aiRecreationRenderer, /def snapped_offset\(/, "Offline AI recreation export should preserve kick-snapped timing logic");
assert.match(aiRecreationRenderer, /push_s=-0\.010/, "Offline AI recreation export should preserve the Human Fly/cramps-punk bass push used for lock-in");
assert.match(aiRecreationRenderer, /"bass_notes": 0, "guitar_strums": 0, "chord_stabs": 0/, "Offline AI recreation export should report independent part event counts");
assert.match(aiRecreationRenderer, /target_karaoke_rms:\s*float\s*=\s*0\.093/, "Offline AI recreation export should keep the current Human Fly pilot loudness target");
assert.match(aiRecreationRenderer, /"mix\.wav": output_metric/, "Offline AI recreation export should produce a compare-capture-ready mix.wav");
assert.match(aiRecreationRenderer, /def instrument_polish\(/, "Offline AI recreation export should bake the v284 synth-only instrument polish into generated stems");
assert.match(aiRecreationDoc, /render-bandroom-ai-recreation\.py/, "AI recreation export docs should document the offline renderer command");
assert.match(aiRecreationDoc, /mix\.wav.*compare-capture\.py/, "AI recreation export docs should document direct compare-capture use");
assert.match(aiRecreationDoc, /生成 mp3\/wav は私的な試聴\/検証用で、repo には追加しません。/, "AI recreation export docs should keep generated audio out of the repo");
// v231: AI bass + guitar default to the internal synth. They used to
// default to the "bass-electric" / "guitar-electric" catalog samplers, but
// those stream from jsDelivr's mirror of nbrosowsky/tonejs-instruments —
// a repo that exceeds jsDelivr's 50 MB limit, so jsDelivr 403s a flaky
// half of the files. A Tone.Sampler never reaches loaded=true if ANY file
// fails, so the AI band's guitar + bass were permanently silent. null =
// internal synth, which always works offline.
assert.match(source, /bassInstrument:\s*"bass-electric"/, "v267: AI bass defaults to the CDN-streamed electric bass Sampler. Root cause of v231 'unservable' was a catalog note-name bug; v267 corrected the catalog to 17 actual github files and made bass-electric the default. Completes the 生音 5/5.");
assert.match(source, /guitarInstrument:\s*"guitar-acoustic"/, "v265: AI guitar defaults to the CDN-streamed acoustic Sampler (2026 re-audit: 11/11 notes servable). bass stays synth (bass-electric still 403s the bass core range).");
assert.match(source, /new Tone\.Limiter\(\{\s*threshold:\s*-1\.0\s*\}\)/, "Band Room master limiter should keep v168 headroom");
// v228: the guitar / chord PolySynth maxPolyphony must stay LOW. Each
// PolySynth voice is a continuously-running oscillator; v227 raised the
// caps to 64/32 and that let the synth-heavy AI mode spawn ~96 oscillators,
// pegging mobile CPUs and freezing the device. The cap is CPU protection —
// it must NOT be raised again. The real fix for dropped notes is cutting
// the agents' note density (step 2), not raising the cap. Ceiling 16.
{
  const guitarPoly = Number((source.match(/guitar\.maxPolyphony\s*=\s*(\d+)/) || [])[1]);
  const chordPoly = Number((source.match(/chord\.maxPolyphony\s*=\s*(\d+)/) || [])[1]);
  assert.ok(guitarPoly > 0 && guitarPoly <= 16, `v228: guitar maxPolyphony must stay low (<=16) for CPU safety — raising it froze devices (found ${guitarPoly})`);
  assert.ok(chordPoly > 0 && chordPoly <= 16, `v228: chord maxPolyphony must stay low (<=16) for CPU safety (found ${chordPoly})`);
}
// v229: synth-lifecycle leak guard. makeDrumKit historically returned a
// plain { kick, snare, ... } object with NO dispose method, so
// buildKitForSource's `if (drumKit && drumKit.dispose)` guard silently
// short-circuited and leaked the WHOLE synth kit (~9 continuously-running
// noise/oscillator generators) on every kit-profile change. Because
// applyRecommendedKitProfile fires that rebuild on every song switch, a
// few switches in AI 再現 mode piled up orphaned oscillators and froze the
// device. The synth kit MUST return through withChainDispose so its full
// node chain is torn down — this is the song-switch freeze fix.
{
  assert.match(source, /function withChainDispose\(/, "v229: withChainDispose helper must exist to tear down full synth FX chains");
  assert.match(source, /return withChainDispose\(\s*\{ kick, snare, hat, ghost, fill, crash \}/,
    "v229/v237: makeDrumKit must return via withChainDispose so synth kits dispose cleanly (song-switch freeze fix)");
}
// v237: buffer-based drum kit. The synth drum kit was re-synthesised LIVE on
// every hit — machine-gunning Tone synths ~30×/bar piled up Web Audio cost
// until the browser choked (preview oracle: full density freezes ~16s, ~2
// hits/bar survives — PolySynth / bass / voice were ruled out). makeDrumKit
// now renders each voice to a buffer once (Tone.Offline) and plays hits as
// cheap one-shot buffer sources — the same engine as 原音 stem playback,
// which never chokes.
{
  assert.match(source, /async function makeDrumKit\(/,
    "v237: makeDrumKit must be async (it offline-renders each drum voice to a buffer)");
  assert.match(source, /function playDrumHit\(/,
    "v237: playDrumHit helper must exist (one-shot buffer playback per drum hit)");
  assert.match(source, /Tone\.Offline\(/,
    "v237: makeDrumKit must render drum voices via Tone.Offline");
}
// v231: AI 再現 is now an all-synth band (guitar + bass switched to the
// internal synth). Guitar and chord are PolySynths with maxPolyphony 10;
// the bar scheduler fires a whole bar of notes at once and PolySynth
// reserves a voice per note on the call, so the agents' per-bar note
// density must stay within the cap or notes flood + drop. Guitar scales
// notes-per-strum to the strum count; chord drops 7th voicings to a shell.
{
  assert.match(source, /notesPerStrum\s*=\s*clamp\(Math\.floor\(9\s*\/\s*Math\.max\(1,\s*plan\.length\)\)/,
    "v231: triggerGuitarAgent must scale notes-per-strum to strum count so the guitar PolySynth stays within maxPolyphony");
  assert.match(source, /if \(baseNotes\.length >= 4\) baseNotes = \[baseNotes\[0\], baseNotes\[1\], baseNotes\[3\]\]/,
    "v231: chordAgentPlan must drop 7th voicings to a 3-note shell so the chord PolySynth stays within maxPolyphony");
  assert.doesNotMatch(source, /if \(state\.guitarInstrument === "guitar-electric"\) state\.guitarInstrument = null/,
    "v265: the v231 force-to-null for guitar-electric was removed (2026 re-audit found the CDN samples mostly servable). Users who pick guitar-electric from the dropdown should retain it across reloads.");
  assert.doesNotMatch(source, /if \(state\.bassInstrument === "bass-electric"\) state\.bassInstrument = null/,
    "v267: the v231 force-to-null for bass-electric was removed. The catalog was corrected (v97 used wrong note names; upstream actually ships A#/C#/E/G in 4-5 octaves); all 17 sample files now servable. bass-electric is the AI 再現 default.");
}
// v232: frequency-lane design (foundation step A). The 5 AI synth parts
// were piling into the mid range — voice/melody played the same chord
// tones in the same octave (4) as the chord pad, so it doubled the pad
// instead of reading as a 5th part. Each pitched part now gets its own
// octave lane (bass 2 / guitar 3 / chord 4 / voice 5) and the guitar +
// chord get high-pass filters so their lower lanes don't bleed down into
// the bass.
{
  assert.match(source, /const notes = chordToNotes\(ctx\.chord, 5\)/,
    "v232: voiceAgentPlan must voice the melody at octave 5 — above the octave-4 chord pad — so it reads as a separate part");
  assert.match(source, /hpG = new Tone\.Filter\(\{ frequency: 130, type: "highpass"/,
    "v232: the synth guitar must high-pass at 130 Hz so its low-mid stays out of the bass lane");
  assert.match(source, /hpC = new Tone\.Filter\(\{ frequency: 190, type: "highpass"/,
    "v232: the chord pad must high-pass at 190 Hz so it sits in its mid lane and doesn't muddy the low end");
}
// v234: v233's JIT note scheduling reverted. v233 added jitTrigger() to
// defer guitar/chord PolySynth triggers via Tone.Transport.scheduleOnce.
// It could not be verified (the preview freezes the renderer on band-room
// audio) and on-device it made playback worse, so it was reverted — the
// guitar/chord agents trigger their PolySynths directly again (v232
// behaviour). The underlying voice-pool concern is being re-investigated
// from the user's on-device observations rather than another blind ship.
{
  assert.doesNotMatch(source, /function jitTrigger\(/,
    "v234: the v233 jitTrigger helper must be removed (JIT scheduling reverted)");
  assert.match(source, /guitarSynth\.triggerAttackRelease\(voicing,/,
    "v234: triggerGuitarAgent must trigger the guitar PolySynth directly");
  assert.match(source, /chordSynth\.triggerAttackRelease\(step\.notes,/,
    "v234: triggerChordAgent must trigger the chord PolySynth directly");
}
// v235: screen Wake Lock. iOS suspends/throttles Web Audio when the screen
// sleeps; the MediaStream background-bridge alone can't keep 原音 playback
// stable (pitch wobble / single-note loop). band-room now holds a screen
// wake lock for the playback session (mirrors hazamaFM's "KEEP"), so the
// screen stays awake and focus listening stays in the stable foreground.
{
  assert.match(source, /async function requestScreenWakeLock\(/,
    "v235: requestScreenWakeLock helper must exist (screen stays awake during playback)");
  assert.match(source, /navigator\.wakeLock\.request\("screen"\)/,
    "v235: must use the Wake Lock API to request a screen lock");
  assert.match(source, /releaseScreenWakeLock\(\);/,
    "v235: stopPlayback must release the screen Wake Lock");
}
// v236: iOS background-transition duck. Locking the screen briefly throttles
// the AudioContext at the visibility transition (a "bo-bo-bo" buffer-repeat
// before the bridge re-settles). band-room ducks the master gain across the
// transition window with a one-shot audio-clock envelope that always ends
// back at the captured volume — masks the seam with no stuck-silent risk.
{
  assert.match(source, /function duckThroughBackgroundTransition\(/,
    "v236: duckThroughBackgroundTransition helper must exist (masks the iOS lock-transition glitch)");
  assert.match(source, /duckThroughBackgroundTransition\(\);/,
    "v236: handlePlaybackGoingBackground must duck through the background transition");
}
assert.match(source, /let masterVolBase = 1\.2/, "Band Room master volume base should match the v202 louder default output");
assert.match(source, /drumBus = new Tone\.Gain\(0\.58\)/, "AI drum bus default should leave headroom for source-derived accents");
assert.match(source, /bassBus = new Tone\.Gain\(0\.66\)/, "AI bass bus default should be balanced against the v168 mix");
assert.match(source, /clickBus = new Tone\.Gain\(0\.35\)/, "Click bus default should match the slider while the click toggle stays off");
assert.match(source, /stemBus\.vocals = new Tone\.Gain\(0\.68\)/, "Vocal stem default should sit forward without pinning the limiter");
assert.match(source, /function makeInstrumentPolishBus\(/, "Band Room should sum the non-vocal band into a polish bus");
assert.match(source, /instrumentBus = makeInstrumentPolishBus\(masterGain\)/, "Non-vocal instruments should feed the polish bus");
assert.match(source, /drumPan\s*=\s*new Tone\.Panner\([^)]*\)\.connect\(instrumentBus\)/, "Drums should route through the instrument polish bus");
assert.match(source, /voicePan\s*=\s*new Tone\.Panner\([^)]*\)\.connect\(masterGain\)/, "Vocal lead should bypass the instrument polish bus");
assert.match(html, /rel="manifest" href="manifest-band-room\.webmanifest\?v=br-icon-1"/, "Band Room should expose its own versioned PWA manifest");
assert.match(html, /id="install-hint"/, "Band Room should expose the PWA install hint banner for BG-playback stability");
assert.match(html, /id="br-reset-audio"/, "Band Room should expose a visible Reset Audio control");
assert.match(html, /id="br-boot-status"/, "Band Room should render boot/version diagnostics");
assert.match(html, /controllerchange/, "Band Room SW reload should wait for controllerchange before reloading");
assert.match(source, /function scheduleMobileSuspendRelease\(/, "Band Room should run panic releases while mobile screen lock is happening");
assert.match(source, /window\.addEventListener\("blur"/, "Band Room should treat mobile blur as a background transition");
assert.match(source, /document\.addEventListener\("freeze"/, "Band Room should handle page lifecycle freeze");
assert.match(source, /releaseAll\(time = Tone\.now\(\)\)/, "Velocity-sensitive samplers should expose releaseAll for suspend panic");
assert.match(html, /id="br-vfx-chorus"[^>]*value="22"/, "Vocal chorus slider should match the v168 wet default");
assert.match(html, /id="br-vfx-delay"[^>]*value="12"/, "Vocal delay slider should match the v168 send default");
assert.match(html, /id="br-vfx-reverb"[^>]*value="20"/, "Vocal reverb slider should match the v168 send default");
assert.match(html, /id="br-vol-external-vocal"[^>]*value="78"/, "External vocal slider should match the v168 bus default");
assert.match(source, /const dryVal = 1 - wetVal;/, "Master reverb dry path should not jump on first slider touch");
assert.match(source, /1 - w \* 0\.85/, "Tape dry path should not jump on first warmth slider touch");
assert.match(source, /const MIX_PREFS_VERSION = "v267-bass-electric"/, "Band Room should version saved mix defaults");
assert.match(source, /storageSchemaVersion:\s*BANDROOM_STORAGE_SCHEMA_VERSION/, "Saved prefs should carry the Band Room storage schema version");
assert.match(source, /function sanitizePrefsForBoot\(/, "Band Room should sanitize persisted local audio prefs before applying them");
assert.match(source, /function applyBandRoomStorageBootPolicy\(/, "Band Room should apply safe-boot storage policy before UI restore");
assert.match(source, /BANDROOM_BOOT_MODE === "standalone" && !schemaIsCurrent/, "Standalone PWA boot should reset stale audio prefs schemas");
assert.match(source, /"br-vol-stem-drums": \{ old: "92", current: "86" \}/, "Saved old stem defaults should migrate to the v167/v168 mix");
assert.match(source, /"br-space-reverb": \{ old: "22", current: "16" \}/, "Saved old master defaults should migrate to the v167/v168 mix");
assert.match(source, /prefs = migratePrefsForCurrentMix\(prefs\);/, "Prefs restore should apply the current mix migration before dispatching sliders");
assert.match(
  source,
  /externalVocalBus\.connect\(vocalChorus\);[\s\S]*stemRecorderDests\[stem\] = dest;[\s\S]*return masterGain;/,
  "Stems-pack recorder taps should be wired after all stem buses exist"
);
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
assert.match(source, /async function startPlaybackBoot\(/, "Band Room start boot should be wrapped so failed starts do not leave START stuck");
assert.match(source, /Tone\.Transport\.cancel\(0\)/, "Band Room should cancel stale Transport schedules on start/stop");
assert.match(source, /function stopPhraseLoops\(/, "Band Room Stop/Reset should stop phrase loops as part of panic handling");
assert.match(source, /function resetBandRoomAudioState\(/, "Band Room should expose a local Reset Audio recovery path");
assert.match(source, /url\.searchParams\.set\("safe", "1"\)/, "Reset Audio should relaunch with safe boot query");
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

const bandRoomIconPaths = [
  "icons/band-room-96.png",
  "icons/band-room-192.png",
  "icons/band-room-512.png",
  "icons/band-room-512-maskable.png"
];
const bandRoomManifestIcons = bandRoomManifest.icons.map((icon) => icon.src);
for (const iconPath of bandRoomIconPaths) {
  assert.ok(bandRoomManifestIcons.includes(iconPath), `Band Room manifest should use ${iconPath}`);
  assert.ok(sw.includes(`"${iconPath}"`), `Service worker should precache ${iconPath}`);
}
assert.ok(sw.includes('"icons/band-room-apple-touch-icon.png"'), "Service worker should precache the Band Room iOS touch icon");
assert.equal(
  bandRoomManifest.shortcuts?.[0]?.icons?.[0]?.src,
  "icons/band-room-192.png",
  "Band Room shortcut should use the Band Room icon"
);
assert.doesNotMatch(
  JSON.stringify(bandRoomManifest.icons),
  /icons\/icon-/,
  "Band Room manifest should not reuse the generic Music icon set"
);
assert.match(
  html,
  /rel="apple-touch-icon" href="icons\/band-room-apple-touch-icon\.png"/,
  "Band Room should expose its own iOS touch icon"
);

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
assert.doesNotMatch(savePrefsBody, /\bmode\s*:/, "Saved prefs must not persist playback mode — band-room always opens 原音 (AI 再現 is WIP)");

const bandRoomScriptMarker = html.match(/band-room\.js\?v=(br-\d+)/);
assert.ok(bandRoomScriptMarker, "Band Room HTML should load a cache-busted script marker");
assert.match(
  sw,
  new RegExp(`band-room\\.js\\?v=${bandRoomScriptMarker[1]}`),
  "Service worker should precache the same Band Room script marker"
);
assert.match(source, /label: "synth: AI drums \(legacy\)"/, "v260: synth kit label updated to (legacy) since v259 made tone-acoustic the default; the synth-as-default labelling was confusing UX");
assert.match(source, /label: "sample: 曲自身の drums \(現在の曲\)"/, "Kit selector should identify the auto-self sample kit");
assert.match(source, /label: "sample: Tabasco \/ TABASCO \(136\)"/, "Kit selector should identify catalog sample kits");
assert.match(source, /kitSource:\s*"online\/tone-acoustic"/, "v259: AI 再現 default drum kit should be the acoustic CDN kit (生音 default; synth is selectable from the dropdown)");
assert.match(source, /if \(prefs\.kitSource === "auto-self"\)\s*\{\s*prefs\.kitSource = "online\/tone-acoustic";/, "applyPrefs should retire saved 'auto-self' directly to the v259 acoustic default (v208 migration target updated)");
assert.match(source, /PHRASE_VEL_MULT\s*=\s*\[0\.95,\s*1\.00,\s*1\.04,\s*0\.98\]/, "Synth drums should breathe across the 4-bar phrase (v209)");
assert.match(source, /Math\.floor\(barInSection \/ 4\) % 4/, "4-bar fills should rotate through variants instead of repeating (v209)");
assert.match(source, /function chordInversion\(notes, inv\)/, "Chord agent should have an inversion helper (v210)");
assert.match(source, /INVERSION_BY_PHRASE\s*=\s*\[0,\s*1,\s*2,\s*0\]/, "Chord voicings should rotate inversions across the 4-bar phrase (v210)");
assert.match(source, /PHRASE_CONTOURS_DEFAULT\s*=\s*\[/, "Voice agent should rotate melody contour across the 4-bar phrase (v211)");
assert.match(source, /PHRASE_CONTOURS_RECAP\s*=\s*\[/, "Voice agent recap path should also rotate contour (v211)");
assert.match(source, /GUITAR_INVERSION_BY_PHRASE\s*=\s*\[1,\s*0,\s*2,\s*0\]/, "Guitar agent should rotate power chord voicings (v212)");
assert.match(source, /\[\.\.\.new Set\(chordInversion\(baseNotes,/, "Guitar agent should dedup duplicated power-chord notes after inversion (v212)");
assert.match(source, /function applyRecommendedKitProfile\(\)/, "v213: should expose a helper that maps band/song to a kit profile recommendation");
assert.match(source, /applyRecommendedKitProfile\(\);/, "v213: loadSong should call the kit profile auto-mapping after song data is set");
assert.match(source, /if \(state\.kitProfileExplicitlyChosen\) return;/, "v215: auto-mapping must gate on the explicit-pick flag, not on kitProfile === 'default' (otherwise only the first song auto-applies)");
assert.match(source, /state\.__kitProfileAutoApplying\s*=\s*true;/, "v215: applyRecommendedKitProfile must set the auto-applying guard before dispatching change");
assert.match(source, /if \(!state\.__kitProfileAutoApplying\)\s*\{\s*state\.kitProfileExplicitlyChosen\s*=\s*\(profileSel\.value !== "default"\);/, "v215: profileSel change handler must mark explicit pick only when not auto-applying, and reset on 'default'");
assert.match(source, /PHRASE_VEL_MULT_BASS\s*=\s*\[0\.96,\s*1\.00,\s*1\.06,\s*0\.98\]/, "v216: bass agent should breathe across the 4-bar phrase");
assert.match(source, /const liftBar2Downbeat\s*=\s*phrasePos === 2/, "v216: bass downbeat should lift an octave on bar 2 (phrase peak before fill)");
assert.match(source, /const isSectionEnd\s*=\s*\(barInSection === barsInSection - 1\)/, "v217: drum scheduler must detect the section's last bar for forced transition fill");
assert.match(source, /const isForcedSectionEndFill\s*=\s*isSectionEnd && !isFillBar/, "v217: forced section-end fill must not double-fire with the 4-bar rotating fill");
assert.match(source, /isForcedSectionEndFill \? 3 : Math\.floor\(barInSection \/ 4\) % 4/, "v217: forced section-end fill must use V3 (sparse) for a transitional feel");
assert.match(source, /let lastChordTopNote = null;/, "v218: should declare lastChordTopNote module-level state for jazz voice leading");
assert.match(source, /if \(isJazzy && lastChordTopNote != null\)/, "v218: chordAgentPlan must use voice leading instead of phrase rotation in jazzy mode");
assert.match(source, /lastChordTopNote = noteNameToSemi\(notes\[notes\.length - 1\]\)/, "v218: chordAgentPlan must update lastChordTopNote for next bar's voice leading");
assert.match(source, /v218: reset jazzy voice-leading history at song boundary[\s\S]{0,200}lastChordTopNote = null;/, "v218: loadSong must reset lastChordTopNote on song change");
assert.match(source, /\(ctx\.role === "intro" \|\| ctx\.role === "outro"\)\s*\?\s*"1n"/, "v219: intro/outro chord downbeat should ring full bar (1n) for atmospheric pad swell");
assert.match(source, /let instrumentBus = null;/, "v220: instrumentBus must be hoisted to module scope for section dynamics");
assert.match(source, /function sectionGainForRole\(role\)/, "v220: section dynamics need a role → gain mapping helper");
assert.match(source, /function rampInstrumentBusForSection\(sec, time\)/, "v220: section dynamics need a ramp helper that gates on synth mode");
assert.match(source, /rampInstrumentBusForSection\(nowSec, time\);/, "v220: scheduleBar must ramp instrumentBus on section change");
assert.match(source, /intro:\s*0\.62[\s\S]{0,200}recap:\s*1\.05/, "v220 / v271: role gain map widened — intro pulled to 0.62 (-4.2 dB) for atmospheric entrance, recap stays at 1.05 lifted. v271 expanded the v220 ±10% range to ±47% so the verse/chorus contrast is audible.");
assert.match(source, /if \(isJazzy && ctx\.role !== "break"\)/, "v221: bass agent must branch to walking mode in jazzy roles (excluding break)");
assert.match(source, /sub:\s*0,\s*note:\s*semiToNote\(root\)[\s\S]{0,800}sub:\s*12,\s*note:\s*semiToNote\((?:seventh|beat4Semi)\)/, "v221: jazzy walking bass should walk root → 5th → 3rd → 7th (v222 may replace 7th with beat4Semi for lookahead)");
assert.match(source, /function nextChordLookahead\(\)/, "v222: need a next-chord lookahead helper for walking-bass chromatic approach");
assert.match(source, /nextChord:\s*nextChordLookahead\(\)/, "v222: makePartAgentContext should expose ctx.nextChord to agents");
assert.match(source, /const beat4Semi\s*=\s*\(nextRootSemi != null && nextRootSemi !== root\)\s*\?\s*nextRootSemi - 1\s*:\s*seventh/, "v222: walking bass beat 4 must use chromatic approach (nextRoot - 1) when next chord differs");
assert.match(source, /function isJazzyMode\(\)/, "v226: jazz-mode detection must be a single shared helper (no hand-copied booleans)");
assert.match(source, /const isJazzySwing = isJazzyMode\(\)/, "v223/v226: voice agent must detect jazzy mode via the shared helper");
assert.match(source, /const swingMs\s*=\s*isJazzySwing && isOffBeat8th \? 12 : 0/, "v226: voice off-beat swing must be 12ms (lo-fi laid-back), not a 35ms bebop triplet");
// v226: the jazz-mode boolean must be defined exactly once (in isJazzyMode);
// every agent calls the helper. Count the raw expression — should be 1.
{
  const rawJazzExpr = /state\.kitProfile === "lofi-nujabes"/g;
  const rawCount = (source.match(rawJazzExpr) || []).length;
  assert.equal(rawCount, 1, `v226: the jazz-mode check must live only in isJazzyMode() — found ${rawCount} raw copies (expected 1)`);
}
assert.match(source, /baseNotes = full\.length >= 4 \? \[full\[0\], full\[1\], full\[3\]\] : full/, "v224: jazz guitar must use shell voicings (root + 3rd + 7th, drop the 5th)");
assert.match(source, /const jazzGrid\s*=\s*ctx\.role === "recap" \? \[0, 6, 10\] : \[0, 6\]/, "v225: jazz guitar comp must be sparse / syncopated (Charleston [0,6], recap adds sub 10)");
assert.equal(bandsRegistry.bands?.tabasco?.kit_profile_default, "cramps-punk", "v260: Tabasco's default kit profile aligned to cramps-punk (matches the band's actual cramps-style punk character; was 'default' which was the generic non-rock fallback)");
assert.equal(bandsRegistry.reference_libraries?.unripe?.kit_profile_default, "cramps-punk", "v213: UNRIPE (hardcore postpunk) should recommend cramps-punk");
const tabascoHey = bandsRegistry.bands?.tabasco?.songs?.find((s) => s.id === "hey");
const tabascoElectricSheep = bandsRegistry.bands?.tabasco?.songs?.find((s) => s.id === "electric-sheep");
const tabascoUnderTheMoon = bandsRegistry.bands?.tabasco?.songs?.find((s) => s.id === "under-the-moon");
assert.equal(tabascoHey?.kit_profile, "sakanaction", "v214: Tabasco / Hey should recommend the sakanaction kit profile");
assert.equal(tabascoElectricSheep?.kit_profile, "lcd-motorik", "v214: Tabasco / Electric Sheep should recommend the lcd-motorik kit profile");
assert.equal(tabascoUnderTheMoon?.kit_profile, "lcd-motorik", "v214: Tabasco / Under the Moon should recommend the lcd-motorik kit profile");

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

assert.doesNotMatch(source, /scrollIntoView/, "Lyrics auto-follow must scroll the #br-lyrics panel only — never the page (no scrollIntoView)");

console.log("Band Room logic check passed");
