const tempoLine = /^setcpm\(\s*(\d+(?:\.\d+)?)\s*\)\s*;?\s*$/gm;

export function strudelBpm(code) {
  const matches = [...code.matchAll(tempoLine)];
  if (matches.length !== 1) return null;
  const bpm = Number(matches[0][1]) * 4;
  return Number.isInteger(bpm) && bpm >= 60 && bpm <= 200 ? bpm : null;
}

export function withStrudelBpm(code, bpm) {
  if (!Number.isInteger(bpm) || bpm < 60 || bpm > 200 || strudelBpm(code) === null) {
    throw new Error('このコードのテンポは受け渡しできません');
  }
  return code.replace(tempoLine, `setcpm(${bpm / 4})`);
}
