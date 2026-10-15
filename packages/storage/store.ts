import { integer, type SqlDatabase } from './sql.js';
export class WebStore {
  constructor(readonly sql: SqlDatabase) {}
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
