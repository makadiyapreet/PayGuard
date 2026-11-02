# PayGuard Gas Consumption Benchmarks

| Operation | Gas Used | Estimated Cost @ 2.5 Gwei (ETH) |
|---|---|---|
| `deposit (2 ETH)` | 539,781 | 0.001349 ETH |
| `execute (normal)` | 202,060 | 0.000505 ETH |
| `execute (large -> Verified)` | 142,752 | 0.000357 ETH |
| `finalizeLarge` | 80,507 | 0.000201 ETH |
| `redeem (1 pgETH)` | 125,998 | 0.000315 ETH |
| `raiseAlert` | 188,728 | 0.000472 ETH |
| `submitProposal` | 214,944 | 0.000537 ETH |
| `executeProposal (resolving alert)` | 269,328 | 0.000673 ETH |

*Measurements conducted on Ganache local testnet (EVM: Paris, Optimizer: enabled with 200 runs).*
