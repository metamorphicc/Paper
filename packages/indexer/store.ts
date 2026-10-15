import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateIndexBatch } from './validate.js';

export type BlockRecord = { number: number; hash: string; parentHash: string; timestamp: number };
export type TokenEvent = {
  chainId: number;
  contract: string;
  blockNumber: number;
  blockHash: string;
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  amountRaw: string;
};
const zero = '0x0000000000000000000000000000000000000000';
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS blocks(chain_id INTEGER NOT NULL, number INTEGER NOT NULL, hash TEXT NOT NULL, parent_hash TEXT NOT NULL, timestamp INTEGER NOT NULL, PRIMARY KEY(chain_id,number));
      CREATE TABLE IF NOT EXISTS events(chain_id INTEGER NOT NULL, contract TEXT NOT NULL, block_number INTEGER NOT NULL, block_hash TEXT NOT NULL, tx_hash TEXT NOT NULL, log_index INTEGER NOT NULL, from_address TEXT NOT NULL, to_address TEXT NOT NULL, amount_raw TEXT NOT NULL, PRIMARY KEY(chain_id,tx_hash,log_index));
      CREATE INDEX IF NOT EXISTS events_address ON events(to_address,block_number);
      CREATE TABLE IF NOT EXISTS cursors(stream TEXT PRIMARY KEY, chain_id INTEGER NOT NULL, from_block INTEGER NOT NULL, through_block INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY, kind TEXT NOT NULL, identity TEXT NOT NULL, source TEXT NOT NULL, block_number INTEGER NOT NULL, observed_at TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(kind,identity,source,block_number));
      CREATE TABLE IF NOT EXISTS index_runs(id INTEGER PRIMARY KEY, stream TEXT NOT NULL, from_block INTEGER NOT NULL, to_block INTEGER NOT NULL, inserted INTEGER NOT NULL, reorg_from INTEGER, completed_at TEXT NOT NULL);
    `);
  }
  close() {
    this.db.close();
  }
  cursor(stream: string) {
    return this.db.prepare('SELECT * FROM cursors WHERE stream=?').get(stream) as
      | { chain_id: number; from_block: number; through_block: number; updated_at: string }
      | undefined;
  }
  applyBatch(stream: string, chainId: number, blocks: BlockRecord[], events: TokenEvent[]) {
    const { first, last } = validateIndexBatch(stream, chainId, blocks, events);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const cursor = this.cursor(stream);
      if (
        cursor &&
        (cursor.chain_id !== chainId ||
          first.number > cursor.through_block + 1 ||
          first.number < cursor.from_block)
      )
        throw new Error('Cursor gap or stream mismatch');
      let reorgFrom: number | null = null;
      for (const block of blocks) {
        const stored = this.db
          .prepare('SELECT hash FROM blocks WHERE chain_id=? AND number=?')
          .get(chainId, block.number) as { hash: string } | undefined;
        if (stored && stored.hash !== block.hash.toLowerCase()) {
          reorgFrom = block.number;
          break;
        }
      }
      const parent = this.db
        .prepare('SELECT hash FROM blocks WHERE chain_id=? AND number=?')
        .get(chainId, first.number - 1) as { hash: string } | undefined;
      if (parent && parent.hash !== first.parentHash.toLowerCase())
        throw new Error('Reorg deeper than overlap; replay earlier blocks');
      if (reorgFrom !== null) {
        this.db
          .prepare('DELETE FROM events WHERE chain_id=? AND block_number>=?')
          .run(chainId, reorgFrom);
        this.db
          .prepare('DELETE FROM blocks WHERE chain_id=? AND number>=?')
          .run(chainId, reorgFrom);
        this.db
          .prepare('UPDATE cursors SET through_block=MIN(through_block,?) WHERE chain_id=?')
          .run(reorgFrom - 1, chainId);
      }
      const insertBlock = this.db.prepare(
        'INSERT INTO blocks VALUES(?,?,?,?,?) ON CONFLICT(chain_id,number) DO NOTHING',
      );
      for (const block of blocks)
        insertBlock.run(
          chainId,
          block.number,
          block.hash.toLowerCase(),
          block.parentHash.toLowerCase(),
          block.timestamp,
        );
      const insertEvent = this.db.prepare(
        'INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(chain_id,tx_hash,log_index) DO NOTHING',
      );
      let inserted = 0;
      for (const event of events)
        inserted += Number(
          insertEvent.run(
            chainId,
            event.contract.toLowerCase(),
            event.blockNumber,
            event.blockHash.toLowerCase(),
            event.txHash.toLowerCase(),
            event.logIndex,
            event.from.toLowerCase(),
            event.to.toLowerCase(),
            event.amountRaw,
          ).changes,
        );
      const through =
        reorgFrom === null ? Math.max(cursor?.through_block ?? 0, last.number) : last.number;
      this.db
        .prepare(
          'INSERT INTO cursors VALUES(?,?,?,?,?) ON CONFLICT(stream) DO UPDATE SET through_block=excluded.through_block, updated_at=excluded.updated_at',
        )
        .run(
          stream,
          chainId,
          cursor?.from_block ?? first.number,
          through,
          new Date().toISOString(),
        );
      this.db
        .prepare(
          'INSERT INTO index_runs(stream,from_block,to_block,inserted,reorg_from,completed_at) VALUES(?,?,?,?,?,?)',
        )
        .run(stream, first.number, last.number, inserted, reorgFrom, new Date().toISOString());
      this.db.exec('COMMIT');
      return { inserted, reorgFrom, through };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  saveSnapshot(kind: string, identity: string, source: string, block: number, payload: unknown) {
    const raw = JSON.stringify(payload);
    if (raw.length > 2_000_000 || !Number.isSafeInteger(block) || block < 0)
      throw new Error('Invalid snapshot');
    this.db
      .prepare(
        'INSERT INTO snapshots(kind,identity,source,block_number,observed_at,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(kind,identity,source,block_number) DO NOTHING',
      )
      .run(kind, identity.toLowerCase(), source, block, new Date().toISOString(), raw);
  }
  latestSnapshot<T>(kind: string, identity: string, source = 'official-indexer') {
    const row = this.db
      .prepare(
        'SELECT * FROM snapshots WHERE kind=? AND identity=? AND source=? ORDER BY block_number DESC LIMIT 1',
      )
      .get(kind, identity.toLowerCase(), source) as
      { observed_at: string; block_number: number; payload: string } | undefined;
    return row
      ? {
          observedAt: row.observed_at,
          block: row.block_number,
          value: JSON.parse(row.payload) as T,
        }
      : null;
  }
  history(address: string, limit = 50) {
    return this.db
      .prepare(
        'SELECT * FROM events WHERE from_address=? OR to_address=? ORDER BY block_number DESC,log_index DESC LIMIT ?',
      )
      .all(address.toLowerCase(), address.toLowerCase(), Math.min(100, Math.max(1, limit)));
  }
  mintedRanking(limit = 20) {
    const events = this.db
      .prepare('SELECT to_address,amount_raw FROM events WHERE from_address=?')
      .all(zero) as { to_address: string; amount_raw: string }[];
    const totals = new Map<string, bigint>();
    for (const event of events)
      totals.set(event.to_address, (totals.get(event.to_address) ?? 0n) + BigInt(event.amount_raw));
    return [...totals]
      .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] > b[1] ? -1 : 1))
      .slice(0, limit)
      .map(([address, minted]) => ({ address, mintedRaw: String(minted) }));
  }
  statistics() {
    return {
      events: Number(
        (this.db.prepare('SELECT count(*) AS n FROM events').get() as { n: number }).n,
      ),
      snapshots: Number(
        (this.db.prepare('SELECT count(*) AS n FROM snapshots').get() as { n: number }).n,
      ),
      streams: this.db.prepare('SELECT * FROM cursors').all(),
    };
  }
  async backupTo(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    await backup(this.db, path);
    return path;
  }
}
