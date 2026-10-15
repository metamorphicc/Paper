import Link from 'next/link';
import CampaignPanel from '../../components/campaign';
import { campaign } from '../../lib/campaign';
import { database } from '../../lib/server';
import { amount, shortAddress } from '../../lib/format';
export const dynamic = 'force-dynamic';
export default async function LeaderboardPage() {
  const [service, db] = await Promise.all([campaign(), database()]);
  const [ranking, metrics, minted, coverage] = await Promise.all([
    service.leaderboard(),
    service.metrics(),
    db.mintedRanking(10),
    db.cursor('paper-transfers'),
  ]);
  return (
    <>
      <section className="page-heading">
        <div>
          <h1>Community</h1>
          <p>
            {' '}
            Earn points for participation and understanding risk. Losses and trade size earn no
            rewards.{' '}
          </p>
        </div>
        <span className="tag">Founding · points</span>
      </section>
      <div className="metric-strip">
        <div>
          <span> Campaign participants </span>
          <strong>{metrics.participants}</strong>
        </div>
        <div>
          <span> Returning participants </span>
          <strong>{metrics.returning}</strong>
        </div>
        <div>
          <span> Acquisition cost </span>
          <strong>—</strong>
        </div>
        <div>
          <span> Per-address cap </span>
          <strong>70 pts</strong>
        </div>
      </div>
      <div className="split-layout">
        <section className="panel">
          <div className="section-heading">
            <h2>Community leaderboard</h2>
            <span> Verified participation </span>
          </div>
          {ranking.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th> Rank </th>
                    <th> Address </th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row, index) => (
                    <tr key={row.address}>
                      <td data-label="Rank">{index + 1}</td>
                      <td data-label="Address">
                        <Link href={`/profile?address=${row.address}`}>
                          {shortAddress(row.address)}
                        </Link>
                      </td>
                      <td data-label="Points">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No participants yet</h3>
              <p> No verified participants yet. Join with a browser wallet. </p>
            </div>
          )}
          <p className="fine-print">
            {' '}
            Proposed pilot targets: 20 active addresses and 30% returning participants. No budget is
            set; CAC is unknown. An address does not prove a unique person.{' '}
          </p>
        </section>
        <CampaignPanel />
      </div>
      <section className="panel history-panel">
        <div className="section-heading">
          <h2> PAPER: network activity </h2>
          <span>
            {coverage ? `Blocks ${coverage.from_block}–${coverage.through_block}` : 'No coverage'}
          </span>
        </div>
        <p className="fine-print">
          {' '}
          Observed mint events within a limited block range. These addresses are not campaign
          participants; this list does not determine rewards.{' '}
        </p>
        {minted.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th> Address </th>
                  <th>Minted PAPER</th>
                  <th> Profile </th>
                </tr>
              </thead>
              <tbody>
                {minted.map((row) => (
                  <tr key={row.address}>
                    <td data-label="Address">{shortAddress(row.address)}</td>
                    <td data-label="PAPER">{amount(row.mintedRaw, 'paper')}</td>
                    <td data-label="Profile">
                      <Link href={`/profile?address=${row.address}`}> View → </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Activity will appear as confirmed blocks are indexed.</p>
        )}
      </section>
    </>
  );
}
