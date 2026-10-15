import { getContractAddress, isAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import { createSnapshot, type Member } from '../rewards/snapshot.js';

export type DeploymentParameters = {
  schemaVersion: 1;
  status: 'draft';
  targetChainId: 999 | 31337;
  deployer: Address;
  startNonce: string;
  token: {
    name: string;
    symbol: string;
    capRaw: string;
    allocations: { recipient: Address; amountRaw: string }[];
  };
  campaign: {
    campaignId: Hex;
    budgetRaw: string;
    deadline: number;
    recovery: Address;
    members: Member[];
  };
  treasury: {
    asset: Address;
    assetDecimals: 6;
    operator: Address;
    reserveRaw: string;
    dailyLimitRaw: string;
    fundingRaw: string;
    destinations: Address[];
  };
};
export type PlanIssue = { field: string; reason: string };
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function address(value: unknown): value is Address {
  return typeof value === 'string' && isAddress(value, { strict: false }) && BigInt(value) !== 0n;
}
function raw(value: unknown, positive = true): value is string {
  return (
    typeof value === 'string' &&
    /^(0|[1-9]\d*)$/.test(value) &&
    value.length <= 78 &&
    BigInt(value) < 1n << 256n &&
    (!positive || BigInt(value) > 0n)
  );
}
/** Parameter completeness only. No result authorizes deployment or changes release gates. */
export function validateDeploymentParameters(value: unknown, nowSeconds: number): PlanIssue[] {
  const root = record(value),
    token = record(root.token),
    campaign = record(root.campaign),
    treasury = record(root.treasury);
  const issues: PlanIssue[] = [];
  const require = (condition: boolean, field: string, reason: string) => {
    if (!condition) issues.push({ field, reason });
  };
  const keys = (value: Record<string, unknown>, expected: string[], prefix: string) => {
    for (const key of Object.keys(value))
      require(expected.includes(key), prefix + key, 'Unknown field');
  };
  keys(
    root,
    [
      'schemaVersion',
      'status',
      'targetChainId',
      'deployer',
      'startNonce',
      'token',
      'campaign',
      'treasury',
    ],
    '',
  );
  keys(token, ['name', 'symbol', 'capRaw', 'allocations'], 'token.');
  keys(campaign, ['campaignId', 'budgetRaw', 'deadline', 'recovery', 'members'], 'campaign.');
  keys(
    treasury,
    [
      'asset',
      'assetDecimals',
      'operator',
      'reserveRaw',
      'dailyLimitRaw',
      'fundingRaw',
      'destinations',
    ],
    'treasury.',
  );
  require(root.schemaVersion === 1 &&
    root.status === 'draft', 'schemaVersion/status', 'Review-only draft required');
  require(root.targetChainId === 999 ||
    root.targetChainId === 31337, 'targetChainId', 'HyperEVM or isolated local chain required');
  require(address(root.deployer), 'deployer', 'Explicit nonzero deployer required');
  require(raw(root.startNonce, false) &&
    BigInt(String(root.startNonce)) <=
      (1n << 64n) - 4n, 'startNonce', 'Canonical deployment nonce required');
  require(typeof token.name === 'string' &&
    /^[\x20-\x7e]{1,64}$/.test(token.name) &&
    token.name.trim() === token.name &&
    token.name.length > 0, 'token.name', 'Explicit English name required');
  require(typeof token.symbol === 'string' &&
    /^[A-Z0-9]{1,12}$/.test(token.symbol), 'token.symbol', 'Explicit ticker required');
  require(raw(token.capRaw), 'token.capRaw', 'Positive uint256 cap required');
  const allocations = Array.isArray(token.allocations) ? token.allocations : [];
  require(allocations.length > 0 &&
    allocations.length <= 100, 'token.allocations', '1–100 explicit allocations required');
  let sum = 0n,
    fundingAllocation = 0n;
  const recipients = new Set<string>();
  for (const [index, item] of allocations.entries()) {
    const row = record(item),
      prefix = `token.allocations.${index}.`;
    keys(row, ['recipient', 'amountRaw'], prefix);
    require(address(row.recipient), prefix + 'recipient', 'Nonzero recipient required');
    require(raw(row.amountRaw), prefix + 'amountRaw', 'Positive uint256 allocation required');
    if (address(row.recipient)) {
      const account = row.recipient.toLowerCase();
      require(!recipients.has(account), prefix + 'recipient', 'Duplicate recipient');
      recipients.add(account);
      if (
        raw(row.amountRaw) &&
        typeof root.deployer === 'string' &&
        account === root.deployer.toLowerCase()
      )
        fundingAllocation += BigInt(row.amountRaw);
    }
    if (raw(row.amountRaw)) sum += BigInt(row.amountRaw);
  }
  if (raw(token.capRaw))
    require(sum ===
      BigInt(token.capRaw), 'token.allocations', 'Allocations must equal the full cap');
  require(typeof campaign.campaignId === 'string' &&
    /^0x[\da-f]{64}$/i.test(campaign.campaignId) &&
    BigInt(campaign.campaignId) !==
      0n, 'campaign.campaignId', 'Nonzero bytes32 campaign ID required');
  require(raw(campaign.budgetRaw), 'campaign.budgetRaw', 'Positive campaign budget required');
  if (raw(campaign.budgetRaw))
    require(fundingAllocation >=
      BigInt(
        campaign.budgetRaw,
      ), 'campaign.budgetRaw', 'Deployer allocation cannot fund the campaign');
  require(Number.isSafeInteger(nowSeconds) &&
    nowSeconds >= 0, 'nowSeconds', 'Valid validation time required');
  require(typeof campaign.deadline === 'number' &&
    Number.isSafeInteger(campaign.deadline) &&
    campaign.deadline > nowSeconds, 'campaign.deadline', 'Future integer Unix deadline required');
  require(address(campaign.recovery), 'campaign.recovery', 'Explicit recovery recipient required');
  const members = Array.isArray(campaign.members) ? campaign.members : [];
  require(members.length > 0 &&
    members.length <= 100_000, 'campaign.members', 'Explicit bounded eligible members required');
  const memberAddresses = new Set<string>();
  for (const [index, item] of members.entries()) {
    const row = record(item),
      prefix = `campaign.members.${index}.`;
    keys(row, ['address', 'points'], prefix);
    require(address(row.address), prefix + 'address', 'Nonzero member address required');
    require(typeof row.points === 'number' &&
      Number.isSafeInteger(row.points) &&
      row.points > 0 &&
      row.points <= 70, prefix + 'points', 'Integer points in 1–70 required');
    if (address(row.address)) {
      const account = row.address.toLowerCase();
      require(!memberAddresses.has(account), prefix + 'address', 'Duplicate member');
      memberAddresses.add(account);
    }
  }
  require(address(treasury.asset), 'treasury.asset', 'Explicit treasury asset required');
  require(treasury.assetDecimals ===
    6, 'treasury.assetDecimals', 'This deployment recipe requires a six-decimal asset');
  require(address(treasury.operator), 'treasury.operator', 'Explicit operator required');
  for (const key of ['reserveRaw', 'dailyLimitRaw', 'fundingRaw'])
    require(raw(treasury[key], key !== 'reserveRaw'), 'treasury.' +
      key, 'Explicit raw uint256 asset amount required');
  if (raw(treasury.reserveRaw, false) && raw(treasury.fundingRaw) && raw(treasury.dailyLimitRaw))
    require(BigInt(treasury.fundingRaw) >=
      BigInt(treasury.reserveRaw) +
        BigInt(
          treasury.dailyLimitRaw,
        ), 'treasury.fundingRaw', 'Funding must cover reserve plus one daily budget');
  const destinations = Array.isArray(treasury.destinations) ? treasury.destinations : [];
  require(destinations.length > 0 &&
    destinations.length <= 100, 'treasury.destinations', '1–100 explicit destinations required');
  const allowed = new Set<string>();
  for (const [index, destination] of destinations.entries()) {
    require(address(destination), `treasury.destinations.${index}`, 'Nonzero destination required');
    if (address(destination)) {
      require(!allowed.has(
        destination.toLowerCase(),
      ), `treasury.destinations.${index}`, 'Duplicate destination');
      allowed.add(destination.toLowerCase());
    }
  }
  return issues;
}

export function buildDeploymentPlan(value: unknown, nowSeconds: number) {
  const issues = validateDeploymentParameters(value, nowSeconds);
  if (issues.length)
    throw new Error('Invalid deployment parameters: ' + issues.map((row) => row.field).join(', '));
  const p = value as DeploymentParameters;
  const predicted = (offset: bigint) =>
    getContractAddress({ from: p.deployer, nonce: BigInt(p.startNonce) + offset });
  const token = predicted(0n),
    claims = predicted(1n),
    treasury = predicted(2n);
  if ([token, claims, treasury].some((a) => a.toLowerCase() === p.treasury.asset.toLowerCase()))
    throw new Error('Treasury asset collides with a planned deployment');
  const snapshot = createSnapshot(p.campaign.members, BigInt(p.campaign.budgetRaw), {
    chainId: p.targetChainId,
    claimContract: claims,
    campaignId: p.campaign.campaignId,
  });
  const deployments = [
    {
      contract: 'ClubToken',
      address: token,
      nonce: p.startNonce,
      args: [
        p.token.name,
        p.token.symbol,
        p.token.capRaw,
        p.token.allocations.map((a) => a.recipient),
        p.token.allocations.map((a) => a.amountRaw),
      ],
    },
    {
      contract: 'CampaignClaims',
      address: claims,
      nonce: String(BigInt(p.startNonce) + 1n),
      args: [
        token,
        snapshot.root,
        p.campaign.campaignId,
        p.campaign.budgetRaw,
        p.campaign.deadline,
        p.campaign.recovery,
      ],
    },
    {
      contract: 'TreasuryBudget',
      address: treasury,
      nonce: String(BigInt(p.startNonce) + 2n),
      args: [
        p.treasury.asset,
        p.treasury.operator,
        p.treasury.reserveRaw,
        p.treasury.dailyLimitRaw,
        p.treasury.destinations,
      ],
    },
  ];
  const content = { parameters: p, deployments, snapshot };
  // Hash canonical reviewed content. No timestamp or implicit wallet/RPC state enters this digest.
  return {
    ...content,
    reviewDigest: keccak256(toHex(JSON.stringify(content))),
    automaticDeploy: false as const,
    launchApproved: false as const,
  };
}
