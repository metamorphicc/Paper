import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { testPostgres } from './test-postgres.js';
import { migrateDatabase, assertSchema } from './schema.js';
import { postgresDatabase, postgresOptions, sqliteDatabase } from './sql.js';
import { PersistentCampaign } from '../community/persistent.js';
import { WebStore } from './store.js';
const alice = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`),
  bob = privateKeyToAccount(('0x' + '33'.repeat(32)) as `0x${string}`);
const origin = 'https://paperclub.example';
test('PostgreSQL wire driver preserves points across instances, serializes replay and rolls back rejected claims', async () => {
  const fixture = await testPostgres();
  const other = postgresDatabase(fixture.url);
  try {
    await migrateDatabase(fixture.database);
    await assertSchema(other);
    let now = 1000;
    const campaign = new PersistentCampaign(
      fixture.database,
      () => now,
      (value) => value === origin,
    );
    const replica = new PersistentCampaign(
      other,
      () => now,
      (value) => value === origin,
    );
    const quiz = await campaign.issue(alice.address, 'quiz', origin);
    await assert.rejects(
      replica.claim({
        id: quiz.id,
        signature: await alice.signMessage({ message: quiz.message }),
        origin,
        answers: ['queued-is-debt', 'profit-is-adjusted', 'paper-is-not-cash'],
      }),
      /Join/,
    );
    assert.equal(
      (
        await fixture.database.query('SELECT used FROM campaign_challenges WHERE id=?', [quiz.id])
      )[0]!.used,
      0,
    );
    const challenge = await campaign.issue(alice.address, 'join', origin);
    const signature = await alice.signMessage({ message: challenge.message });
    await assert.rejects(
      replica.claim({ id: challenge.id, signature, origin: 'https://evil.example' }),
      /origin/,
    );
    const results = await Promise.allSettled([
      campaign.claim({ id: challenge.id, signature, origin }),
      replica.claim({ id: challenge.id, signature, origin }),
    ]);
    assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
    assert.equal((await replica.participant(alice.address)).total, 10);
    const repeat = await replica.issue(alice.address, 'join', origin);
    assert.equal(
      (
        await campaign.claim({
          id: repeat.id,
          signature: await alice.signMessage({ message: repeat.message }),
          origin,
        })
      ).awarded,
      0,
    );
    now += 86400000;
    const track = await replica.issue(alice.address, 'track', origin);
    await campaign.claim({
      id: track.id,
      signature: await alice.signMessage({ message: track.message }),
      origin,
      trackedAddress: alice.address,
    });
    assert.equal((await replica.metrics()).returning, 1);
    assert.equal((await replica.leaderboard())[0]!.points, 30);
    const coldDatabase = postgresDatabase(fixture.url);
    try {
      assert.equal(
        (
          await new PersistentCampaign(
            coldDatabase,
            () => now,
            (value) => value === origin,
          ).participant(alice.address)
        ).total,
        30,
      );
    } finally {
      await coldDatabase.close();
    }
    const expired = await campaign.issue(bob.address, 'join', origin);
    now += 300001;
    await assert.rejects(
      replica.claim({
        id: expired.id,
        signature: await bob.signMessage({ message: expired.message }),
        origin,
      }),
      /expired/,
    );
    const slow = await campaign.issue(alice.address, 'join', origin);
    let clockCalls = 0;
    const delayed = new PersistentCampaign(
      other,
      () => (clockCalls++ === 0 ? now : now + 300001),
      (value) => value === origin,
    );
    await assert.rejects(
      delayed.claim({
        id: slow.id,
        signature: await alice.signMessage({ message: slow.message }),
        origin,
      }),
      /expired/,
    );
    for (let i = 0; i < 5; i++) await campaign.issue(bob.address, 'join', origin);
    await assert.rejects(replica.issue(bob.address, 'join', origin), /rate limit/);
    const store = new WebStore(fixture.database),
      reader = new WebStore(other);
    await store.saveSnapshot('protocol', '999', 'official-indexer', 123, {
      raw: '123456789012345678901234567890',
    });
    assert.equal(
      (await reader.latestSnapshot<{ raw: string }>('protocol', '999'))!.value.raw,
      '123456789012345678901234567890',
    );
    await migrateDatabase(other);
    assert.equal((await reader.sql.query('SELECT version FROM schema_migrations')).length, 1);
  } finally {
    await other.close();
    await fixture.close();
  }
});
test('shared async campaign keeps local SQLite behavior and requires verified TLS for hosted PostgreSQL', async () => {
  const db = await sqliteDatabase(':memory:');
  try {
    await migrateDatabase(db);
    const campaign = new PersistentCampaign(db);
    const local = 'http://127.0.0.1:3000',
      challenge = await campaign.issue(alice.address, 'join', local);
    await campaign.claim({
      id: challenge.id,
      signature: await alice.signMessage({ message: challenge.message }),
      origin: local,
    });
    assert.equal((await campaign.metrics()).participants, 1);
    assert.equal((await campaign.participant(alice.address)).total, 10);
  } finally {
    await db.close();
  }
  assert.throws(() => postgresOptions('https://example.com/db'), /configuration/);
  assert.throws(
    () => postgresOptions('postgres://test:test@example.com/db?sslmode=disable'),
    /TLS/,
  );
  assert.throws(
    () => postgresOptions('postgres://test:test@localhost/db?host=remote.example'),
    /overrides/,
  );
  assert.deepEqual(postgresOptions('postgres://test:test@example.com/db?sslmode=require').ssl, {
    rejectUnauthorized: true,
  });
  assert.equal(postgresOptions('postgres://test:test@127.0.0.1:5432/db').ssl, false);
});
