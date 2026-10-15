import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { boundedText } from '../packages/http/guards.js';
const origin = 'https://exchange.papertrade.xyz';
// Public module URLs observed in the official browser DOM. Downloaded assets are data only.
const paths = [
  '/state/trading',
  '/assets/schemas-Aq5tuoaL.js',
  '/assets/wire-d4-U_uLp.js',
  '/assets/useTradingNetwork-By5ggYkb.js',
  '/assets/build-WoGelbPk.js',
  '/assets/index-T2XgWeBr.js',
  '/assets/queries-3zVmO78C.js',
  '/assets/queries-Bg_FlnJh.js',
  '/assets/execution-0RDXbhDY.js',
  '/assets/trade._coin-Ct4LDCtO.js',
  '/assets/hooks-Dgib49eE.js',
];
await mkdir('data/official-schema', { recursive: true });
const evidence = [];
for (const path of paths) {
  const response = await fetch(origin + path, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Official schema capture unavailable');
  const text = await boundedText(response, 2_000_000);
  const sha256 = createHash('sha256').update(text).digest('hex');
  const name = path === '/state/trading' ? 'state-trading.json' : path.split('/').at(-1)!;
  await writeFile('data/official-schema/' + name, text);
  if (path === '/state/trading')
    await writeFile(
      'research/current-trading-state.json',
      JSON.stringify(JSON.parse(text), null, 2) + '\n',
    );
  evidence.push({ url: origin + path, sha256, bytes: Buffer.byteLength(text) });
}
await writeFile(
  'research/current-trading-schema-evidence.json',
  JSON.stringify(
    { observedAtUtc: new Date().toISOString(), downloadedJavaScriptExecuted: false, evidence },
    null,
    2,
  ) + '\n',
);
console.log({ captured: evidence.length, downloadedJavaScriptExecuted: false });
