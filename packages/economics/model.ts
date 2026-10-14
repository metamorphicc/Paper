// Illustrative floating-point economics. Never use for transaction amounts or NAV accounting.
export type ImpactParameters = {
  baseRate: number; rateMultiplier: number; referenceNotional: number;
  positionMultiplier: number; deadband: number; winFee: number;
};
export const documentedBtcLaunch: ImpactParameters = {
  baseRate: 0.1, rateMultiplier: 15_000, referenceNotional: 100_000,
  positionMultiplier: 814.598, deadband: 1 / 50_000, winFee: 0.02,
};
function finiteNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative`);
}
export function profitableClose(notional: number, favorableMove: number, p = documentedBtcLaunch) {
  finiteNonNegative(notional, 'notional');
  finiteNonNegative(favorableMove, 'favorableMove');
  if (!(p.baseRate >= 0 && p.baseRate < 1 && p.winFee >= 0 && p.winFee < 1 &&
    p.rateMultiplier > 0 && p.positionMultiplier > 0 && p.referenceNotional >= 0 && p.deadband >= 0) ||
    !Object.values(p).every(Number.isFinite)) throw new Error('Invalid impact parameters');
  const effectiveMove = Math.max(0, favorableMove - p.deadband);
  const rawGain = notional * favorableMove;
  if (effectiveMove === 0) return { rawGain, gainAfterDeadband: 0, scale: 0, netGain: 0 };
  const scale = (1 - p.baseRate) / (1 + 1 / (effectiveMove * p.rateMultiplier)
    + p.referenceNotional / (1e6 * effectiveMove * p.positionMultiplier));
  const gainAfterDeadband = notional * effectiveMove;
  return { rawGain, gainAfterDeadband, scale, netGain: gainAfterDeadband * scale * (1 - p.winFee) };
}
export function pairedClose(input: {
  marginPerLeg: number; leverage: number; absoluteMove: number;
  assumedPaperPerLossDollar: number; queueActive: boolean; winPaidFraction: number;
}) {
  for (const [name, value] of Object.entries(input)) if (typeof value === 'number') finiteNonNegative(value, name);
  if (input.leverage < 1 || input.winPaidFraction > 1) throw new Error('Invalid leverage or paid fraction');
  // We do not model liquidation triggers. Restrict examples to an ample margin buffer.
  if (input.leverage * input.absoluteMove >= 0.5) throw new Error('Outside illustrative close-only model; liquidation simulation required');
  const initialCash = input.marginPerLeg * 2;
  const notionalPerLeg = input.marginPerLeg * input.leverage;
  const rawLoss = notionalPerLeg * input.absoluteMove;
  const win = profitableClose(notionalPerLeg, input.absoluteMove);
  const lossMintBasis = rawLoss * (input.queueActive ? 1 : 0.98);
  const mintedPaperApprox = lossMintBasis * input.assumedPaperPerLossDollar;
  const economicCost = rawLoss - win.netGain;
  const queuedGain = win.netGain * (1 - input.winPaidFraction);
  return { ...input, initialCash, notionalPerLeg, rawLoss, netWin: win.netGain,
    economicCost, availableCash: initialCash - rawLoss + win.netGain - queuedGain,
    queuedGain, lossMintBasis, mintedPaperApprox,
    acquisitionCostPerPaper: mintedPaperApprox > 0 ? economicCost / mintedPaperApprox : null };
}
export function rewardProjection(input: {
  acquisitionCost: number; initialStakeShare: number; monthlyPaidPoolRewards: number;
  monthlyOtherStakeGrowth: number; months: number;
}) {
  for (const [name, value] of Object.entries(input)) finiteNonNegative(value, name);
  if (input.initialStakeShare > 1 || !Number.isInteger(input.months)) throw new Error('Invalid share or horizon');
  let otherStake = 1 - input.initialStakeShare;
  const ownStake = input.initialStakeShare;
  const monthly = Array.from({ length: input.months }, (_, month) => {
    const share = ownStake + otherStake === 0 ? 0 : ownStake / (ownStake + otherStake);
    const received = share * input.monthlyPaidPoolRewards;
    otherStake *= 1 + input.monthlyOtherStakeGrowth;
    return { month: month + 1, share, received };
  });
  const cumulativeReceived = monthly.reduce((total, row) => total + row.received, 0);
  return { ...input, monthly, cumulativeReceived, netAfterAcquisition: cumulativeReceived - input.acquisitionCost,
    breakEvenMonth: monthly.find((_, index) => monthly.slice(0, index + 1).reduce((sum, row) => sum + row.received, 0) >= input.acquisitionCost)?.month ?? null };
}
