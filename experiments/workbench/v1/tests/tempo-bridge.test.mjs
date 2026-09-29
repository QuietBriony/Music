import assert from 'node:assert/strict';
import test from 'node:test';
import { strudelBpm, withStrudelBpm } from '../src/tempo-bridge.js';

test('a published work or deck exposes one quarter-note BPM', () => {
  assert.equal(strudelBpm('setcpm(32)\nstack(s("bd"))'), 128);
  assert.equal(strudelBpm('const x = 1\nsetcpm(28.25);\nstack(s("bd"))'), 113);
  assert.equal(strudelBpm('setcpm(24)\nsetcpm(32)'), null);
  assert.equal(strudelBpm('stack(s("bd"))'), null);
  assert.equal(strudelBpm('setcpm(70)'), null);
});

test('returning machine BPM changes only the code tempo declaration', () => {
  const source = '// draft\nsetcpm(24)\nconst bass = "keep this edit"\n';
  assert.equal(withStrudelBpm(source, 129), '// draft\nsetcpm(32.25)\nconst bass = "keep this edit"\n');
  assert.throws(() => withStrudelBpm('setcpm(24)', 201));
  assert.throws(() => withStrudelBpm('setcpm(24)\nsetcpm(28)', 128));
});
