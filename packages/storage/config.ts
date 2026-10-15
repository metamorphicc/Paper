import type { AppEnvironment } from '../http/origin.js';
export function databaseConnection(env: AppEnvironment) {
  return env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim() || null;
}
export function requiresHostedDatabase(env: AppEnvironment) {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME);
}
export function validateDatabaseConfiguration(env: AppEnvironment) {
  const connection = databaseConnection(env);
  if (requiresHostedDatabase(env) && !connection)
    throw new Error(
      'Connect a PostgreSQL database and set DATABASE_URL before deploying this application.',
    );
  return connection;
}
