import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
const ENGINE_PATH = "engine.js";
const FIXTURE_PATH = "scripts/fixtures/music-satellite-engine-fixture.js";
const HOSTS = ["fm.html", "index.html"];
const TONE_SRC = "https://unpkg.com/tone@14.8.49/build/Tone.js";
const HAZAMA_TARGET_ORIGINS = [
  "https://quietbriony.github.io",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://127.0.0.1:8095",
  "http://localhost:8095"
];

const SATELLITES = [
  {
    path: "audio/music-stack-routing.js",
    exportName: "MusicStackRoutes",
    api: {
      ROUTE_LABELS: "object",
      ROUTE_URLS: "object",
      reviewCue: "function",
      routingRecommendation: "function"
    }
  },
  {
    path: "audio/music-focus-modulation.js",
    exportName: "MusicFocusModulation",
    api: {
      refresh: "function",
      setEnabled: "function",
      setDepth: "function",
      getState: "function"
    }
  },
  {
    path: "audio/music-recorder.js",
    exportName: "MusicRecorder",
    api: {
      state: "object",
      toggle: "function",
      start: "function",
      stop: "function",
      setStatus: "function"
    }
  },
  {
    path: "audio/music-packet.js",
    exportName: "MusicPacketKit",
    api: {
      packetUnit: "function",
      buildMusicSessionPacket: "function",
      syncMusicSessionPacket: "function",
      downloadMusicSessionPacket: "function",
      buildMusicOrchestraPacket: "function",
      syncMusicOrchestraPacket: "function",
      downloadMusicOrchestraPacket: "function",
      MUSIC_STACK_PACKET_STORAGE_KEY: "string",
      MUSIC_STACK_CHANNEL_NAME: "string",
      MUSIC_ORCHESTRA_PACKET_STORAGE_KEY: "string",
      MUSIC_ORCHESTRA_CHANNEL_NAME: "string"
    }
  },
  {
    path: "audio/music-hazama-feedback.js",
    exportName: "MusicHazamaFeedback",
    api: {
      maybeSend: "function",
      request: "function"
    }
  }
];

const ENGINE_DEPENDENCIES = {
  MusicFocusModulation: [
    "clampValue",
    "focusModGain",
    "isPlaying"
  ],
  MusicRecorder: [
    "recorderDestination"
  ],
  MusicPacketKit: [
    "clampValue",
    "RecorderState",
    "albumArcActive",
    "currentAlbumArcChapter",
    "UCM",
    "dominantReferenceMorphStyle",
    "EngineParams",
    "HazamaBridgeState",
    "MusicRadioBrainState",
    "makeMusicSessionId",
    "hazamaFmEngineMix",
    "hazamaFmReviewCue",
    "currentGradientParts",
    "GradientState",
    "genreTimbreKitRuntimeState",
    "activePerformancePadNames",
    "RdjGrowthState",
    "musicSelfReviewRuntimeState",
    "musicRadioBrainPacketState",
    "musicStackRoutingRecommendation",
    "UCM_CUR",
    "OutputState",
    "MixGovernorState",
    "ProducerHabitState",
    "isManualPerformanceInfluenceActive",
    "micFollowPacketState",
    "promotionTargetFromDestination",
    "setRecorderStatus",
    "updateMusicStackSyncHelp"
  ],
  MusicHazamaFeedback: [
    "HazamaBridgeState",
    "TimbreFamilyState",
    "GradientState",
    "DepthState",
    "GenreBlendState",
    "MotifMemoryState",
    "clampValue",
    "acidPerformanceAmount",
    "isPlaying",
    "UCM",
    "EngineParams",
    "OutputState",
    "CultureGrammarState",
    "OddLogicDirectorState",
    "albumArcActive",
    "currentAlbumArcChapter",
    "AlbumArcState",
    "AcidLockState",
    "albumArcAcidDrive",
    "hazamaAutoFollowActive",
    "hazamaConnectionState",
    "dominantInnerSourceFamily",
    "HazamaRuntimeFeedbackState",
    "HAZAMA_RUNTIME_FEEDBACK_TARGET_ORIGINS"
  ]
};

const ENGINE_DESTRUCTURED_CONSUMERS = [
  {
    exportName: "MusicPacketKit",
    members: [
      "packetUnit",
      "buildMusicSessionPacket",
      "syncMusicSessionPacket",
      "downloadMusicSessionPacket",
      "buildMusicOrchestraPacket",
      "syncMusicOrchestraPacket",
      "downloadMusicOrchestraPacket",
      "MUSIC_STACK_PACKET_STORAGE_KEY",
      "MUSIC_STACK_CHANNEL_NAME",
      "MUSIC_ORCHESTRA_PACKET_STORAGE_KEY",
      "MUSIC_ORCHESTRA_CHANNEL_NAME"
    ]
  },
  {
    exportName: "MusicHazamaFeedback",
    members: [
      "maybeSend: maybeSendHazamaRuntimeFeedback",
      "request: requestHazamaRuntimeFeedback"
    ]
  },
  {
    exportName: "MusicRecorder",
    members: [
      "toggle: toggleLocalRecorder",
      "stop: stopLocalRecorder",
      "setStatus: setRecorderStatus"
    ]
  },
  {
    exportName: "MusicFocusModulation",
    members: [
      "refresh: refreshFocusModulation",
      "setEnabled: setFmFocusModeEnabled",
      "getState: getFmFocusModeState"
    ]
  }
];

function escapeRegex(value) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
}

function assetPath(src) {
  return String(src || "").replace(/[?#].*$/, "").replace(/^\.\//, "");
}

function stripJavaScriptComments(source) {
  let clean = "";
  let index = 0;
  let mode = "code";
  let quote = "";
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "line-comment") {
      if (char === "\n" || char === "\r") {
        clean += char;
        mode = "code";
      } else {
        clean += " ";
      }
      index += 1;
      continue;
    }
    if (mode === "block-comment") {
      if (char === "*" && next === "/") {
        clean += "  ";
        index += 2;
        mode = "code";
      } else {
        clean += char === "\n" || char === "\r" ? char : " ";
        index += 1;
      }
      continue;
    }
    if (mode === "string") {
      clean += char;
      if (char === "\\") {
        if (index + 1 < source.length) clean += source[index + 1];
        index += 2;
      } else {
        if (char === quote) mode = "code";
        index += 1;
      }
      continue;
    }
    if (char === "/" && next === "/") {
      clean += "  ";
      index += 2;
      mode = "line-comment";
      continue;
    }
    if (char === "/" && next === "*") {
      clean += "  ";
      index += 2;
      mode = "block-comment";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      mode = "string";
    }
    clean += char;
    index += 1;
  }
  return clean;
}

function maskJavaScriptStringsAndComments(source) {
  let masked = "";
  let index = 0;
  let mode = "code";
  let quote = "";
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    const mask = (value) => (value === "\n" || value === "\r" ? value : " ");
    if (mode === "line-comment") {
      masked += mask(char);
      if (char === "\n" || char === "\r") mode = "code";
      index += 1;
      continue;
    }
    if (mode === "block-comment") {
      if (char === "*" && next === "/") {
        masked += "  ";
        index += 2;
        mode = "code";
      } else {
        masked += mask(char);
        index += 1;
      }
      continue;
    }
    if (mode === "string") {
      masked += mask(char);
      if (char === "\\") {
        if (index + 1 < source.length) masked += mask(source[index + 1]);
        index += 2;
      } else {
        if (char === quote) mode = "code";
        index += 1;
      }
      continue;
    }
    if (char === "/" && next === "/") {
      masked += "  ";
      index += 2;
      mode = "line-comment";
      continue;
    }
    if (char === "/" && next === "*") {
      masked += "  ";
      index += 2;
      mode = "block-comment";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      mode = "string";
      masked += " ";
      index += 1;
      continue;
    }
    masked += char;
    index += 1;
  }
  return masked;
}

function topLevelDeclaredBindings(source) {
  const masked = maskJavaScriptStringsAndComments(source);
  const bindings = new Set();
  let braceDepth = 0;
  let index = 0;
  while (index < masked.length) {
    const char = masked[index];
    if (char === "{") {
      braceDepth += 1;
      index += 1;
      continue;
    }
    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      index += 1;
      continue;
    }
    if (braceDepth !== 0 || !/[A-Za-z_$]/.test(char)) {
      index += 1;
      continue;
    }
    const tokenStart = index;
    while (index < masked.length && /[\w$]/.test(masked[index])) index += 1;
    const token = masked.slice(tokenStart, index);
    if (!["const", "let", "var", "function", "class"].includes(token)) continue;
    while (/\s/.test(masked[index] || "")) index += 1;
    if (token === "function" && masked[index] === "*") {
      index += 1;
      while (/\s/.test(masked[index] || "")) index += 1;
    }
    if (!/[A-Za-z_$]/.test(masked[index] || "")) continue;
    const nameStart = index;
    while (index < masked.length && /[\w$]/.test(masked[index])) index += 1;
    bindings.add(masked.slice(nameStart, index));
  }
  return bindings;
}

function htmlTagEnd(html, start) {
  let quote = "";
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") quote = char;
    else if (char === ">") return index;
  }
  return html.length - 1;
}

function parseHtmlAttributes(raw) {
  const attributes = new Map();
  const open = raw.match(/^<script(?=[\s/>])/i);
  let index = open ? open[0].length : 0;
  while (index < raw.length) {
    while (/\s/.test(raw[index] || "")) index += 1;
    if (raw[index] === ">" || raw[index] === "/" || index >= raw.length) break;
    const start = index;
    while (index < raw.length && !/[\s=/>]/.test(raw[index])) index += 1;
    const name = raw.slice(start, index).toLowerCase();
    while (/\s/.test(raw[index] || "")) index += 1;
    let value = "";
    if (raw[index] === "=") {
      index += 1;
      while (/\s/.test(raw[index] || "")) index += 1;
      const quote = raw[index] === "\"" || raw[index] === "'" ? raw[index++] : "";
      const valueStart = index;
      if (quote) {
        while (index < raw.length && raw[index] !== quote) index += 1;
        value = raw.slice(valueStart, index);
        if (raw[index] === quote) index += 1;
      } else {
        while (index < raw.length && !/[\s>]/.test(raw[index])) index += 1;
        value = raw.slice(valueStart, index);
      }
    }
    if (name && !attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
}

function parseScriptElements(html) {
  const scripts = [];
  const lower = html.toLowerCase();
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start < 0) break;
    if (html.startsWith("<!--", start)) {
      const commentEnd = html.indexOf("-->", start + 4);
      cursor = commentEnd < 0 ? html.length : commentEnd + 3;
      continue;
    }
    if (!/^<script(?=[\s/>])/i.test(html.slice(start))) {
      cursor = start + 1;
      continue;
    }
    const startTagEnd = htmlTagEnd(html, start);
    const raw = html.slice(start, startTagEnd + 1);
    const attributes = parseHtmlAttributes(raw);
    const contentStart = startTagEnd + 1;
    const closeStart = lower.indexOf("</script", contentStart);
    const contentEnd = closeStart < 0 ? html.length : closeStart;
    const closeEnd = closeStart < 0 ? html.length - 1 : htmlTagEnd(html, closeStart);
    const src = attributes.get("src") || "";
    scripts.push({
      raw,
      elementRaw: html.slice(start, closeEnd + 1),
      index: start,
      content: html.slice(contentStart, contentEnd),
      src,
      path: assetPath(src),
      defer: attributes.has("defer"),
      async: attributes.has("async"),
      type: String(attributes.get("type") || "").trim().toLowerCase()
    });
    cursor = closeEnd + 1;
  }
  return scripts;
}

function parseScriptTags(html) {
  return parseScriptElements(html).filter((tag) => tag.src);
}

function assertHostContract(html, label) {
  const scripts = parseScriptElements(html);
  const tags = scripts.filter((tag) => tag.src);
  const expectedOrder = SATELLITES.map((item) => item.path).concat(ENGINE_PATH);
  const targetSet = new Set(expectedOrder);
  const relevant = tags.filter((tag) => targetSet.has(tag.path));
  assert.deepEqual(
    relevant.map((tag) => tag.path),
    expectedOrder,
    label + " satellite/engine order drift"
  );
  for (const path of expectedOrder) {
    assert.equal(
      tags.filter((tag) => tag.path === path).length,
      1,
      label + " must load " + path + " exactly once"
    );
  }
  for (const tag of relevant) {
    assert.equal(tag.defer, true, label + " must defer " + tag.path);
    assert.equal(tag.async, false, label + " must not async-load " + tag.path);
    assert.notEqual(tag.type, "module", label + " classic global seam cannot be type=module: " + tag.path);
  }
  const toneTags = tags.filter((tag) => assetPath(tag.src) === TONE_SRC);
  assert.equal(toneTags.length, 1, label + " must load the pinned Tone.js exactly once");
  const toneTag = toneTags[0];
  assert.equal(toneTag.async, false, label + " must not async-load Tone.js");
  assert.notEqual(toneTag.type, "module", label + " Tone.js must stay a classic script");
  assert.ok(toneTag.index < relevant[0].index, label + " must load Tone.js before satellites");
  if (label === "fm.html") {
    assert.equal(toneTag.defer, false, "fm.html Tone.js must block before inline Tone.setContext");
    const toneContextScripts = scripts.filter((tag) => !tag.src && /\bTone\s*\.\s*setContext\s*\(/.test(tag.content));
    assert.equal(toneContextScripts.length, 1, "fm.html must configure Tone context exactly once");
    assert.ok(toneTag.index < toneContextScripts[0].index, "fm.html must load Tone.js before Tone.setContext");
    assert.ok(toneContextScripts[0].index < relevant[0].index, "fm.html must configure Tone before satellites");
    const fmTags = tags.filter((tag) => tag.path === "fm.js");
    assert.equal(fmTags.length, 1, "fm.html must load fm.js exactly once");
    assert.ok(
      tags.findIndex((tag) => tag.path === ENGINE_PATH) < tags.findIndex((tag) => tag.path === "fm.js"),
      "fm.html must load engine.js before fm.js"
    );
  } else {
    assert.equal(toneTag.defer, true, label + " must defer Tone.js with the satellite chain");
  }
  return tags;
}

function assertHostValidatorNegatives(html) {
  const tags = parseScriptTags(html);
  const routing = tags.find((tag) => tag.path === SATELLITES[0].path);
  const engine = tags.find((tag) => tag.path === ENGINE_PATH);
  const routingTag = routing.raw;
  const routingElement = routing.elementRaw;
  const engineElement = engine.elementRaw;
  assert.throws(
    () => assertHostContract(html.replace(routingElement, ""), "fm.html"),
    /order drift|exactly once/,
    "host validator must reject a missing satellite"
  );
  assert.throws(
    () => assertHostContract(html.replace(routingElement, routingElement + "\n" + routingElement), "fm.html"),
    /order drift|exactly once/,
    "host validator must reject a duplicate satellite"
  );
  const afterEngine = html
    .replace(routingElement, "")
    .replace(engineElement, engineElement + "\n" + routingElement);
  assert.throws(
    () => assertHostContract(afterEngine, "fm.html"),
    /order drift/,
    "host validator must reject a satellite loaded after engine"
  );
  const asyncRouting = routingTag.replace(/>$/, " async>");
  assert.throws(
    () => assertHostContract(html.replace(routingTag, asyncRouting), "fm.html"),
    /must not async-load/,
    "host validator must reject async satellite loading"
  );
  assert.throws(
    () => assertHostContract(html.replace(routingTag, "<!-- " + routingTag + " -->"), "fm.html"),
    /order drift|exactly once/,
    "host validator must ignore a satellite tag inside an HTML comment"
  );
  const scriptBodyFake = '<script>void "<script src=\\"' + SATELLITES[0].path + '\\" defer>";</script>';
  assert.throws(
    () => assertHostContract(html.replace(routingTag, scriptBodyFake), "fm.html"),
    /order drift|exactly once/,
    "host validator must ignore a satellite tag inside a script body"
  );
  const dataDeferRouting = routingTag
    .replace(/\sdefer(?=\s|>)/i, "")
    .replace(/>$/, ' data-defer="false">');
  assert.throws(
    () => assertHostContract(html.replace(routingTag, dataDeferRouting), "fm.html"),
    /must defer/,
    "host validator must not mistake data-defer for defer"
  );
  const moduleRouting = routingTag.replace(/>$/, " type=module>");
  assert.throws(
    () => assertHostContract(html.replace(routingTag, moduleRouting), "fm.html"),
    /type=module/,
    "host validator must reject an unquoted module type"
  );
  const toneTag = tags.find((tag) => assetPath(tag.src) === TONE_SRC).raw;
  const toneElement = tags.find((tag) => assetPath(tag.src) === TONE_SRC).elementRaw;
  assert.throws(
    () => assertHostContract(html.replace(toneTag, ""), "fm.html"),
    /Tone\.js exactly once/,
    "host validator must reject missing Tone.js"
  );
  assert.throws(
    () => assertHostContract(html.replace(toneTag, toneTag.replace(/>$/, " async>")), "fm.html"),
    /must not async-load Tone\.js/,
    "host validator must reject async Tone.js"
  );
  assert.throws(
    () => assertHostContract(
      html.replace(toneElement, "").replace(routingElement, routingElement + "\n" + toneElement),
      "fm.html"
    ),
    /before satellites/,
    "host validator must reject Tone.js after a satellite"
  );
  assert.throws(
    () => assertHostContract(html.replace(toneTag, toneTag.replace(/>$/, " defer>")), "fm.html"),
    /must block/,
    "fm host validator must reject deferred Tone.js before inline setup"
  );
}

function serviceWorkerPrecacheUrls(sw) {
  const block = sw.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
  assert.ok(block, "Service Worker PRECACHE_URLS block is missing");
  const clean = stripJavaScriptComments(block[1]);
  return Array.from(clean.matchAll(/"((?:\\.|[^"\\])*)"/g), (match) => JSON.parse('"' + match[1] + '"'));
}

function assertServiceWorkerPresence(sw) {
  const urls = serviceWorkerPrecacheUrls(sw);
  const targets = SATELLITES.map((item) => item.path).concat(ENGINE_PATH);
  const markerByPath = new Map();
  for (const path of targets) {
    const matches = urls.filter((url) => assetPath(url) === path);
    assert.equal(matches.length, 1, "Service Worker must precache " + path + " exactly once");
    const marker = matches[0].match(/[?&]v=(fm-\d+)/);
    assert.ok(marker, "Service Worker asset must carry an fm-N marker: " + path);
    markerByPath.set(path, marker[1]);
  }
  const engineMarker = markerByPath.get(ENGINE_PATH);
  for (const [path, marker] of markerByPath) {
    assert.equal(marker, engineMarker, "Service Worker marker drift for " + path);
  }
  return engineMarker;
}

function assertServiceWorkerValidatorNegatives(sw) {
  const target = SATELLITES[0].path;
  const targetLine = sw.split(/\r?\n/).find((line) => {
    const match = line.match(/"((?:\\.|[^"\\])*)"/);
    return match && assetPath(JSON.parse('"' + match[1] + '"')) === target;
  });
  assert.ok(targetLine, "Service Worker negative fixture target is missing");
  const commented = sw.replace(targetLine, targetLine.replace(/^(\s*)/, "$1// "));
  assert.throws(
    () => assertServiceWorkerPresence(commented),
    /exactly once/,
    "Service Worker validator must ignore commented-out precache entries"
  );
}

function destructuredConsumerMembers(source, exportName) {
  const clean = stripJavaScriptComments(source);
  const pattern = /^const\s*\{([\s\S]*?)^\}\s*=\s*window\.([A-Za-z_$][\w$]*)\s*;/gm;
  return Array.from(clean.matchAll(pattern))
    .filter((match) => match[2] === exportName)
    .map((match) => (
      match[1].split(",").map((member) => member.trim().replace(/\s+/g, " ")).filter(Boolean)
    ));
}

function declaredStringArray(source, name) {
  const clean = stripJavaScriptComments(source);
  const pattern = new RegExp(
    "^const[ \\t]+" + escapeRegex(name) + "[ \\t]*=[ \\t]*\\[([\\s\\S]*?)^\\];",
    "m"
  );
  const block = clean.match(pattern);
  assert.ok(block, "missing top-level string array " + name);
  return Array.from(block[1].matchAll(/"((?:\\.|[^"\\])*)"/g), (match) => JSON.parse('"' + match[1] + '"'));
}

function sourceProvidesBinding(source, name) {
  if (topLevelDeclaredBindings(source).has(name)) return true;
  if (name === "setRecorderStatus") {
    return destructuredConsumerMembers(source, "MusicRecorder")
      .some((members) => members.includes("setStatus: setRecorderStatus"));
  }
  return false;
}

function assertEngineConsumerContract(engineSource) {
  const clean = stripJavaScriptComments(engineSource);
  const routeMembers = Array.from(
    clean.matchAll(/window\.MusicStackRoutes\.([A-Za-z_$][\w$]*)/g),
    (match) => match[1]
  );
  assert.deepEqual(
    routeMembers.sort(),
    ["ROUTE_LABELS", "ROUTE_URLS", "reviewCue", "routingRecommendation"].sort(),
    "engine.js MusicStackRoutes consumer member drift"
  );
  assert.match(
    clean,
    /^const RecorderState = window\.MusicRecorder\.state;$/m,
    "engine.js MusicRecorder.state consumer seam drift"
  );
  for (const contract of ENGINE_DESTRUCTURED_CONSUMERS) {
    const consumers = destructuredConsumerMembers(clean, contract.exportName);
    assert.equal(consumers.length, 1, "engine.js must consume window." + contract.exportName + " exactly once");
    assert.deepEqual(
      consumers[0],
      contract.members,
      "engine.js window." + contract.exportName + " consumer member drift"
    );
  }
}

function assertHazamaOriginParity(engineSource, fixtureSource) {
  assert.deepEqual(
    declaredStringArray(engineSource, "HAZAMA_RUNTIME_FEEDBACK_TARGET_ORIGINS"),
    HAZAMA_TARGET_ORIGINS,
    "engine.js Hazama feedback origin contract drift"
  );
  assert.deepEqual(
    declaredStringArray(fixtureSource, "HAZAMA_RUNTIME_FEEDBACK_TARGET_ORIGINS"),
    HAZAMA_TARGET_ORIGINS,
    "fixture Hazama feedback origins must mirror engine.js"
  );
}

function assertEngineDependencyContract(engineSource, fixtureSource) {
  const dependencies = Array.from(new Set(Object.values(ENGINE_DEPENDENCIES).flat()));
  for (const name of dependencies) {
    assert.match(name, /^[A-Za-z_$][\w$]*$/, "engine dependency name must be an identifier");
    assert.equal(
      sourceProvidesBinding(engineSource, name),
      true,
      "engine.js no longer provides delayed satellite dependency " + name
    );
    assert.equal(
      sourceProvidesBinding(fixtureSource, name),
      true,
      "test fixture must explicitly provide delayed satellite dependency " + name
    );
  }
  assertHazamaOriginParity(engineSource, fixtureSource);
  assertEngineConsumerContract(engineSource);
  return dependencies;
}

function assertDependencyValidatorNegatives(engineSource, fixtureSource) {
  assert.equal(
    sourceProvidesBinding("// const clampValue = () => 0;", "clampValue"),
    false,
    "dependency validator must ignore line comments"
  );
  assert.equal(
    sourceProvidesBinding("/* function clampValue() {} */", "clampValue"),
    false,
    "dependency validator must ignore block comments"
  );
  assert.equal(
    sourceProvidesBinding("function wrapper() {\n  const clampValue = () => 0;\n}", "clampValue"),
    false,
    "dependency validator must reject nested declarations"
  );
  assert.equal(
    sourceProvidesBinding("function wrapper() {\nconst clampValue = () => 0;\n}", "clampValue"),
    false,
    "dependency validator must reject unindented nested declarations"
  );
  assert.equal(
    sourceProvidesBinding("const note = `}\nconst clampValue = () => 0;\n{`;", "clampValue"),
    false,
    "dependency validator must ignore declarations and braces inside multiline templates"
  );
  const mutatedConsumer = engineSource.replace("  packetUnit,", "  packetUnitRenamed,");
  assert.notEqual(mutatedConsumer, engineSource, "engine consumer negative fixture mutation failed");
  assert.throws(
    () => assertEngineConsumerContract(mutatedConsumer),
    /consumer member drift/,
    "engine consumer validator must reject a renamed kit member"
  );
  const mutatedOrigins = engineSource.replace(
    '"http://localhost:8095"',
    '"http://localhost:9999"'
  );
  assert.notEqual(mutatedOrigins, engineSource, "Hazama origin negative fixture mutation failed");
  assert.throws(
    () => assertHazamaOriginParity(mutatedOrigins, fixtureSource),
    /origin contract drift/,
    "Hazama origin validator must reject engine/fixture parity drift"
  );
}

function makeBrowserSandbox(options = {}) {
  const trace = {
    stream: Object.freeze({ kind: "mock-media-stream" }),
    timers: [],
    activeTimers: new Map(),
    clearedTimers: [],
    firedTimers: [],
    events: [],
    warnings: [],
    lfo: { constructed: 0, connected: 0, started: 0, stopped: 0, disposed: 0 },
    media: { constructedWith: null, starts: 0, stops: 0 },
    objectUrls: [],
    revokedUrls: [],
    storage: [],
    broadcasts: [],
    channels: [],
    posts: [],
    anchors: [],
    syncHelpCalls: [],
    makeMusicSessionIdCalls: [],
    promotionTargetCalls: [],
    engineFixtureLoaded: false
  };
  const elements = new Map([
    ["status-text", { textContent: "" }],
    ["btn_rec", { textContent: "" }],
    ["rec_download", { hidden: true, href: "", download: "", textContent: "" }]
  ]);
  trace.elements = elements;
  let timerId = 0;

  class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  class FakeBlob {
    constructor(chunks = [], init = {}) {
      this.size = chunks.reduce((sum, chunk) => sum + (Number(chunk && chunk.size) || 0), 0);
      this.type = init.type || "";
    }
  }

  class FakeMediaRecorder {
    static isTypeSupported(type) {
      return /webm/.test(type);
    }

    constructor(stream, init = {}) {
      trace.media.constructedWith = stream;
      this.stream = stream;
      this.mimeType = init.mimeType || "";
      this.state = "inactive";
      this.ondataavailable = null;
      this.onerror = null;
      this.onstop = null;
    }

    start() {
      this.state = "recording";
      trace.media.starts += 1;
    }

    stop() {
      this.state = "inactive";
      trace.media.stops += 1;
      if (this.ondataavailable) this.ondataavailable({ data: { size: 2048 } });
      if (this.onstop) this.onstop();
    }
  }

  class FakeLfo {
    constructor(frequency, min, max) {
      if (options.lfoThrows) throw new Error("mock LFO unavailable");
      trace.lfo.constructed += 1;
      this.frequency = { value: frequency };
      this.min = min;
      this.max = max;
    }

    connect() {
      trace.lfo.connected += 1;
      return this;
    }

    start() {
      trace.lfo.started += 1;
      return this;
    }

    disconnect() {
      return this;
    }

    stop() {
      trace.lfo.stopped += 1;
      return this;
    }

    dispose() {
      trace.lfo.disposed += 1;
    }
  }

  class FakeBroadcastChannel {
    constructor(name) {
      if (options.broadcastThrows) throw new Error("mock BroadcastChannel unavailable");
      this.name = name;
      this.closed = false;
      this.record = { name, posts: 0, closed: false };
      trace.channels.push(this.record);
    }

    postMessage(payload) {
      this.record.posts += 1;
      trace.broadcasts.push({ name: this.name, payload });
    }

    close() {
      this.closed = true;
      this.record.closed = true;
    }
  }

  const body = {
    dataset: {},
    appendChild() {}
  };
  const sandbox = {
    __contract: trace,
    console: {
      log() {},
      warn(...args) { trace.warnings.push(args.map(String).join(" ")); },
      error(...args) { trace.warnings.push(args.map(String).join(" ")); }
    },
    navigator: { userAgent: "contract-browser", platform: "Win32", maxTouchPoints: 0 },
    performance: { now: () => 1000 },
    URLSearchParams,
    CustomEvent: FakeCustomEvent,
    Blob: FakeBlob,
    URL: {
      createObjectURL(blob) {
        const value = "blob:contract-" + (trace.objectUrls.length + 1);
        trace.objectUrls.push({ value, size: blob.size, type: blob.type });
        return value;
      },
      revokeObjectURL(value) {
        trace.revokedUrls.push(value);
      }
    },
    document: {
      body,
      getElementById(id) {
        return elements.get(id) || null;
      },
      createElement() {
        const anchor = {
          style: {},
          clicked: 0,
          removed: 0,
          click() { this.clicked += 1; },
          remove() { this.removed += 1; }
        };
        trace.anchors.push(anchor);
        return anchor;
      }
    },
    setInterval(callback, delay) {
      const id = ++timerId;
      const timer = { id, kind: "interval", callback, delay };
      trace.timers.push(timer);
      trace.activeTimers.set(id, timer);
      return id;
    },
    clearInterval(id) {
      if (trace.activeTimers.delete(id)) trace.clearedTimers.push(id);
    },
    setTimeout(callback, delay) {
      const id = ++timerId;
      const timer = { id, kind: "timeout", callback, delay };
      trace.timers.push(timer);
      trace.activeTimers.set(id, timer);
      return id;
    },
    clearTimeout(id) {
      if (trace.activeTimers.delete(id)) trace.clearedTimers.push(id);
    },
    Tone: { LFO: FakeLfo },
    location: { search: "" },
    FmAiFill: { status: { active: false } },
    localStorage: {
      setItem(key, value) {
        if (options.storageThrows) throw new Error("mock localStorage unavailable");
        trace.storage.push({ key, value });
      }
    },
    BroadcastChannel: FakeBroadcastChannel,
    dispatchEvent(event) {
      trace.events.push(event);
      return true;
    }
  };
  if (options.mediaRecorder !== false) sandbox.MediaRecorder = FakeMediaRecorder;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.parent = sandbox;
  sandbox.opener = options.closedOpener
    ? { closed: true, postMessage() {} }
    : {
        closed: false,
        postMessage(payload, origin) {
          trace.posts.push({ payload, origin });
        }
      };
  return { sandbox, trace };
}

function loadBareSatelliteContext(options = {}) {
  const { sandbox, trace } = makeBrowserSandbox(options);
  const context = vm.createContext(sandbox, {
    name: "music-satellite-contract",
    codeGeneration: { strings: false, wasm: false }
  });
  for (const satellite of SATELLITES) {
    vm.runInContext(read(satellite.path), context, {
      filename: satellite.path,
      timeout: 1000
    });
  }
  assert.equal(
    vm.runInContext("window === globalThis && self === window", context, { timeout: 1000 }),
    true,
    "VM must preserve browser global identity"
  );
  for (const satellite of SATELLITES) {
    const exported = context[satellite.exportName];
    assert.ok(exported, satellite.path + " must publish window." + satellite.exportName);
    for (const [name, type] of Object.entries(satellite.api)) {
      assert.equal(
        typeof exported[name],
        type,
        satellite.exportName + "." + name + " public API drift"
      );
    }
  }
  return { context, trace };
}

function installEngineFixture(context) {
  vm.runInContext(read(FIXTURE_PATH), context, {
    filename: FIXTURE_PATH,
    timeout: 1000
  });
  assert.equal(context.__contract.engineFixtureLoaded, true, "engine fixture did not finish");
}

function firePendingTimeouts(trace) {
  const pending = Array.from(trace.activeTimers.values()).filter((timer) => timer.kind === "timeout");
  for (const timer of pending) {
    trace.activeTimers.delete(timer.id);
    trace.firedTimers.push(timer.id);
    timer.callback();
  }
}

function assertNoActiveTimers(trace, label) {
  assert.deepEqual(
    Array.from(trace.activeTimers.keys()),
    [],
    label + " must not leave fake timers active"
  );
}

function isReferenceError(error) {
  return !!error && error.name === "ReferenceError";
}

function exerciseRouting(context) {
  const routes = context.MusicStackRoutes;
  const cue = routes.reviewCue({
    active: true,
    genre: "techno",
    listening_trace: {
      current_genre: "techno",
      bpm: 132,
      switch_count: 2,
      dwell_ms_by_genre: { techno: 64000 }
    }
  });
  assert.equal(cue.schema, "hazama-fm-review-cue.v1", "routing cue schema drift");
  assert.equal(cue.metadata_only, true, "routing cue must remain metadata-only");
  assert.equal(cue.human_review_required, true, "routing cue must require human review");
  const recommendation = routes.routingRecommendation({
    selfReview: {
      densityRisk: 0.2,
      lowEndRisk: 0.1,
      brightnessRisk: 0.1,
      restraintScore: 0.8,
      referenceFit: 0.7
    },
    parts: {
      energy: 0.3,
      resource: 0.2,
      creation: 0.2,
      body: 0.2,
      voidness: 0.7,
      circle: 0.6,
      observer: 0.5
    },
    gradient: { micro: 0.2, ghost: 0.1, haze: 0.4, memory: 0.5 },
    kits: {
      technoKit: 0.1,
      pressureKit: 0.1,
      spaceKit: 0.6,
      ambientKit: 0.5,
      idmKit: 0.1
    },
    activePads: ["void"],
    producerHabitCuriosity: 0.2
  });
  assert.equal(recommendation.schema, "music.stack-routing-review.v1", "routing schema drift");
  assert.equal(recommendation.destination, "namima", "void routing should remain namima");
  assert.equal(recommendation.metadata_only, true, "routing recommendation must stay metadata-only");
}

function exerciseFocus(context, trace) {
  const focus = context.MusicFocusModulation;
  let state = focus.setEnabled(true, { force: true, depth: 0.05 });
  assert.equal(state.enabled, true, "focus mode should enable");
  assert.equal(state.active, true, "focus mode should become active");
  assert.equal(state.currentDepth, 0.05, "focus depth seam drift");
  assert.equal(trace.lfo.constructed, 1, "focus should construct one fake LFO");
  assert.equal(trace.lfo.connected, 1, "focus should connect the fake LFO");
  assert.equal(trace.lfo.started, 1, "focus should start the fake LFO");
  state = focus.setDepth(8);
  assert.equal(state.depth, 0.08, "focus setDepth should accept percentage input");
  assert.equal(state.targetDepth, 0.08, "focus setDepth target seam drift");
  state = focus.setEnabled(false, { force: true });
  assert.equal(state.enabled, false, "focus mode should disable");
  assert.equal(state.active, false, "focus mode should become inactive");
  assert.equal(trace.lfo.stopped, 1, "focus should stop the fake LFO");
  assert.equal(trace.lfo.disposed, 1, "focus should dispose the fake LFO");
  context.FmAiFill.status.active = true;
  state = focus.setEnabled(true, { force: true, depth: 0.05 });
  assert.equal(state.suppressedByAiFill, true, "AI fill should suppress focus modulation");
  assert.equal(state.active, false, "suppressed focus must stay inactive");
  assert.equal(trace.lfo.constructed, 1, "suppressed focus must not create another LFO");
  focus.setEnabled(false, { force: true });
  assertNoActiveTimers(trace, "focus cleanup");
}

function exerciseRecorder(context, trace) {
  const recorder = context.MusicRecorder;
  recorder.toggle();
  assert.equal(trace.media.constructedWith, trace.stream, "recorder must use engine recorderDestination.stream");
  assert.equal(trace.media.starts, 1, "recorder should start the fake MediaRecorder");
  assert.equal(recorder.state.recorder.state, "recording", "recorder state should be recording");
  assert.equal(trace.elements.get("btn_rec").textContent, "STOP REC", "recorder button start state drift");
  assert.equal(context.document.body.dataset.recording, "true", "recorder body state drift");
  recorder.toggle();
  assert.equal(trace.media.stops, 1, "recorder should stop the fake MediaRecorder");
  assert.equal(recorder.state.recorder, null, "recorder state should clear after stop");
  assert.equal(trace.elements.get("btn_rec").textContent, "REC", "recorder button stop state drift");
  assert.equal(trace.elements.get("rec_download").hidden, false, "recorder should expose the mock download");
  assert.equal(trace.objectUrls.length, 1, "recorder should create one mock object URL");
  assert.equal(trace.objectUrls[0].size, 2048, "recorder mock blob size drift");
  const firstObjectUrl = trace.objectUrls[0].value;
  recorder.toggle();
  assert.equal(trace.media.starts, 2, "recorder second cycle should start");
  assert.deepEqual(trace.revokedUrls, [firstObjectUrl], "recorder second start must revoke the first object URL");
  assert.equal(recorder.state.recorder.state, "recording", "recorder second cycle should be recording");
  recorder.toggle();
  assert.equal(trace.media.stops, 2, "recorder second cycle should stop");
  assert.equal(recorder.state.recorder, null, "recorder second cycle state should clear after stop");
  assert.equal(trace.objectUrls.length, 2, "recorder second cycle should create a replacement object URL");
  assert.notEqual(trace.objectUrls[1].value, firstObjectUrl, "recorder replacement object URL must be new");
  assert.equal(
    trace.revokedUrls.includes(trace.objectUrls[1].value),
    false,
    "recorder must keep the current download URL available"
  );
  assertNoActiveTimers(trace, "recorder two-cycle cleanup");
}

function exercisePacket(context, trace) {
  const kit = context.MusicPacketKit;
  assert.equal(kit.packetUnit(-1), 0, "packetUnit lower clamp drift");
  assert.equal(kit.packetUnit(2), 1, "packetUnit upper clamp drift");
  const createdAt = vm.runInContext('new Date("2026-08-02T00:00:00.000Z")', context);
  const packet = kit.buildMusicSessionPacket({
    createdAt
  });
  assert.equal(packet.version, 1, "session packet version drift");
  assert.equal(packet.source_repo, "Music", "session packet source drift");
  assert.equal(packet.session_id, "music-contract-session", "session packet id drift");
  assert.deepEqual(
    trace.makeMusicSessionIdCalls,
    ["2026-08-02T00:00:00.000Z"],
    "session packet must call the engine makeMusicSessionId seam"
  );
  assert.equal(packet.safety.metadata_only, true, "session packet must remain metadata-only");
  assert.equal(packet.safety.stores_audio, false, "session packet must not store audio");
  assert.equal(packet.safety.stores_samples, false, "session packet must not store samples");
  assert.equal(packet.safety.stores_lyrics, false, "session packet must not store lyrics");
  const orchestra = kit.buildMusicOrchestraPacket({ sessionPacket: packet });
  assert.equal(orchestra.version, "music-orchestra-packet.v1", "orchestra packet version drift");
  assert.equal(orchestra.promotion.status, "draft", "orchestra promotion must remain draft");
  assert.equal(orchestra.safety.no_audio, true, "orchestra packet must not contain audio");
  assert.equal(orchestra.safety.human_review_required, true, "orchestra packet must require review");
  const promotionCallsBeforeFallback = trace.promotionTargetCalls.length;
  const fallbackOrchestra = kit.buildMusicOrchestraPacket({
    sessionPacket: {
      ...packet,
      routing: {
        ...packet.routing,
        openclaw: {
          next_action: {
            destination: "namima",
            target_repo: "unsupported-contract-target"
          }
        }
      }
    }
  });
  assert.equal(fallbackOrchestra.promotion.target_repo, "namima", "orchestra fallback promotion target drift");
  assert.equal(
    trace.promotionTargetCalls.length,
    promotionCallsBeforeFallback + 1,
    "orchestra fallback must call promotionTargetFromDestination once"
  );
  assert.equal(trace.promotionTargetCalls.at(-1), "namima", "orchestra fallback destination seam drift");
  const result = kit.syncMusicSessionPacket({ packet });
  assert.equal(result.stored, true, "packet sync should use mock localStorage");
  assert.equal(result.broadcast, true, "packet sync should use mock BroadcastChannel");
  assert.equal(result.payload.schema, "qb.music-stack.packet-sync.v1", "packet sync schema drift");
  const orchestraSync = kit.syncMusicOrchestraPacket({ packet: orchestra });
  assert.equal(orchestraSync.stored, true, "orchestra sync should use mock localStorage");
  assert.equal(orchestraSync.broadcast, true, "orchestra sync should use mock BroadcastChannel");
  assert.equal(orchestraSync.payload.schema, "qb.music-stack.orchestra-packet-sync.v1", "orchestra sync schema drift");
  assert.equal(trace.storage.length, 3, "session + two orchestra payloads should be stored");
  assert.equal(trace.broadcasts.length, 3, "session + two orchestra payloads should be broadcast");
  assert.equal(trace.channels.length, 3, "each packet broadcast should construct one channel");
  assert.equal(trace.channels.every((channel) => channel.posts === 1), true, "each packet channel should post once");
  assert.equal(trace.channels.every((channel) => channel.closed), true, "packet broadcasts must close every channel");
  assert.equal(context.MusicSessionPacket.last.session_id, packet.session_id, "session facade last packet drift");
  assert.equal(context.MusicOrchestraPacket.last.version, orchestra.version, "orchestra facade last packet drift");
  assert.ok(
    trace.events.some((event) => event.type === "music-stack-packet-sync"),
    "packet sync should dispatch its CustomEvent"
  );
  assert.ok(
    trace.events.some((event) => event.type === "music-orchestra-packet-sync"),
    "orchestra sync should dispatch its CustomEvent"
  );
  const objectUrlsBeforeDownloads = trace.objectUrls.length;
  kit.downloadMusicSessionPacket();
  kit.downloadMusicOrchestraPacket();
  assert.equal(trace.anchors.length, 2, "packet download APIs should create two mock anchors");
  assert.equal(trace.anchors.every((anchor) => anchor.clicked === 1), true, "packet downloads should click their anchors");
  assert.equal(trace.anchors.every((anchor) => anchor.removed === 1), true, "packet downloads should remove their anchors");
  assert.equal(trace.objectUrls.length, objectUrlsBeforeDownloads + 2, "packet downloads should create two object URLs");
  const revokedBeforeDownloadCleanup = trace.revokedUrls.length;
  firePendingTimeouts(trace);
  assert.equal(
    trace.revokedUrls.length,
    revokedBeforeDownloadCleanup + 2,
    "packet download cleanup should revoke both object URLs"
  );
  assert.equal(trace.makeMusicSessionIdCalls.length, 3, "packet build/download paths should exercise session ID generation");
  assertNoActiveTimers(trace, "packet download cleanup");
}

function exerciseFeedback(context, trace) {
  const feedback = context.MusicHazamaFeedback;
  const before = trace.posts.length;
  feedback.request("contract");
  assert.equal(trace.posts.length, before + HAZAMA_TARGET_ORIGINS.length, "Hazama feedback should post once per target origin");
  const posts = trace.posts.slice(before);
  assert.deepEqual(posts.map((post) => post.origin), HAZAMA_TARGET_ORIGINS, "Hazama feedback origins drift");
  const post = posts[0];
  assert.equal(post.payload.type, "music-runtime-feedback", "Hazama feedback type drift");
  assert.equal(post.payload.version, 1, "Hazama feedback version drift");
  assert.equal(post.payload.provider, "music", "Hazama feedback provider drift");
  assert.equal(post.payload.runtime.event.kind, "contract", "Hazama feedback event kind drift");
  assert.equal(post.payload.capabilities.feedbackVersion, 1, "Hazama feedback capability drift");
  vm.runInContext("HazamaBridgeState.loaded = false; HazamaBridgeState.active = false;", context);
  feedback.maybeSend();
  assert.equal(
    trace.posts.length,
    before + HAZAMA_TARGET_ORIGINS.length,
    "inactive Hazama bridge must not post feedback"
  );
}

function exerciseMissingSeams() {
  const bare = loadBareSatelliteContext();
  assert.throws(
    () => bare.context.MusicFocusModulation.setEnabled(true, { force: true }),
    isReferenceError,
    "focus call must fail when its engine seam is absent"
  );
  assert.throws(
    () => bare.context.MusicRecorder.start(),
    isReferenceError,
    "recorder call must fail when recorderDestination is absent"
  );
  assert.throws(
    () => bare.context.MusicPacketKit.buildMusicSessionPacket(),
    isReferenceError,
    "packet build must fail when engine state is absent"
  );
  assert.throws(
    () => bare.context.MusicHazamaFeedback.request("contract"),
    isReferenceError,
    "feedback request must fail when HazamaBridgeState is absent"
  );
}

function exerciseOptionalFallbacks() {
  const noRecorder = loadBareSatelliteContext({ mediaRecorder: false });
  assert.doesNotThrow(
    () => noRecorder.context.MusicRecorder.start(),
    "missing MediaRecorder should use the fallback"
  );
  assert.equal(
    noRecorder.trace.elements.get("status-text").textContent,
    "Recorder unavailable on this browser",
    "recorder fallback message drift"
  );

  const noStorage = loadBareSatelliteContext({
    storageThrows: true,
    broadcastThrows: true
  });
  installEngineFixture(noStorage.context);
  const createdAt = vm.runInContext('new Date("2026-08-02T00:00:00.000Z")', noStorage.context);
  const packet = noStorage.context.MusicPacketKit.buildMusicSessionPacket({
    createdAt,
    sessionId: "music-contract-no-storage"
  });
  const sync = noStorage.context.MusicPacketKit.syncMusicSessionPacket({ packet });
  assert.equal(sync.stored, false, "storage failure should report stored=false");
  assert.equal(sync.broadcast, false, "BroadcastChannel failure should report broadcast=false");

  const noLfo = loadBareSatelliteContext({ lfoThrows: true });
  installEngineFixture(noLfo.context);
  const state = noLfo.context.MusicFocusModulation.setEnabled(true, {
    force: true,
    depth: 0.05
  });
  assert.equal(state.enabled, true, "focus preference should remain enabled when LFO is unavailable");
  assert.equal(state.active, false, "focus should degrade inactive when LFO is unavailable");
  assert.ok(noLfo.trace.warnings.length > 0, "focus LFO fallback should emit a warning");
  noLfo.context.MusicFocusModulation.setEnabled(false, { force: true });
}

const htmlByHost = Object.fromEntries(HOSTS.map((path) => [path, read(path)]));
for (const host of HOSTS) assertHostContract(htmlByHost[host], host);
assertHostValidatorNegatives(htmlByHost["fm.html"]);
const serviceWorkerSource = read("sw.js");
const engineMarker = assertServiceWorkerPresence(serviceWorkerSource);
assertServiceWorkerValidatorNegatives(serviceWorkerSource);
const engineSource = read(ENGINE_PATH);
const fixtureSource = read(FIXTURE_PATH);
const dependencies = assertEngineDependencyContract(engineSource, fixtureSource);
assertDependencyValidatorNegatives(engineSource, fixtureSource);

const positive = loadBareSatelliteContext();
for (const name of dependencies) {
  assert.equal(
    vm.runInContext("typeof " + name, positive.context, { timeout: 1000 }),
    "undefined",
    "satellites must load before engine dependency " + name
  );
}
installEngineFixture(positive.context);
for (const name of dependencies) {
  assert.notEqual(
    vm.runInContext("typeof " + name, positive.context, { timeout: 1000 }),
    "undefined",
    "engine fixture did not provide " + name
  );
}

exerciseRouting(positive.context);
exerciseFocus(positive.context, positive.trace);
exerciseRecorder(positive.context, positive.trace);
exercisePacket(positive.context, positive.trace);
exerciseFeedback(positive.context, positive.trace);
exerciseMissingSeams();
exerciseOptionalFallbacks();

console.log(
  "Music satellite contract check passed (" +
  SATELLITES.length + " satellites; FM/Core order; 5 live API groups; " +
  dependencies.length + " delayed globals; engine not executed; " + engineMarker + ")"
);
