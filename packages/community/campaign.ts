import { randomBytes, randomUUID } from 'node:crypto';
import { isAddress, verifyMessage, type Hex } from 'viem';
import type { Store } from '../indexer/store.js';

export const CAMPAIGN_ID = 'founding-01';
export const POINTS = { join: 10, quiz: 40, track: 20 } as const;
export type CampaignAction = keyof typeof POINTS;
const answers = ['queued-is-debt', 'profit-is-adjusted', 'paper-is-not-cash'];
export class Campaign {
  constructor(private store: Store, private now = () => Date.now()) {
    store.db.exec(`CREATE TABLE IF NOT EXISTS campaign_challenges(id TEXT PRIMARY KEY,address TEXT NOT NULL,action TEXT NOT NULL,origin TEXT NOT NULL,message TEXT NOT NULL,expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS campaign_claims(campaign TEXT NOT NULL,address TEXT NOT NULL,action TEXT NOT NULL,points INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(campaign,address,action));
      CREATE TABLE IF NOT EXISTS campaign_members(address TEXT PRIMARY KEY,first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS campaign_rejections(reason TEXT NOT NULL,created_at INTEGER NOT NULL);`);
  }
  issue(address: string, action: string, origin: string) {
    if (!isAddress(address) || !Object.hasOwn(POINTS, action) || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error('Invalid campaign request');
    address = address.toLowerCase();
    const recent = this.store.db.prepare('SELECT count(*) AS n FROM campaign_challenges WHERE address=? AND created_at>?').get(address, this.now() - 60_000) as {n:number};
    if (recent.n >= 5) throw new Error('Challenge rate limit. Retry in one minute.');
    const id = randomUUID(), nonce = randomBytes(16).toString('hex'), expiresAt = this.now() + 5 * 60_000;
    const message = `Paperclub community points\nNo transaction. No token allowance. No trading permission.\nOrigin: ${origin}\nAddress: ${address}\nChain: 999\nCampaign: ${CAMPAIGN_ID}\nAction: ${action}\nNonce: ${nonce}\nExpires: ${new Date(expiresAt).toISOString()}`;
    this.store.db.prepare('INSERT INTO campaign_challenges(id,address,action,origin,message,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').run(id, address, action, origin, message, expiresAt, this.now());
    return { id, message, expiresAt, action, points: POINTS[action as CampaignAction] };
  }
  async claim(input: { id: string; signature: Hex; origin: string; answers?: string[]; trackedAddress?: string }) {
    const row = this.store.db.prepare('SELECT * FROM campaign_challenges WHERE id=?').get(input.id) as {address:string; action:CampaignAction; origin:string; message:string; expires_at:number; used:number} | undefined;
    if (!row || row.used || row.expires_at <= this.now() || row.origin !== input.origin) throw new Error('Challenge expired, used or wrong origin');
    if (row.action === 'quiz' && (!input.answers || answers.some((answer, index) => input.answers![index] !== answer) || input.answers.length !== answers.length)) throw new Error('Review the risk questions before claiming points');
    if (row.action === 'track' && input.trackedAddress?.toLowerCase() !== row.address) throw new Error('Track your own signed address');
    const verified = await verifyMessage({ address: row.address as `0x${string}`, message: row.message, signature: input.signature }).catch(() => false);
    if (!verified) { this.store.db.prepare('INSERT INTO campaign_rejections VALUES(?,?)').run('signature', this.now()); throw new Error('Signature does not match the participant'); }
    this.store.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.store.db.prepare('SELECT used FROM campaign_challenges WHERE id=?').get(input.id) as {used:number};
      if (current.used) throw new Error('Challenge already used');
      if (row.action !== 'join' && !this.store.db.prepare('SELECT 1 FROM campaign_claims WHERE campaign=? AND address=? AND action=?').get(CAMPAIGN_ID, row.address, 'join')) throw new Error('Join the campaign first');
      const result = this.store.db.prepare('INSERT INTO campaign_claims VALUES(?,?,?,?,?) ON CONFLICT(campaign,address,action) DO NOTHING').run(CAMPAIGN_ID, row.address, row.action, POINTS[row.action], this.now());
      this.store.db.prepare('UPDATE campaign_challenges SET used=1 WHERE id=?').run(input.id);
      this.store.db.prepare('INSERT INTO campaign_members VALUES(?,?,?) ON CONFLICT(address) DO UPDATE SET last_seen=excluded.last_seen').run(row.address, this.now(), this.now());
      this.store.db.exec('COMMIT'); return { awarded: Number(result.changes) ? POINTS[row.action] : 0, participant: this.participant(row.address) };
    } catch (error) { this.store.db.exec('ROLLBACK'); throw error; }
  }
  participant(address: string) {
    const rows = this.store.db.prepare('SELECT action,points FROM campaign_claims WHERE campaign=? AND address=?').all(CAMPAIGN_ID, address.toLowerCase()) as {action:string;points:number}[];
    return { address: address.toLowerCase(), total: rows.reduce((sum, row) => sum + row.points, 0), completed: rows.map(row => row.action) };
  }
  leaderboard() { return this.store.db.prepare('SELECT address,sum(points) AS points FROM campaign_claims WHERE campaign=? GROUP BY address ORDER BY points DESC,address LIMIT 100').all(CAMPAIGN_ID) as {address:string;points:number}[]; }
  metrics() {
    const members = this.store.db.prepare('SELECT first_seen,last_seen FROM campaign_members').all() as {first_seen:number;last_seen:number}[];
    const returning = members.filter(row => Math.floor(row.last_seen / 86_400_000) > Math.floor(row.first_seen / 86_400_000)).length;
    const issued = Number((this.store.db.prepare('SELECT count(*) AS n FROM campaign_challenges').get() as {n:number}).n);
    const rejected = Number((this.store.db.prepare('SELECT count(*) AS n FROM campaign_rejections').get() as {n:number}).n);
    return { participants: members.length, returning, returningShare: members.length ? returning / members.length : null, issuedChallenges: issued, rejectedSignatures: rejected,
      acquisitionCostUsd: null, targets: { activeAddresses: 20, returningShare: 0.3, acquisitionCostUsd: null },
      targetStatus: 'Proposed pilot targets; CAC requires a user-supplied budget. No proof of unique humans.' };
  }
}
