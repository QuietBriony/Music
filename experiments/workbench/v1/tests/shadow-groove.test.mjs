import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultSet, readTechnoSet, technoSetCode, upgradeSet, liveFrame, SET_PRESETS } from '../src/live-code.js';
import { shadowPlan, shadowControl, shadowCode } from '../src/shadow-groove.js';
import { SliderBridge, sliderDeclarations } from '../src/slider-bridge.js';
import { setTempoChanges } from '../src/live-controls.js';

const layers = await Promise.all(['techno-dub','namima-test'].map(async id => ({
  id, title:id, source:await readFile(new URL('../src/patterns/'+id+'.txt', import.meta.url), 'utf8'),
})));

test('one bounded eight-bar plan uses vacancies and never duplicates the kit, kick or existing pickup', () => {
  for (const {id} of SET_PRESETS) for (const seed of [1, 731, 732, 0xffffffff]) {
    const state = defaultSet(id, layers);
    state.groove.seed = seed;
    const original = structuredClone(state);
    const plan = shadowPlan(state);
    assert.deepEqual(plan, shadowPlan(structuredClone(state)));
    assert.deepEqual(state, original);
    assert.equal(plan.length, 8);
    for (const [bar, {hat, rim, velocity}] of plan.entries()) {
      let count = 0;
      for (let step = 0; step < 16; step++) {
        if (hat[step] === '~' && rim[step] === '~') continue;
        count++;
        assert.notEqual(step % 4, 0);
        assert.ok(hat[step] === '~' || rim[step] === '~');
        for (const track of ['kick','snare','hh','oh','bell', ...state.groove.kit]) assert.equal(state.steps[track][step], false);
        assert.ok(!(bar === 7 && step === 15 && state.groove.variation));
        assert.ok(velocity[step] >= .32 && velocity[step] <= .46);
      }
      assert.ok(count <= 2);
    }
    for (const track of ['kick','snare','hh','oh','bell']) state.steps[track].fill(true);
    assert.ok(shadowPlan(state).every(bar => [...bar.hat, ...bar.rim].every(hit => hit === '~')));
  }
});

test('control changes coalesce at the same musical bar, including mute and HPF, with no timer or stopped work', () => {
  const initial = {amount:0, enabled:1, hpf:1800};
  const control = shadowControl(initial);
  const first = {amount:.12, enabled:1, hpf:2400};
  assert.deepEqual(control(.2, first), {bar:0, ...initial});
  const last = {...first, amount:.18};
  assert.deepEqual(control(.5, last), {bar:0, ...initial});
  assert.deepEqual(control(.999, last), {bar:0, ...initial});
  assert.deepEqual(control(1, last), {bar:1, ...last});
  const muted = {...last, enabled:0};
  assert.equal(control(1.3, muted).enabled, 1);
  assert.equal(control(1.999, muted).enabled, 1);
  assert.equal(control(2, muted).enabled, 0);
  assert.equal(control(1.5, muted).enabled, 1, 'lookahead queries do not change the previous bar');
  const restarted = shadowControl(initial);
  assert.deepEqual(restarted(0, initial), {bar:0, ...initial});
});

test('new saved scores expose every shadow sound and control; old V3 bodies stay unchanged until explicit upgrade', () => {
  const state = defaultSet('acid-drive', layers);
  assert.equal(state.values.SHADOW, 0);
  state.values.SHADOW = .12;
  state.values.SHADOW_ON = 0;
  state.values.SHADOW_HPF = 2400;
  const code = technoSetCode(state);
  assert.ok(code.includes("set_shadow_hh:'/modules/acidbros/assets/samples/tr909/hh01.wav'"));
  assert.equal(shadowCode(state, '').voice.includes('.bank('), false, 'the auxiliary layer does not expand the unverified external bank');
  assert.deepEqual(readTechnoSet(code), state);
  for (const fragment of ['// TECHNO_SET_V4 ', 'function shadowControl', '.hpq(0.707)', '.hpf(signal(t => setShadowAt(t).hpf))', '.pan("<0.42 0.58>")']) assert.ok(code.includes(fragment));
  const old = structuredClone(state);
  delete old.shadow;
  for (const key of ['SHADOW','SHADOW_ON','SHADOW_HPF']) delete old.values[key];
  const legacy = technoSetCode(old);
  assert.ok(legacy.startsWith('// TECHNO_SET_V3 '));
  assert.equal(legacy.includes('SHADOW'), false);
  assert.deepEqual(readTechnoSet(legacy), old);
  assert.equal(technoSetCode(readTechnoSet(legacy)), legacy);
  const upgraded = upgradeSet(old);
  assert.equal(upgraded.values.SHADOW, 0);
  assert.deepEqual(upgraded.steps, old.steps);
  assert.deepEqual(upgraded.muted, old.muted);
  assert.deepEqual(upgraded.notes, old.notes);
  assert.deepEqual(upgraded.layers, old.layers);
  assert.deepEqual(old.shadow, undefined);
});

test('hand-edited rhythm remains owned by the editor while shadow amount, HPF and mute patch only their literals', () => {
  const state = defaultSet('electro-808', layers);
  const mirror = {code:technoSetCode(state).replace('.pan("<0.42 0.58>")', '.pan("<0.3 0.7>")')};
  const body = mirror.code.slice(mirror.code.indexOf('function liveFrame'));
  mirror.widgets = sliderDeclarations(mirror.code);
  mirror.editor = {dispatch({changes:c}) { mirror.code = mirror.code.slice(0,c.from) + c.insert + mirror.code.slice(c.to); }};
  const signals = new Map();
  const bridge = new SliderBridge(() => mirror, {setSignal:(id, value) => signals.set(id, value), updateWidgets:() => {}});
  assert.equal(readTechnoSet(mirror.code), null);
  assert.throws(() => setTempoChanges(mirror.code, 120));
  for (const [key, value] of [['SET_SHADOW', .12], ['SET_SHADOW_HPF', 2400], ['SET_SHADOW_ON', 0]]) bridge.set(key, value, true);
  assert.ok(mirror.code.endsWith(body));
  assert.equal(signals.size, 3);
  assert.equal(readTechnoSet(mirror.code), null);
});

test('amount and HPF are bounded, ambient stays drum-free and additional percussion mute gates the one shadow layer', () => {
  for (const [key, value] of [['SHADOW', -.1], ['SHADOW', .26], ['SHADOW_HPF', 899], ['SHADOW_HPF', 6001], ['SHADOW_ON', .5]]) {
    const state = defaultSet('acid-drive', layers);
    state.values[key] = value;
    assert.throws(() => technoSetCode(state));
  }
  const state = defaultSet('ambient-drift', layers);
  state.values.SHADOW = .25;
  for (let cycle=0; cycle<128; cycle+=.25) assert.equal(liveFrame(state.live, state.groove.seed, cycle).percussion, 0);
  state.muted.push('percussion');
  assert.ok(technoSetCode(state).includes('.filterWhen(t => setShadowAt(t).amount > 0 && setShadowAt(t).enabled > 0).filterWhen(() => false)'));
});
