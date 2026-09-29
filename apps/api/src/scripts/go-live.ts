/**
 * Go-live readiness check: which external services are configured, which
 * are missing, and exactly what to obtain for each.
 *
 *   pnpm go-live              # reads the repo's .env if present
 *   pnpm go-live --offline    # skip network checks
 *
 * Exits non-zero when something required for a pilot is missing.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { JsonRpcProvider, Wallet, formatEther } from 'ethers';
import { loadConfig, loadEnvFiles } from '../config';

// go-live checks the production settings, wherever it runs.
loadEnvFiles({ production: true });
const offline = process.argv.includes('--offline');
const cfg = loadConfig();

type Level = 'ok' | 'warn' | 'missing';
const results: Array<{ area: string; level: Level; msg: string; fix?: string; required: boolean }> = [];
const add = (area: string, level: Level, msg: string, fix?: string, required = true) => results.push({ area, level, msg, fix, required });

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  return { status: res.status, body };
}

// ------------------------------------------------------------------ server
{
  const url = cfg.publicWebUrl;
  if (/localhost|127\.0\.0\.1|example\.com/.test(url)) {
    add('Domain', 'missing', `PUBLIC_WEB_URL is ${url}`, 'Buy a domain, point it at your server, and set PUBLIC_WEB_URL=https://your-domain. It is printed in every QR code, so set it before issuing real documents.');
  } else if (!url.startsWith('https://')) {
    add('Domain', 'warn', `PUBLIC_WEB_URL is not https (${url})`, 'Serve the app over HTTPS (see deploy/Caddyfile).');
  } else {
    add('Domain', 'ok', `Public URL ${url}`);
    if (!offline) {
      try {
        const r = await fetchJson(`${url}/api/health`);
        add('Domain', r.status === 200 ? 'ok' : 'warn', `${url}/api/health answered ${r.status}`);
      } catch (err) {
        add('Domain', 'warn', `${url} is not reachable yet (${(err as Error).message})`, 'Deploy the app, then run doctor again.');
      }
    }
  }
  if (process.env.DATA_DIR && !path.isAbsolute(process.env.DATA_DIR)) {
    add('Server', 'missing', `DATA_DIR is a relative path (${process.env.DATA_DIR})`, 'Use an absolute path, e.g. DATA_DIR=/data in Docker — a relative path puts the database wherever the server happens to start.');
  }
  if (!cfg.isProd) add('Server', 'warn', 'NODE_ENV is not "production"', 'Set NODE_ENV=production on the server (secure cookies, production logging).', false);
  if (!cfg.adminEmails.length) add('Server', 'missing', 'ADMIN_EMAILS is empty — nobody can use the compliance console', 'Set ADMIN_EMAILS to the email(s) of your compliance team, then register with that email.');
  else add('Server', 'ok', `Compliance console for ${cfg.adminEmails.join(', ')}`);
}

// ------------------------------------------------------------ issuer key
{
  const file = path.join(cfg.dataDir, 'issuer-ed25519.pem');
  if (process.env.ISSUER_KEY_PEM) add('Issuer key', 'ok', 'Ed25519 issuer key provided via ISSUER_KEY_PEM');
  else if (fs.existsSync(file)) add('Issuer key', 'warn', `Issuer key lives in ${file}`, 'Copy it into a secret store (ISSUER_KEY_PEM) and keep an offline backup: losing it means new documents are signed by a different key.', false);
  else add('Issuer key', 'warn', 'No issuer key yet — one is generated on first start', 'Start the server once, then back up the generated key.', false);
}

// -------------------------------------------------------------- anchoring
{
  const a = cfg.anchor;
  if (a.mode !== 'evm') {
    add('Blockchain', 'missing', 'Anchoring uses the development ledger (not a public chain)', 'Get an RPC URL (public Polygon Amoy RPC is fine to start), create a wallet with `pnpm --filter @sealchain/api anchor:wallet`, fund it from a faucet, deploy the contract, then set RPC_URL, CHAIN_ID, ANCHOR_CONTRACT, ANCHOR_PRIVATE_KEY.');
  } else if (a.chainId === 31337) {
    add('Blockchain', 'missing', 'Anchoring to the local Hardhat chain (development only)', 'Point RPC_URL at a public network (Polygon Amoy testnet for the pilot) before real use.');
  } else if (!a.contract || !a.privateKey) {
    add('Blockchain', 'missing', 'RPC_URL is set but ANCHOR_CONTRACT or ANCHOR_PRIVATE_KEY is missing', 'Deploy SealAnchor with `RPC_URL=… DEPLOYER_KEY=… pnpm --filter @sealchain/contracts deploy remote` and set both values.');
  } else if (offline) {
    add('Blockchain', 'ok', `Configured for ${a.networkName} (chain ${a.chainId}) — network not checked`);
  } else {
    try {
      const provider = new JsonRpcProvider(a.rpcUrl, undefined, { staticNetwork: false } as never);
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== a.chainId) add('Blockchain', 'missing', `RPC is chain ${net.chainId}, CHAIN_ID says ${a.chainId}`, 'Fix CHAIN_ID or RPC_URL.');
      const code = await provider.getCode(a.contract);
      if (code === '0x') add('Blockchain', 'missing', `No contract at ${a.contract}`, 'Deploy the contract to this network and update ANCHOR_CONTRACT.');
      const wallet = new Wallet(a.privateKey, provider);
      const bal = Number(formatEther(await provider.getBalance(wallet.address)));
      if (bal === 0) add('Blockchain', 'missing', `Anchor wallet ${wallet.address} has no funds`, 'Send native tokens (POL on Polygon) to this address — a faucet for testnets.');
      else if (bal < a.minBalance) add('Blockchain', 'warn', `Anchor wallet balance ${bal} is low`, 'Top it up.');
      else add('Blockchain', 'ok', `${a.networkName}: contract found, wallet ${wallet.address} holds ${bal}`);
      if (code !== '0x') add('Blockchain', 'ok', 'Run `pnpm anchor:preflight` for authorisation and fee checks', undefined, false);
    } catch (err) {
      add('Blockchain', 'missing', `RPC ${a.rpcUrl} unreachable (${(err as Error).message.split('\n')[0]})`, 'Check RPC_URL; use a provider such as Alchemy or Infura if the public RPC is unreliable.');
    }
  }
  if (a.mode === 'evm' && a.chainId !== 31337 && !a.explorerTxUrl) add('Blockchain', 'warn', 'EXPLORER_TX_URL not set — verifiers get no "view transaction" link', 'e.g. EXPLORER_TX_URL=https://amoy.polygonscan.com/tx/{tx}', false);
}

// ------------------------------------------------------------------- mail
{
  const m = cfg.mail;
  if (m.transport !== 'resend') {
    add('Email', 'missing', 'Emails (invites, password resets, alerts, contact form) are only printed to the server log', 'Create a Resend account (resend.com), verify your domain (DNS records), create an API key and set MAIL_API_KEY and MAIL_FROM="SealChain <no-reply@your-domain>".');
  } else if (/example/.test(m.from)) {
    add('Email', 'missing', `MAIL_FROM is ${m.from}`, 'Use an address on your verified domain.');
  } else if (offline) {
    add('Email', 'ok', `Resend configured, sending as ${m.from} — not checked`);
  } else {
    try {
      const r = await fetchJson('https://api.resend.com/domains', { headers: { authorization: `Bearer ${m.apiKey}` } });
      const domain = m.from.match(/@([^>\s]+)/)?.[1];
      const list = ((r.body as { data?: Array<{ name: string; status: string }> })?.data ?? []);
      const found = list.find((d) => d.name === domain);
      if (r.status === 401 || r.status === 403) add('Email', 'missing', 'Resend rejected MAIL_API_KEY', 'Create a new API key with sending access.');
      else if (r.status !== 200) add('Email', 'warn', `Could not list Resend domains (HTTP ${r.status})`, 'A sending-only key cannot list domains; send a test invite to confirm delivery.', false);
      else if (!found) add('Email', 'missing', `Domain ${domain} is not added in Resend`, 'Add it under Domains in Resend and create the DNS records.');
      else if (found.status !== 'verified') add('Email', 'warn', `Domain ${domain} is ${found.status} in Resend`, 'Finish the DNS records; mail may be rejected until verified.');
      else add('Email', 'ok', `Resend ready, ${domain} verified`);
    } catch (err) {
      add('Email', 'warn', `Could not reach Resend (${(err as Error).message})`);
    }
  }
  if (/example/.test(cfg.contactEmail)) add('Email', 'missing', `CONTACT_EMAIL is ${cfg.contactEmail}`, 'Set CONTACT_EMAIL to the inbox that should receive "Talk to us" requests.');
  else add('Email', 'ok', `Contact form goes to ${cfg.contactEmail}`);
}

// ---------------------------------------------------------- social sign-in
{
  const g = cfg.oauth.google;
  if (!g) add('Google sign-in', 'missing', 'Not configured (button explains it is coming)', `Google Cloud Console → APIs & Services → Credentials → OAuth client (Web). Authorised redirect URI: ${cfg.oauth.redirectBase}/api/auth/oauth/google/callback. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.`, false);
  else if (!g.clientId.endsWith('.apps.googleusercontent.com')) add('Google sign-in', 'warn', 'GOOGLE_CLIENT_ID does not look like a Google web client ID', undefined, false);
  else add('Google sign-in', 'ok', `Configured; redirect URI must be ${cfg.oauth.redirectBase}/api/auth/oauth/google/callback`, undefined, false);

  const a = cfg.oauth.apple;
  if (!a) add('Apple sign-in', 'missing', 'Not configured (button explains it is coming)', `Needs a paid Apple Developer account and an https domain. Create a Services ID with "Sign in with Apple", return URL ${cfg.oauth.redirectBase}/api/auth/oauth/apple/callback, and a key (.p8). Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY.`, false);
  else {
    try {
      crypto.createPrivateKey(a.privateKey);
      add('Apple sign-in', cfg.oauth.redirectBase.startsWith('https://') ? 'ok' : 'warn', cfg.oauth.redirectBase.startsWith('https://') ? 'Configured; private key parses' : 'Configured, but Apple only accepts https return URLs', undefined, false);
    } catch {
      add('Apple sign-in', 'missing', 'APPLE_PRIVATE_KEY is not a valid PEM key', 'Paste the .p8 contents with \\n for newlines.', false);
    }
  }
}

// --------------------------------------------------------------- payments
{
  const p = cfg.payments;
  if (p.flutterwave) {
    const test = p.flutterwave.secretKey.includes('_TEST');
    add('Payments', test ? 'warn' : 'ok', `Flutterwave ${test ? 'TEST' : 'live'} key set; charging in ${p.currency}`, test ? 'Switch to the live secret key once Flutterwave approves your business.' : undefined, false);
    if (!p.flutterwave.webhookHash) add('Payments', 'warn', 'FLW_WEBHOOK_HASH not set — payments settle only when the payer returns to SealChain', `Set a secret hash in Flutterwave → Webhooks (URL ${cfg.publicWebUrl}/api/payments/webhook/flutterwave) and in FLW_WEBHOOK_HASH.`, false);
  } else {
    add('Payments', 'missing', 'Online payment off — statements are paid by transfer and recorded by the compliance team', 'Create a Flutterwave business account and set FLW_SECRET_KEY (see requirement.md §8).', false);
  }
  if (!p.manualInstructions) add('Payments', 'warn', 'MANUAL_PAYMENT_INSTRUCTIONS not set', 'Add your MoMo pay code / bank details for people who pay by transfer.', false);
}

// ---------------------------------------------------------------- backups
{
  const dir = path.join(cfg.dataDir, 'backups');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite')).sort() : [];
  const newest = files.at(-1);
  if (!newest) add('Backups', 'warn', 'No database backups found', 'Schedule `pnpm backup` daily (cron) and copy the backups off the server.', false);
  else {
    const age = (Date.now() - fs.statSync(path.join(dir, newest)).mtimeMs) / 3_600_000;
    add('Backups', age > 36 ? 'warn' : 'ok', `Newest backup ${newest} (${Math.round(age)} h old)`, age > 36 ? 'Backups look stale — check the cron job.' : undefined, false);
  }
}

// ----------------------------------------------------------------- report
const icon = { ok: '✓', warn: '!', missing: '✗' } as const;
console.log('SealChain go-live check' + (offline ? ' (offline)' : '') + '\n');
let lastArea = '';
for (const r of results) {
  if (r.area !== lastArea) {
    console.log(`\n${r.area}`);
    lastArea = r.area;
  }
  console.log(`  ${icon[r.level]} ${r.msg}${r.required ? '' : r.level === 'ok' ? '' : '  (optional)'}`);
  if (r.fix && r.level !== 'ok') console.log(`      → ${r.fix}`);
}
const blocking = results.filter((r) => r.required && r.level === 'missing');
console.log(blocking.length ? `\n${blocking.length} required item(s) missing before a public pilot.` : '\nReady for a public pilot.');
process.exit(blocking.length ? 1 : 0);
