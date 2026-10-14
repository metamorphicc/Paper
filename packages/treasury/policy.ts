export type TreasuryPolicy = {
  reserveRaw: bigint;
  periodLimitRaw: bigint;
  spentRaw: bigint;
  maxImpactBps: number;
  maxQuoteAgeMs: number;
};
export type BuybackQuote = {
  spendRaw: bigint;
  expectedOutRaw: bigint;
  minimumOutRaw: bigint;
  impactBps: number;
  observedAtMs: number;
};
/** Only settled spendable USDC enters the budget. Queued claims/PAPER/deposits are not revenue. */
export function spendingCapacity(
  available: bigint,
  realizedRevenue: bigint,
  policy: TreasuryPolicy,
) {
  if (
    [available, realizedRevenue, policy.reserveRaw, policy.periodLimitRaw, policy.spentRaw].some(
      (value) => value < 0n,
    )
  )
    throw new Error('Negative treasury input');
  const liquid = available > policy.reserveRaw ? available - policy.reserveRaw : 0n;
  const remaining =
    policy.periodLimitRaw > policy.spentRaw ? policy.periodLimitRaw - policy.spentRaw : 0n;
  return [liquid, remaining, realizedRevenue].reduce((a, b) => (a < b ? a : b));
}
export function validateBuyback(
  available: bigint,
  realizedRevenue: bigint,
  policy: TreasuryPolicy,
  quote: BuybackQuote,
  now = Date.now(),
) {
  if (
    !Number.isSafeInteger(policy.maxImpactBps) ||
    policy.maxImpactBps < 0 ||
    policy.maxImpactBps > 10000 ||
    !Number.isSafeInteger(quote.impactBps) ||
    quote.impactBps < 0 ||
    !Number.isSafeInteger(quote.observedAtMs) ||
    quote.observedAtMs > now ||
    now - quote.observedAtMs > policy.maxQuoteAgeMs
  )
    throw new Error('Invalid or stale quote');
  if (
    quote.spendRaw <= 0n ||
    quote.spendRaw > spendingCapacity(available, realizedRevenue, policy) ||
    quote.impactBps > policy.maxImpactBps ||
    quote.minimumOutRaw <= 0n ||
    quote.expectedOutRaw < quote.minimumOutRaw
  )
    throw new Error('Buyback violates budget or price constraints');
  return {
    allowed: true,
    spendRaw: String(quote.spendRaw),
    minimumOutRaw: String(quote.minimumOutRaw),
    executionEnabled: false,
  };
}
