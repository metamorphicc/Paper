import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationOrigins, allowsOrigin, allowsRequest } from './origin.js';
import { validateDatabaseConfiguration } from '../storage/config.js';
const env = {
  VERCEL: '1',
  PAPERCLUB_APP_ORIGIN: 'https://paperclub.example',
  VERCEL_URL: 'preview.vercel.app',
};
test('hosted requests require configured hosts and same-origin writes, without loopback or forwarded-host bypasses', () => {
  assert.equal(allowsRequest(new Request('https://paperclub.example/api/campaign'), env), true);
  assert.equal(
    allowsRequest(
      new Request('http://paperclub.example/api/campaign', {
        method: 'POST',
        headers: { Origin: 'https://paperclub.example' },
      }),
      env,
    ),
    true,
    'TLS may terminate before the Next.js server',
  );
  assert.equal(
    allowsRequest(
      new Request('https://paperclub.example/api/campaign', {
        method: 'POST',
        headers: { Origin: 'https://paperclub.example' },
      }),
      env,
    ),
    true,
  );
  assert.equal(
    allowsRequest(new Request('https://paperclub.example/api/campaign', { method: 'POST' }), env),
    false,
  );
  assert.equal(
    allowsRequest(
      new Request('https://paperclub.example/api/campaign', {
        headers: { Origin: 'https://evil.example' },
      }),
      env,
    ),
    false,
  );
  assert.equal(
    allowsRequest(
      new Request('https://evil.example/api/campaign', {
        headers: { 'x-forwarded-host': 'paperclub.example' },
      }),
      env,
    ),
    false,
  );
  assert.equal(allowsRequest(new Request('http://127.0.0.1:3000/api/campaign'), env), false);
  assert.equal(allowsOrigin('http://127.0.0.1:3000', env), false);
  assert.equal(allowsRequest(new Request('http://127.0.0.1:3000/api/campaign'), {}), true);
  assert.throws(
    () => applicationOrigins({ PAPERCLUB_APP_ORIGIN: 'https://user:secret@example.com' }),
    /origin/,
  );
  assert.throws(
    () => applicationOrigins({ PAPERCLUB_APP_ORIGIN: 'https://example.com/path' }),
    /origin/,
  );
  assert.throws(() => validateDatabaseConfiguration({ VERCEL: '1' }), /DATABASE_URL/);
  assert.equal(
    validateDatabaseConfiguration({ DATABASE_URL: 'postgres://fixture', VERCEL: '1' }),
    'postgres://fixture',
  );
});
