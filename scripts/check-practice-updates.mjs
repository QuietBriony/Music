import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { readFirstSong, FIRST_SONGS } from '../practice/first-song.mjs';

const source = readFileSync('practice/sw.js', 'utf8');
function fixture({ htmlVersion = '41' } = {}) {
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
assert.equal((await (await f.caches.open('music-practice-v41')).match('https://example.test/practice/index.html')).redirected, false, 'Install repairs redirected HTML without changing its content');
await f.fire('activate'); assert.ok(f.stores.has('music-practice-v30'), 'Activation preserves modules used by other tabs');
for (const path of ['/?practice-update=40', '/index.html?from=home', '/index.html#reading-help']) {
  const response = await f.fire('fetch', { request: { url: 'https://example.test/practice' + path, method: 'GET', mode: 'navigate' } });
  assert.equal(response.redirected, false, 'Cached navigation never returns a followed redirect');
  assert.match(await response.text(), /content="41"/, 'Navigation gets the installed HTML, including queries and fragments');
}
const redirected = new Response('<meta name="practice-version" content="41">'); Object.defineProperty(redirected, 'redirected', { value: true });
await (await f.caches.open('music-practice-v41')).put('https://example.test/practice/index.html', redirected);
const repaired = await f.fire('fetch', { request: { url: 'https://example.test/practice/', method: 'GET', mode: 'navigate' } });
assert.equal(repaired.redirected, false); assert.match(await repaired.text(), /content="41"/, 'Fetch also repairs an existing redirected navigation response');
const asset = await f.fire('fetch', { request: { url: 'https://example.test/practice/app.mjs?v=41', method: 'GET', mode: 'cors' } });
assert.match(await asset.text(), /snapshot:/); assert.equal(f.network(), 0, 'A live deployment cannot mix new JS with installed HTML');
const previous = await f.fire('fetch', { request: { url: 'https://example.test/practice/app.mjs?v=30', method: 'GET', mode: 'cors' } });
assert.equal(await previous.text(), 'old-module', 'An older open tab gets its matching module');
for (const request of [{ url: 'https://example.test/private', method: 'GET', mode: 'cors' }, { url: 'https://example.test/practice/', method: 'POST', mode: 'cors' }]) assert.equal(await f.fire('fetch', { request }), undefined);
let reported; await f.fire('message', { data: { type: 'PRACTICE_VERSION' }, ports: [{ postMessage: value => { reported = value.version; } }] }); assert.equal(reported, '41');
await f.fire('message', { data: { type: 'PRACTICE_ACTIVATE' }, ports: [] }); assert.equal(f.skipped(), 1, 'Activation needs the explicit update command');
f.setClients([{ id: 'one', url: 'https://example.test/practice/' }, { id: 'two', url: 'https://example.test/practice/index.html' }]);
await f.fire('message', { data: { type: 'PRACTICE_CLEAN', version: '41' }, source: { id: 'one' }, ports: [] }); assert.ok(f.stores.has('music-practice-v30'));
f.setClients([{ id: 'one', url: 'https://example.test/practice/' }]);
await f.fire('message', { data: { type: 'PRACTICE_CLEAN', version: '30' }, source: { id: 'one' }, ports: [] }); assert.ok(f.stores.has('music-practice-v30'), 'An old document cannot clean newer caches');
await f.fire('message', { data: { type: 'PRACTICE_CLEAN', version: '41' }, source: { id: 'one' }, ports: [] });
assert.ok(!f.stores.has('music-practice-v30')); assert.ok(f.stores.has('music-practice-v41')); assert.ok(f.stores.has('unrelated-root-cache'));
const stale = fixture({ htmlVersion: '30' }); await stale.caches.open('music-practice-v30');
await assert.rejects(() => stale.fire('install'), /Incomplete practice release/);
assert.ok(!stale.stores.has('music-practice-v41')); assert.ok(stale.stores.has('music-practice-v30')); assert.equal(stale.skipped(), 0);
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
 const controller=active?{postMessage(message,ports){if(disappeared)throw Error('Worker no longer active');if(message.type==='PRACTICE_VERSION')ports[0].reply({version:'41'});}}:null;
 const serviceWorker={controller,addEventListener(){},register(){return rejected?Promise.reject(Error('Offline')):new Promise(()=>{});}};
 vm.runInNewContext(updateSource+'\nmountPracticeUpdates({onPause(){}});',{document:{getElementById:id=>nodes[id]},navigator:{serviceWorker},window:{isSecureContext:true},MessageChannel:Channel,setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));return nodes['offline-state'].textContent;
}
assert.equal(await offlineBoot(),'オフライン準備OK','Pending registration cannot hide an installed offline shell');
assert.equal(await offlineBoot({rejected:true}),'オフライン準備OK','Registration failure cannot erase confirmed offline readiness');
assert.equal(await offlineBoot({active:false,rejected:true}),'オンラインで利用できます','No worker never claims offline readiness');
assert.equal(await offlineBoot({disappeared:true,rejected:true}),'オンラインで利用できます','A worker disappearing during startup is handled');
console.log('Practice offline boot: pending/rejected registration, ready controller and disappearing worker PASS');

// Exercise the application lifecycle, not just service-worker cache contents.
function appFixture({online=true,remote='41',status=200}={}){
 const ids=['offline-state','practice-update','practice-update-now','practice-update-label','practice-app-version','practice-info-version','practice-info-dialog','practice-info-close','practice-update-check','practice-update-result','practice-reload'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{textContent:'',hidden:true,disabled:false,open:false,click(){return this.onclick?.();},showModal(){this.open=true;},close(){this.open=false;}}]));
 const events={},docEvents={},strip={dataset:{}},trigger={};let pauses=0,reloads=0,updates=0,activated=0,registrations=0,current='41',requests=[];
 const worker=version=>({postMessage(message,ports){if(message.type==='PRACTICE_VERSION')ports[0].reply({version:typeof version==='function'?version():version});else if(message.type==='PRACTICE_ACTIVATE')activated++;}});
 const reg={waiting:null,installing:null,addEventListener(){},update(){updates++;return Promise.resolve();}};
 const serviceWorker={controller:worker(()=>current),addEventListener(type,fn){events[type]=fn;},register:async()=>{registrations++;return reg;},getRegistration:async()=>reg};
 class Channel{constructor(){this.port1={close(){}};this.port2={reply:data=>this.port1.onmessage?.({data})};}}
 class Parser{parseFromString(text){return{querySelector(){const found=text.match(/content="(\d+)"/);return found?{content:found[1]}:null;}};}}
 const navigator={serviceWorker,onLine:online};
 const api=vm.runInNewContext(updateSource+'\nmountPracticeUpdates({onPause(){pause();}});',{
  document:{getElementById:id=>nodes[id],querySelector:()=>strip,querySelectorAll:()=>[trigger],visibilityState:'visible',addEventListener(type,fn){docEvents[type]=fn;}},navigator,
  window:{isSecureContext:true,addEventListener(type,fn){events[type]=fn;},setInterval(){}},location:{href:'https://example.test/practice/',reload(){reloads++;}},
  MessageChannel:Channel,URL,DOMParser:Parser,AbortController,setTimeout,clearTimeout,pause(){pauses++;},
  fetch:async(url,options)=>{requests.push({url:String(url),cache:options.cache});return new Response(`<meta name="practice-version" content="${remote}">`,{status});}
 });
 return{api,nodes,events,docEvents,reg,navigator,worker,requests,settle:()=>new Promise(resolve=>setImmediate(resolve)),stats:()=>({pauses,reloads,updates,activated,registrations}),setCurrent:v=>current=v};
}
const app=appFixture();await app.settle();await app.api.check({manual:true});
assert.equal(app.nodes['practice-app-version'].textContent,'v41');assert.match(app.nodes['practice-update-result'].textContent,/v41 は最新/);
assert.ok(app.requests.length>0&&app.requests.every(r=>r.cache==='no-store'&&new URL(r.url).searchParams.has('practice-release-check')),'Release checks bypass immutable offline navigation');
assert.equal(app.stats().pauses,0,'Read-only update checks do not interrupt practice');
app.reg.waiting=app.worker('42');await app.api.check({manual:true});
assert.equal(app.nodes['practice-update'].hidden,false);assert.match(app.nodes['practice-update-label'].textContent,/v42/);assert.equal(app.stats().activated,0,'A new release waits for the user');
app.nodes['practice-update-now'].click();assert.equal(app.stats().activated,1);app.setCurrent('42');await app.events.controllerchange();
assert.equal(app.stats().reloads,1,'Manual activation reloads after controller change');
const noNetwork=appFixture({online:false});await noNetwork.settle();await noNetwork.api.check({manual:true});
assert.equal(noNetwork.requests.length,0);assert.match(noNetwork.nodes['practice-update-result'].textContent,/オフライン/);assert.equal(noNetwork.nodes['offline-state'].textContent,'オフライン準備OK','Failed release checks preserve offline readiness');
assert.equal(noNetwork.stats().registrations,0,'Offline reopening uses the installed registration');assert.equal(noNetwork.stats().updates,0,'Offline checks never fetch sw.js');
const departing=appFixture();departing.navigator.serviceWorker.controller=null;await departing.settle();await departing.api.check({manual:true});
assert.notEqual(departing.nodes['offline-state'].textContent,'オフライン準備OK','A departing controller cannot confirm a different installed snapshot');
for(const options of [{remote:'39'},{remote:'42'},{remote:'not-a-version'},{status:503}]){
 const a=appFixture(options);await a.settle();await a.api.check({manual:true});assert.doesNotMatch(a.nodes['practice-update-result'].textContent,/は最新/);assert.equal(a.stats().activated,0,'Stale, invalid and installing responses cannot activate a release');
}
const foreground=appFixture();await foreground.settle();const count=foreground.requests.length;
foreground.events.online({type:'online'});await foreground.settle();assert.ok(foreground.requests.length>count,'Reconnection checks again without waiting for the focus throttle');
const beforeResume=foreground.requests.length;foreground.docEvents.visibilitychange({type:'visibilitychange'});await foreground.settle();assert.ok(foreground.requests.length>beforeResume,'Returning to the visible app checks the release');
console.log('Practice update UI: fresh network check, explicit activation, failed/stale/offline checks and foreground/reconnection PASS');

const permissionSource=readFileSync('practice/mic-permission.mjs','utf8').replace(/^export /gm,'');
function permissionFixture({queryState='prompt',unavailable=false}={}){
 const nodes={'mic-permission-state':{textContent:''},'mic-permission-previous':{textContent:''}},saved=new Map([['music-practice-mic-last-used-v1','1234']]);let active=false,streams=0;
 const permission={state:queryState};
 const info=vm.runInNewContext(permissionSource+'\nmountMicPermissionInfo({active:()=>isActive()});',{
  document:{getElementById:id=>nodes[id]},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},isActive:()=>active,
  navigator:{permissions:{query:async()=>{if(unavailable)throw new TypeError('Unsupported permission');return permission;}},mediaDevices:{getUserMedia(){streams++;throw Error('Must never capture from settings');}}}
 });
 return{info,nodes,saved,permission,setActive:v=>active=v,streams:()=>streams};
}
const remembered=permissionFixture();await remembered.info.refresh();
assert.doesNotMatch(remembered.nodes['mic-permission-state'].textContent,/許可されています/,'Past successful capture is not current OS consent');
assert.match(remembered.nodes['mic-permission-previous'].textContent,/前回/);assert.equal(remembered.streams(),0);
remembered.setActive(true);remembered.info.used();assert.match(remembered.nodes['mic-permission-state'].textContent,/聴いています/);remembered.setActive(false);remembered.info.stopped();
assert.doesNotMatch(remembered.nodes['mic-permission-state'].textContent,/聴いています/);
remembered.permission.state='granted';remembered.permission.onchange();assert.match(remembered.nodes['mic-permission-state'].textContent,/この画面ではマイクが許可/);
remembered.permission.state='denied';remembered.permission.onchange();assert.match(remembered.nodes['mic-permission-state'].textContent,/端末の設定/);
const unsupported=permissionFixture({unavailable:true});await unsupported.info.refresh();assert.match(unsupported.nodes['mic-permission-state'].textContent,/始めるとき/);assert.equal(unsupported.streams(),0);
console.log('Practice microphone help: real permission versus past use, revocation, unsupported queries and no implicit capture PASS');
