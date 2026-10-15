import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { keccak256, toHex } from 'viem';
import {
  compilerVersion,
  recompileInput,
  type CompilerInput,
} from '../packages/contracts/compiler.js';
const input = JSON.parse(
  await readFile('artifacts/release/standard-input.json', 'utf8'),
) as CompilerInput;
const manifest = JSON.parse(await readFile('artifacts/release/compilation.json', 'utf8')) as {
  compiler: string;
  inputHash: string;
  sourceHashes: Record<string, string>;
  contracts: {
    name: string;
    sourceName: string;
    sourceHash: string;
    bytecodeHash: string;
    runtimeTemplateHash: string;
    immutableReferences: unknown;
  }[];
};
assert.equal(compilerVersion(), manifest.compiler, 'Compiler version changed');
assert.equal(keccak256(toHex(JSON.stringify(input))), manifest.inputHash, 'Compiler input changed');
assert.deepEqual(Object.keys(input.sources).sort(), Object.keys(manifest.sourceHashes).sort());
for (const [path, row] of Object.entries(input.sources))
  assert.equal(keccak256(toHex(row.content)), manifest.sourceHashes[path], path);
const replay = recompileInput(input);
assert.deepEqual(Object.keys(replay).sort(), manifest.contracts.map((row) => row.name).sort());
for (const row of manifest.contracts) {
  const artifact = replay[row.name]!;
  assert.equal(artifact.sourceName, row.sourceName);
  assert.equal(artifact.sourceHash, row.sourceHash);
  assert.equal(keccak256(artifact.bytecode), row.bytecodeHash);
  assert.equal(keccak256(artifact.deployedBytecode), row.runtimeTemplateHash);
  assert.deepEqual(artifact.immutableReferences, row.immutableReferences);
}
console.log({
  selfContainedReplay: true,
  sources: Object.keys(input.sources).length,
  contracts: Object.keys(replay).length,
  onchainVerification: false,
});
