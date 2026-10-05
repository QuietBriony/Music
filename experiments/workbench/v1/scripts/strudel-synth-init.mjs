// SPDX-License-Identifier: AGPL-3.0-or-later
// Add an opt-in sample-free initialization to the pinned, licensed REPL copy.
// Dependency files stay untouched; fail closed if its known source changes.
import { createHash } from 'node:crypto';

export const PINNED_REPL_SHA256 = '36dd205ab824a59a4b8ada5dd1059f3eb4b4bc95ffdb2cad973f8382d090b29a';
export function synthInitBundle(source) {
  if (createHash('sha256').update(source).digest('hex') !== PINNED_REPL_SHA256) {
    throw new Error('Strudel synth initialization requires the reviewed pinned REPL');
  }
  const replacements = [
    ['async function prebake(){', 'async function prebake({synthOnly=false}={}){'],
    [';await Promise.all([o,registerSynthSounds(),registerZZFXSounds(),',
      ';if(synthOnly){await Promise.all([o,registerSynthSounds(),registerZZFXSounds()]);return}await Promise.all([o,registerSynthSounds(),registerZZFXSounds(),'],
    ['drawContext:d,prebake,onUpdateState:b=>',
      'drawContext:d,prebake:()=>prebake({synthOnly:this.hasAttribute("synth-only")}),onUpdateState:b=>'],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error('Strudel synth initialization anchor changed');
    source = source.replace(before, after);
  }
  return source;
}
