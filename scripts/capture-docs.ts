import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../research/', import.meta.url);
await mkdir(new URL('raw/', root), { recursive: true });
const response = await fetch('https://docs.papertrade.xyz', { signal: AbortSignal.timeout(20_000) });
if (!response.ok) throw new Error(`Docs HTTP ${response.status}`);
const html = await response.text();
const assetPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
if (!assetPath) throw new Error('Docs asset not found; parser needs review');
const assetUrl = new URL(assetPath, 'https://docs.papertrade.xyz').href;
const assetResponse = await fetch(assetUrl, { signal: AbortSignal.timeout(20_000) });
if (!assetResponse.ok) throw new Error(`Asset HTTP ${assetResponse.status}`);
const source = await assetResponse.text();
await writeFile(new URL('raw/papertrade-docs.html', root), html);
await writeFile(new URL('raw/papertrade-docs.js', root), source);
// Extract static content as data only. Never evaluate downloaded JavaScript.
const pattern = /"([a-z-]+\/[a-z-]+)":\{title:`((?:\\.|[^`])*)`,eyebrow:`((?:\\.|[^`])*)`,lead:`((?:\\.|[^`])*)`,body:`((?:\\.|[^`])*)`\}/gs;
const pages = [...source.matchAll(pattern)].map(match => ({
  slug: match[1]!, title: match[2]!, lead: match[4]!,
  url: `https://docs.papertrade.xyz/#/${match[1]}`,
  text: match[5]!.replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<\/(?:p|li|h[1-6]|pre|ol|ul|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n'),
}));
if (pages.length < 20) throw new Error(`Only ${pages.length} pages extracted; parser needs review`);
const snapshot = { capturedAtUtc: new Date().toISOString(), assetUrl,
  sha256: createHash('sha256').update(source).digest('hex'), pages };
await writeFile(new URL('official-docs.json', root), JSON.stringify(snapshot, null, 2) + '\n');
const config = JSON.parse(await readFile(new URL('../config/protocol.json', import.meta.url), 'utf8'));
const addressesPage = pages.find(page => page.slug === 'dev/contract-addresses');
for (const [name, address] of Object.entries(config.contracts) as [string, string][]) {
  if (!addressesPage?.text.toLowerCase().includes(address.toLowerCase())) {
    throw new Error(`${name} no longer matches documentation; review config`);
  }
}
console.log(`Captured ${pages.length} official pages, hash ${snapshot.sha256}; contract addresses match docs.`);
