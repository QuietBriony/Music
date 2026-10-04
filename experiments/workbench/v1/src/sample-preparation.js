import { isSynthOnlyCode } from './mix-code.js';

// Prepare the existing default registries only for a sample-using Play.
// A stopped/cold synthetic score needs none. Keep the same one-shot failure
// behavior as the REPL's original prebaked promise; do not retry failed GETs.
export function createSamplePreparation(loadDefaults) {
  let pending;
  return async (code) => {
    if (isSynthOnlyCode(code)) return;
    pending ??= Promise.resolve().then(loadDefaults);
    await pending;
  };
}
