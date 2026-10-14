'use client';
import { useEffect, useState } from 'react';
import { isAddress } from 'viem';
import { useSearchParams } from 'next/navigation';
import { amount, localTime } from '../lib/format';
import type { WalletProfile } from '../lib/server';
type Result = { value: WalletProfile; stale: boolean; observedAt: string; history: { block_number:number; tx_hash:string; from_address:string; to_address:string; amount_raw:string }[]; coverage: {from_block:number; through_block:number} | null };
export default function Profile() {
  const params = useSearchParams(); const [address, setAddress] = useState(params.get('address') ?? '');
  const [result, setResult] = useState<Result | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function load(value = address) {
    setError(''); setResult(null);
    if (!isAddress(value)) { setError('Введите полный адрес 0x из 40 hex-символов.'); return; }
    setLoading(true);
    try { const response = await fetch(`/api/profile/${value}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setResult(data); }
    catch (error) { setError(error instanceof Error ? error.message : 'Не удалось загрузить адрес.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { const value = params.get('address'); if (value && isAddress(value)) { setAddress(value); void load(value); } }, [params]);
  return <>
    <form className="address-form" onSubmit={event => { event.preventDefault(); void load(); }}><label htmlFor="address">Адрес HyperEVM<input id="address" value={address} onChange={event => setAddress(event.target.value)} placeholder="0x…" aria-invalid={!!error} spellCheck={false} /></label><button className="button primary" disabled={loading}>{loading ? 'Загрузка…' : 'Посмотреть'}</button></form>
    {error && <p role="alert" className="error-text">{error}</p>}
    {!result && !error && <div className="empty-state"><h2>Откройте свой адрес.</h2><p>Публичные данные Papertrade доступны без подписи и без подключения кошелька.</p></div>}
    {result && <><div className="source-line"><span className="status-dot" />Official wallet snapshot · блок {result.value.block} · {localTime(result.value.sourceAt)} НСК<span className="tag">{result.stale ? 'Сохранённые данные' : 'Получено из API'}</span></div>
      <div className="metric-strip">{[['Available USDC', result.value.availableRaw, 'usd'], ['Queued USDC', result.value.queuedRaw, 'usd'], ['PAPER', result.value.paperRaw, 'paper'], ['Staked PAPER', result.value.stakedRaw, 'paper']].map(([title, raw, kind]) => <div key={title}><span>{title}</span><strong>{amount(raw, kind as 'usd' | 'paper')}</strong></div>)}</div>
      <div className="split-layout"><section className="panel"><h2>Результат адреса</h2><dl className="data-list"><div><dt>Realized net PnL</dt><dd>{amount(result.value.realizedPnlRaw, 'usd', false)}</dd></div><div><dt>Полученный staking USDC</dt><dd>{amount(result.value.claimedRaw, 'usd', false)}</dd></div><div><dt>Обеспечение в позициях</dt><dd>{amount(result.value.lockedRaw, 'usd', false)}</dd></div><div><dt>Открытые позиции</dt><dd>{result.value.openPositions.length}</dd></div></dl><p className="fine-print">PendingBase — базовый accumulator snapshot, не полный текущий pendingReward. Claimable USDC не вычисляем без сверенного accumulator.</p></section><section className="notes-column"><h2>Ликвидность отдельно.</h2><p>Queued USDC — требование на будущую выплату. PAPER не оценивается по предполагаемой цене; баланс токена не прибавляется к доступным деньгам.</p><a className="text-link" href={`https://exchange.papertrade.xyz/portfolio?view=${result.value.address}`} target="_blank" rel="noreferrer">Официальный портфель ↗</a></section></div>
      <section className="panel history-panel"><div className="section-heading"><h2>On-chain PAPER activity</h2><span>{result.coverage ? `Блоки ${result.coverage.from_block}–${result.coverage.through_block}` : 'История ещё не индексировалась'}</span></div>{result.history.length ? <div className="table-wrap"><table><thead><tr><th>Блок</th><th>Действие</th><th>PAPER</th><th>Транзакция</th></tr></thead><tbody>{result.history.map((event, index) => <tr key={`${event.tx_hash}-${index}`}><td data-label="Блок">{event.block_number}</td><td data-label="Действие">{event.from_address === '0x' + '0'.repeat(40) ? 'Mint' : event.to_address === result.value.address ? 'Получено' : 'Отправлено'}</td><td data-label="PAPER">{amount(event.amount_raw, 'paper')}</td><td data-label="Транзакция"><a href={`https://hyperevmscan.io/tx/${event.tx_hash}`} target="_blank" rel="noreferrer">Открыть ↗</a></td></tr>)}</tbody></table></div> : <p>В индексированном диапазоне нет PAPER events этого адреса. Это не означает отсутствие более ранней истории.</p>}</section>
    </>}
  </>;
}
