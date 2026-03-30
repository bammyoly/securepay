# SecurePay — Confidential Payroll on Fhenix CoFHE

SecurePay is a fully on-chain confidential payroll system built on **Arbitrum Sepolia** using **Fhenix CoFHE** (Confidential FHE). Employers can wrap USDC into a privacy-preserving vault and execute single or batch salary payments to employees — all encrypted using Fully Homomorphic Encryption (FHE). Employee balances and salary amounts are never exposed on-chain.

---

## How It Works

```
Circle USDC
    │
    ▼  wrap()
cUSDC (plain ERC20, visible balance)
    │
    ▼  depositToVault()
Vault.sol (FHE-encrypted balance)
    │
    ▼  paySalary() / payBatch()
Employee encrypted vault balance
    │
    ▼  withdraw()
cUSDC → Circle USDC (back to wallet)
```

1. **Wrap** — Employer wraps Circle USDC into cUSDC (plain ERC20, 1:1 ratio)
2. **Deposit** — cUSDC is deposited into the FHE Vault; balance is encrypted on-chain
3. **Pay** — Employer selects employees and executes salary transfers; amounts stay encrypted
4. **Withdraw** — Employer or employee can withdraw cUSDC back to their wallet
5. **Decrypt** — Users decrypt their own vault balance client-side using cofhejs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Arbitrum Sepolia (Chain ID: 421614) |
| FHE | Fhenix CoFHE (`cofhejs`) |
| Smart Contracts | Solidity 0.8.24 + Hardhat |
| Frontend | React + Vite + Tailwind CSS |
| Wallet | RainbowKit + wagmi + ethers v6 |
| Backend | Express.js + SQLite (`better-sqlite3`) |
| Auth | JWT (wallet-signed) |

---

## Smart Contracts

| Contract | Description |
|---|---|
| `cUSDC.sol` | Plain ERC20 wrapper for Circle USDC (1:1, 6 decimals) |
| `Vault.sol` | FHE-encrypted balance vault; handles deposit, withdraw, and payroll transfers |
| `ConfidentialPayroll.sol` | Stores encrypted salaries; executes `paySalary` and `payBatch` via Vault |

**Deployed on Arbitrum Sepolia:**

> After deployment, addresses are auto-written to `frontend/src/contracts/addresses.json`

---

## Project Structure

```
payroll/
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx    # Authenticated sidebar navigation
│   │   │   ├── AppLayout.jsx  # Layout wrapper for auth pages
│   │   │   ├── Navbar.jsx     # Public page navigation
│   │   │   └── ThemeContext.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx  # Vault balance, deposit, withdraw
│   │   │   ├── WrapUsdc.jsx   # Wrap / unwrap Circle USDC
│   │   │   ├── Payments.jsx   # Single, batch, and scheduled payments
│   │   │   └── Employees.jsx  # Employee registry
│   │   ├── hooks/
│   │   │   ├── useChainGuard.js   # Reads chainId directly from MetaMask
│   │   │   └── useNetworkSwitch.js # Switches network bypassing wagmi
│   │   ├── utils/
│   │   │   ├── Cofhe.js       # cofhejs singleton (FHE init, encrypt, unseal)
│   │   │   ├── providers.js   # Read (Alchemy), Events (public RPC), Write (MetaMask)
│   │   │   └── api.js         # Backend API client (JWT auth)
│   │   └── contracts/         # Auto-generated JSON from Hardhat deploy
│   ├── vite.config.js         # WASM + COEP/COOP headers for cofhejs
│   └── .env
│
├── backend/                   # Express.js API
│   ├── src/
│   │   ├── db/schema.js       # SQLite schema (employers, employees, payments, schedules)
│   │   ├── middleware/auth.js # JWT verification
│   │   ├── routes/
│   │   │   ├── employees.js   # CRUD employee registry
│   │   │   ├── payments.js    # Payment recording + received history
│   │   │   └── schedules.js   # Scheduled payroll management
│   │   ├── services/scheduler.js # Daily cron for due payment notifications
│   │   └── index.js           # Express entry point
│   └── .env
│
└── hardhat/                   # Smart contract development
    ├── contracts/
    │   ├── cUSDC.sol
    │   ├── Vault.sol
    │   └── ConfidentialPayroll.sol
    ├── scripts/deploy.js      # Deploys all 3 contracts + exports ABIs to frontend
    ├── hardhat.config.js
    └── .env
```

---

## Prerequisites

- Node.js v18+
- MetaMask browser extension
- Arbitrum Sepolia ETH (from [bridge.arbitrum.io](https://bridge.arbitrum.io) or faucet)
- Circle USDC on Arbitrum Sepolia (from [faucet.circle.com](https://faucet.circle.com))
- Alchemy account for RPC URLs ([alchemy.com](https://www.alchemy.com))

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/securepay.git
cd securepay
```

### 2. Set up Hardhat (contracts)

```bash
cd hardhat
npm install
```

Create `hardhat/.env`:

```env
PRIVATE_KEY=your_deployer_wallet_private_key
USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
ARBISCAN_API_KEY=your_arbiscan_api_key
```

Deploy contracts to Arbitrum Sepolia:

```bash
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

> Contract addresses and ABIs are automatically exported to `frontend/src/contracts/`

### 3. Set up the Frontend

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
VITE_ARB_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
VITE_API_URL=http://localhost:3001
```

Start the frontend dev server:

```bash
npm run dev
# Runs on http://localhost:5173
```

### 4. Set up the Backend

```bash
cd ../backend
npm install
```

Create `backend/.env`:

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_random_secret_string
```

Start the backend:

```bash
npm start
# Runs on http://localhost:3001
```

---

## Environment Variables Reference

### `hardhat/.env`

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Private key of deployer wallet (with Arbitrum Sepolia ETH) |
| `USDC_ADDRESS` | Circle USDC on Arbitrum Sepolia: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| `ARBITRUM_SEPOLIA_RPC_URL` | Alchemy RPC URL for Arbitrum Sepolia |
| `ARBISCAN_API_KEY` | For contract verification on Arbiscan (optional) |

### `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_WALLETCONNECT_PROJECT_ID` | From [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `VITE_ARB_SEPOLIA_RPC` | Alchemy RPC — used for read calls (balanceOf, getFeeData) |
| `VITE_SEPOLIA_RPC` | Alchemy RPC for Ethereum Sepolia (fallback) |
| `VITE_API_URL` | Backend URL (default: `http://localhost:3001`) |

### `backend/.env`

| Variable | Description |
|---|---|
| `PORT` | Backend port (default: `3001`) |
| `FRONTEND_URL` | Frontend URL for CORS (default: `http://localhost:5173`) |
| `JWT_SECRET` | Secret for JWT signing |

---

## Key Design Decisions

### FHE Provider Compatibility
`cofhejs` was built against ethers v5. We install ethers v5 as an npm alias (`ethers-v5@npm:ethers@5`) and use it exclusively for cofhejs initialization via `initializeWithEthers({ ethersProvider, ethersSigner })`. All other frontend code uses ethers v6.

### RPC Split
Alchemy's free tier limits `eth_getLogs` to 10 blocks. We use three separate providers:
- **Alchemy** (`getReadProvider`) — fast view calls: `balanceOf`, `getFeeData`, `allowance`
- **Public RPC** (`getEventsProvider`) — event queries: `queryFilter` with no block range limit
- **MetaMask** (`getWriteSigner`) — transaction signing only

### Chain Switching
wagmi's `useSwitchChain` fails silently when the chain isn't registered in the wallet. We bypass wagmi entirely and call `window.ethereum.request({ method: "wallet_switchEthereumChain" })` directly, falling back to `wallet_addEthereumChain` if Arbitrum Sepolia isn't in the user's wallet.

### Scheduled Payments (Option A — Manual Trigger)
Backend cron flags due schedules daily at 8am. Dashboard shows a notification banner when payments are due. Employer reviews and clicks "Run Now" — the frontend pre-selects employees and submits the on-chain transaction. Employer always explicitly signs each payroll run. No custody risk.

### Decimal Handling
cUSDC inherits OpenZeppelin ERC20 (18 decimals) but `wrap(amount)` takes a USDC-scaled amount (6 decimals). All frontend formatting uses `ethers.formatUnits(value, 6)` to correctly display balances.

---

## API Reference (Backend)

### Authentication
All employer endpoints require a JWT token in the `Authorization: Bearer <token>` header.

### Employees
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/employees` | List all employees |
| `POST` | `/api/employees` | Add employee `{ name, wallet_address, salary_usd }` |
| `PATCH` | `/api/employees/:id` | Update employee |
| `DELETE` | `/api/employees/:id` | Deactivate employee |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/payments` | List payments (supports `?employee_id&status`) |
| `POST` | `/api/payments` | Record payment `{ employee_ids, tx_hash }` |
| `PATCH` | `/api/payments/confirm-batch` | Confirm batch payment |
| `GET` | `/api/payments/received/:wallet` | Employee received history (no auth) |

### Schedules
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schedules` | List schedules with employee details |
| `POST` | `/api/schedules` | Create schedule `{ name, frequency, next_run_date, employee_ids }` |
| `POST` | `/api/schedules/:id/run` | Run schedule — returns employees for frontend to pay |
| `DELETE` | `/api/schedules/:id` | Pause schedule |

---

## Pushing to GitHub

### First time setup

```bash
# From project root
git init
git add .
git commit -m "feat: initial SecurePay confidential payroll system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/securepay.git
git push -u origin main
```

### Create `.gitignore` (project root)

```gitignore
# Dependencies
node_modules/

# Environment files — never commit these
.env
.env.local
hardhat/.env
frontend/.env
backend/.env

# Build outputs
dist/
build/

# Database
backend/payroll.db
backend/*.db

# Hardhat
hardhat/cache/
hardhat/artifacts/

# Vite
frontend/.vite/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
```

### Subsequent pushes

```bash
git add .
git commit -m "feat: your commit message"
git push
```

---

## Security Notes

- **Never commit `.env` files** — they contain private keys and API secrets
- The `PRIVATE_KEY` in `hardhat/.env` is the deployer wallet — keep it funded with a small amount of ETH only
- FHE encryption happens client-side — salary amounts never leave the browser unencrypted
- The backend stores salary amounts in plaintext SQLite for the employer's reference only — this data never goes on-chain
- Employee vault balances can only be decrypted by the account that owns them (permit-based access control via cofhejs)

---

## License

MIT