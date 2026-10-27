import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync("band-room.html", "utf8");
const begin = html.indexOf("    // v84: Service Worker registration");
const end = html.indexOf("  </script>", begin);
assert.ok(begin >= 0 && end > begin);
const script = html.slice(begin, end);

async function scenario({ failure = false, installing = false } = {}) {
  let loads = 0, updates = 0, reloads = 0;
  const element = () => ({ hidden: true, disabled: false, textContent: "", style: {},
    handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } });
  const elements = Object.fromEntries(["br-update-check", "br-update-status", "br-sw-message",
    "br-sw-update", "br-sw-reload", "br-sw-dismiss"].map(id => [id, element()]));
  const worker = installing ? { state: "installing", listeners: new Set(),
    addEventListener(type, fn) { this.listeners.add(fn); },
    removeEventListener(type, fn) { this.listeners.delete(fn); } } : null;
  const registration = { waiting: null, installing: worker,
    async update() {
      updates++;
      if (failure) throw Error("offline");
      if (worker) setTimeout(() => { worker.state = "activated"; for (const fn of worker.listeners) fn(); }, 1);
    }, addEventListener() {} };
  const serviceWorker = { controller: null, register: async () => registration, addEventListener() {} };
  const env = { navigator: { serviceWorker }, document: { getElementById: id => elements[id] },
    window: { addEventListener(type, fn) { if (type === "load") loads = fn; }, location: { reload() { reloads++; } } },
    setTimeout, clearTimeout, console: { warn() {} } };
  vm.runInNewContext(script, env);
  loads();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements["br-update-check"].hidden, false);
  // Startup also checks for an update; this button must work independently.
  await elements["br-update-check"].handlers.click();
  assert.equal(elements["br-update-check"].disabled, false);
  assert.ok(updates >= 2);
  assert.equal(reloads, 0, "Checking must not stop playback or discard a recording");
  if (failure) {
    assert.match(elements["br-update-status"].textContent, /確認できませんでした/);
    assert.notEqual(elements["br-sw-update"].style.display, "flex");
  } else {
    assert.equal(elements["br-sw-update"].style.display, "flex");
    assert.match(elements["br-sw-message"].textContent, /再生・録音は停止/);
    elements["br-sw-reload"].handlers.click();
    assert.equal(reloads, 1, "Only the explicit reload applies the new page");
  }
}

await scenario();
await scenario({ installing: true });
await scenario({ failure: true });
console.log("Band Room update: explicit check, install wait, offline error and user-controlled reload passed");
