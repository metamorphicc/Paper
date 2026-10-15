import test from 'node:test';
import assert from 'node:assert/strict';
import { compilationBundle, recompileInput } from '../contracts/compiler.js';
import { compareRuntime } from './bytecode.js';
test('self-contained verification input reproduces all artifacts and imported source changes are detected', () => {
  const bundle = compilationBundle();
  const replay = recompileInput(bundle.input);
  assert.deepEqual(replay, bundle.contracts);
  const path = '@openzeppelin/contracts/token/ERC20/ERC20.sol';
  assert.ok(bundle.sourceHashes[path]);
  assert.ok(bundle.provenance['node_modules/@openzeppelin/contracts']!.integrity);
  const changed = structuredClone(bundle.input);
  assert.ok(changed.sources[path]!.content.includes('return 18;'));
  changed.sources[path]!.content = changed.sources[path]!.content.replace(
    'return 18;',
    'return 6;',
  );
  const altered = recompileInput(changed);
  assert.equal(altered.ClubToken!.sourceHash, bundle.contracts.ClubToken!.sourceHash);
  assert.notEqual(altered.ClubToken!.bytecode, bundle.contracts.ClubToken!.bytecode);
  delete changed.sources[path];
  assert.throws(() => recompileInput(changed), /not found/);
});
test('runtime comparison excludes only valid immutable slots and rejects changed executable bytes', () => {
  const template = ('0x' + '11'.repeat(64)) as `0x${string}`;
  const runtime = ('0x' + '22'.repeat(32) + '11'.repeat(32)) as `0x${string}`;
  const refs = { '1': [{ start: 0, length: 32 }] };
  const matched = compareRuntime(template, runtime, refs);
  assert.equal(matched.templateMatched, true);
  assert.equal(matched.immutableGettersVerified, false);
  assert.throws(
    () => compareRuntime(template, ('0x' + '22'.repeat(64)) as `0x${string}`, refs),
    /differs/,
  );
  assert.throws(
    () => compareRuntime(template, runtime, { '1': [{ start: 40, length: 32 }] }),
    /Invalid/,
  );
  assert.throws(
    () =>
      compareRuntime(template, runtime, {
        '1': [
          { start: 0, length: 32 },
          { start: 0, length: 32 },
        ],
      }),
    /Overlapping/,
  );
});
