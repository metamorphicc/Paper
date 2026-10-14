export const capabilities = [
  {
    id: 'read',
    title: 'Публичные данные',
    status: 'available',
    reason: 'RPC + узкие read-only ABI; происхождение каждого поля сохранено.',
  },
  {
    id: 'history',
    title: 'История PAPER',
    status: 'available',
    reason: 'Стандартный Transfer; trade events пока без подтверждённой схемы.',
  },
  {
    id: 'trade',
    title: 'Live trading',
    status: 'blocked',
    reason:
      'Browser EIP-712 и /intents найдены; source equivalence, third-party access и settlement не проверены.',
  },
  {
    id: 'staking',
    title: 'Live staking',
    status: 'blocked',
    reason: 'Browser schema найдена; current domain и third-party write path требуют проверки.',
  },
  {
    id: 'builder',
    title: 'Builder revenue',
    status: 'planned',
    reason: 'В документации Coming soon; доход в модели равен нулю.',
  },
  {
    id: 'contract-wallet',
    title: 'Contract wallets / vault',
    status: 'unverified',
    reason: 'Нет подтверждения EIP-1271 и полного deposit/withdraw lifecycle.',
  },
  {
    id: 'sandbox',
    title: 'Локальный терминал',
    status: 'available',
    reason: 'Mock settlement и lifecycle; никаких реальных средств.',
  },
] as const;
export function assertLiveSubmissionAllowed(): never {
  throw new Error(
    'Live submission blocked: third-party relayer access, source equivalence and settlement are unverified.',
  );
}
