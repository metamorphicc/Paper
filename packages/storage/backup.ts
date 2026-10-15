import { createHash } from 'node:crypto';
import type { SqlDatabase, Row } from './sql.js';
import { SCHEMA_VERSION } from './schema.js';
const columns = {
  blocks: ['chain_id', 'number', 'hash', 'parent_hash', 'timestamp'],
  events: [
    'chain_id',
    'contract',
    'block_number',
    'block_hash',
    'tx_hash',
    'log_index',
    'from_address',
    'to_address',
    'amount_raw',
  ],
  cursors: ['stream', 'chain_id', 'from_block', 'through_block', 'updated_at'],
  snapshots: ['id', 'kind', 'identity', 'source', 'block_number', 'observed_at', 'payload'],
  index_runs: ['id', 'stream', 'from_block', 'to_block', 'inserted', 'reorg_from', 'completed_at'],
  campaign_challenges: [
    'id',
    'address',
    'action',
    'origin',
    'message',
    'expires_at',
    'used',
    'created_at',
  ],
  campaign_claims: ['campaign', 'address', 'action', 'points', 'created_at'],
  campaign_members: ['address', 'first_seen', 'last_seen'],
  campaign_rejections: ['reason', 'created_at'],
  campaign_rate_windows: ['address', 'window_start', 'used'],
} as const;
type Table = keyof typeof columns;
const tables = Object.keys(columns) as Table[];
const maxBytes = 20_000_000,
  maxRows = 100000;
function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export type DatabaseBackup = {
  format: 'paperclub-database-v1';
  schemaVersion: number;
  source: 'postgres' | 'sqlite';
  capturedAt: string;
  tables: Record<Table, Row[]>;
  sha256: string;
};
export async function exportDatabase(db: SqlDatabase): Promise<DatabaseBackup> {
  const data = await db.transaction(async (tx) => {
    if (db.dialect === 'postgres')
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const captured = {} as Record<Table, Row[]>;
    let bytes = 0;
    for (const table of tables) {
      const rows = await tx.query(
        `SELECT ${columns[table].join(',')} FROM ${table} ORDER BY ${columns[table].join(',')} LIMIT ?`,
        [maxRows + 1],
      );
      if (rows.length > maxRows)
        throw new Error('Database exceeds the bounded export row limit; use provider backups');
      bytes += Buffer.byteLength(JSON.stringify(rows));
      if (bytes > maxBytes)
        throw new Error('Database exceeds the bounded export byte limit; use provider backups');
      captured[table] = rows;
    }
    return captured;
  });
  const content = {
    format: 'paperclub-database-v1' as const,
    schemaVersion: SCHEMA_VERSION,
    source: db.dialect,
    capturedAt: new Date().toISOString(),
    tables: data,
  };
  return { ...content, sha256: digest(content) };
}
export function validateBackup(value: unknown): DatabaseBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid database backup');
  const b = value as DatabaseBackup;
  if (
    b.format !== 'paperclub-database-v1' ||
    b.schemaVersion !== SCHEMA_VERSION ||
    !['postgres', 'sqlite'].includes(b.source) ||
    !Number.isFinite(Date.parse(b.capturedAt)) ||
    !b.tables ||
    typeof b.tables !== 'object' ||
    Object.keys(b.tables).sort().join(',') !== [...tables].sort().join(',')
  )
    throw new Error('Unsupported backup schema');
  if (Object.keys(b).sort().join(',') !== 'capturedAt,format,schemaVersion,sha256,source,tables')
    throw new Error('Unexpected backup fields');
  const { sha256, ...content } = b;
  if (typeof sha256 !== 'string' || digest(content) !== sha256)
    throw new Error('Backup checksum mismatch');
  if (Buffer.byteLength(JSON.stringify(b)) > maxBytes + 10000)
    throw new Error('Backup exceeds byte limit');
  for (const table of tables) {
    const rows = b.tables[table];
    if (!Array.isArray(rows) || rows.length > maxRows) throw new Error('Invalid backup rows');
    for (const row of rows) {
      if (
        !row ||
        Array.isArray(row) ||
        typeof row !== 'object' ||
        Object.keys(row).sort().join(',') !== [...columns[table]].sort().join(',')
      )
        throw new Error('Invalid backup columns');
      for (const value of Object.values(row))
        if (
          value !== null &&
          typeof value !== 'string' &&
          !(typeof value === 'number' && Number.isSafeInteger(value))
        )
          throw new Error('Invalid backup value');
    }
  }
  return b;
}
/** Fresh migrated databases only. No truncate, delete, overwrite or live restore path. */
export async function restoreDatabase(db: SqlDatabase, input: unknown) {
  const backup = validateBackup(input);
  return db.transaction(async (tx) => {
    if (db.dialect === 'postgres')
      await tx.query('LOCK TABLE ' + tables.join(',') + ' IN ACCESS EXCLUSIVE MODE');
    for (const table of tables)
      if ((await tx.query(`SELECT 1 FROM ${table} LIMIT 1`)).length)
        throw new Error('Restore target must be empty');
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = backup.tables[table],
        names = columns[table];
      for (let start = 0; start < rows.length; start += 100) {
        const chunk = rows.slice(start, start + 100);
        const values = chunk.flatMap((row) => names.map((name) => row[name]));
        await tx.query(
          `INSERT INTO ${table}(${names.join(',')}) VALUES ` +
            chunk.map(() => `(${names.map(() => '?').join(',')})`).join(','),
          values,
        );
      }
      counts[table] = rows.length;
    }
    if (db.dialect === 'postgres')
      for (const table of ['snapshots', 'index_runs'])
        await tx.query(
          `SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE(MAX(id),1),COUNT(*)>0) FROM ${table}`,
        );
    return { restored: true, counts, sha256: backup.sha256, replacedExistingData: false };
  });
}
