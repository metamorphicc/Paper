'use client';
import { useState } from 'react';
import { requestWallet } from '../../../packages/wallet/provider.js';
type Provider = { request(input: { method: string; params?: unknown[] }): Promise<unknown> };
export default function CampaignPanel() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [address, setAddress] = useState('');
  const [answers, setAnswers] = useState(['', '', '']);
  async function perform(action: 'join' | 'quiz' | 'track') {
    setBusy(true);
    setMessage('');
    try {
      const provider = (window as unknown as { ethereum?: Provider }).ethereum;
      if (!provider)
        throw new Error(
          'A browser wallet is required to participate. Public data is available without one.',
        );
      const accounts = (await requestWallet(provider, {
        method: 'eth_requestAccounts',
      })) as string[];
      const account = accounts[0];
      if (!account) throw new Error('No address selected by the wallet.');
      const chain = await requestWallet(provider, { method: 'eth_chainId' });
      if (chain !== '0x3e7') throw new Error('Switch your wallet to HyperEVM (999).');
      setAddress(account);
      const response = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'challenge', address: account, action }),
      });
      const challenge = await response.json();
      if (!response.ok) throw new Error(challenge.error);
      // EIP-191 local community proof; this does not request allowance or financial execution.
      const encoded =
        '0x' +
        [...new TextEncoder().encode(challenge.message)]
          .map((value) => value.toString(16).padStart(2, '0'))
          .join('');
      const signature = await requestWallet(provider, {
        method: 'personal_sign',
        params: [encoded, account],
      });
      const latest = (await requestWallet(provider, { method: 'eth_accounts' })) as string[];
      if (
        latest[0]?.toLowerCase() !== account.toLowerCase() ||
        (await requestWallet(provider, { method: 'eth_chainId' })) !== '0x3e7'
      )
        throw new Error('Address or network changed. Try again.');
      const claim = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'claim',
          id: challenge.id,
          signature,
          answers,
          trackedAddress: account,
        }),
      });
      const result = await claim.json();
      if (!claim.ok) throw new Error(result.error);
      setMessage(
        `Awarded ${result.awarded} points. Total: ${result.participant.total}. Refresh the page to update the leaderboard.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }
  const questions = [
    {
      title: 'What does queued profit mean?',
      values: [
        ['', 'Select an answer'],
        ['queued-is-cash', 'Spendable USDC'],
        ['queued-is-debt', 'A claim on a future payout'],
      ],
    },
    {
      title: 'What happens to a winning trade?',
      values: [
        ['', 'Select an answer'],
        ['profit-is-free', 'Raw PnL is paid in full'],
        ['profit-is-adjusted', 'Deadband, impact and fees apply'],
      ],
    },
    {
      title: 'Can PAPER be counted as liquid USDC?',
      values: [
        ['', 'Select an answer'],
        ['paper-is-not-cash', 'No, it is a separate token'],
        ['paper-is-cash', 'Yes, at an assumed price'],
      ],
    },
  ];
  return (
    <section className="panel">
      <h2>Founding community</h2>
      <p className="fine-print">
        {' '}
        Up to 70 points per address. Points do not grant token or income rights. Your signature
        confirms participation in this local campaign only.{' '}
      </p>
      <div className="campaign-actions">
        <button className="button primary" onClick={() => void perform('join')} disabled={busy}>
          {busy ? 'Verifying…' : 'Join · 10'}
        </button>
        <button className="button" onClick={() => void perform('track')} disabled={busy}>
          {' '}
          Track my address · 20{' '}
        </button>
      </div>
      <div className="quiz">
        {questions.map((question, index) => (
          <label key={question.title}>
            {question.title}
            <select
              value={answers[index]}
              onChange={(event) =>
                setAnswers((values) =>
                  values.map((value, i) => (i === index ? event.target.value : value)),
                )
              }
            >
              {question.values.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button
        className="button"
        onClick={() => void perform('quiz')}
        disabled={busy || answers.some((value) => !value)}
      >
        {' '}
        Check understanding · 40{' '}
      </button>
      {message && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
      {address && <p className="fine-print"> Participant: {address}</p>}
    </section>
  );
}
