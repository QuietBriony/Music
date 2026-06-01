import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fmHtml = readFileSync("fm.html", "utf8");
const bandRoomHtml = readFileSync("band-room.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const checklist = readFileSync("docs/runtime-browser-listening-checklist.md", "utf8");

function mustMatch(text, pattern, label) {
  const match = text.match(pattern);
  assert.ok(match, label);
  return match[1] || match[0];
}

function scriptOrLinkMarker(html, path) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return mustMatch(html, new RegExp(`${escaped}\\?v=([^"\\s]+)`), `${path} should be versioned`);
}

const markers = {
  swVersion: mustMatch(sw, /const VERSION = "(hazama-fm-v\d+)";/, "sw.js should expose a cache version"),
  style: scriptOrLinkMarker(fmHtml, "style.css"),
  fmCss: scriptOrLinkMarker(fmHtml, "fm.css"),
  fmJs: scriptOrLinkMarker(fmHtml, "fm.js"),
  engine: scriptOrLinkMarker(fmHtml, "engine.js"),
  flavor: scriptOrLinkMarker(fmHtml, "audio/genre-flavor.js"),
  aiFills: scriptOrLinkMarker(fmHtml, "audio/ai-fills.js"),
  bandCss: scriptOrLinkMarker(bandRoomHtml, "band-room.css"),
  bandJs: scriptOrLinkMarker(bandRoomHtml, "band-room.js"),
  bandSafety: scriptOrLinkMarker(bandRoomHtml, "audio/audio-safety.js"),
  bandManifest: scriptOrLinkMarker(bandRoomHtml, "manifest-band-room.webmanifest")
};

for (const [name, marker] of Object.entries(markers)) {
  assert.ok(checklist.includes(marker), `runtime checklist should mention current ${name} marker ${marker}`);
}

assert.doesNotMatch(
  checklist,
  /Current v\d+ markers:/,
  "runtime checklist should not hard-code a stale 'Current vN markers' label"
);
assert.doesNotMatch(
  checklist,
  /hazama-fm-v17[0-9]|band-room\.js\?v=br-8[0-9]|audio\/genre-flavor\.js\?v=fm-70/,
  "runtime checklist should not retain known-stale v172-era markers"
);

console.log("Runtime doc marker check passed");
