import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect, type Browser } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { testPostgres } from '../packages/storage/test-postgres.js';
import { migrateDatabase } from '../packages/storage/schema.js';
import { productionFixtureServer } from '../packages/testing/web-server.js';
import { PersistentCampaign } from '../packages/community/persistent.js';
import { parseTrading } from '../packages/protocol/official.js';
const fixture = await testPostgres();
let server: Awaited<ReturnType<typeof productionFixtureServer>> | undefined,
  browser: Browser | undefined;
try {
  await migrateDatabase(fixture.database);
  server = await productionFixtureServer(fixture.url);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const walletA = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`),
    walletB = privateKeyToAccount(('0x' + '33'.repeat(32)) as `0x${string}`);
  let current = walletA,
    connected = false,
    signing: 'normal' | 'reject' | 'switch' = 'normal';
  const methods: string[] = [],
    errors: string[] = [],
    checks: string[] = [];
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await context.exposeBinding(
    '__fixtureWallet',
    async ({ page: caller }, input: { method: string; params?: unknown[] }) => {
      assert.ok(caller.url().startsWith(server!.origin + '/'));
      methods.push(input.method);
      if (input.method === 'eth_accounts') return connected ? [current.address] : [];
      if (input.method === 'eth_requestAccounts') {
        connected = true;
        return [current.address];
      }
      if (input.method === 'eth_chainId') return '0x3e7';
      if (input.method === 'personal_sign') {
        if (signing === 'reject') throw new Error('User rejected the request');
        assert.equal(String(input.params?.[1]).toLowerCase(), current.address.toLowerCase());
        const signature = await current.signMessage({
          message: { raw: input.params![0] as `0x${string}` },
        });
        if (signing === 'switch') {
          current = walletA;
          await page.evaluate(
            (account) =>
              (
                window as unknown as { __fixtureEmit: (name: string, value: unknown) => void }
              ).__fixtureEmit('accountsChanged', [account]),
            current.address,
          );
        }
        return signature;
      }
      throw new Error('Fixture wallet forbids financial or unexpected RPC methods');
    },
  );
  await context.addInitScript({
    content: `(() => {
    const listeners = new Map();
    window.ethereum = {
      request(input) { return window.__fixtureWallet(input); },
      on(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
      removeListener(name, callback) { listeners.get(name)?.delete(callback); }
    };
    window.__fixtureEmit = (name, value) => listeners.get(name)?.forEach(callback => callback(value));
  })();`,
  });
  await page.goto(server.origin + '/leaderboard');
  const panel = page.getByRole('region', { name: 'Founding community' });
  await expect(
    panel.getByRole('button', { name: 'Track my address · 20', exact: true }),
  ).toBeDisabled();
  await panel.getByRole('button', { name: 'Join · 10', exact: true }).click();
  await expect(panel.getByRole('progressbar', { name: 'Campaign progress' })).toHaveAttribute(
    'value',
    '10',
  );
  await expect(page.locator('main').getByRole('cell', { name: '10', exact: true })).toBeVisible();
  checks.push('Signed Join updates progress, shared wallet and server leaderboard without reload');
  await panel.getByRole('button', { name: 'Track my address · 20', exact: true }).click();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '30');
  for (const [index, answer] of [
    'queued-is-debt',
    'profit-is-adjusted',
    'paper-is-not-cash',
  ].entries())
    await panel.locator('select').nth(index).selectOption(answer);
  await panel.getByRole('button', { name: 'Check understanding · 40', exact: true }).click();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '70');
  for (const name of ['Joined · 10', 'Address tracked · 20', 'Completed · 40'])
    await expect(panel.getByRole('button', { name, exact: true })).toBeDisabled();
  checks.push('Join, tracking and quiz complete once; all 70 points persisted');
  await server.restart();
  await page.reload();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '70');
  checks.push('Browser and actual production server restart preserve completed actions');
  async function changeWallet(account: typeof walletA) {
    current = account;
    await page.evaluate(
      (address) =>
        (
          window as unknown as { __fixtureEmit: (name: string, value: unknown) => void }
        ).__fixtureEmit('accountsChanged', [address]),
      account.address,
    );
    await expect(panel.getByRole('progressbar')).toHaveAttribute(
      'value',
      account.address === walletA.address ? '70' : '0',
    );
  }
  await changeWallet(walletB);
  signing = 'reject';
  await panel.getByRole('button', { name: 'Join · 10', exact: true }).click();
  await expect(panel.getByRole('status')).toBeVisible();
  assert.equal(
    (await new PersistentCampaign(fixture.database).participant(walletB.address)).total,
    0,
  );
  checks.push('Rejected wallet signature does not award points');
  signing = 'normal';
  let tamper = true;
  await page.route('**/api/campaign', async (route) => {
    if (
      tamper &&
      route.request().method() === 'POST' &&
      route.request().postDataJSON()?.operation === 'challenge'
    ) {
      tamper = false;
      const response = await route.fetch(),
        value = await response.json();
      value.message += '\nUnexpected permission';
      await route.fulfill({ response, json: value });
    } else await route.continue();
  });
  const before = methods.filter((method) => method === 'personal_sign').length;
  await panel.getByRole('button', { name: 'Join · 10', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('does not match');
  assert.equal(methods.filter((method) => method === 'personal_sign').length, before);
  checks.push('Modified origin-bound proof is rejected before wallet signing');
  signing = 'switch';
  await panel.getByRole('button', { name: 'Join · 10', exact: true }).click();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '70');
  assert.equal(
    (await new PersistentCampaign(fixture.database).participant(walletB.address)).total,
    0,
  );
  checks.push('Account change while signing prevents the old proof from being claimed');
  signing = 'normal';
  await mkdir('data/browser-qa', { recursive: true });
  await mkdir('artifacts/design', { recursive: true });
  const responsive = [];
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    assert.equal(overflow, false, 'Community overflow at ' + width);
    responsive.push({ width, overflow });
  }
  await page.reload();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '70');
  await page.evaluate('window.scrollTo(0, 0); document.activeElement?.blur()');
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
  await page.screenshot({
    path: 'artifacts/design/community-complete.jpg',
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  const trading = parseTrading(
    JSON.parse(await readFile('research/current-trading-state.json', 'utf8')),
  );
  await page.route('**/api/market?coin=*', (route) => {
    const coin = new URL(route.request().url()).searchParams.get('coin');
    return route.fulfill({
      json: {
        quote: {
          coin,
          time: Date.now(),
          bid: '50000',
          ask: '50000',
          midpointRaw: coin === 'BTC' ? '500000' : '200000',
          priceScale: coin === 'BTC' ? 10 : 100,
          source: 'hyperliquid-bbo',
        },
        trading,
        candles: [
          { time: Date.now() - 900000, close: 49000 },
          { time: Date.now(), close: 50000 },
        ],
        fetchedAt: new Date().toISOString(),
        liveSubmission: false,
      },
    });
  });
  await page.goto(server.origin + '/trade');
  await expect(page.getByRole('button', { name: 'Try locally', exact: true })).toBeVisible();
  const sandbox = page.getByTestId('sandbox');
  await sandbox.getByRole('button', { name: 'Try locally', exact: true }).click();
  await sandbox.getByRole('button', { name: 'Open locally', exact: true }).click();
  await sandbox.getByRole('button', { name: 'Settle', exact: true }).click();
  await expect(sandbox.getByRole('button', { name: 'Close locally', exact: true })).toBeVisible();
  await sandbox.getByRole('button', { name: 'Close locally', exact: true }).click();
  await sandbox.getByRole('button', { name: 'Settle', exact: true }).click();
  await expect(sandbox.getByText('No open local positions.', { exact: true })).toBeVisible();
  await sandbox.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await sandbox.getByRole('button', { name: 'Settle', exact: true }).click();
  await expect(sandbox.getByRole('row').filter({ hasText: 'Withdrawal ·' })).toContainText(
    'Settled locally',
  );
  await page.reload();
  await sandbox.getByRole('button', { name: 'Try locally', exact: true }).click();
  await expect(sandbox.getByRole('row').filter({ hasText: 'Withdrawal ·' })).toContainText(
    'Settled locally',
  );
  await expect(page.getByRole('button', { name: 'Sign and submit', exact: true })).toBeDisabled();
  checks.push(
    'Local open, settle, close, withdrawal and browser persistence complete without wallet financial RPC',
  );
  checks.push('Terminal renders with deterministic market fixture; live release stays disabled');
  assert.deepEqual(errors, []);
  const report = {
    observedAtUtc: new Date().toISOString(),
    scope: 'headless Chromium, local production Next server and PostgreSQL TCP fixture',
    productionDatabaseUsed: false,
    userWalletUsed: false,
    financialWalletMethodsRequested: false,
    browserErrors: errors,
    checks,
    responsive,
  };
  await writeFile('research/browser-acceptance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server?.stop();
  await fixture.close();
}
