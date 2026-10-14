export type WalletProvider = {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
};
export class WalletRequestError extends Error {
  constructor(readonly code: number | undefined) {
    super(
      code === 4001
        ? 'Wallet request declined.'
        : code === -32002
          ? 'A wallet request is already pending.'
          : code === 4900
            ? 'Wallet disconnected.'
            : code === 4901
              ? 'Wallet is on a different network.'
              : code === 4902
                ? 'Requested network is not added to the wallet.'
                : 'Wallet request failed. Check your wallet and try again.',
    );
  }
}
export async function requestWallet(
  provider: WalletProvider,
  input: { method: string; params?: unknown[] },
) {
  try {
    return await provider.request(input);
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'number'
        ? error.code
        : undefined;
    throw new WalletRequestError(code);
  }
}
