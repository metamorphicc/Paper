'use client';
import { useState } from 'react';
import { isAddress, type Address, type Hex } from 'viem';
import {
  claimLeaf,
  verifyClaim,
  type Claim,
  type SnapshotDomain,
} from '../../../packages/rewards/snapshot.js';
import { amount } from '../lib/format';
export default function ClaimInspector() {
  const [file, setFile] = useState<unknown>(null),
    [address, setAddress] = useState(''),
    [message, setMessage] = useState('');
  function inspect() {
    try {
      if (!isAddress(address)) throw new Error('Enter a valid account address.');
      if (!file || typeof file !== 'object') throw new Error('Select a campaign manifest first.');
      const manifest = file as { domain: SnapshotDomain; root: Hex; claims: Claim[] };
      if (
        !/^0x[\da-f]{64}$/i.test(manifest.root) ||
        !Array.isArray(manifest.claims) ||
        manifest.claims.length > 100000 ||
        !manifest.domain ||
        !Number.isSafeInteger(manifest.domain.chainId) ||
        manifest.domain.chainId <= 0 ||
        !isAddress(manifest.domain.claimContract) ||
        !/^0x[\da-f]{64}$/i.test(manifest.domain.campaignId)
      )
        throw new Error('Invalid manifest schema.');
      const matches = manifest.claims.filter(
        (row) =>
          typeof row.account === 'string' && row.account.toLowerCase() === address.toLowerCase(),
      );
      if (matches.length !== 1)
        throw new Error('No unique claim for this address in the manifest.');
      const row = matches[0]!;
      if (
        !Number.isSafeInteger(row.index) ||
        row.index < 0 ||
        !/^\d+$/.test(row.amountRaw) ||
        BigInt(row.amountRaw) <= 0n ||
        !Array.isArray(row.proof) ||
        row.proof.length > 64 ||
        row.proof.some((hash) => !/^0x[\da-f]{64}$/i.test(hash))
      )
        throw new Error('Invalid claim schema.');
      const leaf = claimLeaf(manifest.domain, row.index, address as Address, BigInt(row.amountRaw));
      if (!verifyClaim(manifest.root, { ...row, leaf }))
        throw new Error('Proof does not match the declared root.');
      setMessage(
        `Proof matches this manifest: ${amount(row.amountRaw, 'paper', false)} tokens. Chain ${manifest.domain.chainId}; contract ${manifest.domain.claimContract}. This does not verify funding, contract deployment, campaign approval or token rights.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not inspect manifest.');
    }
  }
  return (
    <section className="panel">
      <h2>Inspect a claim manifest</h2>
      <p>
        Verify a local proof without connecting a wallet. Files stay in this browser. A valid proof
        alone does not establish an approved or funded campaign.
      </p>
      <label>
        Campaign JSON
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (event) => {
            setFile(null);
            setMessage('');
            try {
              const selected = event.target.files?.[0];
              if (!selected) return;
              if (selected.size > 2_000_000) throw new Error('File exceeds 2 MB.');
              setFile(JSON.parse(await selected.text()));
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Invalid file.');
            }
          }}
        />
      </label>
      <label>
        Account address
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="0x…"
          spellCheck={false}
        />
      </label>
      <div className="campaign-actions">
        <button className="button" onClick={inspect}>
          Verify proof
        </button>
        <button className="button" disabled>
          Live claims disabled
        </button>
      </div>
      {message && (
        <p role="status" className="feedback">
          {message}
        </p>
      )}
    </section>
  );
}
