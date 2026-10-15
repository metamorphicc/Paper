import { randomBytes, randomUUID } from 'node:crypto';
import { isAddress, verifyMessage, type Hex } from 'viem';
import { CAMPAIGN_ID, POINTS, type CampaignAction } from './campaign.js';
import { integer, type SqlDatabase, type SqlSession } from '../storage/sql.js';
const quizAnswers = ['queued-is-debt', 'profit-is-adjusted', 'paper-is-not-cash'];
export class CampaignError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export class PersistentCampaign {
  constructor(
    private db: SqlDatabase,
    private now = () => Date.now(),
    private originAllowed = (origin: string) =>
      /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin),
  ) {}
  async issue(address: string, action: string, origin: string) {
    if (!isAddress(address) || !Object.hasOwn(POINTS, action) || !this.originAllowed(origin))
      throw new CampaignError('Invalid campaign request');
    address = address.toLowerCase();
    const createdAt = this.now(),
      expiresAt = createdAt + 300000,
      id = randomUUID(),
      nonce = randomBytes(16).toString('hex');
    const message = `Paperclub community points\nNo transaction. No token allowance. No trading permission.\nOrigin: ${origin}\nAddress: ${address}\nChain: 999\nCampaign: ${CAMPAIGN_ID}\nAction: ${action}\nNonce: ${nonce}\nExpires: ${new Date(expiresAt).toISOString()}`;
    await this.db.transaction(async (tx) => {
      const [window] = await tx.query(
        `INSERT INTO campaign_rate_windows(address,window_start,used) VALUES(?,?,1)
        ON CONFLICT(address) DO UPDATE SET
        used=CASE WHEN campaign_rate_windows.window_start<=? THEN 1 ELSE campaign_rate_windows.used+1 END,
        window_start=CASE WHEN campaign_rate_windows.window_start<=? THEN ? ELSE campaign_rate_windows.window_start END RETURNING used`,
        [address, createdAt, createdAt - 60000, createdAt - 60000, createdAt],
      );
      if (!window || integer(window.used) > 5)
        throw new CampaignError('Challenge rate limit. Retry in one minute.', 429);
      await tx.query(
        'INSERT INTO campaign_challenges(id,address,action,origin,message,expires_at,created_at) VALUES(?,?,?,?,?,?,?)',
        [id, address, action, origin, message, expiresAt, createdAt],
      );
    });
    return { id, message, expiresAt, action, points: POINTS[action as CampaignAction] };
  }
  async claim(input: {
    id: string;
    signature: Hex;
    origin: string;
    answers?: string[];
    trackedAddress?: string;
  }) {
    if (!this.originAllowed(input.origin))
      throw new CampaignError('Challenge expired, used or wrong origin');
    const [row] = await this.db.query('SELECT * FROM campaign_challenges WHERE id=?', [input.id]);
    if (
      !row ||
      integer(row.used) !== 0 ||
      integer(row.expires_at) <= this.now() ||
      row.origin !== input.origin
    )
      throw new CampaignError('Challenge expired, used or wrong origin');
    const action = String(row.action) as CampaignAction;
    if (!Object.hasOwn(POINTS, action)) throw new CampaignError('Invalid campaign action');
    if (
      action === 'quiz' &&
      (!input.answers ||
        input.answers.length !== 3 ||
        quizAnswers.some((answer, index) => input.answers![index] !== answer))
    )
      throw new CampaignError('Review the risk questions before claiming points');
    if (action === 'track' && input.trackedAddress?.toLowerCase() !== row.address)
      throw new CampaignError('Track your own signed address');
    const verified = await verifyMessage({
      address: row.address as Hex,
      message: String(row.message),
      signature: input.signature,
    }).catch(() => false);
    if (!verified) {
      await this.db.query('INSERT INTO campaign_rejections(reason,created_at) VALUES(?,?)', [
        'signature',
        this.now(),
      ]);
      throw new CampaignError('Signature does not match the participant');
    }
    return this.db.transaction(async (tx) => {
      // Atomic compare-and-swap rechecks expiry after wallet verification, across all replicas.
      const consumed = await tx.query(
        'UPDATE campaign_challenges SET used=1 WHERE id=? AND used=0 AND expires_at>? AND origin=? RETURNING id',
        [input.id, this.now(), input.origin],
      );
      if (consumed.length !== 1) throw new CampaignError('Challenge expired or already used', 409);
      if (
        action !== 'join' &&
        !(
          await tx.query(
            'SELECT 1 FROM campaign_claims WHERE campaign=? AND address=? AND action=?',
            [CAMPAIGN_ID, row.address, 'join'],
          )
        ).length
      )
        throw new CampaignError('Join the campaign first');
      const now = this.now();
      const awarded = await tx.query(
        'INSERT INTO campaign_claims(campaign,address,action,points,created_at) VALUES(?,?,?,?,?) ON CONFLICT(campaign,address,action) DO NOTHING RETURNING points',
        [CAMPAIGN_ID, row.address, action, POINTS[action], now],
      );
      await tx.query(
        'INSERT INTO campaign_members(address,first_seen,last_seen) VALUES(?,?,?) ON CONFLICT(address) DO UPDATE SET last_seen=CASE WHEN excluded.last_seen>campaign_members.last_seen THEN excluded.last_seen ELSE campaign_members.last_seen END',
        [row.address, now, now],
      );
      return {
        awarded: awarded.length ? POINTS[action] : 0,
        participant: await this.participant(String(row.address), tx),
      };
    });
  }
  async participant(address: string, session: SqlSession = this.db) {
    const rows = await session.query(
      'SELECT action,points FROM campaign_claims WHERE campaign=? AND address=? ORDER BY action',
      [CAMPAIGN_ID, address.toLowerCase()],
    );
    return {
      address: address.toLowerCase(),
      total: rows.reduce((sum, row) => sum + integer(row.points), 0),
      completed: rows.map((row) => String(row.action)),
    };
  }
  async leaderboard() {
    const rows = await this.db.query(
      'SELECT address,SUM(points) AS points FROM campaign_claims WHERE campaign=? GROUP BY address ORDER BY SUM(points) DESC,address LIMIT 100',
      [CAMPAIGN_ID],
    );
    return rows.map((row) => ({ address: String(row.address), points: integer(row.points) }));
  }
  async metrics() {
    const [members] = await this.db.query(
      'SELECT COUNT(*) AS participants,COALESCE(SUM(CASE WHEN last_seen/86400000>first_seen/86400000 THEN 1 ELSE 0 END),0) AS returning_count FROM campaign_members',
    );
    const [issued] = await this.db.query('SELECT COUNT(*) AS n FROM campaign_challenges');
    const [rejected] = await this.db.query('SELECT COUNT(*) AS n FROM campaign_rejections');
    const participants = integer(members!.participants),
      returning = integer(members!.returning_count);
    return {
      participants,
      returning,
      returningShare: participants ? returning / participants : null,
      issuedChallenges: integer(issued!.n),
      rejectedSignatures: integer(rejected!.n),
      acquisitionCostUsd: null,
      targets: { activeAddresses: 20, returningShare: 0.3, acquisitionCostUsd: null },
      targetStatus:
        'Proposed pilot targets; CAC requires a user-supplied budget. No proof of unique humans.',
    };
  }
  async membersAt(cutoff: number) {
    if (!Number.isSafeInteger(cutoff) || cutoff < 0) throw new Error('Invalid snapshot cutoff');
    const rows = await this.db.query(
      'SELECT address,SUM(points) AS points FROM campaign_claims WHERE campaign=? AND created_at<=? GROUP BY address ORDER BY address',
      [CAMPAIGN_ID, cutoff],
    );
    return rows.map((row) => ({ address: String(row.address), points: integer(row.points) }));
  }
}
