import { isAddress, type Address, type Hex } from 'viem';
import { claimLeaf, verifyClaim, type Claim, type SnapshotDomain } from './snapshot.js';
export function inspectClaim(value: unknown, account: string) {
  if (!isAddress(account)) throw new Error('Enter a valid account address.');
  const manifest = value as { domain: SnapshotDomain; root: Hex; claims: Claim[] } | null;
  if (
    !manifest ||
    !/^0x[\da-f]{64}$/i.test(manifest.root) ||
    !Array.isArray(manifest.claims) ||
    manifest.claims.length > 100000 ||
    !manifest.domain ||
    !Number.isSafeInteger(manifest.domain.chainId) ||
    manifest.domain.chainId <= 0 ||
    !isAddress(manifest.domain.claimContract) ||
    /^0x0{40}$/i.test(manifest.domain.claimContract) ||
    !/^0x[\da-f]{64}$/i.test(manifest.domain.campaignId)
  )
    throw new Error('Invalid campaign manifest.');
  if (
    manifest.claims.some(
      (row) =>
        !row ||
        typeof row !== 'object' ||
        typeof row.account !== 'string' ||
        !isAddress(row.account),
    )
  )
    throw new Error('Invalid campaign claim.');
  const matches = manifest.claims.filter(
    (row) => row.account.toLowerCase() === account.toLowerCase(),
  );
  if (matches.length !== 1) throw new Error('No unique claim for this address in the manifest.');
  const claim = matches[0]!;
  if (
    !Number.isSafeInteger(claim.index) ||
    claim.index < 0 ||
    typeof claim.amountRaw !== 'string' ||
    !/^[1-9]\d{0,77}$/.test(claim.amountRaw) ||
    BigInt(claim.amountRaw) >= 1n << 256n ||
    !Array.isArray(claim.proof) ||
    claim.proof.length > 64 ||
    claim.proof.some((hash) => typeof hash !== 'string' || !/^0x[\da-f]{64}$/i.test(hash))
  )
    throw new Error('Invalid campaign claim.');
  const leaf = claimLeaf(manifest.domain, claim.index, account as Address, BigInt(claim.amountRaw));
  if (!verifyClaim(manifest.root, { ...claim, leaf }))
    throw new Error('Proof does not match the declared root.');
  return { domain: manifest.domain, amountRaw: claim.amountRaw };
}
