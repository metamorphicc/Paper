import { createPublicClient, defineChain, http, type Address } from 'viem';

export const CHAIN_ID = 999;
export const hyperEvm = defineChain({
  id: 999,
  name: 'HyperEVM',
  nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.hyperliquid.xyz/evm'] } },
  blockExplorers: { default: { name: 'HyperEVMScan', url: 'https://hyperevmscan.io' } },
});
export const ADDRESSES = {
  Exchange: '0x6cd5661646289fb6e65ea5c032310fded797d0a2',
  BatchExecutor: '0x233ff29b239abc1d7748605da9b205c3e008626e',
  PaperToken: '0xe40f17915daa230324030003a197cdaef2261c0e',
  PaperStaking: '0xaad6c7b0cc3014fc80ffedae0ed7ce5967b0f016',
  PaperTokenomics: '0x75174549dbbd44497d31a47e2e2d7406408d63d9',
  SessionKeyManager: '0x8326eb8896e358717f10502ec73ce8d28e37b108',
  PriceOracle: '0xa9b4c7b7ca5835652d81e25739c870d49f39cc2e',
  DepositProxyFactory: '0x1629b7d46bef6e13ff754174fc9f32dea309b38f',
} as const satisfies Record<string, Address>;
export const IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
export function publicClient(
  rpcUrl = process.env.HYPEREVM_RPC_URL ?? 'https://rpc.hyperliquid.xyz/evm',
) {
  return createPublicClient({
    chain: hyperEvm,
    transport: http(rpcUrl, {
      timeout: 12_000,
      retryCount: 1,
    }),
  });
}
export function archiveClient() {
  const rpcUrl = process.env.HYPEREVM_ARCHIVE_RPC_URL;
  if (!rpcUrl) throw new Error('Historical state requires a separately configured archive RPC');
  return publicClient(rpcUrl);
}
