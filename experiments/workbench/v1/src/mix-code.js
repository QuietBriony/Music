const samplePrelude = [
  'samples({',
  "  pad: '/api/sounds/pad',",
  "  sub: '/api/sounds/sub',",
  "  drums: '/api/sounds/drums',",
  '});',
].join('\n');

export const SINGLE_LEVEL = 'WORKBENCH_LEVEL_V1';
export const DECK_A_LEVEL = 'DECK_A_LEVEL_V1';
export const DECK_B_LEVEL = 'DECK_B_LEVEL_V1';
export const DECK_XFADE = 'DECK_XFADE_V1';
const managedNames = [SINGLE_LEVEL, DECK_A_LEVEL, DECK_B_LEVEL, DECK_XFADE];

export function clampLevel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(1, number)) * 100) / 100 : 1;
}

function sourceText(source) {
  return source.replace(/\r\n?/g, '\n').trim();
}

export function isSynthOnlyCode(source) {
  return /^\/\/ WORKBENCH_SYNTH_ONLY_V1$/m.test(source.replace(/\r\n?/g, '\n'));
}

export function splitPublishedPattern(source) {
  const text = sourceText(source);
  const tempo = [...text.matchAll(/^setcpm\(\s*(\d+(?:\.\d+)?)\s*\)\s*;?\s*$/gm)];
  if (tempo.length !== 1) throw new Error('この試作はデッキ用のテンポを読み取れません');
  const cpm = Number(tempo[0][1]);
  if (!(cpm > 0 && cpm <= 120)) throw new Error('デッキ用のテンポが範囲外です');
  const withoutTempo = text.replace(tempo[0][0], '');
  const expressionStart = /^stack\s*\(/m.exec(withoutTempo)?.index;
  if (expressionStart === undefined) throw new Error('この試作はデッキで組み合わせられません');
  const declarations = withoutTempo.slice(0, expressionStart).trim();
  const expression = withoutTempo.slice(expressionStart).trim();
  if (!expression.endsWith(')')) throw new Error('この試作はデッキで組み合わせられません');
  return { cpm, declarations, expression };
}

export function singleWorkCode(source, level = 1) {
  // All published works currently end in one stack(...) expression. Multiplying
  // its gain keeps the per-part gain and the Acid post-distortion balance.
  splitPublishedPattern(source);
  return [
    ...(isSynthOnlyCode(source) ? [] : [samplePrelude]),
    '// WORKBENCH_SINGLE_V1 — 作品ごとの音量。1が元の音量、0がミュート。',
    `const ${SINGLE_LEVEL} = slider(${clampLevel(level)}, 0, 1, 0.01)`,
    sourceText(source),
    `.mul(gain(${SINGLE_LEVEL}))`,
    '',
  ].join('\n\n');
}

export function upgradeLegacyDraftCode(code, level = 1) {
  if (code.includes('WORKBENCH_SINGLE_V1') || code.includes('DECK_MIX_V1')) return code;
  const text = sourceText(code);
  if (!text.startsWith(samplePrelude)) return code;
  try {
    return singleWorkCode(text.slice(samplePrelude.length).trim(), level);
  } catch {
    return code;
  }
}

export function deckMixCode(a, b, settings) {
  if (a.id === b.id) throw new Error('デッキAとBには別の試作を選んでください');
  const left = splitPublishedPattern(a.source);
  const right = splitPublishedPattern(b.source);
  const aLevel = clampLevel(settings.a);
  const bLevel = clampLevel(settings.b);
  const cross = clampLevel(settings.cross);
  return [
    samplePrelude,
    `// DECK_MIX_V1 ${a.id} + ${b.id} — Aの${left.cpm * 4} BPMで同期。`,
    `const ${DECK_A_LEVEL} = slider(${aLevel}, 0, 1, 0.01)`,
    `const ${DECK_B_LEVEL} = slider(${bLevel}, 0, 1, 0.01)`,
    `const ${DECK_XFADE} = slider(${cross}, 0, 1, 0.01)`,
    `setcpm(${left.cpm})`,
    `const deckA = (() => {\n${left.declarations}\nreturn ${left.expression}\n})()`,
    `const deckB = (() => {\n${right.declarations}\nreturn ${right.expression}\n})()`,
    // xfade multiplies existing per-part gains. The final 0.7 leaves headroom
    // when both decks are at the center (where xfade plays both at full level).
    `xfade(deckA.mul(gain(${DECK_A_LEVEL})), ${DECK_XFADE}, deckB.mul(gain(${DECK_B_LEVEL}))).mul(gain(0.7))`,
    '',
  ].join('\n\n');
}

// Recover musical bodies, including edits inside their wrappers. Accept only
// our complete layout: never evaluate or guess at a partially edited program.
export function readDeckMix(source) {
  try {
    const code = sourceText(source);
    const pair = /^\/\/ DECK_MIX_V1 ([a-z0-9-]+) \+ ([a-z0-9-]+) — /m.exec(code);
    const tempo = /^setcpm\(([0-9.]+)\)$/m.exec(code);
    if (!pair || !tempo || code.length > 100_000) return null;
    const settings = Object.fromEntries([['a', DECK_A_LEVEL], ['b', DECK_B_LEVEL], ['cross', DECK_XFADE]]
      .map(([key, name]) => [key, managedSliderValue(code, name)]));
    if (Object.values(settings).some(value => value === null || value < 0 || value > 1)) return null;
    const layers = ['A', 'B'].map((side, index) => {
      const match = new RegExp('^const deck' + side + ' = \\(\\(\\) => \\{\\n([\\s\\S]*?)\\nreturn (stack\\([\\s\\S]*?)\\n\\}\\)\\(\\)$', 'm').exec(code);
      if (!match) throw new Error('Missing deck body');
      return { id: pair[index + 1], source: match[1] + '\n\nsetcpm(' + tempo[1] + ')\n\n' + match[2] };
    });
    if (sourceText(deckMixCode(layers[0], layers[1], settings)) !== code) return null;
    return { layers, settings };
  } catch { return null; }
}

function sliderPattern(name) {
  return new RegExp(`(\\bconst\\s+${name}\\s*=\\s*slider\\(\\s*)([0-9.]+)(\\s*,)`);
}

export function managedSliderValue(code, name) {
  const match = sliderPattern(name).exec(code);
  return match ? clampLevel(match[2]) : null;
}

export function replaceManagedSliderValue(code, name, value) {
  return code.replace(sliderPattern(name), (_, before, _old, after) => before + clampLevel(value) + after);
}

export function comparableCode(code) {
  return managedNames.reduce((text, name) =>
    text.replace(sliderPattern(name), (_, before, _old, after) => before + '<level>' + after), code);
}
