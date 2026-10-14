import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { keccak256, toHex, type Abi, type Hex } from 'viem';
const require = createRequire(import.meta.url);
const solc = require('solc') as {
  compile(
    input: string,
    callbacks: { import(path: string): { contents?: string; error?: string } },
  ): string;
  version(): string;
};
export type Compiled = { abi: Abi; bytecode: Hex; deployedBytecode: Hex; sourceHash: Hex };
let cache: Record<string, Compiled> | undefined;
export function compileContracts() {
  if (cache) return cache;
  const sources = Object.fromEntries(
    readdirSync('contracts')
      .filter((file) => file.endsWith('.sol'))
      .map((file) => [
        `contracts/${file}`,
        { content: readFileSync(resolve('contracts', file), 'utf8') },
      ]),
  );
  const result = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: 'Solidity',
        sources,
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: 'cancun',
          outputSelection: {
            '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
          },
        },
      }),
      {
        import(path) {
          if (!path.startsWith('@openzeppelin/contracts/') || path.includes('..'))
            return { error: 'Import not allowed' };
          try {
            return { contents: readFileSync(resolve('node_modules', path), 'utf8') };
          } catch {
            return { error: `Import unavailable: ${path}` };
          }
        },
      },
    ),
  );
  const errors = (result.errors ?? []).filter(
    (error: { severity: string }) => error.severity === 'error',
  );
  if (errors.length) throw new Error(JSON.stringify(errors));
  const contracts: Record<string, Compiled> = {};
  for (const [file, content] of Object.entries(sources)) {
    for (const [name, artifact] of Object.entries(result.contracts[file]) as [
      string,
      { abi: Abi; evm: { bytecode: { object: string }; deployedBytecode: { object: string } } },
    ][]) {
      contracts[name] = {
        abi: artifact.abi,
        bytecode: `0x${artifact.evm.bytecode.object}`,
        deployedBytecode: `0x${artifact.evm.deployedBytecode.object}`,
        sourceHash: keccak256(toHex(content.content)),
      };
    }
  }
  cache = contracts;
  return contracts;
}
export const compilerVersion = () => solc.version();
