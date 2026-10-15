import { integer, type SqlDatabase } from './sql.js';
import { validateIndexBatch } from '../indexer/validate.js';
import type { BlockRecord, TokenEvent } from '../indexer/store.js';
export class WebStore {
  constructor(readonly sql: SqlDatabase) {}
  async applyBatch(stream: string, chainId: number, blocks: BlockRecord[], events: TokenEvent[]) {
    const { first, last } = validateIndexBatch(stream, chainId, blocks, events);
    return this.sql.transaction(async (tx) => {
      if (this.sql.dialect === 'postgres')
        await tx.query('SELECT pg_advisory_xact_lock(hashtext(?))', ['paperclub-index:' + chainId]);
      const [cursor] = await tx.query('SELECT * FROM cursors WHERE stream=?', [stream]);
      if (
        cursor &&
        (integer(cursor.chain_id) !== chainId ||
          first.number > integer(cursor.through_block) + 1 ||
          first.number < integer(cursor.from_block))
      )
        throw new Error('Cursor gap or stream mismatch');
      const stored = await tx.query(
        'SELECT number,hash FROM blocks WHERE chain_id=? AND number>=? AND number<=? ORDER BY number',
        [chainId, first.number - 1, last.number],
      );
      const known = new Map(stored.map((row) => [integer(row.number), String(row.hash)]));
      const parent = known.get(first.number - 1);
      if (parent && parent !== first.parentHash.toLowerCase())
        throw new Error('Reorg deeper than overlap; replay earlier blocks');
      const changed = blocks.find(
        (block) => known.has(block.number) && known.get(block.number) !== block.hash.toLowerCase(),
      );
      const reorgFrom = changed?.number ?? null;
      if (reorgFrom !== null) {
        await tx.query('DELETE FROM events WHERE chain_id=? AND block_number>=?', [
          chainId,
          reorgFrom,
        ]);
        await tx.query('DELETE FROM blocks WHERE chain_id=? AND number>=?', [chainId, reorgFrom]);
        await tx.query(
          'UPDATE cursors SET through_block=CASE WHEN through_block>? THEN ? ELSE through_block END WHERE chain_id=?',
          [reorgFrom - 1, reorgFrom - 1, chainId],
        );
      }
      const previousEvents = await tx.query(
        'SELECT * FROM events WHERE chain_id=? AND block_number>=? AND block_number<=?',
        [chainId, first.number, last.number],
      );
      const previous = new Map(
        previousEvents.map((row) => [String(row.tx_hash) + ':' + row.log_index, row]),
      );
      for (const event of events) {
        const old = previous.get(event.txHash.toLowerCase() + ':' + event.logIndex);
        if (
          old &&
          (String(old.amount_raw) !== event.amountRaw ||
            old.block_hash !== event.blockHash.toLowerCase() ||
            old.contract !== event.contract.toLowerCase() ||
            old.from_address !== event.from.toLowerCase() ||
            old.to_address !== event.to.toLowerCase())
        )
          throw new Error('Conflicting canonical event');
      }
      const blockValues = blocks.flatMap((block) => [
        chainId,
        block.number,
        block.hash.toLowerCase(),
        block.parentHash.toLowerCase(),
        block.timestamp,
      ]);
      await tx.query(
        'INSERT INTO blocks(chain_id,number,hash,parent_hash,timestamp) VALUES ' +
          blocks.map(() => '(?,?,?,?,?)').join(',') +
          ' ON CONFLICT(chain_id,number) DO NOTHING',
        blockValues,
      );
      let inserted = 0;
      if (events.length) {
        const values = events.flatMap((event) => [
          chainId,
          event.contract.toLowerCase(),
          event.blockNumber,
          event.blockHash.toLowerCase(),
          event.txHash.toLowerCase(),
          event.logIndex,
          event.from.toLowerCase(),
          event.to.toLowerCase(),
          event.amountRaw,
        ]);
        inserted = (
          await tx.query(
            'INSERT INTO events(chain_id,contract,block_number,block_hash,tx_hash,log_index,from_address,to_address,amount_raw) VALUES ' +
              events.map(() => '(?,?,?,?,?,?,?,?,?)').join(',') +
              ' ON CONFLICT(chain_id,tx_hash,log_index) DO NOTHING RETURNING tx_hash',
            values,
          )
        ).length;
      }
      const through =
        reorgFrom === null
          ? Math.max(cursor ? integer(cursor.through_block) : 0, last.number)
          : last.number;
      const now = new Date().toISOString();
      await tx.query(
        'INSERT INTO cursors(stream,chain_id,from_block,through_block,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(stream) DO UPDATE SET through_block=excluded.through_block,updated_at=excluded.updated_at',
        [stream, chainId, cursor ? integer(cursor.from_block) : first.number, through, now],
      );
      await tx.query(
        'INSERT INTO index_runs(stream,from_block,to_block,inserted,reorg_from,completed_at) VALUES(?,?,?,?,?,?)',
        [stream, first.number, last.number, inserted, reorgFrom, now],
      );
      return { inserted, reorgFrom, through };
    });
  }
  async statistics() {
    const [events] = await this.sql.query('SELECT COUNT(*) AS n FROM events');
    const [snapshots] = await this.sql.query('SELECT COUNT(*) AS n FROM snapshots');
    const streams = await this.sql.query('SELECT * FROM cursors ORDER BY stream');
    return {
      events: integer(events!.n),
      snapshots: integer(snapshots!.n),
      streams: streams.map((row) => ({
        ...row,
        chain_id: integer(row.chain_id),
        from_block: integer(row.from_block),
        through_block: integer(row.through_block),
      })),
    };
  }
  async saveSnapshot(
    kind: string,
    identity: string,
    source: string,
    block: number,
    payload: unknown,
  ) {
    const raw = JSON.stringify(payload);
    if (raw.length > 2_000_000 || !Number.isSafeInteger(block) || block < 0)
      throw new Error('Invalid snapshot');
    await this.sql.query(
      'INSERT INTO snapshots(kind,identity,source,block_number,observed_at,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(kind,identity,source,block_number) DO NOTHING',
      [kind, identity.toLowerCase(), source, block, new Date().toISOString(), raw],
    );
  }
  async latestSnapshot<T>(kind: string, identity: string, source = 'official-indexer') {
    const [row] = await this.sql.query(
      'SELECT observed_at,block_number,payload FROM snapshots WHERE kind=? AND identity=? AND source=? ORDER BY block_number DESC LIMIT 1',
      [kind, identity.toLowerCase(), source],
    );
    return row
      ? {
          observedAt: String(row.observed_at),
          block: integer(row.block_number),
          value: JSON.parse(String(row.payload)) as T,
        }
      : null;
  }
  async history(address: string, limit = 50) {
    const rows = await this.sql.query(
      'SELECT block_number,tx_hash,from_address,to_address,amount_raw FROM events WHERE from_address=? OR to_address=? ORDER BY block_number DESC,log_index DESC LIMIT ?',
      [address.toLowerCase(), address.toLowerCase(), Math.min(100, Math.max(1, limit))],
    );
    return rows.map((row) => ({
      block_number: integer(row.block_number),
      tx_hash: String(row.tx_hash),
      from_address: String(row.from_address),
      to_address: String(row.to_address),
      amount_raw: String(row.amount_raw),
    }));
  }
  async cursor(stream: string) {
    const [row] = await this.sql.query('SELECT * FROM cursors WHERE stream=?', [stream]);
    return row
      ? {
          chain_id: integer(row.chain_id),
          from_block: integer(row.from_block),
          through_block: integer(row.through_block),
          updated_at: String(row.updated_at),
        }
      : undefined;
  }
  async mintedRanking(limit = 20) {
    const rows = await this.sql.query(
      this.sql.dialect === 'postgres'
        ? 'SELECT to_address AS address,SUM(CAST(amount_raw AS NUMERIC))::text AS minted FROM events WHERE from_address=? GROUP BY to_address ORDER BY SUM(CAST(amount_raw AS NUMERIC)) DESC,to_address LIMIT ?'
        : 'SELECT to_address,amount_raw FROM events WHERE from_address=?',
      ['0x' + '0'.repeat(40), ...(this.sql.dialect === 'postgres' ? [limit] : [])],
    );
    if (this.sql.dialect === 'postgres')
      return rows.map((row) => ({ address: String(row.address), mintedRaw: String(row.minted) }));
    const totals = new Map<string, bigint>();
    for (const row of rows)
      totals.set(
        String(row.to_address),
        (totals.get(String(row.to_address)) ?? 0n) + BigInt(String(row.amount_raw)),
      );
    return [...totals]
      .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] > b[1] ? -1 : 1))
      .slice(0, limit)
      .map(([address, value]) => ({ address, mintedRaw: String(value) }));
  }
  close() {
    return this.sql.close();
  }
}
