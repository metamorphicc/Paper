import type { SqlDatabase } from './sql.js';
export const SCHEMA_VERSION = 1;
export async function migrateDatabase(db: SqlDatabase) {
  await db.transaction(async (tx) => {
    if (db.dialect === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(1473202415)');
    const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY';
    const statements = [
      'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS blocks(chain_id INTEGER NOT NULL,number BIGINT NOT NULL,hash TEXT NOT NULL,parent_hash TEXT NOT NULL,timestamp BIGINT NOT NULL,PRIMARY KEY(chain_id,number))',
      'CREATE TABLE IF NOT EXISTS events(chain_id INTEGER NOT NULL,contract TEXT NOT NULL,block_number BIGINT NOT NULL,block_hash TEXT NOT NULL,tx_hash TEXT NOT NULL,log_index INTEGER NOT NULL,from_address TEXT NOT NULL,to_address TEXT NOT NULL,amount_raw TEXT NOT NULL,PRIMARY KEY(chain_id,tx_hash,log_index))',
      'CREATE INDEX IF NOT EXISTS events_address ON events(to_address,block_number)',
      'CREATE INDEX IF NOT EXISTS events_from_address ON events(from_address,block_number)',
      'CREATE TABLE IF NOT EXISTS cursors(stream TEXT PRIMARY KEY,chain_id INTEGER NOT NULL,from_block BIGINT NOT NULL,through_block BIGINT NOT NULL,updated_at TEXT NOT NULL)',
      `CREATE TABLE IF NOT EXISTS snapshots(id ${id},kind TEXT NOT NULL,identity TEXT NOT NULL,source TEXT NOT NULL,block_number BIGINT NOT NULL,observed_at TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(kind,identity,source,block_number))`,
      `CREATE TABLE IF NOT EXISTS index_runs(id ${id},stream TEXT NOT NULL,from_block BIGINT NOT NULL,to_block BIGINT NOT NULL,inserted INTEGER NOT NULL,reorg_from BIGINT,completed_at TEXT NOT NULL)`,
      'CREATE TABLE IF NOT EXISTS campaign_challenges(id TEXT PRIMARY KEY,address TEXT NOT NULL,action TEXT NOT NULL,origin TEXT NOT NULL,message TEXT NOT NULL,expires_at BIGINT NOT NULL,used INTEGER NOT NULL DEFAULT 0,created_at BIGINT NOT NULL)',
      'CREATE INDEX IF NOT EXISTS campaign_challenge_address_time ON campaign_challenges(address,created_at)',
      'CREATE TABLE IF NOT EXISTS campaign_claims(campaign TEXT NOT NULL,address TEXT NOT NULL,action TEXT NOT NULL,points INTEGER NOT NULL,created_at BIGINT NOT NULL,PRIMARY KEY(campaign,address,action))',
      'CREATE TABLE IF NOT EXISTS campaign_members(address TEXT PRIMARY KEY,first_seen BIGINT NOT NULL,last_seen BIGINT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS campaign_rejections(reason TEXT NOT NULL,created_at BIGINT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS campaign_rate_windows(address TEXT PRIMARY KEY,window_start BIGINT NOT NULL,used INTEGER NOT NULL)',
    ];
    for (const sql of statements) await tx.query(sql);
    await tx.query(
      'INSERT INTO schema_migrations(version,applied_at) VALUES(?,?) ON CONFLICT(version) DO NOTHING',
      [SCHEMA_VERSION, new Date().toISOString()],
    );
  });
}
export async function assertSchema(db: SqlDatabase) {
  const rows = await db.query('SELECT version FROM schema_migrations WHERE version=?', [
    SCHEMA_VERSION,
  ]);
  if (rows.length !== 1) throw new Error('Database migration is required');
}
