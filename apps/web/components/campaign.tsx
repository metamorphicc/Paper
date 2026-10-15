'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from './wallet';
import { validateParticipant, type Participant } from '../../../packages/community/proof.js';
import type { CampaignAction } from '../../../packages/community/constants.js';
async function campaignRequest(path: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    signal: signal ?? AbortSignal.timeout(20000),
    ...(body
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  const result = await response.json().catch(() => {
    throw new Error('Community could not be reached. Try again.');
  });
  if (!response.ok)
    throw new Error(
      typeof result.error === 'string' && result.error.length < 250
        ? result.error
        : 'Community could not be reached. Try again.',
    );
  return result;
}
export default function CampaignPanel() {
  const wallet = useWallet(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [answers, setAnswers] = useState(['', '', '']);
  const [participant, setParticipant] = useState<Participant | null>(null),
    [statusIssue, setStatusIssue] = useState(''),
    [refresh, setRefresh] = useState(0);
  const locked = useRef(false),
    requestVersion = useRef(0),
    latestWallet = useRef(wallet);
  latestWallet.current = wallet;
  useEffect(() => {
    const version = ++requestVersion.current,
      controller = new AbortController();
    setParticipant(null);
    setMessage('');
    setStatusIssue('');
    if (!wallet.address) return;
    const address = wallet.address;
    void campaignRequest('/api/campaign?address=' + address, undefined, controller.signal)
      .then((result) => {
        if (requestVersion.current === version)
          setParticipant(validateParticipant(result.participant, address));
      })
      .catch(() => {
        if (!controller.signal.aborted && requestVersion.current === version)
          setStatusIssue('Could not refresh your points.');
      });
    return () => controller.abort();
  }, [wallet.address, wallet.generation, refresh]);
  async function perform(action: CampaignAction) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try {
      const identity = await wallet.communityAccount();
      const challenge = await campaignRequest('/api/campaign', {
        operation: 'challenge',
        address: identity.address,
        action,
      });
      const signature = await latestWallet.current.signCommunity(identity, action, challenge);
      if (!latestWallet.current.isCurrent(identity))
        throw new Error('Wallet changed. Try the action again.');
      const result = await campaignRequest('/api/campaign', {
        operation: 'claim',
        id: challenge.id,
        signature,
        answers,
        trackedAddress: identity.address,
      });
      if (latestWallet.current.isCurrent(identity)) {
        ++requestVersion.current;
        setParticipant(validateParticipant(result.participant, identity.address));
        setStatusIssue('');
        setMessage(
          result.awarded === 0
            ? 'This action is already complete.'
            : `Added ${result.awarded} points.`,
        );
      }
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Action could not be completed. Try again.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const completed = participant?.completed ?? [],
    joined = completed.includes('join');
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
    <section className="panel" aria-labelledby="community-title">
      <h2 id="community-title">Founding community</h2>
      <p className="fine-print">
        Up to 70 points per address. Points do not grant token or income rights. Your signature
        confirms participation in this campaign only.
      </p>
      {participant && (
        <div className="campaign-progress">
          <strong>
            Your points <span>{participant.total} / 70</span>
          </strong>
          <progress aria-label="Campaign progress" value={participant.total} max={70} />
        </div>
      )}
      <div className="campaign-actions">
        <button
          className="button primary"
          onClick={() => void perform('join')}
          disabled={busy || wallet.busy || joined}
        >
          {busy ? 'Verifying…' : joined ? 'Joined · 10' : 'Join · 10'}
        </button>
        <button
          className="button"
          onClick={() => void perform('track')}
          disabled={busy || wallet.busy || !joined || completed.includes('track')}
        >
          {completed.includes('track') ? 'Address tracked · 20' : 'Track my address · 20'}
        </button>
        {wallet.address && wallet.chainId !== 999 && (
          <button
            className="button"
            onClick={() => void wallet.switchChain()}
            disabled={busy || wallet.busy}
          >
            Switch to HyperEVM
          </button>
        )}
      </div>
      {statusIssue && (
        <p role="status" className="feedback">
          {statusIssue}{' '}
          <button className="text-link" onClick={() => setRefresh((value) => value + 1)}>
            Refresh points
          </button>
        </p>
      )}
      <div className="quiz">
        {questions.map((question, index) => (
          <label key={question.title}>
            {question.title}
            <select
              value={answers[index]}
              disabled={busy || completed.includes('quiz')}
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
        disabled={
          busy ||
          wallet.busy ||
          !joined ||
          answers.some((value) => !value) ||
          completed.includes('quiz')
        }
      >
        {completed.includes('quiz') ? 'Completed · 40' : 'Check understanding · 40'}
      </button>
      {message && (
        <p className="feedback" role="status">
          {message}
          <button
            type="button"
            className="wallet-error-dismiss"
            aria-label="Dismiss participation message"
            onClick={() => setMessage('')}
          >
            ×
          </button>
        </p>
      )}
      {wallet.address && <p className="fine-print">Participant: {wallet.address}</p>}
    </section>
  );
}
