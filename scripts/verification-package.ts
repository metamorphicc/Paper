import { mkdir, writeFile } from 'node:fs/promises';
import { keccak256 } from 'viem';
import { compilationBundle } from '../packages/contracts/compiler.js';
const bundle = compilationBundle();
await mkdir('artifacts/release', { recursive: true });
await writeFile(
  'artifacts/release/standard-input.json',
  JSON.stringify(bundle.input, null, 2) + '\n',
);
const report = {
  compiler: bundle.compiler,
  inputHash: bundle.inputHash,
  sourceHashes: bundle.sourceHashes,
  provenance: bundle.provenance,
  contracts: Object.entries(bundle.contracts).map(([name, row]) => ({
    name,
    sourceName: row.sourceName,
    sourceHash: row.sourceHash,
    bytecodeHash: keccak256(row.bytecode),
    runtimeTemplateHash: keccak256(row.deployedBytecode),
    immutableReferences: row.immutableReferences,
  })),
  sourceEquivalenceOnchainVerified: false,
  mainnetDeployed: false,
  explanation:
    'Self-contained local compiler input. Runtime templates contain zeroed immutable slots; deployed bytecode must be reconciled with constructor arguments and getter values. This package is not an independent audit or Papertrade source verification.',
};
await writeFile('artifacts/release/compilation.json', JSON.stringify(report, null, 2) + '\n');
console.log({
  compiler: bundle.compiler,
  sources: Object.keys(bundle.input.sources).length,
  contracts: Object.keys(bundle.contracts).length,
  inputHash: bundle.inputHash,
  mainnetDeployed: false,
});
