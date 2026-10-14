import { parseUnits, formatUnits } from 'viem';
import type { Instrument, TradingState } from './official.js';
export const WAD = 10n ** 18n;
export const DOCUMENTED_WIN_FEE = 20_000_000_000_000_000n;
export function bustPrice(entry: bigint, leverage: number, isLong: boolean, buffer: bigint) {
  if (
    entry <= 0n ||
    !Number.isSafeInteger(leverage) ||
    leverage < 1 ||
    buffer < 0n ||
    buffer >= WAD
  )
    throw new Error('Invalid bust inputs');
  const l = BigInt(leverage);
  // Browser-derived buffer formula; source equivalence remains unverified.
  const zeroEquity = isLong ? entry - entry / l : entry + entry / l;
  const offset = (zeroEquity * buffer) / WAD;
  return isLong ? zeroEquity + offset : zeroEquity - offset;
}
export function closePnl(
  margin: bigint,
  leverage: number,
  entry: bigint,
  exit: bigint,
  isLong: boolean,
  instrument: Instrument,
  winFee = DOCUMENTED_WIN_FEE,
) {
  if (
    margin <= 0n ||
    entry <= 0n ||
    exit <= 0n ||
    !Number.isSafeInteger(leverage) ||
    leverage < 1 ||
    winFee < 0n ||
    winFee >= WAD
  )
    throw new Error('Invalid valuation inputs');
  const bust = bustPrice(entry, leverage, isLong, BigInt(instrument.bustBufferRaw));
  const liquidated = isLong ? exit <= bust : exit >= bust;
  const originalDelta = isLong ? exit - entry : entry - exit;
  const rawPnl = (margin * BigInt(leverage) * originalDelta) / entry;
  if (liquidated) return { rawPnl, netPnl: -margin, adjustedPnl: -margin, liquidated, bust };
  const deadband = entry / 50_000n;
  const effectiveDelta =
    originalDelta > 0n ? (originalDelta > deadband ? originalDelta - deadband : 0n) : originalDelta;
  const gain = (margin * BigInt(leverage) * effectiveDelta) / entry;
  if (gain <= 0n)
    return { rawPnl, netPnl: gain < -margin ? -margin : gain, adjustedPnl: gain, liquidated, bust };
  const move = (effectiveDelta * WAD) / entry;
  const firstDenom = (move * BigInt(instrument.rateMultiplierRaw)) / WAD;
  const secondDenom = (1_000_000n * move * BigInt(instrument.positionMultiplierRaw)) / WAD;
  if (!firstDenom || !secondDenom) return { rawPnl, netPnl: 0n, adjustedPnl: 0n, liquidated, bust };
  const first = (WAD * WAD) / firstDenom;
  const second = (BigInt(instrument.referenceNotionalRaw) * WAD) / secondDenom;
  const scale = ((WAD - BigInt(instrument.baseRateRaw)) * WAD) / (WAD + first + second);
  const adjustedPnl = (gain * scale) / WAD;
  return {
    rawPnl,
    adjustedPnl,
    netPnl: adjustedPnl - (adjustedPnl * winFee) / WAD,
    liquidated,
    bust,
  };
}
export function validateOpen(
  marginText: string,
  leverage: number,
  instrument: Instrument,
  state: TradingState,
) {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(marginText))
    throw new Error('Enter a positive margin with at most 18 decimal places.');
  if (!Number.isSafeInteger(leverage) || leverage < 1 || leverage > instrument.maxLeverage)
    throw new Error('Leverage is out of range.');
  const margin = parseUnits(marginText, 18),
    notional = margin * BigInt(leverage);
  if (margin < BigInt(state.minimumTradeSizeRaw) || margin >= 1n << 128n)
    throw new Error(`Minimum margin: ${formatUnits(BigInt(state.minimumTradeSizeRaw), 18)} USDC.`);
  if (notional < BigInt(state.minimumOpenNotionalRaw))
    throw new Error(
      `Minimum notional: ${formatUnits(BigInt(state.minimumOpenNotionalRaw), 18)} USDC.`,
    );
  if (notional > BigInt(instrument.maxPositionNotionalRaw))
    throw new Error('Position limit exceeded.');
  if (
    state.tradingPaused ||
    instrument.paused ||
    !instrument.active ||
    instrument.retired ||
    instrument.terminal ||
    state.intake.disabledActions.includes('openPosition')
  )
    throw new Error('Opening positions is paused.');
  return { margin, notional };
}
