export type Implementation = { address: string; runtimeHash: string };
export function compareImplementations(
  expected: Record<string, Implementation>,
  observed: Record<string, Implementation>,
) {
  const changes: { name: string; reason: string }[] = [];
  for (const name of new Set([...Object.keys(expected), ...Object.keys(observed)])) {
    const before = expected[name],
      after = observed[name];
    if (!before || !after) {
      changes.push({ name, reason: 'Missing or unexpected implementation' });
      continue;
    }
    if (!/^0x[\da-f]{40}$/i.test(after.address) || !/^0x[\da-f]{64}$/i.test(after.runtimeHash)) {
      changes.push({ name, reason: 'Invalid implementation observation' });
      continue;
    }
    if (before.address.toLowerCase() !== after.address.toLowerCase())
      changes.push({ name, reason: 'Implementation address changed' });
    if (before.runtimeHash.toLowerCase() !== after.runtimeHash.toLowerCase())
      changes.push({ name, reason: 'Runtime hash changed' });
  }
  return {
    status: changes.length ? 'changed' : 'unchanged',
    changes,
    liveSubmission: false,
    sourceVerification: false,
  };
}
