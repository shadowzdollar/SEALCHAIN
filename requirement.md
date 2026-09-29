# SealChain — external requirements

Everything SealChain needs from outside to run as a full end-to-end pilot.
Tick each box as you get it.

**How to hand things over**

- **Secrets** (API keys, client secrets, private keys, `.p8` files): never paste them into chat or commit them. Put them in a file named `.env` at the project root (copy `.env.example` to start). `.env` is git-ignored.
- **`.env` holds the production server's settings.** It is read by the production server and by `pnpm go-live`, not by `pnpm dev`, so placeholder values in it cannot break local development.
  - To try a credential on your own computer first (e.g. Google sign-in on `http://localhost:5174`), put just that key in `.env.local`, which `pnpm dev` reads.
  - Keep `DATA_DIR` in `.env` as an absolute path on the server (e.g. `/data` in Docker).
- **Non-secret details** (domain, server IP, email addresses) can be shared in chat.
- After adding anything, run `pnpm go-live` to see what works and what is still missing. `docs/GO_LIVE.md` has the technical detail.

**Suggested order:** 1 → 2 → 4 → 3 → 5 (enough for a live pilot), then 6 → 8 → 7, then section D.

---

## A. Required for a real pilot

### 1. Domain name

- [ ] **Get:** a domain or subdomain, e.g. `sealchain.rw` or `app.yourname.com`.
- **Where:** any registrar (Namecheap, Cloudflare, GoDaddy, or a `.rw` registrar).
- **Cost:** about $10–40 per year.
- **Why first:** the address is printed in the QR code of every document. It should not change after real documents are issued.
- **Give:** the exact hostname, e.g. `app.sealchain.rw`.
- **Sets:** `DOMAIN`, `PUBLIC_WEB_URL=https://<hostname>`, `CORS_ORIGINS=https://<hostname>`.

### 2. Server

- [ ] **Get:** a Linux VPS (Ubuntu 22.04 or 24.04) with 1–2 vCPU, 2 GB RAM, 25 GB+ disk and SSH access.
- **Where:** Hetzner, DigitalOcean, Contabo, AWS Lightsail, or a Rwandan host (e.g. AOS, KtRN).
- **Cost:** about $5–12 per month.
- [ ] **DNS:** at your registrar, add an **A record** pointing the hostname from step 1 at the server's IP address.
- **Give:** the server IP and confirmation that SSH login works.
- HTTPS certificates are automatic (Caddy, in `deploy/`).

### 3. Blockchain anchoring — Polygon Amoy testnet (free)

- [ ] **RPC endpoint (optional):** the public `https://rpc-amoy.polygon.technology` works. For reliability, create a free account at alchemy.com or infura.io and copy the Amoy URL.
  - **Sets:** `RPC_URL`, `PUBLIC_RPC_URL`, `CHAIN_ID=80002`, `CHAIN_NAME=Polygon Amoy testnet`.
- [ ] **Anchor wallet:** Claude generates it (`pnpm --filter @sealchain/api anchor:wallet`) and gives you its public address.
  - **Sets:** `ANCHOR_PRIVATE_KEY`.
- [ ] **Test funds:** request test POL for that address from a faucet (e.g. faucet.polygon.technology). About 0.5 POL is plenty for the pilot.
- [ ] **Contract:** Claude deploys it once the wallet has funds.
  - **Sets:** `ANCHOR_CONTRACT`, `EXPLORER_TX_URL=https://amoy.polygonscan.com/tx/{tx}`.
- **Later, for production:** the same steps on Polygon mainnet with real POL. A few dollars covers thousands of batches.

### 4. Email — Resend

- [ ] **Account:** sign up at resend.com. The free tier sends 3,000 emails per month.
- [ ] **Domain:** Resend → Domains → add your domain → add the 3–4 DNS records it shows at your registrar → wait for "Verified".
- [ ] **API key:** Resend → API Keys → create a key (starts with `re_`).
  - **Sets:** `MAIL_API_KEY`.
- [ ] **Sender address**, e.g. `no-reply@sealchain.rw`.
  - **Sets:** `MAIL_FROM="SealChain <no-reply@sealchain.rw>"`.
- [ ] **Inbox for "Talk to us" requests**, e.g. `pilot@sealchain.rw`.
  - **Sets:** `CONTACT_EMAIL`.
- **Why:** without this, invites, password resets, tamper alerts and contact requests only go to the server log.

### 5. Compliance team

- [ ] **Emails** of the people who will run the compliance console: verify rules, record payments, handle enquiries, onboard authorities.
- **Sets:** `ADMIN_EMAILS=person1@…,person2@…`. Each person then registers with that email.

---

## B. Sign in with Google and Apple

### 6. Google sign-in (free)

- [ ] Go to console.cloud.google.com and create a project.
- [ ] APIs & Services → **OAuth consent screen**: app name "SealChain", support email, your domain, logo (optional).
- [ ] APIs & Services → **Credentials** → Create credentials → **OAuth client ID** → type *Web application*.
- [ ] **Authorised redirect URI:** `https://<your-domain>/api/auth/oauth/google/callback`
  - For local testing, also add `http://localhost:5174/api/auth/oauth/google/callback`.
- **Give:** the **Client ID** (ends with `.apps.googleusercontent.com`) and the **Client Secret**.
- **Sets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### 7. Apple sign-in ($99 per year)

- [ ] **Apple Developer Program** membership at developer.apple.com. An organisation account needs a D-U-N-S number, which is free but takes a few days.
- [ ] Certificates, Identifiers & Profiles → **App ID** with "Sign in with Apple" enabled.
- [ ] **Services ID** (e.g. `rw.sealchain.web`) → enable Sign in with Apple → configure:
  - **Domain:** `<your-domain>`
  - **Return URL:** `https://<your-domain>/api/auth/oauth/apple/callback`
- [ ] **Keys** → create a key with Sign in with Apple → download the **`.p8` file**. It can only be downloaded once; keep it safe.
- **Give:** Services ID, **Team ID** (10 characters, top right of the portal), **Key ID** (10 characters), and the `.p8` file contents.
- **Sets:** `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.
- **Note:** Apple only works on a real https domain, not on localhost.

---

## C. Online payments

### 8. Payment provider — recommended: Flutterwave

Flutterwave covers MTN MoMo, Airtel Money and cards in Rwanda.

- [ ] **Account:** create a business account at flutterwave.com.
- [ ] **Test secret key** (available immediately): Settings → API Keys → **Secret key** (starts with `FLWSECK_TEST-`). The public and encryption keys are not needed.
  - **Sets:** `FLW_SECRET_KEY`.
- [ ] **Webhook:** Settings → Webhooks →
  - **URL:** `https://<your-domain>/api/payments/webhook/flutterwave`
  - **Secret hash:** any long random text you choose.
  - **Sets:** `FLW_WEBHOOK_HASH`.
- [ ] **Manual payment details** for people who pay by transfer, e.g. MoMo pay code and bank account.
  - **Sets:** `MANUAL_PAYMENT_INSTRUCTIONS`.
- [ ] **Live mode** (later) requires business verification: RDB registration certificate, TIN, a director's national ID or passport, and business bank account details.
- Payers are charged in RWF (`PAYMENT_CURRENCY`, converted from the USD statement at your FX rate). This is required for MTN MoMo and Airtel Money in Rwanda.
- **Alternatives:** tell Claude if you prefer:
  - **MTN MoMo API directly** (momodeveloper.mtn.com): Collections subscription key plus an API user and key.
  - **IremboPay.**
- **Status:** the checkout is built and tested (including the webhook). It switches on as soon as `FLW_SECRET_KEY` is set. In development, a *test payment* page lets you try the full flow without keys.

---

## D. Not credentials, but needed before traders rely on it

- [ ] **9. Rules sign-off:** someone with customs or trade expertise reviews each corridor's rule set (RW→KE, RW→UG, RW→TZ, RW→BI) and the tariff notes in the compliance console, and marks them verified. They currently show "draft".
- [ ] **10. RRA confirmation:** confirm with the Rwanda Revenue Authority (or an issuing officer) that the EAC Certificate of Origin layout and the endorsement flow are acceptable. Ideally, one officer tries the authority workspace.
- [ ] **11. Translation review:** a native speaker checks the Kiswahili and Kinyarwanda text of the public verifier page.
- [ ] **12. Legal review:** a lawyer reviews the Privacy and Terms pages, which are currently marked "pilot draft".
- [ ] **13. Pilot traders:** 3–5 exporters willing to run real shipments. Collect their business name, contact name, email and phone.

---

## E. Optional extras

- [ ] **14. Off-server backups:** a storage bucket at Cloudflare R2, Backblaze B2 or AWS S3.
  - **Give:** endpoint URL, bucket name, access key ID and secret access key.
  - Without it, daily backups stay only on the server.
- [ ] **15. Error monitoring:** a Sentry account (free tier) at sentry.io.
  - **Give:** the project **DSN**.
- [ ] **16. Exchange rates**, used for the simplified-certificate threshold. Either:
  - send the rates to use (RWF, KES, UGX, TZS and BIF per USD), which sets `FX_RATES_JSON`; or
  - send an API key from exchangerate-api.com or openexchangerates.org for automatic daily rates.
- [ ] **17. Issuer key safekeeping:** after the first production start, copy the generated issuer key (`DATA_DIR/issuer-ed25519.pem`) into a password manager or secret store.
  - **Sets:** `ISSUER_KEY_PEM`.
  - Losing it means new documents are signed with a different key.

Items 14–16 need a small amount of code once the details arrive.

---

## Summary checklist

| # | Item | Required | Cost | Who |
|---|---|---|---|---|
| 1 | Domain | Yes | ~$10–40/yr | You |
| 2 | Server + DNS record | Yes | ~$5–12/mo | You |
| 3 | Test POL for the anchor wallet | Yes | Free | You (Claude creates the wallet and deploys the contract) |
| 4 | Resend account, domain, key, sender and contact inbox | Yes | Free tier | You |
| 5 | Compliance team emails | Yes | — | You |
| 6 | Google OAuth client | Recommended | Free | You |
| 7 | Apple Developer account and keys | Recommended | $99/yr | You |
| 8 | Flutterwave secret key, webhook hash and manual payment details | For online payments | Free to test | You |
| 9–13 | Rules sign-off, RRA, translations, legal, pilot traders | Before real use | — | You and partners |
| 14–17 | Backups bucket, Sentry, FX rates, issuer key | Optional | Free tiers | You |
