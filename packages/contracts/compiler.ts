import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { keccak256, toHex, type Abi, type Hex } from 'viem';
const require = createRequire(import.meta.url);
const solc = require('solc') as {
  compile(
    input: string,
    callbacks?: { import(path: string): { contents?: string; error?: string } },
  ): string;
  version(): string;
};
export const compilerSettings = {
  optimizer: { enabled: true, runs: 200 },
  evmVersion: 'cancun',
  outputSelection: {
    '*': {
      '*': [
        'abi',
        'metadata',
        'evm.bytecode.object',
        'evm.deployedBytecode.object',
        'evm.deployedBytecode.immutableReferences',
      ],
    },
  },
};
export type CompilerInput = {
  language: 'Solidity';
  sources: Record<string, { content: string }>;
  settings: typeof compilerSettings;
};
export type ImmutableReferences = Record<string, { start: number; length: number }[]>;
export type Compiled = {
  abi: Abi;
  bytecode: Hex;
  deployedBytecode: Hex;
  sourceHash: Hex;
  sourceName: string;
  immutableReferences: ImmutableReferences;
  metadata: string;
};
type CompilerResult = {
  errors?: { severity: string; formattedMessage: string }[];
  contracts: Record<
    string,
    Record<
      string,
      {
        abi: Abi;
        metadata: string;
        evm: {
          bytecode: { object: string };
          deployedBytecode: { object: string; immutableReferences?: ImmutableReferences };
        };
      }
    >
  >;
};
function result(text: string): CompilerResult {
  const parsed = JSON.parse(text) as CompilerResult;
  const errors = (parsed.errors ?? []).filter((row) => row.severity === 'error');
  if (errors.length) throw new Error(errors.map((row) => row.formattedMessage).join('\n'));
  return parsed;
}
function artifacts(input: CompilerInput, output: CompilerResult) {
  const contracts: Record<string, Compiled> = {};
  for (const [file, source] of Object.entries(input.sources)) {
    if (!file.startsWith('contracts/')) continue;
    for (const [name, artifact] of Object.entries(output.contracts[file] ?? {})) {
      if (contracts[name]) throw new Error('Duplicate contract name');
      if (!/^[\da-f]+$/i.test(artifact.evm.bytecode.object))
        throw new Error('Unlinked or abstract artifact');
      contracts[name] = {
        abi: artifact.abi,
        bytecode: `0x${artifact.evm.bytecode.object}`,
        deployedBytecode: `0x${artifact.evm.deployedBytecode.object}`,
        sourceName: file,
        sourceHash: keccak256(toHex(source.content)),
        immutableReferences: artifact.evm.deployedBytecode.immutableReferences ?? {},
        metadata: artifact.metadata,
      };
    }
  }
  return contracts;
}
/** Self-contained input only: replay never reads imports from disk or network. */
export function recompileInput(input: CompilerInput) {
  return artifacts(input, result(solc.compile(JSON.stringify(input))));
}
let cached: ReturnType<typeof buildCompilationBundle> | undefined;
function buildCompilationBundle() {
  const sources = Object.fromEntries(
    readdirSync('contracts')
      .filter((file) => file.endsWith('.sol'))
      .sort()
      .map((file) => [
        `contracts/${file}`,
        { content: readFileSync(resolve('contracts', file), 'utf8') },
      ]),
  ) as CompilerInput['sources'];
  const input: CompilerInput = { language: 'Solidity', sources, settings: compilerSettings };
  // First pass discovers every transitive source actually used by solc.
  result(
    solc.compile(JSON.stringify(input), {
      import(path) {
        if (
          !path.startsWith('@openzeppelin/contracts/') ||
          path.includes('..') ||
          !/^[\w@/.-]+\.sol$/.test(path)
        )
          return { error: 'Import not allowed' };
        try {
          const content = readFileSync(resolve('node_modules', path), 'utf8');
          sources[path] = { content };
          return { contents: content };
        } catch {
          return { error: `Import unavailable: ${path}` };
        }
      },
    }),
  );
  input.sources = Object.fromEntries(
    Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const contracts = recompileInput(input);
  const dependencies = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
    packages: Record<string, { version?: string; integrity?: string }>;
  };
  const provenance = Object.fromEntries(
    ['node_modules/solc', 'node_modules/@openzeppelin/contracts'].map((key) => [
      key,
      {
        version: dependencies.packages[key]?.version ?? null,
        integrity: dependencies.packages[key]?.integrity ?? null,
      },
    ]),
  );
  return {
    compiler: solc.version(),
    input,
    inputHash: keccak256(toHex(JSON.stringify(input))),
    sourceHashes: Object.fromEntries(
      Object.entries(input.sources).map(([name, row]) => [name, keccak256(toHex(row.content))]),
    ),
    provenance,
    contracts,
  };
}
export function compilationBundle() {
  return (cached ??= buildCompilationBundle());
}
export function compileContracts() {
  return compilationBundle().contracts;
}
export const compilerVersion = () => solc.version();
