'use client';
import { useRef, useState } from 'react';
import { inspectClaim } from '../../../packages/rewards/inspect.js';
export default function ClaimInspector() {
  const [file, setFile] = useState<unknown>(null),
    [address, setAddress] = useState(''),
    [message, setMessage] = useState('');
  const selection = useRef(0);
  function inspect() {
    try {
      const result = inspectClaim(file, address);
      setMessage(
        `Proof matches this manifest. Raw token amount: ${result.amountRaw}. Chain ${result.domain.chainId}; contract ${result.domain.claimContract}. Funding and campaign approval are not verified by this file.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not verify this manifest.');
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
            const version = ++selection.current;
            setFile(null);
            setMessage('');
            const selected = event.target.files?.[0];
            if (!selected) return;
            if (selected.size > 2_000_000) {
              setMessage('File exceeds 2 MB.');
              return;
            }
            try {
              const value = JSON.parse(await selected.text());
              if (selection.current === version) setFile(value);
            } catch {
              if (selection.current === version)
                setMessage('Select a valid JSON campaign manifest.');
            }
          }}
        />
      </label>
      <label>
        Account address
        <input
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setMessage('');
          }}
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
