import { database } from '../../../lib/server';
import { guardRead } from '../../../lib/request-guard';
import { SCHEMA_VERSION } from '../../../../../packages/storage/schema';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const rejection = guardRead(request, 'health', 60);
  if (rejection) return rejection;
  try {
    const db = await database();
    await db.sql.query('SELECT 1');
    return Response.json({
      status: 'ready',
      storage: db.sql.dialect,
      schemaVersion: SCHEMA_VERSION,
      scope: 'application backend',
      liveSubmission: false,
    });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
