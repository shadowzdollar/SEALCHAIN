# Going live

Everything below is what SealChain needs from the outside world. Put each value
in `.env` at the repository root (copy `.env.example`), then run:

```bash
pnpm go-live            # checks every item, including network reachability
pnpm go-live --offline  # configuration only
```

It prints ✓ / ! / ✗ per item with the exact fix, and exits non-zero while a
required item is missing.

`.env` is the production server's configuration: the server reads it when
`NODE_ENV=production`, and `pnpm go-live` always reads it. `pnpm dev` ignores
it and reads `.env.local` instead, for trying individual credentials locally.

## Required for a public pilot

### 1. A server and a domain

| What | Where | Sets |
|---|---|---|
| A Linux server with Docker (1 vCPU / 2 GB is plenty for the pilot) | Any VPS provider | — |
| A domain or subdomain, e.g. `app.sealchain.rw` | Any registrar; add an **A record** pointing at the server | `DOMAIN`, `PUBLIC_WEB_URL=https://<domain>`, `CORS_ORIGINS=https://<domain>` |

`PUBLIC_WEB_URL` is printed in the QR code of every document, so choose it
before issuing real documents. HTTPS certificates are automatic (Caddy).

### 2. Blockchain anchoring (Polygon Amoy testnet for the pilot)

| What | Where | Sets |
|---|---|---|
| An RPC endpoint | The public `https://rpc-amoy.polygon.technology` works to start; for reliability, a free Alchemy or Infura key | `RPC_URL`, `PUBLIC_RPC_URL`, `CHAIN_ID=80002`, `CHAIN_NAME=Polygon Amoy testnet` |
| A dedicated anchor wallet | `pnpm --filter @sealchain/api anchor:wallet` creates one | `ANCHOR_PRIVATE_KEY` |
| Test POL in that wallet | A Polygon Amoy faucet (search "Polygon Amoy faucet"); ~0.5 POL lasts a long pilot | — |
| The SealAnchor contract | `RPC_URL=… DEPLOYER_KEY=<anchor wallet key> pnpm --filter @sealchain/contracts deploy remote` | `ANCHOR_CONTRACT` |
| Explorer links (optional) | — | `EXPLORER_TX_URL=https://amoy.polygonscan.com/tx/{tx}` |

Then run `pnpm anchor:preflight` for authorisation, balance and fee checks.
Moving to Polygon mainnet later is the same steps with real POL.

### 3. Email (Resend)

| What | Where | Sets |
|---|---|---|
| A Resend account and API key | resend.com → API Keys | `MAIL_API_KEY` |
| Your domain verified for sending | resend.com → Domains → add the DNS records it shows | `MAIL_FROM="SealChain <no-reply@<domain>>"` |
| An inbox for "Talk to us" requests | Your own mailbox | `CONTACT_EMAIL` |

Without this, invites, password resets, tamper alerts and contact requests are
only written to the server log.

### 4. The compliance team

Set `ADMIN_EMAILS` to the email(s) that should run the compliance console, then
register with that email. Before inviting traders, the compliance team should
review and sign off each corridor's rule set and the tariff notes in the console.

## Recommended

| Item | Where | Sets |
|---|---|---|
| Google sign-in | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Redirect URI `https://<domain>/api/auth/oauth/google/callback`. See `docs/SIGN_IN.md`. | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Apple sign-in | Paid Apple Developer account → Services ID with Sign in with Apple, return URL `https://<domain>/api/auth/oauth/apple/callback`, and a key (.p8). | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |
| Issuer key in a secret store | After first start, copy `DATA_DIR/issuer-ed25519.pem` somewhere safe | `ISSUER_KEY_PEM` |
| Off-server backups | The `backup` service writes daily copies to `/data/backups`; sync them to object storage or another machine | — |
| Current FX rates | Rates used for the simplified-certificate threshold | `FX_RATES_JSON` |

Until Google/Apple are configured, their buttons stay visible and tell people to
use email for now.

## Deploy

```bash
git clone <repo> sealchain && cd sealchain
cp .env.example .env && nano .env        # fill in the values above
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f deploy/docker-compose.prod.yml exec app node --import tsx src/scripts/go-live.ts
```

## Not needed from outside

Document generation, validation, signing, the verifier, fraud screening, teams,
API keys, webhooks and billing statements all run inside SealChain.
Payments are currently recorded by the compliance team against the monthly
statement (mobile money or bank transfer); online payment needs a payment
provider account — see the open decision in the README.
