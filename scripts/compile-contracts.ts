import { mkdir, writeFile } from 'node:fs/promises';
import { compileContracts, compilerVersion } from '../packages/contracts/compiler.js';
import { keccak256 } from 'viem';
const contracts = compileContracts();
await mkdir('artifacts/contracts', { recursive: true });
for (const [name, artifact] of Object.entries(contracts))
  await writeFile(`artifacts/contracts/${name}.json`, JSON.stringify(artifact, null, 2) + '\n');
await writeFile(
  'research/local-contracts.json',
  JSON.stringify(
    {
      compiler: compilerVersion(),
      settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
      localChainId: 31337,
      mainnetDeployed: false,
      contracts: Object.entries(contracts).map(([name, artifact]) => ({
        name,
        sourceHash: artifact.sourceHash,
        bytecodeHash: keccak256(artifact.bytecode),
      })),
    },
    null,
    2,
  ) + '\n',
);
console.table(
  Object.keys(contracts).map((name) => ({
    name,
    bytes: (contracts[name]!.bytecode.length - 2) / 2,
  })),
);
