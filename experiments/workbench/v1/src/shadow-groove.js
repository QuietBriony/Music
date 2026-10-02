export const SHADOW_SLIDERS = [
  ['SHADOW', '影グルーヴ量', 0, 0, .25, .01, '%'],
  ['SHADOW_HPF', '影の低音カット', 1800, 900, 6000, 100, ' Hz'],
  ['SHADOW_ON', '影グルーヴ有効', 1, 0, 1, 1, ''],
];

// Reuse the hat and rim voices, only in unoccupied offbeats. Do not duplicate
// the existing kit, the last-bar hat pickup, or any kick / user drum onset.
export function shadowPlan(state) {
  const tracks = ['kick', 'snare', 'hh', 'oh', 'bell', ...state.groove.kit];
  return Array.from({length:8}, (_, bar) => {
    const open = [3, 7, 11, 15].filter(step => !tracks.some(id => state.steps[id][step])
      && !(bar === 7 && step === 15 && state.groove.variation));
    const hat = Array(16).fill('~');
    const rim = Array(16).fill('~');
    const velocity = Array(16).fill(0);
    if (open.length) {
      const start = ((state.groove.seed >>> 0) + bar * 3) % open.length;
      for (let n = 0; n < Math.min(open.length, bar % 2 ? 2 : 1); n++) {
        const step = open[(start + n) % open.length];
        (n ? rim : hat)[step] = n ? 'triangle' : state.bank === '909' ? 'set_shadow_hh' : 'white';
        velocity[step] = [.32, .42, .36, .46][(bar + n) % 4];
      }
    }
    return {hat, rim, velocity};
  });
}

// Emitted into the editable score. Signals are sampled by the one Strudel
// scheduler. UI input timestamps use the playing cycle, while lookup cycles
// can be in Cyclist's lookahead. Do not quantize an edit from a future query.
// Already queued onsets keep their old audio; change the next unqueued onset.
// No timer or global pending work survives Stop; evaluation makes a new control.
export function shadowControl(initial) {
  let input = {...initial};
  const changes = [{bar:0, ...initial}];
  return (cycle, target, changedAt = cycle) => {
    const time = Math.max(0, Number(cycle) || 0);
    if (['amount', 'enabled', 'hpf'].some(key => target[key] !== input[key])) {
      input = {...target};
      const bar = Math.ceil(Math.max(0, Number(changedAt) || 0));
      const pending = changes.find(change => change.bar === bar);
      if (pending) Object.assign(pending, target);
      else changes.push({bar, ...target});
      changes.sort((a, b) => a.bar - b.bar);
      if (changes.length > 16) changes.splice(0, changes.length - 16);
    }
    return [...changes].reverse().find(change => change.bar <= time) || changes[0];
  };
}

export function shadowCode(state, gate) {
  const plan = shadowPlan(state);
  const multi = key => '<' + plan.map(bar => '[' + bar[key].join(' ') + ']').join(' ') + '>';
  const hat = 's(' + JSON.stringify(multi('hat')) + ')'
    + (state.bank === '909' ? '' : '.attack(0.001).decay(0.025).sustain(0).release(0.01)');
  const rim = 's(' + JSON.stringify(multi('rim')) + ').freq(1650).attack(0.001).decay(0.022).sustain(0).release(0.01)';
  return {
    declarations: [
      '// 影だけを低ゲイン・HPFへ。主kickと既存打点は変えない。量0 / 有効0で元の演奏。',
      shadowControl.toString().replace(/\r\n?/g, '\n'),
      'const setShadowAt = (() => {',
      '  const read = (p, t) => Number(p.queryArc(Number(t), Number(t) + 1 / 1024)[0]?.value ?? 0)',
      '  const values = t => ({amount:read(SET_SHADOW, t), enabled:read(SET_SHADOW_ON, t), hpf:read(SET_SHADOW_HPF, t)})',
      '  const control = shadowControl(values(0))',
      '  return (t, changedAt) => control(Number(t), values(t), changedAt ?? (getIsStarted() ? getTime() : Number(t)))',
      '})()',
    ],
    voice: 'stack(' + hat + ', ' + rim + ')'
      + '.withQuerySpan(arc => { setShadowAt(arc.begin); return arc })'
      + '.hpf(signal(t => setShadowAt(t).hpf)).hpq(0.707)'
      + '.gain(signal(t => setShadowAt(t).amount * setShadowAt(t).enabled))'
      + '.mul(gain(' + JSON.stringify(multi('velocity')) + ')).pan("<0.42 0.58>")'
      + '.filterWhen(t => setShadowAt(t).amount > 0 && setShadowAt(t).enabled > 0)' + gate,
  };
}
