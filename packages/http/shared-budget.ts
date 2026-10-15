import { integer, type SqlDatabase } from '../storage/sql.js';
/** Fixed route buckets share the existing campaign rate ledger; never store raw IPs or arbitrary client keys. */
export async function sharedCampaignBudget(
  db: SqlDatabase,
  scope: 'read' | 'write',
  limit: number,
  now = Date.now(),
) {
  if (
    !['read', 'write'].includes(scope) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    throw new Error('Invalid shared request budget');
  const windowStart = Math.floor(now / 60000) * 60000,
    bucket = 'route:campaign:' + scope;
  const result = await db.query(
    `INSERT INTO campaign_rate_windows(address,window_start,used) VALUES(?,?,1)
    ON CONFLICT(address) DO UPDATE SET
    used=CASE WHEN campaign_rate_windows.window_start<? THEN 1 ELSE campaign_rate_windows.used+1 END,
    window_start=? WHERE campaign_rate_windows.window_start<? OR (campaign_rate_windows.window_start=? AND campaign_rate_windows.used<?)
    RETURNING used`,
    [bucket, windowStart, windowStart, windowStart, windowStart, windowStart, limit],
  );
  return {
    allowed: result.length === 1 && integer(result[0]!.used) <= limit,
    retryAfter: Math.max(1, Math.ceil((windowStart + 60000 - now) / 1000)),
  };
}
