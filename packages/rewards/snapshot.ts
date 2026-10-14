import {
  encodeAbiParameters,
  getAddress,
  isAddress,
  keccak256,
  concatHex,
  type Address,
  type Hex,
} from 'viem';
export type Member = { address: string; points: number };
export type Claim = { index: number; account: Address; amountRaw: string; leaf: Hex; proof: Hex[] };
export type SnapshotDomain = { chainId: number; claimContract: Address; campaignId: Hex };
export function claimLeaf(domain: SnapshotDomain, index: number, account: Address, amount: bigint) {
  return keccak256(
    keccak256(
      encodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'address' },
          { type: 'bytes32' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'uint256' },
        ],
        [
          BigInt(domain.chainId),
          domain.claimContract,
          domain.campaignId,
          BigInt(index),
          account,
          amount,
        ],
      ),
    ),
  );
}
function hashPair(a: Hex, b: Hex) {
  return keccak256(concatHex(BigInt(a) < BigInt(b) ? [a, b] : [b, a]));
}
export function createSnapshot(members: Member[], budget: bigint, domain: SnapshotDomain) {
  if (
    !Number.isSafeInteger(domain.chainId) ||
    domain.chainId <= 0 ||
    !isAddress(domain.claimContract) ||
    domain.claimContract.toLowerCase() === '0x' + '0'.repeat(40) ||
    !/^0x[\da-f]{64}$/i.test(domain.campaignId) ||
    budget <= 0n ||
    members.length === 0 ||
    members.length > 100_000
  )
    throw new Error('Invalid snapshot parameters');
  const rows = members
    .map((row) => {
      if (
        !isAddress(row.address) ||
        row.address.toLowerCase() === '0x' + '0'.repeat(40) ||
        !Number.isSafeInteger(row.points) ||
        row.points <= 0 ||
        row.points > 70
      )
        throw new Error('Invalid eligible participant');
      return {
        address: getAddress(row.address).toLowerCase() as Address,
        points: BigInt(row.points),
      };
    })
    .sort((a, b) => a.address.localeCompare(b.address));
  if (new Set(rows.map((row) => row.address)).size !== rows.length)
    throw new Error('Duplicate participant');
  const total = rows.reduce((sum, row) => sum + row.points, 0n);
  const amounts = rows.map((row) => (budget * row.points) / total);
  let residual = budget - amounts.reduce((sum, value) => sum + value, 0n);
  for (let i = 0; residual > 0n; i++, residual--) amounts[i] = amounts[i]! + 1n;
  if (amounts.some((amount) => amount === 0n))
    throw new Error('Budget too small for every participant');
  const claims: Claim[] = rows.map((row, index) => ({
    index,
    account: row.address,
    amountRaw: String(amounts[index]!),
    leaf: claimLeaf(domain, index, row.address, amounts[index]!),
    proof: [],
  }));
  const layers: Hex[][] = [claims.map((row) => row.leaf)];
  while (layers.at(-1)!.length > 1) {
    const previous = layers.at(-1)!,
      next: Hex[] = [];
    for (let i = 0; i < previous.length; i += 2)
      next.push(previous[i + 1] ? hashPair(previous[i]!, previous[i + 1]!) : previous[i]!);
    layers.push(next);
  }
  for (const claim of claims) {
    let index = claim.index;
    for (const layer of layers.slice(0, -1)) {
      const sibling = index ^ 1;
      if (layer[sibling]) claim.proof.push(layer[sibling]!);
      index = Math.floor(index / 2);
    }
  }
  return {
    domain,
    budgetRaw: String(budget),
    totalPoints: String(total),
    root: layers.at(-1)![0]!,
    claims,
  };
}
export function verifyClaim(root: Hex, claim: Claim) {
  return claim.proof.reduce(hashPair, claim.leaf) === root;
}
