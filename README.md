# EmissionsMRV: On-Chain GHG Emissions Register

A tamper evident register for greenhouse gas (GHG) emissions Monitoring, Reporting and
Verification (MRV), built as a Solidity smart contract and deployed to the Ethereum Sepolia
test network.

**The problem.** Emissions reports are self reported, hard to audit after the fact and easy
to quietly revise. Carbon tax, carbon credits and climate linked finance all depend on those
numbers being trustworthy.

**The approach.** Facilities submit a hash of each emissions report on chain, independent
verifiers sign off on records, and anyone can check a report against what was submitted.
The report itself stays off chain, so commercially sensitive data is never made public.

**Highlights**
- Role based access control for regulator, facility operator, reporter and verifier
- 22 Hardhat tests covering permissions, submissions and verification
- Deployed and source verified on Sepolia, with measured gas costs
- A no build front end dApp that connects through MetaMask

Built during my MCom in Financial Technology at Wits (Blockchain and Cryptocurrencies, 2026).

## Contents

```
contracts/EmissionsMRV.sol   Main smart contract
test/EmissionsMRV.test.js    Hardhat/Mocha/Chai test suite (22 tests)
frontend/index.html          Front-end dApp (plain HTML/JS + ethers.js, no build step)
hardhat.config.js            Hardhat configuration
package.json                 Dependencies for compiling and testing
```

## Deployed contract

| Item | Value |
|---|---|
| Network | Sepolia (chain ID 11155111) |
| Contract address | `0x84abB842204f0eBf0EE01E9f9a3f7A6019fb1084` |
| Deployment transaction hash | `0xe65cea66c6bbe7446885e9d8a8c3d4d44e4056d1d6a50cf9911e471842b46cce` |
| Deployment block | 11562539 |
| Etherscan | https://sepolia.etherscan.io/address/0x84abB842204f0eBf0EE01E9f9a3f7A6019fb1084 |
| Source verified | Yes - the Contract tab on Etherscan shows the verified source |

`contracts/EmissionsMRV.sol` in this repository is byte-for-byte the source compiled and
deployed to the address above. The verified source on the Etherscan Contract tab can be
compared against it directly.

### Measured gas costs on Sepolia

| Operation | Cost (ETH) |
|---|---|
| Contract deployment | 0.00644586 |
| `registerFacility` | 0.00041237 |
| `setVerifier` | 0.00012169 |

The one-off deployment dominates; recurring MRV operations are individually cheap.

## How the deployed contract was created

The contract at the address above was compiled and deployed through the
[Remix IDE](https://remix.ethereum.org) with MetaMask as the signing wallet:

1. `contracts/EmissionsMRV.sol` was compiled with Solidity **0.8.20**, optimizer
   **disabled**, targeting the Sepolia network.
2. Remix's **Deploy & Run** panel was set to `Injected Provider - MetaMask`, with the
   wallet connected to Sepolia (chain ID 11155111).
3. The deploying account became the contract's `regulator`, since the constructor
   assigns that role to `msg.sender`.
4. The source was published to Etherscan at deployment, so the verified source on the
   Contract tab can be compared against this repository.

## Reproducing the build locally

To compile and run the test suite against a local Hardhat network:

```bash
npm install
npx hardhat compile
npx hardhat test
```

`hardhat.config.js` pins Solidity 0.8.20 with the optimizer disabled, matching the
compiler version and optimizer setting used for the deployment. Note that Hardhat
defaults to the `paris` EVM target while Remix used its own default, so the two builds
produce functionally identical contracts but not byte-identical output - the verified
source on Etherscan, rather than a local recompile, is the reference for what is
deployed.

The test suite runs against Hardhat's in-process network, so no RPC endpoint or funded
key is needed to verify the contract's behaviour.

## Front-end dApp

`frontend/index.html` is a single self-contained HTML file (no build step, no npm
install) that gives every role a UI instead of Remix's raw function list: register a
facility, appoint/revoke verifiers, authorise/revoke reporters, submit an emission
record (with a built-in hash tool for text or files), verify a record, and look up any
facility/record as a member of the public. It uses [ethers.js v6](https://docs.ethers.org/v6/)
loaded from a CDN and talks directly to MetaMask - there is no backend server.

Running it:

1. **Serve it over HTTP** - from inside `frontend/`, run `python -m http.server 8000`
   and open `http://localhost:8000`. Opening the file directly via `file://` does not
   work: Chrome gives `file://` pages a `null` origin, which breaks the `postMessage`
   channel MetaMask uses to talk to the page, so the wallet is never detected.
2. Click **Connect Wallet** and confirm the network pill reads "Sepolia ✓" - the
   **Switch to Sepolia** button prompts MetaMask to change network if not.
3. Paste the contract address into the box at the top and click **Load Contract**. The
   status tiles then show the regulator, the facility and record counts, and which
   roles the connected account holds.

The address is not persisted anywhere - it is re-entered on each page load, and the page
stores no wallet data.

## Roles in the contract

| Role | Set by | Can do |
|---|---|---|
| **Regulator** (admin) | Deployer address (constructor) | `registerFacility`, `setVerifier` (appoint or remove an auditor), `setReporter` for any facility |
| **Facility operator** | Named by the regulator at registration | `submitEmissionRecord` for its facility, and `setReporter` to add/remove that facility's other reporters |
| **Reporter** | The regulator, or that facility's operator | `submitEmissionRecord` for that one facility only - cannot manage other reporters |
| **Verifier / auditor** | Regulator | `verifyEmissionRecord` - mark a record independently verified (cannot alter the submitted data) |
| **Public / anyone** | - | `getFacility`, `getEmissionRecord`, `getFacilityRecords` and the full event log - no role required |

The appoint/remove pairs are single functions taking a boolean (`setVerifier(addr, true)` appoints,
`setVerifier(addr, false)` removes), which keeps the authorisation surface to one code path per role
instead of two near-identical ones.

## Why only a hash is stored on-chain

Full emissions reports (raw sensor logs, calculation spreadsheets, supporting evidence)
are commercially sensitive and can be large, so they are kept off-chain (e.g. IPFS or the
company's own document management system). Only the `keccak256` hash of the report is
written to the smart contract. This still gives regulators and auditors a tamper-evident,
timestamped, publicly verifiable anchor: anyone holding a copy of the original report can
re-hash it and confirm it matches what was submitted on-chain, without the contents ever
being exposed on a public ledger. The trade off is that the chain proves a report has not
changed, not that its numbers were right in the first place, which is why independent
verifiers are part of the design.
