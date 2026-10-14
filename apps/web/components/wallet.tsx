'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isAddress } from 'viem';
type Provider = {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, callback: (value: unknown) => void): void;
  removeListener?(event: string, callback: (value: unknown) => void): void;
};
type Wallet = {
  address: string | null;
  chainId: number | null;
  generation: number;
  busy: boolean;
  error: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
};
const Context = createContext<Wallet | null>(null);
export function useWallet() {
  const wallet = useContext(Context);
  if (!wallet) throw new Error('WalletProvider missing');
  return wallet;
}
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null),
    [chainId, setChain] = useState<number | null>(null),
    [generation, setGeneration] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const provider = useRef<Provider | undefined>(undefined);
  const connected = useRef(false);
  function invalidate() {
    setGeneration((value) => value + 1);
  }
  function accountChanged(value: unknown) {
    invalidate();
    const next =
      Array.isArray(value) && typeof value[0] === 'string' && isAddress(value[0])
        ? value[0].toLowerCase()
        : null;
    setAddress(next);
    connected.current = !!next;
  }
  function chainChanged(value: unknown) {
    invalidate();
    setChain(
      typeof value === 'string' && /^0x[\da-f]+$/i.test(value) ? Number(BigInt(value)) : null,
    );
  }
  useEffect(() => {
    provider.current = (window as unknown as { ethereum?: Provider }).ethereum;
    const p = provider.current;
    if (!p) return;
    const disconnected = () => {
      invalidate();
      setAddress(null);
      setChain(null);
      connected.current = false;
    };
    p.on?.('accountsChanged', accountChanged);
    p.on?.('chainChanged', chainChanged);
    p.on?.('disconnect', disconnected);
    let active = true;
    void Promise.all([p.request({ method: 'eth_accounts' }), p.request({ method: 'eth_chainId' })])
      .then(([accounts, chain]) => {
        if (active) {
          accountChanged(accounts);
          chainChanged(chain);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      p.removeListener?.('accountsChanged', accountChanged);
      p.removeListener?.('chainChanged', chainChanged);
      p.removeListener?.('disconnect', disconnected);
    };
  }, []);
  async function connect() {
    setBusy(true);
    setError('');
    try {
      const p = provider.current;
      if (!p)
        throw new Error('No browser wallet found. Install a wallet or use the local account.');
      const accounts = await p.request({ method: 'eth_requestAccounts' });
      accountChanged(accounts);
      chainChanged(await p.request({ method: 'eth_chainId' }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Wallet is not connected.');
    } finally {
      setBusy(false);
    }
  }
  async function switchChain() {
    setBusy(true);
    setError('');
    try {
      const p = provider.current;
      if (!p) throw new Error('Wallet is unavailable.');
      try {
        await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x3e7' }] });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x3e7',
              chainName: 'HyperEVM',
              nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
              rpcUrls: ['https://rpc.hyperliquid.xyz/evm'],
              blockExplorerUrls: ['https://hyperevmscan.io'],
            },
          ],
        });
      }
      chainChanged(await p.request({ method: 'eth_chainId' }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Network was not switched.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        address,
        chainId,
        generation,
        busy,
        error,
        connect,
        disconnect() {
          invalidate();
          setAddress(null);
          setChain(null);
          connected.current = false;
        },
        switchChain,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function WalletButton() {
  const wallet = useWallet();
  return (
    <div className="wallet-control">
      <button
        className="button small"
        onClick={() =>
          void (wallet.address && wallet.chainId !== 999
            ? wallet.switchChain()
            : wallet.address
              ? wallet.disconnect()
              : wallet.connect())
        }
        disabled={wallet.busy}
      >
        {wallet.busy
          ? 'Connecting…'
          : wallet.address
            ? wallet.chainId !== 999
              ? 'HyperEVM'
              : `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
            : 'Connect'}
      </button>
      {wallet.error && (
        <span className="wallet-error" role="alert">
          {wallet.error}
        </span>
      )}
    </div>
  );
}
