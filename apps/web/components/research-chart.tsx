'use client';
import { useState } from 'react';
import { amount, localTime } from '../lib/format';
type Result = {
  strategy: string;
  cashRaw: string;
  queuedRaw: string;
  netEquityRaw: string;
  paperRaw: string;
  maxDrawdownRaw: string;
  liquidations: number;
  stopped: boolean;
  series: { time: number; cashRaw: string; equityRaw: string }[];
};
export default function ResearchChart({ results }: { results: Result[] }) {
  const [selected, setSelected] = useState(0),
    [view, setView] = useState<'cashRaw' | 'equityRaw'>('cashRaw');
  const result = results[selected]!;
  const values = result.series.map((row) => Number(row[view]) / 1e18),
    lo = Math.min(...values),
    hi = Math.max(...values);
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(1, values.length - 1)) * 900},${220 - ((value - lo) / Math.max(1, hi - lo)) * 180}`,
    )
    .join(' ');
  return (
    <>
      <div className="terminal-top">
        <div className="market-tabs" role="group" aria-label="Research scenario">
          {results.map((row, index) => (
            <button
              key={row.strategy}
              className={`button ${selected === index ? 'selected' : ''}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              {row.strategy}
            </button>
          ))}
        </div>
        <label>
          Chart metric
          <select value={view} onChange={(event) => setView(event.target.value as typeof view)}>
            <option value="cashRaw">Spendable cash</option>
            <option value="equityRaw">Economic equity, including queue</option>
          </select>
        </label>
      </div>
      <div className="metric-strip">
        <div>
          <span>Spendable cash</span>
          <strong>{amount(result.cashRaw)}</strong>
        </div>
        <div>
          <span>Queued profit</span>
          <strong>{amount(result.queuedRaw)}</strong>
        </div>
        <div>
          <span>Economic result</span>
          <strong className={BigInt(result.netEquityRaw) < 0n ? 'error-text' : ''}>
            {amount(result.netEquityRaw, 'usd', false)}
          </strong>
        </div>
        <div>
          <span>PAPER · unpriced</span>
          <strong>{amount(result.paperRaw, 'paper')}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>
            {view === 'cashRaw' ? 'Cash availability' : 'Economic equity'} · {result.strategy}
          </h2>
          <span>Scenario replay</span>
        </div>
        <svg
          className="price-chart"
          viewBox="0 0 900 260"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${result.strategy} modeled ${view === 'cashRaw' ? 'cash' : 'equity'} over the replay period`}
        >
          <path className="chart-grid" d="M0 40H900 M0 130H900 M0 220H900" />
          <polyline className="chart-line" points={points} />
        </svg>
        <div className="chart-axis">
          <span>{localTime(result.series[0]!.time)} UTC</span>
          <span>{localTime(result.series.at(-1)!.time)} UTC</span>
        </div>
        <dl className="data-list">
          <div>
            <dt>Maximum drawdown</dt>
            <dd>{amount(result.maxDrawdownRaw, 'usd', false)}</dd>
          </div>
          <div>
            <dt>Liquidations</dt>
            <dd>{result.liquidations}</dd>
          </div>
          <div>
            <dt>New openings stopped</dt>
            <dd>{result.stopped ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
