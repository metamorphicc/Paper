import test from 'node:test';
import assert from 'node:assert/strict';
import { testPostgres } from '../storage/test-postgres.js';
import { postgresDatabase } from '../storage/sql.js';
import { migrateDatabase } from '../storage/schema.js';
import { sharedCampaignBudget } from './shared-budget.js';
test('shared campaign route budgets cap simultaneous requests across pools, retain bounded counters and reset only forward', async () => {
  const fixture = await testPostgres(),
    other = postgresDatabase(fixture.url);
  try {
    await migrateDatabase(fixture.database);
    const requests = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        sharedCampaignBudget(i % 2 ? fixture.database : other, 'write', 10, 61000),
      ),
    );
    assert.equal(requests.filter((v) => v.allowed).length, 10);
    assert.equal((await sharedCampaignBudget(other, 'write', 10, 62000)).allowed, false);
    assert.equal((await sharedCampaignBudget(other, 'write', 10, 120000)).allowed, true);
    assert.equal((await sharedCampaignBudget(other, 'write', 10, 1000)).allowed, false);
    assert.equal((await sharedCampaignBudget(other, 'read', 10, 1000)).allowed, true);
    const rows = await other.query('SELECT used FROM campaign_rate_windows WHERE address=?', [
      'route:campaign:write',
    ]);
    assert.equal(Number(rows[0]!.used), 1);
    await assert.rejects(sharedCampaignBudget(other, 'write', 0), /budget/);
  } finally {
    await other.close();
    await fixture.close();
  }
});
