'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseUnits } from 'viem';
import { closePnl, validateOpen } from '../../../packages/protocol/quote.js';
import { officialTypedData } from '../../../packages/protocol/intents.js';
import type { MarketQuote } from '../../../packages/protocol/market.js';
import type { TradingState } from '../../../packages/protocol/official.js';
import { amount, localTime } from '../lib/format';
import { useWallet } from './wallet';
import Sandbox from './sandbox';
type MarketData = {
  quote: MarketQuote;
  trading: TradingState;
  candles: { time: number; close: number }[];
  fetchedAt: string;
};
type Calculation =
  | {
      ok: true;
      valid: ReturnType<typeof validateOpen>;
      pnl: ReturnType<typeof closePnl>;
      entry: bigint;
      exit: bigint;
    }
  | { ok: false; issue: string };
export default function Terminal({ initialCoin = 'BTC' }: { initialCoin?: 'BTC' | 'ETH' }) {
  const wallet = useWallet();
  const [coin, setCoin] = useState<'BTC' | 'ETH'>(initialCoin),
    [market, setMarket] = useState<MarketData | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const [margin, setMargin] = useState('100'),
    [leverage, setLeverage] = useState(10),
    [isLong, setLong] = useState(true),
    [move, setMove] = useState('0.1'),
    [showPreview, setPreview] = useState(false);
  const [now, setNow] = useState(Date.now());
  const currentCoin = useRef(coin);
  currentCoin.current = coin;
  useEffect(() => setCoin(initialCoin), [initialCoin]);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/market?coin=${coin}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.quote?.coin === currentCoin.current) setMarket(data);
    } catch (error) {
      if (currentCoin.current === coin)
        setError(error instanceof Error ? error.message : 'Could not load data.');
    } finally {
      if (currentCoin.current === coin) setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    setMarket(null);
    setError('');
    setLoading(true);
    void fetch(`/api/market?coin=${coin}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!cancelled) setMarket(data);
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coin]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let active = true;
    const id = setInterval(() => {
      if (document.hidden) return;
      void fetch(`/api/market?coin=${coin}`)
        .then(async (response) => {
          if (!response.ok) return;
          const value = await response.json();
          if (active && value.quote?.coin === coin) setMarket(value);
        })
        .catch(() => {});
    }, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [coin]);
  useEffect(() => setPreview(false), [margin, leverage, isLong, coin, wallet.generation]);
  const instrument = market?.trading.instruments.find((item) => item.symbol === coin),
    fresh = !!market && now - market.quote.time < 30_000;
  const calculation = useMemo<Calculation | null>(() => {
    if (!market || !instrument) return null;
    try {
      const valid = validateOpen(margin, leverage, instrument, market.trading);
      if (!/^-?\d+(\.\d{1,4})?$/.test(move)) throw new Error('Enter a price movement percentage.');
      const delta = parseUnits(move, 4);
      if (delta < -990000n || delta > 10000000n) throw new Error('Price movement is out of range.');
      const entry = BigInt(market.quote.midpointRaw),
        exit = (entry * (1_000_000n + delta)) / 1_000_000n;
      const pnl = closePnl(valid.margin, leverage, entry, exit, isLong, instrument);
      return { ok: true, valid, pnl, entry, exit };
    } catch (error) {
      return { ok: false, issue: error instanceof Error ? error.message : 'Invalid intent.' };
    }
  }, [market, instrument, margin, leverage, isLong, move]);
  const typedPreview =
    wallet.address && calculation?.ok
      ? officialTypedData('OpenPosition', {
          user: wallet.address,
          instrumentId: instrument!.id,
          isLong,
          size: calculation.valid.margin,
          leverage,
          useDebt: false,
          nonce: 0n,
          deadline: BigInt(Math.floor(now / 1000) + 3600),
        })
      : null;
  const candles = market?.candles ?? [],
    low = candles.length ? Math.min(...candles.map((row) => row.close)) : 0,
    high = candles.length ? Math.max(...candles.map((row) => row.close)) : 0;
  const points = candles
    .map(
      (row, index) =>
        `${(index / Math.max(1, candles.length - 1)) * 900},${220 - ((row.close - low) / Math.max(1, high - low)) * 180}`,
    )
    .join(' ');
  return (
    <>
      <div className="terminal-top">
        <div className="market-tabs" role="group" aria-label="Market">
          {(['BTC', 'ETH'] as const).map((value) => (
            <button
              key={value}
              className={`button ${coin === value ? 'selected' : ''}`}
              aria-pressed={coin === value}
              onClick={() => setCoin(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="market-price">
          <strong>
            {market
              ? new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 2,
                }).format(Number(market.quote.midpointRaw) / market.quote.priceScale)
              : '—'}
          </strong>
          <span>BBO midpoint</span>
        </div>
        <button className="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="trade-workspace">
        <section className="chart-section">
          <div className="section-heading">
            <h2>{coin} / USD</h2>
            <span> 24 hours · 15 min </span>
          </div>
          {candles.length ? (
            <>
              <svg
                className="price-chart"
                viewBox="0 0 900 260"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${coin}: actual 15-minute prices over 24 hours`}
              >
                <path className="chart-grid" d="M0 40H900 M0 130H900 M0 220H900" />
                <polyline className="chart-line" points={points} />
              </svg>
              <div className="chart-axis">
                <span>{localTime(candles[0]!.time)} UTC </span>
                <span>{localTime(candles.at(-1)!.time)} UTC </span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>{loading ? 'Loading market…' : 'No candles available.'}</h3>
              <p> The chart will appear after the Hyperliquid API responds. </p>
            </div>
          )}
          <div className="source-line">
            <span className="status-dot" />
            {market ? `Hyperliquid BBO · ${localTime(market.quote.time)} UTC` : 'No BBO data'}
            <span className={fresh ? '' : 'error-text'}>
              {market ? (fresh ? 'Price snapshot' : 'Stale price') : 'Waiting'}
            </span>
          </div>
          <div className="note">
            <strong> Execution determines the final price. </strong>
            <p>
              {' '}
              Chart and BBO data come from the Hyperliquid API. Papertrade uses a precompile in the
              execution block, so the final price may differ.{' '}
            </p>
          </div>
        </section>
        <section className="order-panel">
          <div className="section-heading">
            <h2> Risk before signing </h2>
            <span className="tag">Preview</span>
          </div>
          <div className="direction-tabs">
            <button
              className={`button ${isLong ? 'selected' : ''}`}
              onClick={() => setLong(true)}
              aria-pressed={isLong}
            >
              Long ↗
            </button>
            <button
              className={`button ${!isLong ? 'selected' : ''}`}
              onClick={() => setLong(false)}
              aria-pressed={!isLong}
            >
              Short ↘
            </button>
          </div>
          <label>
            Margin (USDC)
            <input
              inputMode="decimal"
              value={margin}
              onChange={(event) => setMargin(event.target.value)}
            />
          </label>
          <label>
            {' '}
            Leverage · {leverage}x
            <input
              type="range"
              aria-label="Leverage slider"
              min="1"
              max={instrument?.maxLeverage ?? 1000}
              value={leverage}
              onChange={(event) => setLeverage(Number(event.target.value))}
            />
            <input
              type="number"
              aria-label="Leverage multiplier"
              min="1"
              max="1000"
              value={leverage}
              onChange={(event) => setLeverage(Number(event.target.value))}
            />
          </label>
          <label>
            {' '}
            Scenario: price movement (%){' '}
            <input
              inputMode="decimal"
              value={move}
              onChange={(event) => setMove(event.target.value)}
            />
          </label>
          {calculation?.ok ? (
            <dl className="data-list">
              <div>
                <dt>Notional</dt>
                <dd>{amount(String(calculation.valid.notional))}</dd>
              </div>
              <div>
                <dt>Bust price</dt>
                <dd>
                  $
                  {(Number(calculation.pnl.bust) / market!.quote.priceScale).toLocaleString(
                    'en-US',
                  )}
                </dd>
              </div>
              <div>
                <dt> Raw PnL </dt>
                <dd>{amount(String(calculation.pnl.rawPnl), 'usd', false)}</dd>
              </div>
              <div>
                <dt> After impact + fee </dt>
                <dd className={calculation.pnl.netPnl < 0n ? 'error-text' : 'positive-text'}>
                  {amount(String(calculation.pnl.netPnl), 'usd', false)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="error-text" role="status">
              {calculation && !calculation.ok
                ? calculation.issue
                : 'Waiting for market configuration.'}
            </p>
          )}
          {calculation?.ok && calculation.pnl.liquidated && (
            <p className="feedback error-text">
              {' '}
              This scenario reaches the bust price: the entire margin is lost.{' '}
            </p>
          )}
          <p className="fine-print">
            {' '}
            The 2% win fee is a documented assumption; impact and buffer come from current official
            trading state. Profit may enter the queue.{' '}
          </p>
          <button
            className="button"
            disabled={!typedPreview || !fresh}
            onClick={() => setPreview(!showPreview)}
          >
            {' '}
            Preview signature{' '}
          </button>
          {!wallet.address && (
            <p className="fine-print">
              {' '}
              Connect an address to preview. No real signature is requested here.{' '}
            </p>
          )}
          {showPreview && typedPreview && (
            <div className="signature-preview">
              <strong> Official schema · preview </strong>
              <p>
                {' '}
                Nonce and deadline are illustrative. This payload is not ready for submission.{' '}
              </p>
              <pre>
                {JSON.stringify(
                  typedPreview,
                  (_, value) => (typeof value === 'bigint' ? String(value) : value),
                  2,
                )}
              </pre>
            </div>
          )}
          <div className="live-blocked">
            <strong> Live trading is not enabled. </strong>
            <p> Third-party relayer access and settlement need verification. </p>
            <a
              href="https://exchange.papertrade.xyz/trade/btc"
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              {' '}
              Official trading ↗{' '}
            </a>
          </div>
        </section>
      </div>
      {market && instrument && (
        <Sandbox
          instrument={instrument}
          trading={market.trading}
          entry={BigInt(market.quote.midpointRaw)}
          exit={calculation?.ok ? calculation.exit : BigInt(market.quote.midpointRaw)}
          margin={margin}
          leverage={leverage}
          isLong={isLong}
          fresh={fresh && !!calculation?.ok}
        />
      )}
      <section className="emergency-actions">
        <h2> User recovery </h2>
        <p>
          {' '}
          Real withdrawals require the main wallet signature; closing positions and staking depend
          on the relayer. Use the official interface if ours is unavailable. Direct revokeSessionKey
          is documented; we do not create calldata from an unverified ABI.{' '}
        </p>
        <div className="campaign-actions">
          <a
            className="button"
            href="https://exchange.papertrade.xyz/portfolio"
            target="_blank"
            rel="noreferrer"
          >
            {' '}
            Official withdrawal ↗{' '}
          </a>
          <a
            className="button"
            href="https://docs.papertrade.xyz/#/learn/session-keys"
            target="_blank"
            rel="noreferrer"
          >
            {' '}
            Revoke session key ↗{' '}
          </a>
          <a
            className="button"
            href="https://hyperevmscan.io/address/0x8326Eb8896e358717f10502Ec73CE8D28E37B108"
            target="_blank"
            rel="noreferrer"
          >
            SessionKeyManager ↗
          </a>
        </div>
      </section>
    </>
  );
}
