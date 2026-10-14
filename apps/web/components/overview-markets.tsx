'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarketQuote } from '../../../packages/protocol/market';

type Market = { quote: MarketQuote; candles: { time: number; close: number }[] };
type Entry = { value?: Market; error?: string };
const coins = ['BTC', 'ETH'] as const;
const usd = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function OverviewMarkets() {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [windowHours, setWindowHours] = useState(24);
  const [now, setNow] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    await Promise.all(
      coins.map(async (coin) => {
        try {
          const response = await fetch(`/api/market?coin=${coin}`, { signal: controller.signal });
          const value = await response.json();
          if (!response.ok) throw new Error('Market feed unavailable');
          if (!controller.signal.aborted)
            setEntries((previous) => ({ ...previous, [coin]: { value } }));
        } catch {
          if (!controller.signal.aborted)
            setEntries((previous) => ({
              ...previous,
              [coin]: { ...previous[coin], error: 'Market feed unavailable' },
            }));
        }
      }),
    );
    if (request.current === controller) request.current = null;
    if (!controller.signal.aborted) {
      setLoading(false);
      setNow(Date.now());
    }
  }, []);
  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      setNow(Date.now());
      if (!document.hidden) void refresh();
    }, 15000);
    return () => {
      clearInterval(id);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);
  return (
    <section className="market-section" aria-label="Market prices">
      <div className="section-heading">
        <div>
          <h2>Markets</h2>
          <p>Hyperliquid BBO midpoint · 15-minute candles</p>
        </div>
        <div className="section-actions">
          <div className="market-tabs" role="group" aria-label="Chart period">
            {[1, 24].map((hours) => (
              <button
                key={hours}
                className={`button small ${windowHours === hours ? 'selected' : ''}`}
                aria-pressed={windowHours === hours}
                onClick={() => setWindowHours(hours)}
              >
                {hours}h
              </button>
            ))}
          </div>
          <button className="button small" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Updating…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="markets-grid">
        {coins.map((coin) => (
          <MarketCard
            key={coin}
            coin={coin}
            entry={entries[coin]}
            loading={loading}
            hours={windowHours}
            now={now}
          />
        ))}
      </div>
    </section>
  );
}

function MarketCard({
  coin,
  entry,
  loading,
  hours,
  now,
}: {
  coin: 'BTC' | 'ETH';
  entry?: Entry;
  loading: boolean;
  hours: number;
  now: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const value = entry?.value;
  const price = value ? Number(value.quote.midpointRaw) / value.quote.priceScale : null;
  const candles = value?.candles.filter((row) => row.time >= now - hours * 3600000) ?? [];
  const low = Math.min(...candles.map((row) => row.close)),
    high = Math.max(...candles.map((row) => row.close));
  const x = (index: number) => 8 + (index / Math.max(1, candles.length - 1)) * 484;
  const y = (close: number) => 120 - ((close - low) / Math.max(0.01, high - low)) * 96;
  const points = candles.map((row, index) => `${x(index)},${y(row.close)}`).join(' ');
  const change = price !== null && candles.length ? (price / candles[0]!.close - 1) * 100 : null;
  const selected = hover !== null ? candles[hover] : undefined;
  const cached = !!value && (!!entry?.error || now - value.quote.time >= 30000);
  return (
    <article className="market-card">
      <div className="market-card-top">
        <h3>
          <span className="coin-mark" aria-hidden="true">
            {coin === 'BTC' ? '₿' : 'Ξ'}
          </span>
          {coin}
          <span className="pair"> / USD</span>
        </h3>
        <span className={`tag ${value && !cached ? 'positive' : ''}`}>
          {value ? (cached ? 'Cached' : 'Live') : loading ? 'Loading' : 'Unavailable'}
        </span>
      </div>
      <div className="market-card-price">
        <strong>{price !== null ? usd(price) : '—'}</strong>
        {change !== null && (
          <span className={`market-change ${change >= 0 ? 'up' : 'down'}`}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}% <small>/ {hours}h</small>
          </span>
        )}
      </div>
      {candles.length > 1 ? (
        <svg
          className="market-sparkline"
          viewBox="0 0 500 144"
          role="img"
          aria-label={`${coin} closing prices over ${hours} hours, from ${usd(candles[0]!.close)} to ${usd(candles.at(-1)!.close)}`}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            setHover(
              Math.max(
                0,
                Math.min(
                  candles.length - 1,
                  Math.round(((event.clientX - box.left) / box.width) * (candles.length - 1)),
                ),
              ),
            );
          }}
        >
          {[24, 72, 120].map((level) => (
            <line key={level} className="chart-grid" x1="0" y1={level} x2="500" y2={level} />
          ))}
          <polyline className="chart-line" points={points} />
          {selected && hover !== null && (
            <>
              <line className="chart-grid" x1={x(hover)} x2={x(hover)} y1="0" y2="144" />
              <circle className="chart-point" cx={x(hover)} cy={y(selected.close)} r="4" />
            </>
          )}
        </svg>
      ) : (
        <p className="market-unavailable">{entry?.error ?? 'Waiting for market candles…'}</p>
      )}
      <div className="market-card-footer">
        <p>
          {selected
            ? `${usd(selected.close)} · ${new Date(selected.time).toISOString().slice(11, 16)} UTC`
            : value
              ? `BBO · ${new Date(value.quote.time).toISOString().slice(11, 19)} UTC${cached ? ' · refresh needed' : ''}`
              : 'Prices are unavailable.'}
        </p>
        <Link href={`/trade?coin=${coin}`} className="text-link">
          View {coin} →
        </Link>
      </div>
    </article>
  );
}
