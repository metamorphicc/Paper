import { resolve } from 'node:path';
import { validateDatabaseConfiguration } from './config.js';
import { postgresDatabase, sqliteDatabase } from './sql.js';
import { assertSchema, migrateDatabase } from './schema.js';
import { WebStore } from './store.js';
import type { AppEnvironment } from '../http/origin.js';
export async function openWebStore(env: AppEnvironment, localDirectory = 'data') {
  const connection = validateDatabaseConfiguration(env);
  const sql = connection
    ? postgresDatabase(connection)
    : await sqliteDatabase(resolve(env.PAPERCLUB_DATA_DIR ?? localDirectory, 'paperclub.sqlite'));
  try {
    if (connection) await assertSchema(sql);
    else await migrateDatabase(sql);
    return new WebStore(sql);
  } catch (error) {
    await sql.close();
    throw error;
  }
}
