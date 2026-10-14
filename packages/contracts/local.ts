import hre from 'hardhat';
import { createPublicClient, createWalletClient, custom, defineChain, type Address } from 'viem';
export async function localEvm() {
  const connection = await hre.network.create('local');
  const chainId = Number(await connection.provider.request({ method: 'eth_chainId' }));
  if (chainId !== 31337) {
    await connection.close();
    throw new Error('Local EVM only');
  }
  const accounts = (await connection.provider.request({ method: 'eth_accounts' })) as Address[];
  const chain = defineChain({
    id: 31337,
    name: 'Paperclub Local Tests',
    nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [] } },
  });
  const transport = custom(connection.provider);
  return {
    connection,
    accounts,
    publicClient: createPublicClient({ chain, transport }),
    wallet: (account: Address) => createWalletClient({ account, chain, transport }),
    close: () => connection.close(),
  };
}
