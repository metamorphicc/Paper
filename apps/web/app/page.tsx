import Link from 'next/link';
import { protocolData } from '../lib/server';
import { capabilities } from '../../../packages/protocol/capabilities.js';
import { amount, localTime } from '../lib/format';
export const dynamic = 'force-dynamic';
export default async function Overview() {
  let summary = null; let error = false;
  let stale = false;
  try { const data = await protocolData(); summary = data.value; stale = data.stale; } catch { error = true; }
  return <>
    <section className="page-heading"><div><p className="overline">PAPERTRADE / COMMUNITY</p><h1>Всё начинается с данных.</h1><p>Протокол, доля PAPER и цена риска — в одном месте.</p></div><Link href="/trade" className="button primary">Открыть терминал ↗</Link></section>
    <section className="protocol-hero" aria-label="Состояние протокола"><div className="hero-number"><span>LP протокола</span><strong>{amount(summary?.balances.lp)}</strong><p>Из official indexer. Treasury включает и пользовательское обеспечение.</p></div><div className="hero-details"><div><span>Активные позиции</span><strong>{summary?.activity.open.toLocaleString('en-US') ?? '—'}</strong></div><div><span>Ожидающие выплаты</span><strong>{amount(summary?.balances.queue)}</strong></div><div><span>PAPER в staking</span><strong>{amount(summary?.paper.staked, 'paper')}</strong></div><div><span>Supply PAPER</span><strong>{amount(summary?.paper.supply, 'paper')}</strong></div></div></section>
    <div className={`source-line ${error ? 'error-text' : ''}`}><span className="status-dot" />{summary ? `${stale ? 'Сохранённые данные' : 'Official API'} · блок ${summary.source.block} · ${localTime(summary.source.at)} НСК` : 'Official API недоступен. Обновите страницу позже.'}<span>Сверка с RPC частичная</span></div>
    <div className="split-layout"><section className="panel"><div className="section-heading"><h2>Что доступно</h2><span>Статус интеграции</span></div><div className="capability-list">{capabilities.map(item => <div key={item.id}><div><strong>{item.title}</strong><p>{item.reason}</p></div><span className={`tag ${item.status === 'available' ? 'positive' : ''}`}>{item.status === 'available' ? 'Доступно' : item.status === 'planned' ? 'Ожидается' : 'Проверяется'}</span></div>)}</div></section><section className="notes-column"><h2>Участие без обещаний.</h2><p>Изучайте протокол, следите за своим адресом и участвуйте в программе points. Потери и торговый объём не дают бонусов.</p><Link href="/leaderboard" className="text-link">Программа сообщества →</Link><div className="note"><strong>1000x — потолок протокола.</strong><p>В терминале сначала рассчитайте выигрыш после удержаний и расстояние до bust price. Локальный стенд работает без реальных средств.</p></div></section></div>
  </>;
}
