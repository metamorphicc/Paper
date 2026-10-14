import { walletData } from '../../lib/server';
import { amount, localTime } from '../../lib/format';
import { isAddress } from 'viem';
export const dynamic = 'force-dynamic';
export default async function TreasuryPage() {
  const address = process.env.TREASURY_ADDRESS;
  let result = null;
  if (address && isAddress(address)) {
    try {
      result = await walletData(address);
    } catch {
      /* show unavailable, not zero */
    }
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <h1>Каждый доллар — отдельно.</h1>
          <p>Treasury, PAPER и ожидающие выплаты. Только фактические поступления.</p>
        </div>
        <span className="tag">Buyback не включён</span>
      </section>
      {!address ? (
        <div className="empty-state">
          <h2>Адрес treasury ещё не выбран.</h2>
          <p>
            Мемкоин и treasury появятся на следующем этапе. Публичный адрес можно задать через
            TREASURY_ADDRESS; неизвестный баланс отображается как «—».
          </p>
        </div>
      ) : (
        <p className="address-text">{address}</p>
      )}
      <div className="metric-strip">
        {[
          ['Available USDC', result?.value.availableRaw, 'usd'],
          ['Queued USDC', result?.value.queuedRaw, 'usd'],
          ['Staked PAPER', result?.value.stakedRaw, 'paper'],
          ['Claimed USDC', result?.value.claimedRaw, 'usd'],
        ].map(([label, raw, kind]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{amount(raw, kind as 'usd' | 'paper')}</strong>
          </div>
        ))}
      </div>
      <div className="split-layout">
        <section className="panel">
          <h2>Источники поступлений</h2>
          <dl className="data-list">
            <div>
              <dt>Builder codes</dt>
              <dd>Не запущены</dd>
            </div>
            <div>
              <dt>Staking yield</dt>
              <dd>{amount(result?.value.claimedRaw, 'usd', false)}</dd>
            </div>
            <div>
              <dt>Покупки / burn</dt>
              <dd>Не включены</dd>
            </div>
          </dl>
          <p className="fine-print">
            Новые депозиты и выпуск собственного токена не считаются доходом. PAPER и queued claims
            не прибавляются к liquid USDC.
          </p>
        </section>
        <section className="notes-column">
          <h2>Проверяемые правила.</h2>
          <p>
            На этом этапе treasury только наблюдается. Торговля средствами, token launch, buyback и
            распределение rewards реализуются отдельно по зафиксированным правилам и бюджету.
          </p>
          {result && (
            <p className="fine-print">
              Official API · блок {result.value.block} · {localTime(result.value.sourceAt)} НСК
              {result.stale ? ' · сохранённые данные' : ''}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
