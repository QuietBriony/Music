import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { pathToFileURL } from "node:url";

const ROOT_URL = "https://quietbriony.github.io/Music/";
const API_URL = `${ROOT_URL}api/lyric-drafts`;
const TOKEN = "test-sync-token";

const { onRequest } = await import(
  `${pathToFileURL("functions/api/lyric-drafts.js").href}?contract-check=${Date.now()}`
);

class FakeStatement {
  constructor(db, query) {
    this.db = db;
    this.query = query;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    this.db.binds.push({ query: this.query, values });
    return this;
  }

  async all() {
    if (this.db.failAll) throw new Error("simulated D1 all failure");
    return { results: this.db.results };
  }

  async run() {
    if (this.db.failRun) throw new Error("simulated D1 run failure");
    return { success: true };
  }
}

class FakeD1 {
  constructor({ failAll = false, failBatch = false, failRun = false, results = [] } = {}) {
    this.failAll = failAll;
    this.failBatch = failBatch;
    this.failRun = failRun;
    this.results = results;
    this.binds = [];
  }

  prepare(query) {
    return new FakeStatement(this, query);
  }

  async batch(statements) {
    assert.ok(Array.isArray(statements), "D1 batch should receive an array");
    if (this.failBatch) throw new Error("simulated D1 batch failure");
    return statements.map(() => ({ success: true }));
  }
}

function apiRequest(method = "GET", { body, token = TOKEN, url = API_URL, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set("X-Lyric-Lab-Token", token);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  return new Request(url, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function callApi(request, env = {}) {
  return onRequest({
    request,
    env: {
      LYRIC_LAB_TOKEN: TOKEN,
      LYRIC_LAB_DB: new FakeD1(),
      ...env
    }
  });
}

{
  const response = await callApi(apiRequest("GET", { token: "wrong-token" }));
  assert.equal(response.status, 401, "API should reject an invalid sync token");
}

{
  const response = await onRequest({
    request: apiRequest("GET", { token: null }),
    env: { LYRIC_LAB_ALLOW_OPEN: "1", LYRIC_LAB_DB: new FakeD1() }
  });
  assert.equal(response.status, 503, "API should fail closed when LYRIC_LAB_TOKEN is missing, even with a legacy open flag");
}

{
  const response = await onRequest({
    request: apiRequest("GET"),
    env: { LYRIC_LAB_TOKEN: TOKEN }
  });
  assert.equal(response.status, 503, "API should stay unavailable when the D1 binding is missing");
}

for (const invalid of [null, "draft", 7, true, []]) {
  const response = await callApi(apiRequest("POST", { body: { drafts: [invalid] } }));
  assert.equal(response.status, 400, `API should reject non-object draft ${JSON.stringify(invalid)}`);
}

{
  const db = new FakeD1();
  const response = await callApi(
    apiRequest("GET", { url: `${API_URL}?limit=not-a-number` }),
    { LYRIC_LAB_DB: db }
  );
  assert.equal(response.status, 200, "invalid list limit should use a safe default");
  assert.match(response.headers.get("cache-control") || "", /\bno-store\b/, "private API responses must not be cacheable");
  assert.match(response.headers.get("vary") || "", /X-Lyric-Lab-Token/i, "private API responses should vary on the sync token");
  assert.equal(db.binds.at(-1)?.values[0], 100, "invalid list limit should bind the default of 100");
}

{
  const oversized = { payload: "x".repeat(256_001) };
  const response = await callApi(apiRequest("POST", { body: { drafts: [{ settings: oversized }] } }));
  assert.equal(response.status, 413, "API should bound serialized settings/result data");
}

{
  const response = await callApi(apiRequest("POST", {
    body: { drafts: [{ id: "large-body", seed: "x".repeat(2_000_100) }] }
  }));
  assert.equal(response.status, 413, "API should enforce the actual request-body byte limit without trusting headers");
}

{
  const response = await callApi(
    apiRequest("POST", { body: { drafts: [{ id: "d1", title: "Draft" }] } }),
    { LYRIC_LAB_DB: new FakeD1({ failBatch: true }) }
  );
  assert.equal(response.status, 500, "D1 async rejection should become a stable 500 response");
  assert.equal(await response.text(), "Lyric draft API failed.");
}


for (const [request, db] of [
  [apiRequest("GET"), new FakeD1({ failAll: true })],
  [apiRequest("DELETE", { url: `${API_URL}?id=d1` }), new FakeD1({ failRun: true })]
]) {
  const response = await callApi(request, { LYRIC_LAB_DB: db });
  assert.equal(response.status, 500, "all async D1 handlers should return a stable 500 response");
  assert.equal(await response.text(), "Lyric draft API failed.");
}

function loadServiceWorkerHarness(cacheKeys) {
  const listeners = new Map();
  const deleted = [];
  const opened = [];
  const cacheSet = new Set(cacheKeys);
  const caches = {
    async keys() {
      return [...cacheSet];
    },
    async delete(key) {
      deleted.push(key);
      return cacheSet.delete(key);
    },
    async open(key) {
      opened.push(key);
      return {
        async add() {},
        async put() {}
      };
    },
    async match() {
      return undefined;
    }
  };
  const self = {
    location: { origin: "https://quietbriony.github.io" },
    clients: { async claim() {} },
    async skipWaiting() {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };
  const sandbox = {
    AbortController,
    Promise,
    Request,
    Response,
    URL,
    caches,
    console,
    fetch: async () => new Response("network"),
    self,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(readFileSync("sw.js", "utf8"), sandbox, { filename: "sw.js" });
  return { cacheSet, deleted, listeners, opened };
}

const swSource = readFileSync("sw.js", "utf8");
const version = swSource.match(/const VERSION = "(hazama-fm-v\d+)";/)?.[1];
assert.ok(version, "Service worker should expose a hazama-fm-vN version");

{
  const currentStatic = `${version}-static`;
  const currentRuntime = `${version}-runtime`;
  const oldMusic = "hazama-fm-v1-static";
  const sisterCaches = ["chill-pwa-v9", "drum-floor-pwa-v3", "namima-pwa-v8", "openclaw-pwa-v4"];
  const harness = loadServiceWorkerHarness([
    oldMusic,
    currentStatic,
    currentRuntime,
    ...sisterCaches
  ]);
  let activation;
  harness.listeners.get("activate")({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.ok(harness.deleted.includes(oldMusic), "activate should delete an old Hazama FM cache");
  assert.ok(harness.cacheSet.has(currentStatic), "activate should preserve the current static cache");
  assert.ok(harness.cacheSet.has(currentRuntime), "activate should preserve the current runtime cache");
  for (const key of sisterCaches) {
    assert.ok(harness.cacheSet.has(key), `activate should preserve sister cache ${key}`);
  }
}

for (const path of ["api/lyric-drafts", "api/lyric-drafts?id=d1"]) {
  const harness = loadServiceWorkerHarness([]);
  let responded = false;
  harness.listeners.get("fetch")({
    request: new Request(`${ROOT_URL}${path}`),
    respondWith() {
      responded = true;
    }
  });
  assert.equal(responded, false, `Service worker should bypass authenticated API request ${path}`);
  assert.deepEqual(harness.opened, [], "API bypass should not open a cache");
}

{
  const harness = loadServiceWorkerHarness([]);
  let responsePromise = null;
  harness.listeners.get("fetch")({
    request: new Request(`${ROOT_URL}fm.css`),
    respondWith(value) {
      responsePromise = Promise.resolve(value);
    }
  });
  assert.ok(responsePromise, "Service worker should still intercept an ordinary same-origin static GET");
  const response = await responsePromise;
  assert.equal(await response.text(), "network", "ordinary static GET should retain the normal network/cache path");
}

console.log("Cloudflare/PWA contract check passed");
