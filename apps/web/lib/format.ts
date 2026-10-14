import { formatUnits } from 'viem';
export function amount(
  raw: string | null | undefined,
  kind: 'usd' | 'paper' = 'usd',
  compact = true,
) {
  if (raw === null || raw === undefined) return '—';
  try {
    const value = Number(formatUnits(BigInt(raw), 18));
    return new Intl.NumberFormat('en-US', {
      ...(kind === 'usd' ? { style: 'currency' as const, currency: 'USD' } : {}),
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 2 : kind === 'usd' ? 2 : 4,
    }).format(value);
  } catch {
    return '—';
  }
}
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function localTime(utc: string | number) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Novosibirsk',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(utc));
}
