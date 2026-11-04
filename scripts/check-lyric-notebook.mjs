import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { spawnSync } from "node:child_process";

const html = readFileSync("lyric-lab.html", "utf8");
const client = readFileSync("lyric-lab.js", "utf8");
const model = readFileSync("lyric-notebook-model.js", "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
class Element {
  value = ""; textContent = ""; children = []; hidden = false; dataset = {}; parentElement = {};
  append(...els) { this.children.push(...els); }
  replaceChildren(...els) { this.children = els; }
  addEventListener() {} focus() {} click() {} removeAttribute() {}
}
function harness(storage = new Map()) {
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const context = vm.createContext({ console, crypto: webcrypto, Date, Intl, URL, URLSearchParams, Blob, setTimeout,
    navigator: {}, localStorage, location: { hash: "#shelf" }, history: { replaceState() {} },
    window: { addEventListener() {}, scrollTo() {}, confirm: () => true },
    document: { getElementById: id => { assert.ok(elements[id], `missing #${id}`); return elements[id]; }, createElement: () => new Element(), querySelectorAll: () => [] }
  });
  vm.runInContext(model + "\n" + client, context);
  return { elements, context, storage, run: code => vm.runInContext(code, context) };
}
const h = harness();
assert.equal(h.run("NB.body({result:{final:'',draft:'legacy draft'},seed:'legacy seed'})"), "legacy draft");
assert.equal(h.run("NB.body({result:{final:'',draft:''},seed:'legacy seed'})"), "legacy seed");
await h.run("importLibraryJson({text: async () => JSON.stringify({drafts:[{id:'bad',result:{notes:'broken'}}]})})");
assert.equal(h.run("state.library.length"), 0, "invalid backup must not mutate the library");
const set = (id, value) => { h.elements[id].value = value; };
h.run("startNewDraft()");
assert.match(h.elements["ll-saved-state"].textContent, /まだ保存/);
set("ll-title", "Test title"); set("ll-view-final", "first\n\nsecond");
await h.run("saveFinal()");
assert.equal(h.elements["ll-poem"].textContent, "first\n\nsecond");
const id = h.run("state.working.id");
h.run("state.working.settings.extra = { preserved: true }; state.working.result.production = 'custom sound directions';");
set("ll-note", "personal note"); set("ll-sound-note", "quiet voice");
await h.run("addNote({preventDefault(){}})");
assert.equal(h.run("state.working.result.notes.length"), 1);
assert.equal(h.run("state.working.result.soundNote"), "quiet voice");
set("ll-view-final", "revision");
await h.run("saveFinal()");
assert.equal(h.run("state.working.result.original.text"), "first\n\nsecond");
assert.equal(h.run("state.working.result.revisions[0].text"), "first\n\nsecond");
assert.equal(h.run("state.working.settings.extra.preserved"), true);
assert.equal(h.run("state.working.result.production"), "custom sound directions");
await h.run("forkDraftToLibrary()");
assert.notEqual(h.run("state.working.id"), id);
assert.equal(h.run("NB.body(state.working)"), "revision", "fork must copy, never generate");
h.run("state.working.result.notes[0].text = 'changed on copy'");
assert.equal(h.run(`state.library.find(i => i.id === ${JSON.stringify(id)}).result.notes[0].text`), "personal note", "no result aliases");
set("ll-view-final", "unsaved revision"); h.run("state.editing = true; markDirty()");
const reopened = harness(h.storage);
assert.ok(reopened.run("state.resume"));
reopened.run("persist(); resumeWorkspace()");
assert.equal(reopened.elements["ll-view-final"].value, "unsaved revision");
// A cloud pull must preserve the base revision of an open dirty editor.
const fresh = JSON.parse(h.run("JSON.stringify(state.working)")); fresh.updatedAt = "2099-01-01T00:00:00.000Z"; fresh.result.final = "other device";
h.run(`state.bases[state.working.id] = '2026-01-01T00:00:00.000Z'; delete state.pending[state.working.id]`);
set("ll-sync-token-main", "fixture-token");
h.context.fetch = async () => ({ ok: true, json: async () => ({ drafts: [fresh] }) });
await h.run("cloudPull()");
assert.equal(h.run("state.bases[state.working.id]"), "2026-01-01T00:00:00.000Z");
assert.equal(h.elements["ll-view-final"].value, "unsaved revision");
let sent;
h.context.fetch = async (_url, init) => { sent = JSON.parse(init.body); return { status: 409, ok: false }; };
await h.run("saveFinal()");
assert.equal(sent.drafts.length, 1, "only changed poem is posted");
assert.equal(sent.drafts[0].baseUpdatedAt, "2026-01-01T00:00:00.000Z");
assert.ok(h.run("state.conflicts[state.working.id]"));
assert.equal(h.run("NB.body(state.working)"), "unsaved revision");
h.context.localStorage.setItem = () => { throw new Error("quota"); };
set("ll-view-final", "quota text"); await h.run("saveFinal()");
assert.match(h.elements["ll-saved-state"].textContent, /保存に失敗/);
assert.equal(h.run("NB.body(state.working)"), "quota text");

const race = harness();
race.run("startNewDraft()");
race.elements["ll-view-final"].value = "sending";
race.elements["ll-sync-token-main"].value = "fixture-token";
race.context.fetch = async () => {
  race.run("state.library[0].updatedAt = '2099-01-01T00:00:00.000Z'; state.library[0].result.final = 'typed during sync'; state.pending[state.library[0].id] = true");
  return { ok: true, status: 200 };
};
await race.run("saveFinal()");
assert.equal(race.run("Object.keys(state.pending).length"), 1);
assert.match(race.elements["ll-status"].textContent, /新しい変更/, "an older response must not claim a new edit was synced");

const legacyStorage = new Map([["music-stack.lyric-lab.library.v1", JSON.stringify([{id:"offline-legacy",title:"Test",result:{final:"local revision"},updatedAt:"2026-02-01T00:00:00.000Z"}])]]);
const legacy = harness(legacyStorage);
legacy.elements["ll-sync-token-main"].value = "fixture-token";
legacy.context.fetch = async () => ({ok:true,json:async()=>({drafts:[{id:"offline-legacy",result:{final:"older cloud"},updatedAt:"2026-01-01T00:00:00.000Z"}]})});
await legacy.run("cloudPull()");
assert.equal(legacy.run("state.library[0].result.final"), "local revision", "migration must not discard newer offline work");
assert.equal(legacy.run("state.pending['offline-legacy']"), true);

// Exercise the actual upsert SQL against SQLite, including stale devices.
const api = await import(`data:text/javascript;base64,${Buffer.from(readFileSync("functions/api/lyric-drafts.js", "utf8")).toString("base64")}`);
const py = `import sqlite3,json,sys\np=json.load(sys.stdin); d=sqlite3.connect(':memory:'); d.row_factory=sqlite3.Row\nd.execute('CREATE TABLE lyric_drafts(id TEXT PRIMARY KEY,title TEXT,source_url TEXT,seed TEXT,settings_json TEXT,result_json TEXT,reroll INTEGER,active_view TEXT,created_at TEXT,updated_at TEXT)')\nfor r in p['rows']: d.execute('INSERT INTO lyric_drafts VALUES(?,?,?,?,?,?,?,?,?,?)',list(r.values()))\nchanges=[]\nfor s in p['statements']: changes.append(d.execute(s['sql'],s['values']).rowcount)\nprint(json.dumps({'changes':changes,'rows':[dict(r) for r in d.execute('SELECT * FROM lyric_drafts')]}))`;
const db = { rows: [], prepare(sql) { return { bind(...values) { return { sql, values }; } }; }, async batch(statements) {
  const child = spawnSync("python", ["-X", "utf8", "-c", py], { input: JSON.stringify({ rows: this.rows, statements }), encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  const out = JSON.parse(child.stdout); this.rows = out.rows; return out.changes.map(changes => ({ meta: { changes } }));
} };
const post = draft => api.onRequest({ env: { LYRIC_LAB_TOKEN: "fixture-token", LYRIC_LAB_DB: db }, request: new Request("https://test.invalid/api/lyric-drafts", { method: "POST", headers: { "X-Lyric-Lab-Token": "fixture-token" }, body: JSON.stringify({ drafts: [draft] }) }) });
const draft = { id: "sql-test", title: "Test", result: { final: "initial" }, updatedAt: "2026-01-01T00:00:00.000Z", baseUpdatedAt: null };
assert.equal((await post(draft)).status, 200);
assert.equal((await post({ ...draft, result: { final: "new" }, updatedAt: "2026-01-02T00:00:00.000Z", baseUpdatedAt: draft.updatedAt })).status, 200);
assert.equal((await post({ ...draft, result: { final: "stale" }, updatedAt: "2026-01-03T00:00:00.000Z", baseUpdatedAt: draft.updatedAt })).status, 409);
assert.equal((await post({ ...draft, updatedAt: "2026-01-04T00:00:00.000Z" })).status, 409, "unverified copy cannot overwrite cloud");
delete draft.baseUpdatedAt;
assert.equal((await post(draft)).status, 409, "legacy old timestamp cannot replace newer row");
assert.equal((await post({ ...draft, updatedAt: "2099-01-01T00:00:00.000Z" })).status, 409, "legacy clients must refresh before updating existing records");
assert.equal(JSON.parse(db.rows[0].result_json).final, "new");
console.log("Lyric notebook: preservation, resume, quota, selective sync and SQLite concurrency passed");
