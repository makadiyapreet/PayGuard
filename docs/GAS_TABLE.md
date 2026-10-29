# PayGuard Gas Consumption Benchmarks

| Operation | Gas Used | Estimated Cost @ 2.5 Gwei (ETH) |
|---|---|---|
| `deposit (2 ETH)` | 495,504 | 0.001239 ETH |
| `execute (normal)` | 201,862 | 0.000505 ETH |
| `execute (large -> Verified)` | 142,577 | 0.000356 ETH |
| `finalizeLarge` | 80,402 | 0.000201 ETH |
| `redeem (1 pgETH)` | 125,938 | 0.000315 ETH |
| `raiseAlert` | 188,728 | 0.000472 ETH |
| `submitProposal` | 214,944 | 0.000537 ETH |
| `executeProposal (resolving alert)` | 269,328 | 0.000673 ETH |

*Measurements conducted on Ganache local testnet (EVM: Paris, Optimizer: enabled with 200 runs).*
