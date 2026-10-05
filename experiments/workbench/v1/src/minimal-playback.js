const MARKER = '// WORKBENCH_MINIMAL_PLAYBACK_V1';
const MODE = /^const MINIMAL_MODE = '(once|loop|develop)'$/m;
export const MINIMAL_PLAYBACK_MODES = ['once', 'loop', 'develop'];

export function readMinimalPlaybackMode(code) {
  if (typeof code !== 'string' || !code.split(/\r?\n/).includes(MARKER)) return null;
  const matches = code.match(/^const MINIMAL_MODE = .*$/gm) || [];
  return matches.length === 1 ? MODE.exec(code)?.[1] || null : null;
}

export function minimalPlaybackCode(code, mode) {
  if (!MINIMAL_PLAYBACK_MODES.includes(mode) || readMinimalPlaybackMode(code) === null) {
    throw new Error('ミニマルの再生モードを確認できません。コードを保持しました。');
  }
  return code.replace(MODE, `const MINIMAL_MODE = '${mode}'`);
}
