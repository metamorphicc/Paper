import { defineConfig } from 'hardhat/config';

export default defineConfig({
  defaultNetwork: 'local',
  networks: {
    local: { type: 'edr-simulated', chainType: 'l1', chainId: 31337, hardfork: 'cancun' },
  },
});
