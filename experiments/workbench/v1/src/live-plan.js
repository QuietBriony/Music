// Pure musical time: scheduler queries, UI and saved scores share these rules.
// No mutable PRNG, wall clock, timer or accumulated changes to the user's motif.
export function liveFrame(config, seed, cycle, auto = true, scene = 'acid') {
  const time = Math.max(0, Number(cycle) || 0);
  const span = config.pace;
  const chapter = Math.floor(time / (span * 8));
  const index = Math.floor(time / span) % 8;
  const orders = [
    ['intro', 'groove', 'acid', 'groove', 'break', 'acid', 'peak', 'groove'],
    ['groove', 'acid', 'groove', 'break', 'acid', 'peak', 'acid', 'groove'],
    ['intro', 'groove', 'acid', 'break', 'groove', 'acid', 'peak', 'groove'],
  ];
  const orderFor = c => orders[c === 0 ? 0 : ((Math.imul(c, 1664525) + seed) >>> 0) % orders.length];
  const order = orderFor(chapter);
  const previous = index ? order[index - 1] : orderFor(Math.max(0, chapter - 1))[7];
  const section = !auto ? scene : config.lock || order[index];
  const position = (time % span) / span;
  const smooth = n => n * n * (3 - 2 * n);
  const blend = auto && !config.lock && time >= span ? smooth(Math.min(1, (time % span) / Math.min(4, span / 2))) : 1;
  const levels = {
    intro:  {kick:1, snare:0, hh:.3, oh:0, bell:0, acid:.15, response:0, percussion:0, ride:0, pad:.42, tone:.6},
    groove: {kick:1, snare:.65, hh:.75, oh:.4, bell:0, acid:.55, response:.25, percussion:.4, ride:0, pad:.35, tone:.85},
    acid:   {kick:1, snare:.8, hh:.85, oh:.7, bell:.35, acid:1, response:.65, percussion:.7, ride:.35, pad:.25, tone:1.05},
    break:  {kick:0, snare:0, hh:.16, oh:0, bell:0, acid:.3, response:.25, percussion:.15, ride:0, pad:.7, tone:.55},
    peak:   {kick:1, snare:1, hh:1, oh:.9, bell:.5, acid:1, response:1, percussion:1, ride:1, pad:.18, tone:1.25},
  };
  const target = levels[section];
  const before = levels[previous];
  const result = {};
  for (const key of Object.keys(target)) result[key] = key === 'kick' ? target[key] : before[key] + (target[key] - before[key]) * blend;
  const e = config.energy;
  const drumScale = config.mode === 'dub' ? .62 : 1;
  for (const key of ['kick','snare','hh','oh','bell','percussion','ride']) result[key] *= drumScale * (.45 + .55 * e);
  result.acid *= (config.mode === 'dub' ? .65 : 1) * (.55 + .45 * e);
  result.response *= (config.mode === 'dub' ? .55 : 1) * e;
  result.tone *= .7 + e * .4;
  const breath = Math.sin(time * Math.PI * 2 / (span * 2));
  result.tone *= 1 + breath * (config.mode === 'techno' ? .16 : .1);
  if (config.mode === 'ambient') {
    // No new percussion from automatic evolution. Long chords carry the flow.
    for (const key of ['kick','snare','hh','oh','bell','acid','response','percussion','ride']) result[key] = 0;
    const soft = {intro:[.75,.47],groove:[.88,.55],acid:[.95,.65],break:[.65,.42],peak:[.98,.7]};
    const from = soft[previous];
    const to = soft[section];
    result.pad = (from[0] + (to[0] - from[0]) * blend) * (.8 + .2 * e) * (1 + .025 * Math.sin(time * Math.PI * 2 / 64));
    result.tone = from[1] + (to[1] - from[1]) * blend + .035 * Math.sin(time * Math.PI * 2 / 96);
  }
  const fill = config.mode !== 'ambient' && e >= .55 && section !== 'break' && Math.floor(time) % 8 === 7;
  const crash = config.mode === 'techno' && e >= .55 && !config.lock && auto
    && Math.floor(time) % span === 0 && ['groove','acid','peak'].includes(section)
    && (previous === 'break' || section === 'peak');
  return {...result, chapter, section, index, position, span, fill, crash, remaining: span - time % span};
}

export function liveMotif(base, groove, chapter, cycle) {
  const time = Math.max(0, Number(cycle) || 0);
  const midi = {g1:31,bb1:34,c2:36,d2:38,eb2:39,f2:41,g2:43,bb2:46,c3:48};
  const pitches = Object.keys(midi);
  const notes = [...base];
  const candidates = base.map((n,i) => n !== '~' && i % 4 !== 0 ? i : -1).filter(i => i >= 0);
  const seed = (groove.seed + Math.imul(chapter, 4099) + (Math.floor(time / 16) % 4) * 17) >>> 0;
  if (!groove.hold && Math.floor(time) % 8 >= 4 && groove.variation && candidates.length) {
    for (let n = 0; n < Math.min(groove.variation, candidates.length); n++) {
      const slot = candidates[(seed + n) % candidates.length];
      const old = pitches.indexOf(base[slot]);
      let next = old + (seed % 2 ? 1 : -1);
      if (next < 0 || next >= pitches.length) next = old + (next < 0 ? 1 : -1);
      notes[slot] = pitches[next];
    }
  }
  const step = Math.floor((time % 1) * 16 + 1e-7) % 16;
  const note = notes[step];
  const prior = notes[(step + 15) % 16];
  const slide = [3,7,11].includes(step) && note !== '~' && prior !== '~' ? midi[note] - midi[prior] : 0;
  const intervals = (step % 2 ? [3,7] : [7,3]).filter(n => [0,2,3,5,7,10].includes((midi[note] + n) % 12));
  const response = note !== '~' && [3,7,10,14].includes(step) ? midi[note] + 12 + intervals[0] : null;
  return {notes, note:midi[note], response, slide, accent:step % 4 === 0 || step === 6 ? 1.16 : .86};
}
