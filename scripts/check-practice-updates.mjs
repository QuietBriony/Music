import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { readFirstSong, FIRST_SONGS } from '../practice/first-song.mjs';

const source = readFileSync('practice/sw.js', 'utf8');
function fixture({ htmlVersion = '36' } = {}) {
  const listeners = {}, stores = new Map();
  let clients = [{ id: 'one', url: 'https://example.test/practice/' }], network = 0, skipped = 0;
  const key = request => typeof request === 'string' ? request : request.url;
  const cacheFor = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return { async match(request) { const stored = entries.get(key(request)), copy = stored?.clone(); if (stored?.redirected) Object.defineProperty(copy, 'redirected', { value: true }); return copy; },
      async addAll(requests) { for (const request of requests) { const response = new Response(new URL(request.url).pathname.match(/practice\/(index.html)?$/) ? `<meta name="practice-version" content="${htmlVersion}">` : 'snapshot:' + request.url); if (request.url.endsWith('/index.html')) Object.defineProperty(response, 'redirected', { value: true }); entries.set(key(request), response); } },
      async put(request, response) { entries.set(key(request), response); } };
  };
  const caches = { open: async name => cacheFor(name), keys: async () => [...stores.keys()], delete: async name => stores.delete(name) };
  vm.runInNewContext(source, { URL, Request, Response, caches, fetch: async () => { network++; return new Response('different-deployment'); },
    self: { location: { href: 'https://example.test/practice/sw.js' }, clients: { claim: async () => {}, matchAll: async () => clients },
      skipWaiting: async () => { skipped++; }, addEventListener: (type, listener) => { listeners[type] = listener; } } });
  const fire = async (type, options = {}) => {
    let promise; listeners[type]({ ...options, waitUntil: p => { promise = p; }, respondWith: p => { promise = p; } }); return promise;
  };
  return { fire, caches, stores, network: () => network, skipped: () => skipped, setClients: value => { clients = value; } };
}

const f = fixture();
await (await f.caches.open('music-practice-v30')).put('https://example.test/practice/app.mjs?v=30', new Response('old-module'));
await f.caches.open('unrelated-root-cache');
await f.fire('install'); assert.equal(f.skipped(), 0, 'Installing an update does not interrupt practice');
assert.equal((await (await f.caches.open('music-practice-v36')).match('https://example.test/practice/index.html')).redirected, false, 'Install repairs redirected HTML without changing its content');
await f.fire('activate'); assert.ok(f.stores.has('music-practice-v30'), 'Activation preserves modules used by other tabs');
for (const path of ['/?practice-update=36', '/index.html?from=home', '/index.html#reading-help']) {
  const response = await f.fire('fetch', { request: { url: 'https://example.test/practice' + path, method: 'GET', mode: 'navigate' } });
  assert.equal(response.redirected, false, 'Cached navigation never returns a followed redirect');
  assert.match(await response.text(), /content="36"/, 'Navigation gets the installed HTML, including queries and fragments');
}
const redirected = new Response('<meta name="practice-version" content="36">'); Object.defineProperty(redirected, 'redirected', { value: true });
await (await f.caches.open('music-practice-v36')).put('https://example.test/practice/index.html', redirected);
const repaired = await f.fire('fetch', { request: { url: 'https://example.test/practice/', method: 'GET', mode: 'navigate' } });
assert.equal(repaired.redirected, false); assert.match(await repaired.text(), /content="36"/, 'Fetch also repairs an existing redirected navigation response');
const asset = await f.fire('fetch', { request: { url: 'https://example.test/practice/app.mjs?v=36', method: 'GET', mode: 'cors' } });
assert.match(await asset.text(), /snapshot:/); assert.equal(f.network(), 0, 'A live deployment cannot mix new JS with installed HTML');
const previous = await f.fire('fetch', { request: { url: 'https://example.test/practice/app.mjs?v=30', method: 'GET', mode: 'cors' } });
assert.equal(await previous.text(), 'old-module', 'An older open tab gets its matching module');
for (const request of [{ url: 'https://example.test/private', method: 'GET', mode: 'cors' }, { url: 'https://example.test/practice/', method: 'POST', mode: 'cors' }]) assert.equal(await f.fire('fetch', { request }), undefined);
let reported; await f.fire('message', { data: { type: 'PRACTICE_VERSION' }, ports: [{ postMessage: value => { reported = value.version; } }] }); assert.equal(reported, '36');
await f.fire('message', { data: { type: 'PRACTICE_ACTIVATE' }, ports: [] }); assert.equal(f.skipped(), 1, 'Activation needs the explicit update command');
f.setClients([{ id: 'one', url: 'https://example.test/practice/' }, { id: 'two', url: 'https://example.test/practice/index.html' }]);
await f.fire('message', { data: { type: 'PRACTICE_CLEAN', version: '36' }, source: { id: 'one' }, ports: [] }); assert.ok(f.stores.has('music-practice-v30'));
f.setClients([{ id: 'one', url: 'https://example.test/practice/' }]);
await f.fire('message', { data: { type: 'PRACTICE_CLEAN', version: '30' }, source: { id: 'one' }, ports: [] }); assert.ok(f.stores.has('music-practice-v30'), 'An old document cannot clean newer caches');
await f.fire('message', { data: { type: 'PRACTICE_CLEAN', version: '36' }, source: { id: 'one' }, ports: [] });
assert.ok(!f.stores.has('music-practice-v30')); assert.ok(f.stores.has('music-practice-v36')); assert.ok(f.stores.has('unrelated-root-cache'));
const stale = fixture({ htmlVersion: '30' }); await stale.caches.open('music-practice-v30');
await assert.rejects(() => stale.fire('install'), /Incomplete practice release/);
assert.ok(!stale.stores.has('music-practice-v36')); assert.ok(stale.stores.has('music-practice-v30')); assert.equal(stale.skipped(), 0);
assert.deepEqual(readFirstSong(null), { guitar: { step: 0 }, sanshin: { step: 0 } });
assert.deepEqual(readFirstSong({ guitar: { step: 3 }, sanshin: { step: -1 }, injected: true }), { guitar: { step: 3 }, sanshin: { step: 0 } });
assert.equal(readFirstSong({ guitar: { step: '3' } }).guitar.step, 0);
assert.equal(FIRST_SONGS.guitar.song, 'twinkle'); assert.equal(FIRST_SONGS.sanshin.song, 'tinsagu');
console.log('Practice updates: coherent snapshot, staged activation, old tabs, safe cleanup, stale HTML rejection and independent first-song progress PASS');

// A usable offline worker must not wait for WebKit's network registration.
const updateSource=readFileSync('practice/app-update.mjs','utf8').replace(/^export /gm,'');
async function offlineBoot({active=true,rejected=false,disappeared=false}={}){
 const nodes=Object.fromEntries(['offline-state','practice-update','practice-update-now'].map(id=>[id,{textContent:'PWAを準備中',hidden:true}]));
 class Channel{constructor(){this.port1={close(){}};this.port2={reply:data=>this.port1.onmessage?.({data})};}}
 const controller=active?{postMessage(message,ports){if(disappeared)throw Error('Worker no longer active');if(message.type==='PRACTICE_VERSION')ports[0].reply({version:'36'});}}:null;
 const serviceWorker={controller,addEventListener(){},register(){return rejected?Promise.reject(Error('Offline')):new Promise(()=>{});}};
 vm.runInNewContext(updateSource+'\nmountPracticeUpdates({onPause(){}});',{document:{getElementById:id=>nodes[id]},navigator:{serviceWorker},window:{isSecureContext:true},MessageChannel:Channel,setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));return nodes['offline-state'].textContent;
}
assert.equal(await offlineBoot(),'オフライン準備OK','Pending registration cannot hide an installed offline shell');
assert.equal(await offlineBoot({rejected:true}),'オフライン準備OK','Registration failure cannot erase confirmed offline readiness');
assert.equal(await offlineBoot({active:false,rejected:true}),'オンラインで利用できます','No worker never claims offline readiness');
assert.equal(await offlineBoot({disappeared:true,rejected:true}),'オンラインで利用できます','A worker disappearing during startup is handled');
console.log('Practice offline boot: pending/rejected registration, ready controller and disappearing worker PASS');
