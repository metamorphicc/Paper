# Token and treasury proposals

Paperclub / CLUB and a cap of 1 billion tokens are draft test parameters. The user has not selected launch parameters. The token is independent of PAPER and gives no rights to Papertrade fees, staking USDC or guaranteed returns.

| Proposal | Community | Liquidity | Treasury | Reserve |
|---|---:|---:|---:|---:|
| Community first | 600 million | 200 million | 100 million | 100 million |
| Liquidity first | 500 million | 300 million | 100 million | 100 million |
| Community only | 800 million | 200 million | 0 | 0 |

All scenarios total 1 billion. Builder revenue is zero in every budget. Community first is the working test scenario; it is not approved for launch. The deploy constructor requires explicit nonzero recipients and allocations whose sum equals the cap. Full supply is minted once; no privileged mint, transfer tax or upgrade path. Holder burn is optional. Treasury/reward contracts have their own narrowly scoped permissions; token holders do not acquire control over the protocol.

Initial liquidity and the campaign budget remain unknown. For an illustrative pool containing 200 million CLUB, 10,000 / 25,000 / 50,000 USDC implies an initial ratio of $0.00005 / $0.000125 / $0.00025 per token. These are arithmetic scenarios, not price estimates, funding commitments or available cash. Market value, executable price and capital recovery are unestablished.

Points do not automatically become token claims. Each token campaign needs explicit eligibility, a funded budget, fixed block/hash, cut-off, claim deadline and review of sybil abuse. The signed campaign ledger is the eligibility input; public PAPER mint rankings are excluded. Integer allocation rounds down, then distributes residual units deterministically by address. Anyone can reproduce the Merkle root from the published manifest.

Claims use an immutable root and token address, bind each leaf to chain ID, claim contract, campaign, index, account and amount, and prevent replay. Claim funds always go to the leaf's account. Unclaimed tokens can be recovered only after expiry by the declared recovery address. Claim contracts do not mint tokens or accept user funds. This requires sufficient pre-funding and published recovery rights; it is not described as a fair launch.

Deployment is restricted to an in-process local chain (31337) for this work. Compilation and tests use [OpenZeppelin ERC20](https://docs.openzeppelin.com/contracts/5.x/erc20), [MerkleProof](https://docs.openzeppelin.com/contracts/5.x/api/utils#MerkleProof) and [Hardhat simulated networks](https://hardhat.org/docs/reference/configuration). Local EVM results do not establish HyperEVM deployment safety or Papertrade contract-wallet compatibility.

Open decisions: final brand/cap/allocation, campaign budget and rules, actual multisig/recipient/recovery addresses, liquidity USDC, custody/admin policy, jurisdiction and independent audit. Mainnet deploy and public claims remain disabled until these decisions and checks are recorded.
