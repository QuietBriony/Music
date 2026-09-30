import test from 'node:test';
import assert from 'node:assert/strict';
import { initPwa } from '../src/pwa.js';

class Control {
  hidden = true;
  disabled = false;
  textContent = '';
  listeners = new Map();
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { return this.disabled ? undefined : this.listeners.get('click')?.(); }
}

async function fixture({ waiting = false, consent = true, fail = false } = {}) {
  const controls = new Map(['pwa-summary','pwa-status','pwa-prepare','pwa-install','pwa-update',
    'pwa-update-top','pwa-update-hint','pwa-installed'].map(id => ['#'+id,new Control()]));
  const serviceWorker = new EventTarget();
  let reloads = 0, activations = 0, checks = 0, confirmations = 0;
  const worker = { postMessage({action}, [port]) {
    if (action === 'activate') {
      activations++;
      serviceWorker.dispatchEvent(new Event('controllerchange'));
    }
    port.postMessage({result: {shellReady:true,soundsReady:true,appBytes:1,soundBytes:1,preparedAt:1}});
    port.close();
  } };
  const registration = Object.assign(new EventTarget(), { active:worker,waiting:waiting?worker:null,
    async update() { checks++; if (fail) throw new Error('Network unavailable'); } });
  serviceWorker.register = async () => registration;
  const globals = { document:{querySelector:selector=>controls.get(selector)||null},
    window:Object.assign(new EventTarget(),{isSecureContext:true}),
    navigator:{serviceWorker,onLine:true},matchMedia:()=>({matches:false}) };
  const originals = new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  try {
    await initPwa({confirmReload:async()=>{confirmations++;return consent;},reload:()=>{reloads++;}});
  } catch (error) { restore(); throw error; }
  function restore() {
    for (const [key,descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
  }
  return {controls,restore,counts:()=>({reloads,activations,checks,confirmations})};
}

test('a stale page can check and reload even after another tab activated the update',async()=>{
  const f=await fixture();
  try {
    assert.equal(f.controls.get('#pwa-update').hidden,false);
    assert.equal(f.controls.get('#pwa-update-top').hidden,false);
    await f.controls.get('#pwa-update-top').click();
    assert.deepEqual(f.counts(),{reloads:1,activations:0,checks:1,confirmations:1});
  } finally {f.restore();}
});

test('the visible update notice activates a waiting version before reloading',async()=>{
  const f=await fixture({waiting:true});
  try {
    assert.equal(f.controls.get('#pwa-update-hint').hidden,false);
    assert.match(f.controls.get('#pwa-update-top').textContent,/更新あり/);
    await f.controls.get('#pwa-update-top').click();
    assert.deepEqual(f.counts(),{reloads:1,activations:1,checks:0,confirmations:1});
  } finally {f.restore();}
});

test('canceling an unsaved-edit confirmation preserves the loaded page and restores controls',async()=>{
  const f=await fixture({waiting:true,consent:false});
  try {
    await f.controls.get('#pwa-update-top').click();
    assert.deepEqual(f.counts(),{reloads:0,activations:0,checks:0,confirmations:1});
    assert.equal(f.controls.get('#pwa-update-top').disabled,false);
  } finally {f.restore();}
});

test('a failed network check keeps the page and reports the error without stopping playback',async()=>{
  const f=await fixture({fail:true});
  try {
    await f.controls.get('#pwa-update-top').click();
    assert.deepEqual(f.counts(),{reloads:0,activations:0,checks:1,confirmations:0});
    assert.equal(f.controls.get('#pwa-status').textContent,'Network unavailable');
    assert.equal(f.controls.get('#pwa-update-top').disabled,false);
  } finally {f.restore();}
});
