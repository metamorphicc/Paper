import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedText, BodyLimitError, isLocalRead, WindowLimiter } from './guards.js';
test('streaming body limits count bytes before complete buffering and reject misleading length', async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('abcdefgh'));
        controller.enqueue(new TextEncoder().encode('ijklmnop'));
        controller.close();
      },
    }),
  );
  await assert.rejects(boundedText(response, 10), BodyLimitError);
  await assert.rejects(
    boundedText(new Response('x', { headers: { 'Content-Length': '100000' } }), 10),
    BodyLimitError,
  );
  assert.equal(await boundedText(new Response('hello'), 10), 'hello');
});
test('rate windows reset and local reads reject cross-origin and foreign hosts', () => {
  let time = 0;
  const limiter = new WindowLimiter(() => time);
  assert.equal(limiter.consume('profile', 2).allowed, true);
  assert.equal(limiter.consume('profile', 2).allowed, true);
  assert.equal(limiter.consume('profile', 2).allowed, false);
  time = 60000;
  assert.equal(limiter.consume('profile', 2).allowed, true);
  assert.equal(isLocalRead(new Request('http://127.0.0.1:3000/api/profile')), true);
  assert.equal(
    isLocalRead(
      new Request('http://localhost:3000/api/profile', {
        headers: { Host: '127.0.0.1:3000', Origin: 'http://127.0.0.1:3000' },
      }),
    ),
    true,
    'Next may normalize its internal request URL; bind Origin to the validated Host',
  );
  assert.equal(
    isLocalRead(
      new Request('http://127.0.0.1:3000/api/profile', {
        headers: { Origin: 'https://untrusted.example' },
      }),
    ),
    false,
  );
  assert.equal(
    isLocalRead(
      new Request('http://127.0.0.1:3000/api/profile', { headers: { Host: 'untrusted.example' } }),
    ),
    false,
  );
});
