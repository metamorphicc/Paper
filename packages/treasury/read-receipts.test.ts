import test from 'node:test';
import assert from 'node:assert/strict';
import type { Address } from 'viem';
import { localEvm } from '../contracts/local.js';
import { compileContracts } from '../contracts/compiler.js';
import { readTreasuryReceipts } from './read-receipts.js';

test('RPC reader reconciles actual local EVM transfer receipts and rejects a wrong chain', async () => {
  const evm = await localEvm();
  try {
    const [owner, treasury] = evm.accounts as [Address, Address];
    const artifact = compileContracts().ClubToken!;
    const deployment = await evm.wallet(owner).deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      args: ['Paperclub', 'CLUB', 1000n, [owner], [1000n]],
    });
    const receipt = await evm.publicClient.waitForTransactionReceipt({ hash: deployment });
    const asset = receipt.contractAddress!;
    const write = async (actor: Address, functionName: string, args: unknown[]) => {
      const hash = await evm
        .wallet(actor)
        .writeContract({ address: asset, abi: artifact.abi, functionName, args });
      assert.equal((await evm.publicClient.waitForTransactionReceipt({ hash })).status, 'success');
    };
    await write(owner, 'transfer', [treasury, 200n]);
    await write(treasury, 'transfer', [owner, 40n]);
    await write(treasury, 'burn', [10n]);
    await write(treasury, 'transfer', [treasury, 5n]);
    const result = await readTreasuryReceipts(evm.publicClient, {
      treasury,
      asset,
      expectedChainId: 31337,
      blocks: 4,
      minConfirmations: 1,
    });
    assert.equal(result.reconciled, true);
    assert.equal(result.closingBalanceRaw, '150');
    assert.equal(result.receivedRaw, '200');
    assert.equal(result.sentRaw, '50');
    assert.equal(result.transfers.length, 4);
    assert.equal(result.symbol, 'CLUB');
    assert.equal(result.decimals, 18);
    assert.equal(result.realizedRevenueRaw, null);
    assert.equal(
      result.burnsVerified,
      false,
      'A transfer to zero is not a reviewed treasury burn workflow',
    );
    await assert.rejects(
      readTreasuryReceipts(evm.publicClient, { treasury, asset, expectedChainId: 999 }),
      /Unexpected/,
    );
    await assert.rejects(
      readTreasuryReceipts(evm.publicClient, { treasury, asset, blocks: 2049 }),
      /Invalid/,
    );
  } finally {
    await evm.close();
  }
});
