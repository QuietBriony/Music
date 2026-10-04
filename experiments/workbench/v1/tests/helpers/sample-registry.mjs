import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import { parse } from 'acorn';
import { map } from 'nanostores';

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  if (from < 0 || to <= from) throw new Error('Pinned sample registration section missing: ' + start);
  return source.slice(from, to).replaceAll('export ', '');
}

function literalMap(node) {
  if (node?.type === 'Literal') return typeof node.value === 'string';
  if (node?.type === 'ArrayExpression') return node.elements.every(literalMap);
  if (node?.type !== 'ObjectExpression') return false;
  return node.properties.every(property => property.type === 'Property' && !property.computed
    && !property.method && property.kind === 'init' && literalMap(property.value));
}

const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

// Run the installed production registration chain, including the real
// nanostores map, in a new VM/store for each test. Do not import the audio
// engine, fetch registries, load buffers, or evaluate the musical expression.
export async function createSampleRegistry() {
  const [sampler, dough] = await Promise.all([
    readFile(new URL('../../node_modules/superdough/sampler.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../node_modules/superdough/superdough.mjs', import.meta.url), 'utf8'),
  ]);
  const attempts = { network: 0, audio: 0 };
  const soundMap = map({});
  const networkForbidden = () => { attempts.network++; throw new Error('Network forbidden in sample registration tests'); };
  const audioForbidden = () => { attempts.audio++; throw new Error('Audio forbidden in sample registration tests'); };
  const context = createContext({ soundMap, fetch: networkForbidden, fetchSampleMap: networkForbidden,
    onTriggerSample: audioForbidden, getAudioContext: audioForbidden,
    registerWaveTable() { throw new Error('Wavetables are outside the registration-only test boundary'); }, console });
  runInContext([
    section(sampler, 'function resolveSpecialPaths(', 'export const processSampleMap'),
    section(sampler, 'export const processSampleMap', '// allows adding a custom url prefix handler'),
    section(sampler, 'export const samples =', 'const cutGroups ='),
    section(sampler, 'function registerSample(', 'export function registerSampleSource'),
    section(sampler, 'export function registerSampleSource'),
    section(dough, 'export function registerSound(', 'let gainCurveFunc'),
    section(dough, 'export function getSound(', 'export const getAudioDevices'),
  ].join('\n'), context, { filename: 'pinned sample registration functions' });
  const samples = runInContext('samples', context);
  const getSound = runInContext('getSound', context);
  const sources = name => copy(getSound(name)?.data?.samples);
  return {
    async registerSamples(sampleMap, baseUrl = '') {
      if (!sampleMap || typeof sampleMap !== 'object' || Array.isArray(sampleMap)) {
        throw new Error('Object sample maps only; registry fetching is forbidden');
      }
      await samples(copy(sampleMap), baseUrl);
    },
    async registerCode(code) {
      const tree = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
      const calls = [];
      for (const statement of tree.body) {
        if (statement.type !== 'ExpressionStatement') continue;
        const expression = statement.expression.type === 'AwaitExpression' ? statement.expression.argument : statement.expression;
        if (expression.type !== 'CallExpression' || expression.callee.type !== 'Identifier' || expression.callee.name !== 'samples') continue;
        if (expression.arguments[0]?.type !== 'ObjectExpression' || !literalMap(expression.arguments[0])
          || expression.arguments.slice(1).some(argument => !literalMap(argument))) {
          throw new Error('Only top-level literal samples({...}) declarations are evaluated');
        }
        calls.push(code.slice(expression.start, expression.end));
      }
      // Validate every declaration before registering any of them.
      for (const call of calls) await runInContext(call, context, { filename: 'score sample declaration', timeout: 1000 });
      return calls.length;
    },
    sources,
    snapshot(keys = Object.keys(soundMap.get())) {
      return Object.fromEntries([...keys].sort().map(name => [name.toLowerCase(), sources(name)]));
    },
    get boundaryAttempts() { return { ...attempts }; },
    productionHashes: {
      sampler: createHash('sha256').update(sampler).digest('hex'),
      superdough: createHash('sha256').update(dough).digest('hex'),
    },
  };
}
