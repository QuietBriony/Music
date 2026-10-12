import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { synthInitBundle } from '../scripts/strudel-synth-init.mjs';

const original = readFileSync(new URL('../node_modules/@strudel/repl/dist/index.js', import.meta.url), 'utf8');
const patched = synthInitBundle(original);
async function registrations(bundle, options) {
  const start = bundle.indexOf('async function prebake(');
  const end = bundle.indexOf('const maxPan=', start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  const scope = {
    core: {}, hydra$1: {}, index: {}, index$b: {}, index$a: {}, index$9: {}, index$8: {}, index$7: {},
    index$6: {}, index$5: {}, index$4: {}, index$3: {}, index$2: {},
    evalScope: async (...args) => { calls.push(['scope', args.length]); await Promise.all(args); },
    registerSynthSounds: () => { calls.push(['synth']); },
    registerZZFXSounds: () => { calls.push(['zzfx']); },
    index$1: { registerSoundfonts: () => { calls.push(['soundfonts']); } },
    samples: (...args) => { calls.push(['samples', ...args]); },
    aliasBank: (...args) => { calls.push(['alias', ...args]); },
  };
  // Run the actual copied dependency function with registration boundaries,
  // never an alternative loader and never network access.
  const prebake = runInNewContext('(' + bundle.slice(start, end) + ')', scope);
  await prebake(options);
  return calls;
}
test('opt-in initialization registers only the existing synth voices and scope', async () => {
  const calls = await registrations(patched, { synthOnly: true });
  assert.deepEqual(calls.map(call => call[0]), ['scope', 'synth', 'zzfx']);
  assert.ok(patched.includes('prebake:()=>prebake({synthOnly:this.hasAttribute("synth-only")})'));
});
test('default initialization retains the original registries, arguments and order', async () => {
  assert.deepEqual(await registrations(patched), await registrations(original));
  const calls = await registrations(patched);
  assert.equal(calls.filter(call => call[0] === 'samples').length, 6);
  assert.equal(calls.filter(call => call[0] === 'alias').length, 1);
  assert.equal(calls.filter(call => call[0] === 'soundfonts').length, 1);
});
test('build transform refuses an unreviewed dependency', () => {
  assert.throws(() => synthInitBundle(original + '\n'), /reviewed pinned REPL/);
});

test('moving the opted-in editor retains its code, scheduler and single Mirror instance', () => {
  const start=patched.indexOf('class o extends HTMLElement{static observedAttributes=["code"]');
  const end=patched.indexOf('customElements.define("strudel-editor",o)',start);
  let mirrors=0,roots=0;
  class Element { hasAttribute(name){return name==='synth-only';} }
  class Mirror { constructor(){mirrors++;this.scheduler={};}updateSettings(){}setCode(code){this.code=code;} }
  const Constructor=runInNewContext(patched.slice(start,end)+';o;',{
    HTMLElement:Element,StrudelMirror:Mirror,codemirrorSettings:{get:()=>({})},
    setTimeout(){},document:{createElement:()=>({})},getDrawContext(){},
    webaudioOutput(){},getAudioContext(){},transpiler(){},silence:{},
  });
  const editor=new Constructor();editor.code='note(48)';editor.parentElement={insertBefore(){roots++;}};
  editor.connectedCallback();const mirror=editor.editor;mirror.code='note(51)';
  editor.connectedCallback();editor.connectedCallback();
  assert.equal(editor.editor,mirror);assert.equal(editor.editor.code,'note(51)');
  assert.equal(mirrors,1);assert.equal(roots,1);
});
