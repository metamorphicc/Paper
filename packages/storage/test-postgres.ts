import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { postgresDatabase } from './sql.js';
export async function testPostgres() {
  const engine = await PGlite.create();
  const server = new PGLiteSocketServer({
    db: engine,
    host: '127.0.0.1',
    port: 0,
    maxConnections: 8,
  });
  await server.start();
  const url = 'postgres://postgres:postgres@' + server.getServerConn() + '/postgres';
  const database = postgresDatabase(url);
  return {
    database,
    url,
    async close() {
      await database.close();
      await server.stop();
      await engine.close();
    },
  };
}
