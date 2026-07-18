import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("lyric-lab.html", "utf8");
const css = readFileSync("lyric-lab.css", "utf8");
const client = readFileSync("lyric-lab.js", "utf8");
const api = readFileSync("functions/api/lyric-drafts.js", "utf8");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "Lyric Lab HTML ids must be unique");

for (const id of [
  "ll-new-draft",
  "ll-copy-ai-handoff",
  "ll-source-link",
  "ll-library-main",
  "ll-sync-token-main"
]) {
  assert.ok(ids.includes(id), `Lyric Lab should expose #${id}`);
}

for (const view of ["draft", "library", "final", "hook", "suno", "map"]) {
  assert.match(html, new RegExp(`data-view="${view}"`), `Lyric Lab should expose the ${view} view`);
}

assert.match(client, /function startNewDraft\(\)/, "Shelf should start a new lyric workspace");
assert.match(client, /function buildAiHandoffPacket\(\)/, "Drafts should build an AI handoff packet");
assert.match(client, /function normalizedSourceUrl\(/, "Voice memo links should be normalized before rendering");
assert.match(client, /currentControls\.direction === "hitotobi"/, "AI handoff should preserve direction-specific ending rules");
assert.match(css, /\.ll-library-source-link/, "Voice memo shelf links should be styled");
assert.match(css, /\.ll-source-link\[hidden\]\s*{\s*display:\s*none;/, "Empty voice memo links should stay hidden");
assert.match(css, /\.ll-output\[data-view="final"\] \.ll-output-tools/, "Mobile final actions should have a stable layout");

assert.match(api, /constantTimeEqual/, "Cloud API should compare sync tokens without early exit");
assert.match(api, /X-Lyric-Lab-Token/i, "Cloud API should require the Lyric Lab token header");
assert.match(api, /request\.method === "DELETE"/, "Cloud API should synchronize shelf deletion");
assert.doesNotMatch(client, /LYRIC_LAB_TOKEN\s*=/, "Client must not contain a server sync token");

console.log("Lyric Lab check passed");
