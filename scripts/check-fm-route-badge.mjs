import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("fm.html", "utf8");
const js = readFileSync("fm.js", "utf8");
const css = readFileSync("fm.css", "utf8");

assert.match(html, /id="fm-route"/, "FM should expose a visible audio route badge");
assert.match(html, /id="fm-route-status"/, "FM route badge should have a live status label");
assert.match(html, /id="background_value"/, "FM engine shim should expose background bridge status");
assert.match(html, /id="fm-drum-floor-link"/, "FM should expose a direct Drum Floor handoff link");

assert.match(js, /function normalizeAudioRoute\(/, "FM should normalize engine bridge labels");
assert.match(js, /function bindAudioRouteStatus\(/, "FM should bind the route badge");
assert.match(js, /new MutationObserver\(\(\) => refreshAudioRouteStatus\(\)\)/, "FM should watch engine background status changes");
assert.match(js, /bindAudioRouteStatus\(\)/, "FM boot should wire the route badge");
assert.match(js, /bridge[\s\S]*failed[\s\S]*direct[\s\S]*off/, "FM route states should cover bridge/failed/direct/off");
assert.match(js, /function publishDrumFloorHandoff\(/, "FM should publish a metadata-only packet before Drum Floor handoff");
assert.match(js, /MusicSessionPacket[\s\S]*sync\(\)/, "FM Drum Floor handoff should use the shared Music session packet");
assert.match(js, /bindDrumFloorLink\(\)/, "FM boot should wire the Drum Floor handoff link");

assert.match(css, /#fm-route\b/, "FM route badge should be styled");
assert.match(css, /#fm-route\[data-route="bridge"\]/, "FM route badge should style bridge state");
assert.match(css, /#fm-route\[data-route="failed"\]/, "FM route badge should style failed state");

console.log("FM route badge check passed");
