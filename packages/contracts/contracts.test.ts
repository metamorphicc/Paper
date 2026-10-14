import test from 'node:test';
import assert from 'node:assert/strict';
import { getContractAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import { compileContracts } from './compiler.js';
import { localEvm } from './local.js';
import { createSnapshot, verifyClaim } from '../rewards/snapshot.js';

type Evm = Awaited<ReturnType<typeof localEvm>>;
async function deploy(evm: Evm, name: string, args: unknown[]) {
  const artifact = compileContracts()[name]!;
  const hash = await evm
    .wallet(evm.accounts[0]!)
    .deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args });
  const receipt = await evm.publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success');
  assert.ok(receipt.contractAddress);
  return receipt.contractAddress;
}
async function write(
  evm: Evm,
  name: string,
  address: Address,
  functionName: string,
  args: unknown[],
  actor = evm.accounts[0]!,
) {
  const hash = await evm
    .wallet(actor)
    .writeContract({ address, abi: compileContracts()[name]!.abi, functionName, args });
  const receipt = await evm.publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success');
}
async function read(
  evm: Evm,
  name: string,
  address: Address,
  functionName: string,
  args: unknown[] = [],
) {
  return evm.publicClient.readContract({
    address,
    abi: compileContracts()[name]!.abi,
    functionName,
    args,
  });
}

test('fixed token allocations conserve cap, reject invalid supply and have no privileged mint', async () => {
  const evm = await localEvm();
  try {
    const [owner, recipient] = evm.accounts as [Address, Address];
    await assert.rejects(deploy(evm, 'ClubToken', ['Paperclub', 'CLUB', 1000n, [owner], [999n]]));
    const token = await deploy(evm, 'ClubToken', [
      'Paperclub',
      'CLUB',
      1000n,
      [owner, recipient],
      [600n, 400n],
    ]);
    assert.equal(await read(evm, 'ClubToken', token, 'totalSupply'), 1000n);
    assert.equal(await read(evm, 'ClubToken', token, 'balanceOf', [recipient]), 400n);
    await write(evm, 'ClubToken', token, 'transfer', [recipient, 100n]);
    assert.equal(await read(evm, 'ClubToken', token, 'balanceOf', [recipient]), 500n);
    await write(evm, 'ClubToken', token, 'burn', [10n], recipient);
    assert.equal(await read(evm, 'ClubToken', token, 'totalSupply'), 990n);
    assert.equal(await read(evm, 'ClubToken', token, 'cap'), 1000n);
    assert.ok(
      !compileContracts().ClubToken!.abi.some(
        (item) =>
          item.type === 'function' && ['mint', 'setTax', 'upgradeTo', 'owner'].includes(item.name),
      ),
    );
  } finally {
    await evm.close();
  }
});

test('funded immutable claims pay only the leaf account and reject replay, wrong proofs and premature recovery', async () => {
  const evm = await localEvm();
  try {
    const [owner, alice, bob, attacker] = evm.accounts as [Address, Address, Address, Address];
    const token = await deploy(evm, 'ClubToken', ['Paperclub', 'CLUB', 1000n, [owner], [1000n]]);
    const nonce = await evm.publicClient.getTransactionCount({ address: owner });
    const predicted = getContractAddress({ from: owner, nonce: BigInt(nonce) });
    const campaignId = keccak256(toHex('local-campaign-test'));
    const snapshot = createSnapshot(
      [
        { address: alice, points: 10 },
        { address: bob, points: 20 },
      ],
      300n,
      { chainId: 31337, claimContract: predicted, campaignId },
    );
    const deadline = (await evm.publicClient.getBlock()).timestamp + 1000n;
    const claims = await deploy(evm, 'CampaignClaims', [
      token,
      snapshot.root,
      campaignId,
      300n,
      deadline,
      owner,
    ]);
    assert.equal(claims.toLowerCase(), predicted.toLowerCase());
    const leaf = snapshot.claims.find((row) => row.account === alice.toLowerCase())!;
    assert.ok(verifyClaim(snapshot.root, leaf));
    await assert.rejects(
      write(
        evm,
        'CampaignClaims',
        claims,
        'claim',
        [leaf.index, alice, BigInt(leaf.amountRaw), leaf.proof],
        attacker,
      ),
    );
    assert.equal(
      await read(evm, 'CampaignClaims', claims, 'claimed', [leaf.index]),
      false,
      'underfunded failure must not consume claim',
    );
    await write(evm, 'ClubToken', token, 'transfer', [claims, 300n]);
    await assert.rejects(
      write(
        evm,
        'CampaignClaims',
        claims,
        'claim',
        [leaf.index, attacker, BigInt(leaf.amountRaw), leaf.proof],
        attacker,
      ),
    );
    await write(
      evm,
      'CampaignClaims',
      claims,
      'claim',
      [leaf.index, alice, BigInt(leaf.amountRaw), leaf.proof],
      attacker,
    );
    assert.equal(await read(evm, 'ClubToken', token, 'balanceOf', [alice]), 100n);
    assert.equal(await read(evm, 'ClubToken', token, 'balanceOf', [attacker]), 0n);
    await assert.rejects(
      write(evm, 'CampaignClaims', claims, 'claim', [leaf.index, alice, 100n, leaf.proof]),
    );
    await assert.rejects(write(evm, 'CampaignClaims', claims, 'recoverExpired', []));
    await evm.connection.provider.request({
      method: 'evm_setNextBlockTimestamp',
      params: [Number(deadline) + 1],
    });
    await evm.connection.provider.request({ method: 'evm_mine' });
    const other = snapshot.claims.find((row) => row.account === bob.toLowerCase())!;
    await assert.rejects(
      write(evm, 'CampaignClaims', claims, 'claim', [
        other.index,
        bob,
        BigInt(other.amountRaw),
        other.proof,
      ]),
    );
    await assert.rejects(write(evm, 'CampaignClaims', claims, 'recoverExpired', [], attacker));
    await write(evm, 'CampaignClaims', claims, 'recoverExpired', []);
    assert.equal(await read(evm, 'ClubToken', token, 'balanceOf', [claims]), 0n);
    assert.equal(await read(evm, 'ClubToken', token, 'balanceOf', [owner]), 900n);
  } finally {
    await evm.close();
  }
});

test('treasury enforces immutable operator, destinations, daily limit and liquid reserve', async () => {
  const evm = await localEvm();
  try {
    const [owner, destination, attacker] = evm.accounts as [Address, Address, Address];
    const token = await deploy(evm, 'ClubToken', ['Test USDC', 'USDC', 1000n, [owner], [1000n]]);
    const treasury = await deploy(evm, 'TreasuryBudget', [token, owner, 80n, 20n, [destination]]);
    const purpose = keccak256(toHex('reviewed-cost'));
    await write(evm, 'ClubToken', token, 'transfer', [treasury, 100n]);
    await assert.rejects(
      write(evm, 'TreasuryBudget', treasury, 'spend', [destination, 1n, purpose], attacker),
    );
    await assert.rejects(write(evm, 'TreasuryBudget', treasury, 'spend', [attacker, 1n, purpose]));
    await write(evm, 'TreasuryBudget', treasury, 'spend', [destination, 15n, purpose]);
    await assert.rejects(
      write(evm, 'TreasuryBudget', treasury, 'spend', [destination, 6n, purpose]),
    );
    assert.equal(await read(evm, 'ClubToken', token, 'balanceOf', [destination]), 15n);
    await evm.connection.provider.request({ method: 'evm_increaseTime', params: [86401] });
    await evm.connection.provider.request({ method: 'evm_mine' });
    await assert.rejects(
      write(evm, 'TreasuryBudget', treasury, 'spend', [destination, 6n, purpose]),
    );
    await write(evm, 'TreasuryBudget', treasury, 'spend', [destination, 5n, purpose]);
    assert.equal(await read(evm, 'ClubToken', token, 'balanceOf', [treasury]), 80n);
  } finally {
    await evm.close();
  }
});
