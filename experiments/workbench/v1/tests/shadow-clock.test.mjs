import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import { defaultSet } from '../src/live-code.js';
import { shadowCode } from '../src/shadow-groove.js';

// Run the actual Cyclist, Pattern and mini parser from the pinned browser
// bundle. Its optional browser/editor modules are outside this prefix.
const bundle = await readFile(new URL('../node_modules/@strudel/repl/dist/index.js', import.meta.url), 'utf8');
const body = parse(bundle, {ecmaVersion:'latest'}).body[0].declarations[0].init.callee.body.body;
const mini = body.find(node => node.type === 'VariableDeclaration'
  && node.declarations.some(declaration => declaration.id.name === 'mini$1'));
assert.ok(mini, 'pinned native core/mini boundary exists');
const nativeSource = bundle.slice(0, mini.end) + ';return {...core,mini:mini$1};}({});';
const layers = await Promise.all(['techno-dub','namima-test'].map(async id => ({
  id, title:id, source:await readFile(new URL('../src/patterns/'+id+'.txt', import.meta.url), 'utf8'),
})));

async function fixture(initial = {}, {early=0} = {}) {
  const context = vm.createContext({console:{log(){},warn(){}}, performance,
    setTimeout, clearTimeout, setInterval, clearInterval});
  vm.runInContext(nativeSource, context);
  const native = context.strudel;
  native.setStringParser(native.mini);
  const target = {amount:0, enabled:1, hpf:1800, ...initial};
  let seconds = 0, tick;
  const events = [], errors = [];
  const scheduler = new native.Cyclist({
    getTime:() => seconds,
    setInterval:callback => {tick=callback;return 1;}, clearInterval:() => {tick=null;},
    onTrigger:hap => events.push({begin:Number(hap.whole.begin), value:{...hap.value}}),
    onError:error => errors.push(error),
  });
  Object.assign(context, native, {
    getTime:() => scheduler.now(), getIsStarted:() => scheduler.started,
    SET_SHADOW:native.signal(() => target.amount),
    SET_SHADOW_ON:native.signal(() => target.enabled),
    SET_SHADOW_HPF:native.signal(() => target.hpf),
  });
  const score = () => {
    const emitted = shadowCode(defaultSet('acid-drive', layers), '');
    return vm.runInContext('(() => {\n'+emitted.declarations.join('\n')
      +'\nconst setScore = '+emitted.voice+(early ? '.early('+early+')' : '')
      +'\nsetScore.shadowInput = t => setShadowAt(t,t)\nreturn setScore\n})()', context);
  };
  await scheduler.setPattern(score());
  scheduler.setCps(128 / 240);
  await scheduler.start();
  const fire = second => {seconds=second;tick?.();};
  const prepareBoundary = () => {
    for (let n=1;n<=18;n++) fire(n/10);
    seconds=1.9; // Input arrives just before the already pending 1.9s tick.
    assert.ok(Math.abs(scheduler.now() - .9813333333333333) < 1e-10);
    assert.ok(Math.abs(scheduler.lastEnd - 1.0666666666666667) < 1e-10);
  };
  const input = values => {
    Object.assign(target, values);
    if (scheduler.started) scheduler.pattern.shadowInput(scheduler.now());
  };
  return {scheduler, target, events, errors, prepareBoundary, input, fire, score};
}

test('running native lookahead applies end-of-bar amount, mute and HPF at bar 1, not bar 2', async () => {
  for (const firstTick of [19,20]) for (const change of [{amount:.12}, {enabled:0}, {hpf:2400}]) {
    const f=await fixture('amount' in change ? {} : {amount:.12});
    f.prepareBoundary();
    f.input(change);
    // The 2.0s variant first samples after playing cycle 1. Timestamping at
    // the input is essential; reading getTime only in that query is too late.
    for (let n=firstTick;n<=40;n++) f.fire(n/10);
    const next=f.events.filter(event => event.begin >= 1 && event.begin < 2);
    if ('enabled' in change) assert.equal(next.length,0);
    else {
      assert.ok(next.length>0, 'the immediately following bar has its shadow onsets');
      assert.ok(next.every(event => event.value.hcutoff === ('hpf' in change ? 2400 : 1800)));
      assert.ok(next.every(event => event.value.gain > 0));
    }
    const before=f.events.filter(event => event.begin < 1);
    assert.equal(before.length, 'amount' in change ? 0 : 1);
    assert.ok(before.every(event => event.value.hcutoff===1800), 'previously queued audio retains its old parameters');
    assert.equal(f.errors.length,0);
    f.scheduler.stop();
  }
});

test('rapid timestamped edits coalesce on that bar even when native tempo changes before the next query', async () => {
  for (const bpm of [60,96,180]) {
    const f=await fixture();
    f.prepareBoundary();
    for (const amount of [.08,.2,.11,.18]) f.input({amount});
    f.input({hpf:3200});
    f.scheduler.setCps(bpm/240);
    for (let n=19;n<=70;n++) f.fire(n/10);
    const next=f.events.filter(event=>event.begin>=1 && event.begin<2);
    assert.equal(next.length,2);
    assert.ok(next.every(event=>event.value.hcutoff===3200));
    assert.deepEqual(next.map(event=>event.value.gain).sort(), [.18*.36,.18*.42]);
    assert.equal(f.errors.length,0);
    f.scheduler.stop();
  }
});

test('Stop cancels native ticks; a fresh edited score cannot inherit a stopped pending shadow input', async () => {
  const f=await fixture();
  f.prepareBoundary();
  f.input({amount:.12});
  f.scheduler.stop();
  const count=f.events.length;
  f.input({amount:0, hpf:3600});
  for (let n=19;n<=80;n++) f.fire(n/10);
  assert.equal(f.events.length,count);
  assert.equal(f.scheduler.started,false);
  await f.scheduler.setPattern(f.score());
  await f.scheduler.start();
  for (let n=81;n<=120;n++) f.fire(n/10);
  assert.equal(f.events.length,count, 'saved amount 0 starts without the previous pending amount .12');
  assert.equal(f.errors.length,0);
  f.scheduler.stop();
});

test('a hand-edited early onset already queued by Cyclist keeps its value; the next unqueued onset changes in the same bar', async () => {
  const f=await fixture({amount:.12}, {early:.4375});
  f.prepareBoundary();
  assert.equal(f.events.find(event=>event.begin===1).value.hcutoff,1800);
  f.input({hpf:2400});
  for (let n=19;n<=40;n++) f.fire(n/10);
  assert.equal(f.events.find(event=>event.begin===1).value.hcutoff,1800, 'native queued audio is immutable');
  assert.equal(f.events.find(event=>event.begin===1.5).value.hcutoff,2400, 'do not defer unqueued audio to bar 2');
  assert.equal(f.errors.length,0);
  f.scheduler.stop();
});
