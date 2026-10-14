'use client';
import { useState } from 'react';
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
        throw new Error('Для участия нужен browser wallet. Просмотр данных доступен без него.');
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const account = accounts[0];
      if (!account) throw new Error('Кошелёк не выбрал адрес.');
      const chain = await provider.request({ method: 'eth_chainId' });
      if (chain !== '0x3e7') throw new Error('Переключите кошелёк на HyperEVM (999).');
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
      const signature = await provider.request({
        method: 'personal_sign',
        params: [encoded, account],
      });
      const latest = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (
        latest[0]?.toLowerCase() !== account.toLowerCase() ||
        (await provider.request({ method: 'eth_chainId' })) !== '0x3e7'
      )
        throw new Error('Адрес или сеть изменились. Повторите действие.');
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
        `Начислено ${result.awarded} points. Всего: ${result.participant.total}. Рейтинг обновится после обновления страницы.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Действие не выполнено.');
    } finally {
      setBusy(false);
    }
  }
  const questions = [
    {
      title: 'Что означает queued profit?',
      values: [
        ['', 'Выберите ответ'],
        ['queued-is-cash', 'Доступные USDC'],
        ['queued-is-debt', 'Требование на будущую выплату'],
      ],
    },
    {
      title: 'Что происходит с выигрышем?',
      values: [
        ['', 'Выберите ответ'],
        ['profit-is-free', 'Выплачивается сырой PnL'],
        ['profit-is-adjusted', 'Применяются deadband, impact и fee'],
      ],
    },
    {
      title: 'Можно ли считать PAPER ликвидными USDC?',
      values: [
        ['', 'Выберите ответ'],
        ['paper-is-not-cash', 'Нет, это отдельный токен'],
        ['paper-is-cash', 'Да, по предполагаемой цене'],
      ],
    },
  ];
  return (
    <section className="panel">
      <h2>Founding community</h2>
      <p className="fine-print">
        До 70 points на адрес. Points не дают права на токены или доход. Подпись подтверждает
        участие только в этой локальной программе.
      </p>
      <div className="campaign-actions">
        <button className="button primary" onClick={() => void perform('join')} disabled={busy}>
          {busy ? 'Проверка…' : 'Участвовать · 10'}
        </button>
        <button className="button" onClick={() => void perform('track')} disabled={busy}>
          Мой адрес · 20
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
        Проверить знания · 40
      </button>
      {message && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
      {address && <p className="fine-print">Участник: {address}</p>}
    </section>
  );
}
