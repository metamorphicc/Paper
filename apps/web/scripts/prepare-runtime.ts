import nextEnv from '@next/env';
import { applicationOrigins } from '../../../packages/http/origin.js';
import { validateDatabaseConfiguration } from '../../../packages/storage/config.js';
import { postgresDatabase } from '../../../packages/storage/sql.js';
import { migrateDatabase, assertSchema } from '../../../packages/storage/schema.js';
nextEnv.loadEnvConfig(process.cwd());
const connection = validateDatabaseConfiguration(process.env);
if (process.env.VERCEL && applicationOrigins(process.env).length === 0)
  throw new Error('Set PAPERCLUB_APP_ORIGIN to the public HTTPS origin before deployment.');
if (connection) {
  const db = postgresDatabase(connection);
  try {
    await migrateDatabase(db);
    await assertSchema(db);
    console.log('PostgreSQL schema ready.');
  } catch {
    throw new Error(
      'Database preparation failed. Check the database connection and permissions in your deployment environment.',
    );
  } finally {
    await db.close();
  }
} else console.log('Local development storage selected.');
