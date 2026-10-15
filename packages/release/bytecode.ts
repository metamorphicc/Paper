import type { Hex } from 'viem';
import type { ImmutableReferences } from '../contracts/compiler.js';
/** Compare all executable/metadata bytes except solc's declared constructor immutable spans. */
export function compareRuntime(template: Hex, deployed: Hex, references: ImmutableReferences) {
  if (!/^0x(?:[\da-f]{2})+$/i.test(template) || !/^0x(?:[\da-f]{2})+$/i.test(deployed))
    throw new Error('Invalid runtime bytecode');
  if (template.length !== deployed.length) throw new Error('Runtime length mismatch');
  const a = Buffer.from(template.slice(2), 'hex'),
    b = Buffer.from(deployed.slice(2), 'hex');
  const masked = new Set<number>();
  const immutableValues: Record<string, string[]> = {};
  for (const [id, spans] of Object.entries(references)) {
    immutableValues[id] = [];
    for (const span of spans) {
      if (
        !Number.isSafeInteger(span.start) ||
        !Number.isSafeInteger(span.length) ||
        span.start < 0 ||
        span.length !== 32 ||
        span.start + span.length > a.length
      )
        throw new Error('Invalid immutable reference');
      immutableValues[id].push(
        '0x' + b.subarray(span.start, span.start + span.length).toString('hex'),
      );
      for (let i = span.start; i < span.start + span.length; i++) {
        if (masked.has(i)) throw new Error('Overlapping immutable reference');
        masked.add(i);
        a[i] = 0;
        b[i] = 0;
      }
    }
    if (new Set(immutableValues[id]).size !== 1) throw new Error('Inconsistent immutable value');
  }
  if (!a.equals(b)) throw new Error('Runtime differs outside constructor immutables');
  return {
    templateMatched: true as const,
    immutableValues,
    immutableBytesExcluded: masked.size,
    immutableGettersVerified: false as boolean,
  };
}
