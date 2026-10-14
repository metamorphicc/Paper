import { hashTypedData, keccak256, toHex, recoverTypedDataAddress, type Hex } from 'viem';
import {
  officialTypedData,
  actionTypes,
  type IntentMessage,
  type IntentType,
} from '../protocol/intents.js';
import { assertLiveSubmissionAllowed } from '../protocol/capabilities.js';
import { closePnl, WAD } from '../protocol/quote.js';
import type { Instrument } from '../protocol/official.js';

export const SANDBOX_DOMAIN = {
  name: 'Paperclub Sandbox',
  version: '1',
  chainId: 999,
  verifyingContract: '0x0000000000000000000000000000000000000000',
} as const;
export type Action = keyof typeof actionTypes;
export type Envelope = { action: Action; message: IntentMessage; signature: Hex };
export type IntentStatus = 'queued' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
export type Receipt = {
  id: Hex;
  action: Action;
  status: IntentStatus;
  message: IntentMessage;
  deadline: number;
  createdAt: number;
  reason?: string;
};
export type Position = {
  id: string;
  instrumentId: number;
  isLong: boolean;
  marginRaw: string;
  leverage: number;
  entryPriceRaw: string;
};
export type Ledger = {
  balanceRaw: string;
  queuedRaw: string;
  paperRaw: string;
  stakedRaw: string;
  rewardsRaw: string;
  claimedRaw: string;
  positions: Position[];
  sessions: Record<string, number>;
  nextPosition: number;
};
export function sandboxTypedData(type: IntentType, message: IntentMessage) {
  return { ...officialTypedData(type, message), domain: SANDBOX_DOMAIN };
}
export function sandboxId(type: IntentType, message: IntentMessage): Hex {
  return keccak256(toHex(`paperclub:sandbox:v1:${hashTypedData(sandboxTypedData(type, message))}`));
}
export class LiveRelayerTransport {
  async submit(_payload: Envelope): Promise<Receipt> {
    assertLiveSubmissionAllowed();
  }
  async status(_id: Hex): Promise<Receipt> {
    assertLiveSubmissionAllowed();
  }
  async cancel(_id: Hex): Promise<Receipt> {
    assertLiveSubmissionAllowed();
  }
}
export class MockRelayer {
  readonly mode = 'sandbox';
  readonly receipts = new Map<Hex, Receipt>();
  readonly ledger: Ledger;
  private nonces = new Set<string>();
  outage = false;
  ambiguousNext = false;
  queueProfit = false;
  paused = false;
  paperPerDollarRaw = 100n * WAD;
  minimumMarginRaw = 10n * WAD;
  minimumNotionalRaw = 1000n * WAD;
  minimumPaperStakeRaw = 0n;
  constructor(
    readonly user: string,
    private instrument: Instrument,
    private entry: bigint,
    private now = () => Date.now(),
    state?: { ledger: Ledger; receipts: Receipt[]; nonces: string[] },
  ) {
    this.ledger = state?.ledger ?? {
      balanceRaw: String(2500n * WAD),
      queuedRaw: '0',
      paperRaw: '0',
      stakedRaw: '0',
      rewardsRaw: '0',
      claimedRaw: '0',
      positions: [],
      sessions: {},
      nextPosition: 1,
    };
    if (state) {
      for (const receipt of state.receipts) this.receipts.set(receipt.id, receipt);
      this.nonces = new Set(state.nonces);
    }
  }
  configure(instrument: Instrument, entry: bigint) {
    this.instrument = instrument;
    this.entry = entry;
  }
  serialize() {
    return { ledger: this.ledger, receipts: [...this.receipts.values()], nonces: [...this.nonces] };
  }
  available() {
    this.expire();
    let reserved = 0n;
    for (const receipt of this.receipts.values())
      if (receipt.status === 'queued') {
        if (receipt.action === 'openPosition') reserved += BigInt(String(receipt.message.size));
        if (receipt.action === 'withdrawToCore')
          reserved += BigInt(String(receipt.message.amount)) * 10n ** 12n;
      }
    return BigInt(this.ledger.balanceRaw) - reserved;
  }
  private expire() {
    for (const receipt of this.receipts.values())
      if (receipt.status === 'queued' && receipt.deadline <= Math.floor(this.now() / 1000)) {
        receipt.status = 'expired';
        receipt.reason = 'Deadline expired';
      }
  }
  async submit(envelope: Envelope): Promise<Receipt> {
    if (this.outage) throw new Error('Local relayer unavailable');
    this.expire();
    const type = actionTypes[envelope.action];
    if (!type) throw new Error('Unknown action');
    const typed = sandboxTypedData(type, envelope.message);
    const signer = (
      await recoverTypedDataAddress({ ...typed, signature: envelope.signature })
    ).toLowerCase();
    if (String(envelope.message.user).toLowerCase() !== this.user.toLowerCase())
      throw new Error('Wrong user');
    const session = this.ledger.sessions[signer];
    if (
      signer !== this.user.toLowerCase() &&
      (!['openPosition', 'closePositions'].includes(envelope.action) ||
        !session ||
        session <= this.now() / 1000)
    )
      throw new Error('Wallet signature required or session revoked');
    const id = sandboxId(type, envelope.message),
      existing = this.receipts.get(id);
    if (existing) return existing;
    const nonce = BigInt(String(envelope.message.nonce)),
      deadline = Number(envelope.message.deadline),
      nonceKey = `${signer}:${nonce}`;
    if (
      nonce < 0n ||
      nonce >= 1n << 256n ||
      !Number.isSafeInteger(deadline) ||
      deadline <= this.now() / 1000 ||
      deadline > this.now() / 1000 + 3600
    )
      throw new Error('Invalid nonce or deadline');
    if (this.nonces.has(nonceKey)) throw new Error('Nonce already used');
    this.validate(envelope);
    const receipt: Receipt = {
      id,
      action: envelope.action,
      message: envelope.message,
      status: 'queued',
      deadline,
      createdAt: this.now(),
    };
    this.nonces.add(nonceKey);
    this.receipts.set(id, receipt);
    if (this.ambiguousNext) {
      this.ambiguousNext = false;
      throw new Error('Confirmation unknown; check the same intent ID');
    }
    return receipt;
  }
  private validate({ action, message }: Envelope) {
    if (action === 'openPosition') {
      if (
        this.paused ||
        this.instrument.paused ||
        !this.instrument.active ||
        this.instrument.terminal
      )
        throw new Error('Market paused');
      const margin = BigInt(String(message.size)),
        leverage = Number(message.leverage);
      if (
        message.instrumentId !== this.instrument.id ||
        typeof message.isLong !== 'boolean' ||
        message.useDebt !== false ||
        margin <= 0n ||
        margin >= 1n << 128n ||
        !Number.isInteger(leverage) ||
        leverage < 1 ||
        leverage > this.instrument.maxLeverage ||
        margin * BigInt(leverage) > BigInt(this.instrument.maxPositionNotionalRaw)
      )
        throw new Error('Invalid position');
      if (margin < this.minimumMarginRaw || margin * BigInt(leverage) < this.minimumNotionalRaw)
        throw new Error('Minimum margin or notional not met');
      if (margin > this.available()) throw new Error('Insufficient available collateral');
    }
    if (action === 'closePositions') {
      if (
        !Array.isArray(message.positionIds) ||
        message.positionIds.length < 1 ||
        message.positionIds.length > 12
      )
        throw new Error('Invalid close IDs');
      const ids = message.positionIds.map(String);
      if (
        new Set(ids).size !== ids.length ||
        ids.some((id) => !this.ledger.positions.some((position) => position.id === id))
      )
        throw new Error('Position already closed');
      for (const receipt of this.receipts.values())
        if (
          receipt.status === 'queued' &&
          receipt.action === 'closePositions' &&
          ids.some((id) =>
            (receipt.message.positionIds as readonly string[]).map(String).includes(id),
          )
        )
          throw new Error('Close already pending');
    }
    if (['paperStake', 'paperUnstake', 'withdrawToCore'].includes(action)) {
      const amount = BigInt(String(message.amount));
      if (amount <= 0n) throw new Error('Amount must be positive');
      if (action === 'paperStake' && amount < this.minimumPaperStakeRaw)
        throw new Error('Minimum PAPER stake not met');
      const available =
        action === 'paperStake'
          ? BigInt(this.ledger.paperRaw)
          : action === 'paperUnstake'
            ? BigInt(this.ledger.stakedRaw)
            : this.available() / 10n ** 12n;
      if (amount > available) throw new Error('Insufficient balance');
      // One balance-changing non-trading action at a time, so pending stake/withdraw never double-spends.
      if (
        [...this.receipts.values()].some(
          (receipt) =>
            receipt.status === 'queued' &&
            ['paperStake', 'paperUnstake', 'withdrawToCore', 'paperClaim'].includes(receipt.action),
        )
      )
        throw new Error('Balance action already pending');
    }
    if (action === 'paperClaim' && BigInt(this.ledger.rewardsRaw) <= 0n)
      throw new Error('No distributed rewards');
    if (action === 'registerSessionKey') {
      const expiry = Number(message.expiry);
      if (
        !Number.isSafeInteger(expiry) ||
        expiry <= this.now() / 1000 ||
        expiry > this.now() / 1000 + 30 * 86400
      )
        throw new Error('Invalid session expiry');
    }
  }
  status(id: Hex) {
    this.expire();
    const receipt = this.receipts.get(id);
    if (!receipt) throw new Error('Unknown intent');
    return receipt;
  }
  cancel(id: Hex) {
    const receipt = this.status(id);
    if (receipt.status !== 'queued') throw new Error('Only queued intents can be cancelled');
    receipt.status = 'cancelled';
    return receipt;
  }
  revoke(key: string) {
    delete this.ledger.sessions[key.toLowerCase()];
  }
  releaseQueue() {
    this.ledger.balanceRaw = String(BigInt(this.ledger.balanceRaw) + BigInt(this.ledger.queuedRaw));
    this.ledger.queuedRaw = '0';
  }
  distributeTestRewards(amount: bigint) {
    if (amount <= 0n || BigInt(this.ledger.stakedRaw) === 0n)
      throw new Error('Stake PAPER before test distribution');
    this.ledger.rewardsRaw = String(BigInt(this.ledger.rewardsRaw) + amount);
  }
  settle(id: Hex, exit = this.entry) {
    const receipt = this.status(id);
    if (this.outage) throw new Error('Local relayer unavailable');
    if (receipt.status !== 'queued') return receipt;
    const m = receipt.message;
    const originalLedger = structuredClone(this.ledger);
    try {
      if (receipt.action === 'openPosition') {
        if (this.paused) throw new Error('Market paused');
        const margin = BigInt(String(m.size));
        if (margin > BigInt(this.ledger.balanceRaw))
          throw new Error('Insufficient funds at execution');
        this.ledger.balanceRaw = String(BigInt(this.ledger.balanceRaw) - margin);
        this.ledger.positions.push({
          id: String(this.ledger.nextPosition++),
          instrumentId: Number(m.instrumentId),
          marginRaw: String(margin),
          leverage: Number(m.leverage),
          isLong: !!m.isLong,
          entryPriceRaw: String(this.entry),
        });
      } else if (receipt.action === 'closePositions') {
        const ids = (m.positionIds as readonly string[]).map(String),
          positions = ids.map((id) => this.ledger.positions.find((position) => position.id === id));
        if (positions.some((position) => !position)) throw new Error('Position already closed');
        for (const position of positions) {
          if (position!.instrumentId !== this.instrument.id)
            throw new Error('Select the position market to settle');
          const margin = BigInt(position!.marginRaw),
            result = closePnl(
              margin,
              position!.leverage,
              BigInt(position!.entryPriceRaw),
              exit,
              position!.isLong,
              this.instrument,
            );
          if (result.netPnl > 0n && this.queueProfit) {
            this.ledger.balanceRaw = String(BigInt(this.ledger.balanceRaw) + margin);
            this.ledger.queuedRaw = String(BigInt(this.ledger.queuedRaw) + result.netPnl);
          } else
            this.ledger.balanceRaw = String(
              BigInt(this.ledger.balanceRaw) + margin + result.netPnl,
            );
          if (result.netPnl < 0n) {
            const loss = -result.netPnl,
              basis = result.liquidated || this.queueProfit ? loss : (loss * 98n) / 100n;
            this.ledger.paperRaw = String(
              BigInt(this.ledger.paperRaw) + (basis * this.paperPerDollarRaw) / WAD,
            );
          }
        }
        this.ledger.positions = this.ledger.positions.filter(
          (position) => !ids.includes(position.id),
        );
      } else if (receipt.action === 'paperStake') {
        const amount = BigInt(String(m.amount));
        if (amount > BigInt(this.ledger.paperRaw)) throw new Error('Insufficient PAPER');
        this.ledger.paperRaw = String(BigInt(this.ledger.paperRaw) - amount);
        this.ledger.stakedRaw = String(BigInt(this.ledger.stakedRaw) + amount);
      } else if (receipt.action === 'paperUnstake') {
        const amount = BigInt(String(m.amount));
        if (amount > BigInt(this.ledger.stakedRaw)) throw new Error('Insufficient stake');
        this.ledger.stakedRaw = String(BigInt(this.ledger.stakedRaw) - amount);
        this.ledger.paperRaw = String(BigInt(this.ledger.paperRaw) + amount);
      } else if (receipt.action === 'paperClaim') {
        this.ledger.balanceRaw = String(
          BigInt(this.ledger.balanceRaw) + BigInt(this.ledger.rewardsRaw),
        );
        this.ledger.claimedRaw = String(
          BigInt(this.ledger.claimedRaw) + BigInt(this.ledger.rewardsRaw),
        );
        this.ledger.rewardsRaw = '0';
      } else if (receipt.action === 'withdrawToCore') {
        const amount = BigInt(String(m.amount)) * 10n ** 12n;
        if (amount > BigInt(this.ledger.balanceRaw))
          throw new Error('Insufficient withdrawal collateral');
        this.ledger.balanceRaw = String(BigInt(this.ledger.balanceRaw) - amount);
      } else if (receipt.action === 'registerSessionKey') {
        this.ledger.sessions[String(m.key).toLowerCase()] = Number(m.expiry);
      }
      receipt.status = 'confirmed';
    } catch (error) {
      Object.assign(this.ledger, originalLedger);
      receipt.status = 'failed';
      receipt.reason = error instanceof Error ? error.message : 'Execution failed';
    }
    return receipt;
  }
}
