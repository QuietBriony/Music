import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("fm.html", "utf8");
const js = readFileSync("fm.js", "utf8");
const css = readFileSync("fm.css", "utf8");

assert.match(html, /id="fm-route"/, "FM should expose a visible audio route badge");
assert.match(html, /id="fm-route-status"/, "FM route badge should have a live status label");
assert.match(html, /id="fm-route-panel"/, "FM route badge should expose diagnostics");
assert.match(html, /id="fm-route-rearm"/, "FM route diagnostics should expose rearm");
assert.match(html, /id="background_value"/, "FM engine shim should expose background bridge status");
assert.match(html, /id="fm-drum-floor-link"/, "FM should expose a direct Drum Floor handoff link");

assert.match(js, /function normalizeAudioRoute\(/, "FM should normalize engine bridge labels");
assert.match(js, /function renderAudioRoutePanel\(/, "FM should render route diagnostics");
assert.match(js, /function bindAudioRouteStatus\(/, "FM should bind the route badge");
assert.match(js, /new MutationObserver\(\(\) => refreshAudioRouteStatus\(\)\)/, "FM should watch engine background status changes");
assert.match(js, /music-background-bridge-state/, "FM should listen for bridge diagnostic events");
assert.match(js, /MusicBackgroundBridge[\s\S]*rearm/, "FM should rearm the hidden audio bridge from diagnostics");
assert.match(js, /bindAudioRouteStatus\(\)/, "FM boot should wire the route badge");
assert.match(js, /bridge[\s\S]*failed[\s\S]*direct[\s\S]*off/, "FM route states should cover bridge/failed/direct/off");
assert.match(js, /function publishDrumFloorHandoff\(/, "FM should publish a metadata-only packet before Drum Floor handoff");
assert.match(js, /MusicSessionPacket[\s\S]*sync\(\)/, "FM Drum Floor handoff should use the shared Music session packet");
assert.match(js, /bindDrumFloorLink\(\)/, "FM boot should wire the Drum Floor handoff link");
assert.match(js, /lofi:\s*\{[\s\S]*?bpm:\s*88,/, "FM lofi profile should use the measured lofi pocket tempo");
assert.match(js, /funk:\s*\{[\s\S]*?bpm:\s*100,/, "FM funk profile should use the measured funk pocket tempo");
assert.match(js, /function drumFloorHandoffBpmValue\(/, "FM should derive handoff BPM without leaking idle Tone defaults");
assert.match(js, /function drumFloorHrefForContext[\s\S]*drumFloorHandoffBpmValue\(name\)/, "FM Drum Floor links should use genre-aware handoff BPM");

assert.match(css, /#fm-route\b/, "FM route badge should be styled");
assert.match(css, /#fm-route-panel\b/, "FM route diagnostics should be styled");
assert.match(css, /#fm-route\[data-route="bridge"\]/, "FM route badge should style bridge state");
assert.match(css, /#fm-route\[data-route="failed"\]/, "FM route badge should style failed state");

const engine = readFileSync("engine.js", "utf8");
assert.match(engine, /backgroundBridgeDiagnostics/, "Engine should track background bridge diagnostics");
assert.match(engine, /window\.MusicBackgroundBridge/, "Engine should expose bridge diagnostics API");
assert.match(engine, /function rearmBackgroundAudioBridge\(/, "Engine should expose manual bridge rearm");
assert.match(engine, /function checkBackgroundBridgeHealth\(/, "Engine should watchdog hidden bridge health");
assert.match(engine, /scheduleBackgroundBridgeRearm/, "Engine should auto-rearm a lost preferred bridge");

console.log("FM route badge diagnostics check passed");
