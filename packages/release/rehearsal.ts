import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  decodeEventLog,
  encodeDeployData,
  keccak256,
  parseAbiItem,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { compilationBundle, recompileInput, type Compiled } from '../contracts/compiler.js';
import { localEvm } from '../contracts/local.js';
import { buildDeploymentPlan, type DeploymentParameters } from './plan.js';
import { compareRuntime } from './bytecode.js';
import { readTreasuryReceipts } from '../treasury/read-receipts.js';

/** Always creates/destroys an isolated in-process chain. No RPC URL or key input exists. */
export async function rehearseDeployment(fault?: 'nonce-drift' | 'wrong-constructor') {
  const evm = await localEvm();
  try {
    assert.equal(await evm.publicClient.getChainId(), 31337);
    const [owner, alice, bob] = evm.accounts as [Address, Address, Address];
    const bundle = compilationBundle();
    const localInput = structuredClone(bundle.input);
    localInput.sources['contracts/fixtures/LocalUSDC.sol'] = {
      content: await readFile('contracts/fixtures/LocalUSDC.sol', 'utf8'),
    };
    const fixture = recompileInput(localInput).LocalUSDC!;
    assert.equal(
      bundle.contracts.LocalUSDC,
      undefined,
      'Fixture cannot enter production artifacts',
    );
    const receipts: {
      step: string;
      hash: Hex;
      blockNumber: string;
      blockHash: Hex;
      gasUsed: string;
    }[] = [];
    async function confirmed(step: string, hash: Hex) {
      const receipt = await evm.publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, 'success', step);
      assert.equal(
        (await evm.publicClient.getBlock({ blockNumber: receipt.blockNumber })).hash,
        receipt.blockHash,
        'Noncanonical receipt',
      );
      receipts.push({
        step,
        hash,
        blockNumber: String(receipt.blockNumber),
        blockHash: receipt.blockHash,
        gasUsed: String(receipt.gasUsed),
      });
      return receipt;
    }
    const fixtureReceipt = await confirmed(
      'deploy-local-USDC',
      await evm.wallet(owner).deployContract({
        abi: fixture.abi,
        bytecode: fixture.bytecode,
        args: [owner, 1_000_000_000n],
      }),
    );
    const asset = fixtureReceipt.contractAddress!;
    const head = await evm.publicClient.getBlock();
    const p: DeploymentParameters = {
      schemaVersion: 1,
      status: 'draft',
      targetChainId: 31337,
      deployer: owner,
      startNonce: String(await evm.publicClient.getTransactionCount({ address: owner })),
      token: {
        name: 'Local Test Token',
        symbol: 'TEST',
        capRaw: '1000000000000000000000000000',
        allocations: [{ recipient: owner, amountRaw: '1000000000000000000000000000' }],
      },
      campaign: {
        campaignId: keccak256(toHex('isolated-rehearsal')),
        budgetRaw: '1000000000000000000000000',
        deadline: Number(head.timestamp) + 86400,
        recovery: owner,
        members: [
          { address: alice, points: 50 },
          { address: bob, points: 25 },
        ],
      },
      treasury: {
        asset,
        assetDecimals: 6,
        operator: owner,
        reserveRaw: '80000000',
        dailyLimitRaw: '20000000',
        fundingRaw: '100000000',
        destinations: [alice],
      },
    };
    const plan = buildDeploymentPlan(p, Number(head.timestamp));
    const deployed: {
      contract: string;
      address: Address;
      creationInputHash: Hex;
      runtimeHash: Hex;
      runtimeTemplateMatched: boolean;
      immutableGettersVerified: boolean;
    }[] = [];
    async function read(
      artifact: Compiled,
      address: Address,
      functionName: string,
      args: unknown[] = [],
    ) {
      return evm.publicClient.readContract({ address, abi: artifact.abi, functionName, args });
    }
    for (const row of plan.deployments) {
      assert.equal(
        await evm.publicClient.getTransactionCount({ address: owner }),
        Number(row.nonce),
        'Deployment nonce changed; regenerate the plan and proofs',
      );
      const artifact = bundle.contracts[row.contract]!;
      const args = [...row.args];
      if (fault === 'wrong-constructor' && row.contract === 'CampaignClaims')
        args[3] = String(BigInt(p.campaign.budgetRaw) + 1n);
      const receipt = await confirmed(
        'deploy-' + row.contract,
        await evm.wallet(owner).deployContract({
          abi: artifact.abi,
          bytecode: artifact.bytecode,
          args,
          nonce: Number(row.nonce),
        }),
      );
      assert.equal(
        receipt.contractAddress?.toLowerCase(),
        row.address.toLowerCase(),
        'Deployment address mismatch',
      );
      const creation = await evm.publicClient.getTransaction({ hash: receipt.transactionHash });
      const expected = encodeDeployData({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: row.args,
      });
      assert.equal(creation.input, expected, 'Creation input mismatch');
      const code = await evm.publicClient.getBytecode({ address: row.address });
      assert.ok(code);
      compareRuntime(artifact.deployedBytecode, code, artifact.immutableReferences);
      deployed.push({
        contract: row.contract,
        address: row.address,
        creationInputHash: keccak256(expected),
        runtimeHash: keccak256(code),
        runtimeTemplateMatched: true,
        immutableGettersVerified: false,
      });
      if (fault === 'nonce-drift' && row.contract === 'ClubToken')
        await confirmed(
          'injected-local-nonce-drift',
          await evm.wallet(owner).sendTransaction({ to: owner, value: 0n }),
        );
    }
    const token = plan.deployments[0]!.address,
      claims = plan.deployments[1]!.address,
      treasury = plan.deployments[2]!.address;
    const club = bundle.contracts.ClubToken!,
      campaign = bundle.contracts.CampaignClaims!,
      budget = bundle.contracts.TreasuryBudget!;
    const addressEquals = (actual: unknown, expected: Address) =>
      assert.equal(String(actual).toLowerCase(), expected.toLowerCase());
    assert.equal(await read(club, token, 'cap'), BigInt(p.token.capRaw));
    assert.equal(await read(club, token, 'totalSupply'), BigInt(p.token.capRaw));
    assert.equal(await read(club, token, 'decimals'), 18);
    assert.equal(await read(club, token, 'name'), p.token.name);
    assert.equal(await read(club, token, 'symbol'), p.token.symbol);
    for (const row of p.token.allocations)
      assert.equal(await read(club, token, 'balanceOf', [row.recipient]), BigInt(row.amountRaw));
    addressEquals(await read(campaign, claims, 'token'), token);
    addressEquals(await read(campaign, claims, 'recovery'), p.campaign.recovery);
    assert.equal(await read(campaign, claims, 'merkleRoot'), plan.snapshot.root);
    assert.equal(await read(campaign, claims, 'campaignId'), p.campaign.campaignId);
    assert.equal(await read(campaign, claims, 'budget'), BigInt(p.campaign.budgetRaw));
    assert.equal(await read(campaign, claims, 'deadline'), BigInt(p.campaign.deadline));
    assert.equal(await read(campaign, claims, 'totalClaimed'), 0n);
    addressEquals(await read(budget, treasury, 'asset'), asset);
    addressEquals(await read(budget, treasury, 'operator'), p.treasury.operator);
    assert.equal(await read(budget, treasury, 'reserve'), BigInt(p.treasury.reserveRaw));
    assert.equal(await read(budget, treasury, 'dailyLimit'), BigInt(p.treasury.dailyLimitRaw));
    assert.equal(await read(budget, treasury, 'destinationAllowed', [alice]), true);
    assert.equal(await read(budget, treasury, 'destinationAllowed', [bob]), false);
    assert.equal(await read(fixture, asset, 'decimals'), 6);
    for (const row of deployed) row.immutableGettersVerified = true;
    const transfer = parseAbiItem(
      'event Transfer(address indexed from,address indexed to,uint256 value)',
    );
    async function write(
      step: string,
      artifact: Compiled,
      address: Address,
      functionName: string,
      args: unknown[],
      actor = owner,
    ) {
      return confirmed(
        step,
        await evm.wallet(actor).writeContract({ address, abi: artifact.abi, functionName, args }),
      );
    }
    async function transferChecked(
      step: string,
      artifact: Compiled,
      address: Address,
      to: Address,
      amount: bigint,
    ) {
      const before = (await read(artifact, address, 'balanceOf', [to])) as bigint;
      const receipt = await write(step, artifact, address, 'transfer', [to, amount]);
      const matches = receipt.logs
        .filter((log) => log.address.toLowerCase() === address.toLowerCase())
        .map((log) => decodeEventLog({ abi: [transfer], data: log.data, topics: log.topics }))
        .filter(
          (log) =>
            log.args.to.toLowerCase() === to.toLowerCase() &&
            log.args.from.toLowerCase() === owner.toLowerCase() &&
            log.args.value === amount,
        );
      assert.equal(matches.length, 1, 'Funding transfer event missing');
      assert.equal(await read(artifact, address, 'balanceOf', [to]), before + amount);
    }
    await transferChecked('fund-campaign', club, token, claims, BigInt(p.campaign.budgetRaw));
    await transferChecked(
      'fund-treasury-USDC',
      fixture,
      asset,
      treasury,
      BigInt(p.treasury.fundingRaw),
    );
    const denied: string[] = [];
    async function reject(
      step: string,
      artifact: Compiled,
      address: Address,
      functionName: string,
      args: unknown[],
      actor: Address,
      reason: RegExp,
    ) {
      await assert.rejects(
        evm.publicClient.simulateContract({
          address,
          abi: artifact.abi,
          functionName,
          args,
          account: actor,
        }),
        reason,
        step,
      );
      denied.push(step);
    }
    const purpose = keccak256(toHex('local-reviewed-cost'));
    await reject(
      'unauthorized-treasury-spend',
      budget,
      treasury,
      'spend',
      [alice, 1n, purpose],
      bob,
      /Not authorized/,
    );
    const leaf = plan.snapshot.claims.find(
      (row) => row.account.toLowerCase() === alice.toLowerCase(),
    )!;
    const claimArgs = [leaf.index, leaf.account, BigInt(leaf.amountRaw), leaf.proof];
    await reject(
      'claim-to-wrong-recipient',
      campaign,
      claims,
      'claim',
      [leaf.index, bob, BigInt(leaf.amountRaw), leaf.proof],
      bob,
      /Invalid proof/,
    );
    await write('claim-for-eligible-account', campaign, claims, 'claim', claimArgs, bob);
    assert.equal(await read(club, token, 'balanceOf', [alice]), BigInt(leaf.amountRaw));
    assert.equal(await read(club, token, 'balanceOf', [bob]), 0n);
    assert.equal(await read(campaign, claims, 'totalClaimed'), BigInt(leaf.amountRaw));
    await reject(
      'duplicate-claim',
      campaign,
      claims,
      'claim',
      claimArgs,
      bob,
      /Expired or claimed/,
    );
    await reject(
      'premature-recovery',
      campaign,
      claims,
      'recoverExpired',
      [],
      owner,
      /Recovery unavailable/,
    );
    await write('treasury-reviewed-cost', budget, treasury, 'spend', [alice, 10_000_000n, purpose]);
    assert.equal(await read(fixture, asset, 'balanceOf', [alice]), 10_000_000n);
    assert.equal(await read(budget, treasury, 'spent'), 10_000_000n);
    await reject(
      'daily-limit-exceeded',
      budget,
      treasury,
      'spend',
      [alice, 11_000_000n, purpose],
      owner,
      /Daily limit/,
    );
    await evm.connection.provider.request({
      method: 'evm_setNextBlockTimestamp',
      params: [p.campaign.deadline + 86401],
    });
    await evm.connection.provider.request({ method: 'evm_mine' });
    await reject(
      'reserve-floor-after-day-reset',
      budget,
      treasury,
      'spend',
      [alice, 11_000_000n, purpose],
      owner,
      /Reserve floor/,
    );
    const second = plan.snapshot.claims.find(
      (row) => row.account.toLowerCase() === bob.toLowerCase(),
    )!;
    await reject(
      'expired-claim',
      campaign,
      claims,
      'claim',
      [second.index, second.account, BigInt(second.amountRaw), second.proof],
      bob,
      /Expired or claimed/,
    );
    await reject(
      'unauthorized-recovery',
      campaign,
      claims,
      'recoverExpired',
      [],
      bob,
      /Recovery unavailable/,
    );
    const leftover = BigInt(p.campaign.budgetRaw) - BigInt(leaf.amountRaw),
      beforeRecovery = (await read(club, token, 'balanceOf', [owner])) as bigint;
    await write('recover-unclaimed-after-expiry', campaign, claims, 'recoverExpired', []);
    assert.equal(await read(club, token, 'balanceOf', [claims]), 0n);
    assert.equal(await read(club, token, 'balanceOf', [owner]), beforeRecovery + leftover);
    const finalHead = await evm.publicClient.getBlock();
    const reconciliation = await readTreasuryReceipts(evm.publicClient, {
      treasury,
      asset,
      expectedChainId: 31337,
      blocks: Number(finalHead.number - fixtureReceipt.blockNumber),
      minConfirmations: 1,
    });
    assert.equal(reconciliation.reconciled, true);
    assert.equal(reconciliation.decimals, 6);
    assert.equal(reconciliation.receivedRaw, '100000000');
    assert.equal(reconciliation.sentRaw, '10000000');
    assert.equal(reconciliation.closingBalanceRaw, '90000000');
    assert.equal(reconciliation.realizedRevenueRaw, null);
    return {
      scope: 'isolated local deployment rehearsal',
      chainId: 31337,
      fixtureParameters: true,
      publicChainUsed: false,
      userWalletUsed: false,
      mainnetDeployed: false,
      launchApproved: false,
      compilerInputHash: bundle.inputHash,
      localAssetFixture: {
        address: asset,
        decimals: 6,
        creationBytecodeHash: keccak256(fixture.bytecode),
      },
      plan,
      deployed,
      receipts,
      denied,
      reconciliation,
      balances: {
        claimedTokenRaw: leaf.amountRaw,
        recoveredUnclaimedTokenRaw: String(leftover),
        treasuryUsdcRaw: reconciliation.closingBalanceRaw,
      },
      independentAuditComplete: false,
      hyperEvmBehaviorVerified: false,
      protocolSettlementVerified: false,
    };
  } finally {
    await evm.close();
  }
}
