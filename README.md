# GEvidence — IoT-Funded ESG Verification dApp  
**MetaMask Login • Crowdfunding Progress • Rewards • Off-Cycle Checks • NFT Certificates**
GEvidence is a decentralized application that verifies a company’s environmental (ESG) performance using IoT-style measurements (or an oracle-like data source). Verification is funded through **crowdfunding campaigns**, and successful verification results in a public, on-chain **NFT certificate**.
The application uses **wallet-based authentication only**:
- Users “log in” by connecting **MetaMask**.
- The connected wallet address is the user identity.
- There are **no accounts, passwords, or centralized login**.
> The project runs on **Ethereum testnets** (Sepolia / Holesky). All transactions are executed via MetaMask.
## What GEvidence does (project idea)
### 1) Crowdfunding to pay for IoT verification
IoT verification costs resources (collection, processing, validation). GEvidence allows the community to finance this process.
Users can:
- open a **verification campaign** for a company (to speed up verification),
- contribute **test ETH** to the campaign,
- watch the campaign **progress** (raised / goal + deadline),
- finalize the campaign after the deadline.
**Important security rule:**  
Campaign creators do **not** receive raised funds. If a campaign succeeds, funds go to the **treasury / IoT operator wallet** (the verification service wallet). This ensures donations are used for verification, not personal profit.
### 2) Reward system (ERC-20)
Every contribution automatically mints **reward tokens (ERC-20)** to the contributor. Rewards are proportional to the donation amount. These tokens represent platform utility.
### 3) Off-Cycle Checks (extra inspections)
Reward tokens can be used to request an **off-cycle check** (an extra inspection outside the main verification flow).
The frontend provides a dedicated page with a **form**:
- select company / evidence,
- enter reason/details (stored as hashes/references on-chain),
- choose stake amount in reward tokens,
- submit request.
This uses the standard ERC-20 workflow:
1) `approve()` tokens for the off-cycle module  
2) `requestOffCycleCheck()` creates the request on-chain
A trusted verification wallet resolves requests:
- approved → stake is returned to the requester,
- rejected/spam → stake is sent to the treasury.
### 4) NFT Certificate (ERC-721)
After a campaign succeeds and the verification is approved, the company receives an **ERC-721 NFT certificate**.  
This NFT is a public proof that the verification was completed.
## User Interface
### Wallet & network
- Connect MetaMask (request account permission)
- Display connected wallet address
- Verify the selected network (Sepolia/Holesky only)
### Company pages
- List of companies / evidence records
- Company detail page:
  - verification status
  - campaign info
  - certificate NFT (if minted)
  - “Create campaign” and “Contribute” actions
### Crowdfunding progress
For each campaign the UI shows:
- goal and raised amount
- progress bar (raised/goal)
- deadline / time remaining
- status: active / ended / finalized
- transaction outcome feedback: pending / success / failed
### Off-Cycle Check form page
A separate page includes a form to submit an off-cycle check request:
- select evidence/company
- input reason/details
- stake reward tokens (approve + request)
### Balances
The UI displays:
- user test ETH balance
- user reward token balance
## Technology
### Smart contracts (Hardhat)
Hardhat is used for:
- compiling Solidity contracts
- running automated tests

The deployed contracts live on the testnet. The frontend interacts with them via MetaMask.
- Local Hardhat network for development/testing
