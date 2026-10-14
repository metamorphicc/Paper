'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isAddress, createWalletClient, custom, type Address, type Hex } from 'viem';
import {
  officialTypedData,
  type IntentType,
  type IntentMessage,
} from '../../../packages/protocol/intents';
import { hyperEvm } from '../../../packages/protocol/registry';
import { requestWallet } from '../../../packages/wallet/provider.js';
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
  dismissError: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  signOfficial: (type: IntentType, message: IntentMessage) => Promise<Hex>;
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
  const authority = useRef({
    address: null as string | null,
    chainId: null as number | null,
    generation: 0,
  });
  const dismissError = useCallback(() => setError(''), []);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(dismissError, 6000);
    return () => clearTimeout(timer);
  }, [error, dismissError]);
  function invalidate() {
    setError('');
    authority.current.generation++;
    setGeneration(authority.current.generation);
  }
  function accountChanged(value: unknown) {
    invalidate();
    const next =
      Array.isArray(value) && typeof value[0] === 'string' && isAddress(value[0])
        ? value[0].toLowerCase()
        : null;
    setAddress(next);
    authority.current.address = next;
    connected.current = !!next;
  }
  function chainChanged(value: unknown) {
    invalidate();
    setChain(
      typeof value === 'string' && /^0x[\da-f]+$/i.test(value) ? Number(BigInt(value)) : null,
    );
    authority.current.chainId =
      typeof value === 'string' && /^0x[\da-f]+$/i.test(value) ? Number(BigInt(value)) : null;
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
      authority.current.address = null;
      authority.current.chainId = null;
    };
    p.on?.('accountsChanged', accountChanged);
    p.on?.('chainChanged', chainChanged);
    p.on?.('disconnect', disconnected);
    let active = true;
    void Promise.all([
      requestWallet(p, { method: 'eth_accounts' }),
      requestWallet(p, { method: 'eth_chainId' }),
    ])
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
      const accounts = await requestWallet(p, { method: 'eth_requestAccounts' });
      accountChanged(accounts);
      chainChanged(await requestWallet(p, { method: 'eth_chainId' }));
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
        await requestWallet(p, {
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x3e7' }],
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await requestWallet(p, {
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
      chainChanged(await requestWallet(p, { method: 'eth_chainId' }));
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
        dismissError,
        connect,
        disconnect() {
          invalidate();
          setAddress(null);
          setChain(null);
          connected.current = false;
          authority.current.address = null;
          authority.current.chainId = null;
        },
        switchChain,
        async signOfficial(type, message) {
          const capture = { ...authority.current };
          const p = provider.current;
          if (
            !p ||
            !connected.current ||
            !capture.address ||
            capture.chainId !== 999 ||
            String(message.user).toLowerCase() !== capture.address
          )
            throw new Error('Connected HyperEVM wallet required');
          const ready = await fetch('/api/trading/readiness').then((response) => response.json());
          if (ready.enabled !== true)
            throw new Error('Live signing is unavailable until integration is verified');
          const check = () => {
            if (
              authority.current.generation !== capture.generation ||
              authority.current.address !== capture.address ||
              authority.current.chainId !== capture.chainId
            )
              throw new Error('Wallet changed while signing');
          };
          check();
          const signer = createWalletClient({
            account: capture.address as Address,
            chain: hyperEvm,
            transport: custom({
              request: (input) => requestWallet(p, input as { method: string; params?: unknown[] }),
            }),
          });
          const signature = await signer.signTypedData(officialTypedData(type, message));
          check();
          return signature;
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function WalletButton() {
  const wallet = useWallet();
  const pathname = usePathname();
  useEffect(() => wallet.dismissError(), [pathname, wallet.dismissError]);
  useEffect(() => {
    if (!wallet.error) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') wallet.dismissError();
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [wallet.error, wallet.dismissError]);
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
        <div className="wallet-error" role="alert">
          <span>{wallet.error}</span>
          <button
            className="wallet-error-dismiss"
            type="button"
            aria-label="Dismiss wallet message"
            onClick={wallet.dismissError}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
