import { Pool, type PoolConfig } from 'pg';
export type Row = Record<string, unknown>;
export interface SqlSession {
  query<T extends Row = Row>(sql: string, values?: unknown[]): Promise<T[]>;
}
export interface SqlDatabase extends SqlSession {
  dialect: 'postgres' | 'sqlite';
  transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export function postgresOptions(connectionString: string): PoolConfig {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Invalid database configuration');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2
  )
    throw new Error('Invalid database configuration');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  for (const key of ['host', 'port', 'user', 'password', 'database', 'ssl'])
    if (url.searchParams.has(key)) throw new Error('Database connection overrides are not allowed');
  if (
    !local &&
    ['disable', 'allow', 'prefer', 'no-verify'].includes(url.searchParams.get('sslmode') ?? '')
  )
    throw new Error('Database TLS verification is required');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
    max: 3,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    statement_timeout: 12000,
    query_timeout: 15000,
    application_name: 'paperclub-web',
    allowExitOnIdle: true,
  };
}
export function postgresDatabase(connectionString: string): SqlDatabase {
  const pool = new Pool(postgresOptions(connectionString));
  pool.on('error', () => {
    console.error('Database pool connection unavailable');
  });
  function session(client: Pick<Pool, 'query'>): SqlSession {
    return {
      async query<T extends Row>(sql: string, values: unknown[] = []) {
        let index = 0;
        const text = sql.replace(/\?/g, () => '$' + ++index);
        return (await client.query<T>(text, values)).rows;
      },
    };
  }
  return {
    dialect: 'postgres',
    ...session(pool),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '5s'");
        const result = await work(session(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
/** Desktop/local storage only; never imported or opened in a configured hosted request. */
export async function sqliteDatabase(path: string): Promise<SqlDatabase> {
  const { Store } = await import('../indexer/store.js');
  const store = new Store(path);
  let tail = Promise.resolve();
  const session: SqlSession = {
    async query<T extends Row>(sql: string, values: unknown[] = []) {
      return store.db.prepare(sql).all(...(values as (string | number | null)[])) as T[];
    },
  };
  async function locked<T>(work: () => Promise<T>) {
    const previous = tail;
    let release!: () => void;
    tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
  return {
    dialect: 'sqlite',
    query: (sql, values) => locked(() => session.query(sql, values)),
    transaction: (work) =>
      locked(async () => {
        store.db.exec('BEGIN IMMEDIATE');
        try {
          const value = await work(session);
          store.db.exec('COMMIT');
          return value;
        } catch (error) {
          store.db.exec('ROLLBACK');
          throw error;
        }
      }),
    async close() {
      await tail;
      store.close();
    },
  };
}
export function integer(value: unknown) {
  if (!['number', 'string', 'bigint'].includes(typeof value) || !/^-?\d+$/.test(String(value)))
    throw new Error('Invalid database integer');
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Unsafe database integer');
  return result;
}
