import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { privateKeyToAccount } from 'viem/accounts';
import { officialTypedData, identifyIntent } from '../protocol/intents.js';
import {
  OfficialRelayerTransport,
  UnconfirmedIntentError,
  IntentRejectedError,
} from './official-transport.js';
import { OfficialIntentController, CoordinatedNonces } from './intent-controller.js';
const wallet = privateKeyToAccount(('0x' + '11'.repeat(32)) as `0x${string}`);
const message = {
  user: wallet.address,
  size: 100000000000000000000n,
  instrumentId: 0,
  isLong: true,
  leverage: 100,
  useDebt: false,
  nonce: 9n,
  deadline: 3600n,
};
test('real HTTP adapter binds acknowledgement identity and observed signed wire schema', async () => {
  const signature = await wallet.signTypedData(officialTypedData('OpenPosition', message));
  const { intentId } = await identifyIntent('OpenPosition', message, signature);
  const requests: { url: string; body: any; build: unknown }[] = [];
  let responseMode = 'ok';
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({
      url: request.url!,
      body: JSON.parse(body),
      build: request.headers['x-papertrade-build'],
    });
    response.setHeader('Content-Type', 'application/json');
    if (responseMode === 'rate') {
      response.statusCode = 429;
      response.setHeader('Retry-After', '2');
      response.end(JSON.stringify({ code: 'rate_limited' }));
      return;
    }
    response.end(
      JSON.stringify({
        intentId: responseMode === 'wrong' ? '0x' + '00'.repeat(32) : intentId,
        action: 'openPosition',
        state: 'queued',
        queueRevision: '7',
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const fetcher: typeof fetch = (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://exchange.papertrade.xyz');
    return fetch(`http://127.0.0.1:${port}${url.pathname}`, init);
  };
  let now = 0;
  const transport = new OfficialRelayerTransport({
    fetcher,
    buildId: '5573690ff1da',
    assertReleased: () => {},
    now: () => now,
  });
  try {
    const ack = await transport.submit({ action: 'openPosition', message, signature });
    assert.equal(ack.phase, 'acknowledged');
    assert.equal(ack.intentId, intentId);
    assert.equal(requests[0]!.body.signed.size, String(message.size));
    assert.equal(requests[0]!.body.signed.v, '27');
    assert.equal(requests[0]!.body.action, 'openPosition');
    assert.equal(requests[0]!.build, '5573690ff1da');
    const cancellation = { user: wallet.address, intentId, deadline: 3600n };
    const cancelSignature = await wallet.signTypedData(
      officialTypedData('CancelIntent', cancellation),
    );
    await transport.cancel(intentId, cancellation, cancelSignature, 'openPosition');
    assert.equal(requests.at(-1)!.url, `/intents/${intentId}/cancel`);
    assert.equal('intentId' in requests.at(-1)!.body, false);
    responseMode = 'wrong';
    await assert.rejects(
      transport.submit({ action: 'openPosition', message, signature }),
      UnconfirmedIntentError,
    );
    responseMode = 'rate';
    await assert.rejects(
      transport.submit({ action: 'openPosition', message, signature }),
      IntentRejectedError,
    );
    const count = requests.length;
    await assert.rejects(
      transport.submit({ action: 'openPosition', message, signature }),
      IntentRejectedError,
    );
    assert.equal(requests.length, count);
    now = 2000;
    responseMode = 'ok';
    await transport.submit({ action: 'openPosition', message, signature });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
test('default release gate prevents HTTP; unsafe schemas and wrong signer fail before network', async () => {
  const signature = await wallet.signTypedData(officialTypedData('OpenPosition', message));
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    throw new Error('No request expected');
  };
  await assert.rejects(
    new OfficialRelayerTransport({ fetcher }).submit({
      action: 'openPosition',
      message,
      signature,
    }),
    /blocked/,
  );
  const transport = new OfficialRelayerTransport({
    fetcher,
    assertReleased: () => {},
    buildId: 'fixture',
    now: () => 0,
  });
  await assert.rejects(
    transport.submit({ action: 'openPosition', message: { ...message, extra: 1 }, signature }),
    /schema/,
  );
  await assert.rejects(
    transport.submit({
      action: 'openPosition',
      message: { ...message, leverage: 2 ** 40 },
      signature,
    }),
    /range/,
  );
  await assert.rejects(
    transport.submit({ action: 'openPosition', message: { ...message, deadline: 0n }, signature }),
    /deadline/,
  );
  const wrongWallet = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`);
  await assert.rejects(
    transport.submit({
      action: 'openPosition',
      message,
      signature: await wrongWallet.signTypedData(officialTypedData('OpenPosition', message)),
    }),
    /Wallet signature/,
  );
  assert.equal(calls, 0);
});
test('status absence never invents settlement and account snapshots cannot cross wallets', async () => {
  const id = ('0x' + '00'.repeat(32)) as `0x${string}`;
  const transport = new OfficialRelayerTransport({
    walletReader: async () => ({
      address: wallet.address,
      operations: [],
      indexedThroughBlock: 10,
    }),
  });
  assert.equal((await transport.status(id, wallet.address)).settlementVerified, false);
  assert.equal((await transport.status(id, wallet.address)).phase, 'unconfirmed');
  await assert.rejects(transport.status(id, '0x' + '22'.repeat(20)), /mismatch/);
});
test('controller coordinates nonces, retries identical signatures and invalidates changed authority', async () => {
  const store = new Map<string, string>();
  let tail = Promise.resolve();
  const nonces = new CoordinatedNonces({
    read: (key) => store.get(key) ?? null,
    write: (key, value) => {
      store.set(key, value);
    },
    seed: () => 256n,
    lock: async (_key, work) => {
      const previous = tail;
      let unlock!: () => void;
      tail = new Promise((resolve) => {
        unlock = resolve;
      });
      await previous;
      try {
        return await work();
      } finally {
        unlock();
      }
    },
  });
  const allocated = await Promise.all(
    Array.from({ length: 5 }, () => nonces.take(wallet.address, '0x' + '00'.repeat(20), 999)),
  );
  assert.deepEqual(allocated, [256n, 257n, 258n, 259n, 260n]);
  let generation = 1,
    signed = 0,
    rejectCancellation = false;
  const bodies: string[] = [];
  const transport = new OfficialRelayerTransport({
    assertReleased: () => {},
    now: () => 0,
    buildId: 'fixture',
    fetcher: async (_input, init) => {
      bodies.push(String(init?.body));
      if (rejectCancellation) return Response.json({ code: 'admission_rejected' }, { status: 409 });
      throw new Error('Ambiguous timeout');
    },
  });
  const controller = new OfficialIntentController({
    context: () => ({ user: wallet.address, chainId: 999, generation }),
    nonces,
    transport,
    assertReady: () => {},
    validateAction: () => {},
    now: () => 0,
    sign: async (type, message) => {
      signed++;
      return wallet.signTypedData(officialTypedData(type, message));
    },
  });
  const { user: _, nonce: __, deadline: ___, ...fields } = message;
  const prepared = await controller.prepare('openPosition', fields);
  await assert.rejects(controller.submit(prepared), UnconfirmedIntentError);
  await assert.rejects(controller.submit(prepared), /already used/);
  const id = [...controller.pending.keys()][0]!;
  await assert.rejects(controller.retrySame(id), UnconfirmedIntentError);
  assert.equal(signed, 1);
  assert.equal(bodies[0], bodies[1]);
  rejectCancellation = true;
  await assert.rejects(controller.cancel(id), IntentRejectedError);
  assert.equal(controller.pending.has(id), true);
  assert.equal(controller.pending.get(id)!.phase, 'unconfirmed');
  assert.equal(signed, 2);
  generation++;
  await assert.rejects(controller.retrySame(id), /changed/);
  assert.equal(bodies.length, 3);
});
