import { isAddress } from 'viem';
import { actionTypes } from '../protocol/intents.js';
import { sandboxId, type MockRelayer } from './relayer.js';
export const SANDBOX_STORAGE_KEY = 'paperclub.sandbox.v1';
type State = ReturnType<MockRelayer['serialize']>;
function uint(value: unknown, positive = false) {
  return (
    typeof value === 'string' &&
    /^(0|[1-9]\d*)$/.test(value) &&
    value.length <= 78 &&
    BigInt(value) < 1n << 256n &&
    (!positive || BigInt(value) > 0n)
  );
}
export function parseBrowserSandbox(raw: string, user: string): State {
  const invalid = () => {
    throw new Error('Saved local account is invalid. Reset the virtual account to continue.');
  };
  if (raw.length > 1_000_000) return invalid();
  try {
    const envelope = JSON.parse(raw),
      state = envelope?.state as State,
      ledger = state?.ledger;
    if (
      envelope.version !== 1 ||
      envelope.user !== user ||
      !ledger ||
      !['balanceRaw', 'queuedRaw', 'paperRaw', 'stakedRaw', 'rewardsRaw', 'claimedRaw'].every(
        (key) => uint(ledger[key as keyof typeof ledger]),
      ) ||
      !Number.isSafeInteger(ledger.nextPosition) ||
      ledger.nextPosition < 1 ||
      !Array.isArray(ledger.positions) ||
      ledger.positions.length > 1000 ||
      !ledger.sessions ||
      typeof ledger.sessions !== 'object' ||
      Array.isArray(ledger.sessions) ||
      Object.keys(ledger.sessions).length > 100 ||
      !Array.isArray(state.receipts) ||
      state.receipts.length > 1000 ||
      !Array.isArray(state.nonces) ||
      state.nonces.length > 10000
    )
      return invalid();
    for (const [address, expiry] of Object.entries(ledger.sessions))
      if (!isAddress(address) || !Number.isSafeInteger(expiry) || expiry < 0) return invalid();
    for (const position of ledger.positions)
      if (
        !position ||
        !uint(position.id, true) ||
        Number(position.id) >= ledger.nextPosition ||
        !Number.isSafeInteger(position.instrumentId) ||
        position.instrumentId < 0 ||
        typeof position.isLong !== 'boolean' ||
        !Number.isSafeInteger(position.leverage) ||
        position.leverage < 1 ||
        position.leverage > 1000 ||
        !uint(position.marginRaw, true) ||
        !uint(position.entryPriceRaw, true)
      )
        return invalid();
    for (const receipt of state.receipts) {
      if (
        !receipt ||
        !Object.hasOwn(actionTypes, receipt.action) ||
        !/^0x[\da-f]{64}$/i.test(receipt.id) ||
        !['queued', 'confirmed', 'failed', 'expired', 'cancelled'].includes(receipt.status) ||
        !Number.isSafeInteger(receipt.createdAt) ||
        receipt.createdAt < 0 ||
        !Number.isSafeInteger(receipt.deadline) ||
        receipt.deadline < 0 ||
        (receipt.reason !== undefined &&
          (typeof receipt.reason !== 'string' || receipt.reason.length > 250)) ||
        !receipt.message ||
        typeof receipt.message.user !== 'string' ||
        receipt.message.user.toLowerCase() !== user.toLowerCase() ||
        sandboxId(actionTypes[receipt.action], receipt.message) !== receipt.id
      )
        return invalid();
    }
    if (
      new Set(ledger.positions.map((v) => v.id)).size !== ledger.positions.length ||
      new Set(state.receipts.map((v) => v.id)).size !== state.receipts.length ||
      new Set(state.nonces).size !== state.nonces.length ||
      state.nonces.some(
        (v) => typeof v !== 'string' || !/^0x[\da-f]{40}:(0|[1-9]\d{0,77})$/i.test(v),
      )
    )
      return invalid();
    return state;
  } catch {
    return invalid();
  }
}
