import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_FX_PER_USD, type Currency } from '@sealchain/core';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../../..');

/**
 * Environment files (real environment variables always win):
 *   .env        the production server's settings — read in production and by `pnpm go-live`
 *   .env.local  optional overrides for local development, e.g. to try Google sign-in on localhost
 * Tests read neither, so credentials on a developer machine can't change results.
 */
export function loadEnvFiles(opts: { production?: boolean } = {}) {
  if (process.env.VITEST) return;
  const production = opts.production ?? process.env.NODE_ENV === 'production';
  const file = path.join(REPO_ROOT, production ? '.env' : '.env.local');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
loadEnvFiles();

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function num(name: string, fallback: number): number {
  const v = env(name);
  const n = v === undefined ? fallback : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

/**
 * Hardhat's well-known first development account. Only ever used against a
 * local development chain (chainId 31337); refused for anything else.
 */
const HARDHAT_DEV_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

function localDeployment(): { address: string; chainId: number } | undefined {
  const file = path.join(REPO_ROOT, 'packages/contracts/deployments/localhost.local.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

export type AnchorMode = 'evm' | 'local';

export function loadConfig() {
  const nodeEnv = env('NODE_ENV', 'development')!;
  const dataDir = path.resolve(env('DATA_DIR', path.join(REPO_ROOT, 'data'))!);
  fs.mkdirSync(dataDir, { recursive: true });

  const rpcUrl = env('RPC_URL');
  const deployment = rpcUrl ? undefined : localDeployment();
  const effectiveRpc = rpcUrl ?? (deployment ? 'http://127.0.0.1:8546' : undefined);
  const anchorMode = (env('ANCHOR_MODE') ?? (effectiveRpc ? 'evm' : 'local')) as AnchorMode;
  const chainId = num('CHAIN_ID', deployment?.chainId ?? 31337);

  let anchorKey = env('ANCHOR_PRIVATE_KEY');
  if (!anchorKey && anchorMode === 'evm' && chainId === 31337) anchorKey = HARDHAT_DEV_KEY;

  let fx: Record<Currency, number> = DEFAULT_FX_PER_USD;
  const fxJson = env('FX_RATES_JSON');
  if (fxJson) fx = { ...DEFAULT_FX_PER_USD, ...JSON.parse(fxJson) };

  const cfg = {
    nodeEnv,
    isProd: nodeEnv === 'production',
    host: env('HOST', '0.0.0.0')!,
    port: num('PORT', 4100),
    /** Public origin of the web app — printed in QR codes on every document. */
    publicWebUrl: env('PUBLIC_WEB_URL', 'http://localhost:5174')!.replace(/\/$/, ''),
    corsOrigins: (env('CORS_ORIGINS', 'http://localhost:5174,http://127.0.0.1:5174') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    dataDir,
    dbFile: env('DB_FILE', path.join(dataDir, 'sealchain.sqlite'))!,
    sessionDays: num('SESSION_DAYS', 14),
    webDist: env('WEB_DIST', path.join(REPO_ROOT, 'apps/web/dist'))!,
    anchor: {
      mode: anchorMode,
      rpcUrl: effectiveRpc,
      /** RPC the *browser* may call for independent verification (defaults to rpcUrl). */
      publicRpcUrl: env('PUBLIC_RPC_URL', effectiveRpc),
      privateKey: anchorKey,
      contract: env('ANCHOR_CONTRACT', deployment?.address),
      chainId,
      networkName: env('CHAIN_NAME', chainId === 31337 ? 'Local development chain (Hardhat)' : `EVM chain ${chainId}`)!,
      explorerTxUrl: env('EXPLORER_TX_URL'), // e.g. https://amoy.polygonscan.com/tx/{tx}
      intervalMs: num('ANCHOR_INTERVAL_MS', 20_000),
      debounceMs: num('ANCHOR_DEBOUNCE_MS', 1_500),
      confirmations: num('ANCHOR_CONFIRMATIONS', 1),
      /** Defer anchoring while the network's max fee exceeds this (gwei). 0 = no cap. */
      maxGasGwei: num('ANCHOR_MAX_GAS_GWEI', 0),
      /** Warn in health checks when the anchor wallet holds less than this (native units). */
      minBalance: num('ANCHOR_MIN_BALANCE', 0.01),
    },
    billing: {
      currency: 'USD' as const,
      monthlyFeeCents: num('PLAN_MONTHLY_CENTS', 1500),
      perShipmentCents: num('PER_SHIPMENT_CENTS', 300),
      plans: {
        pilotSeats: num('PLAN_PILOT_SEATS', 3),
        growthMonthlyCents: num('PLAN_GROWTH_MONTHLY_CENTS', 4900),
        growthPerShipmentCents: num('PLAN_GROWTH_PER_SHIPMENT_CENTS', 200),
        growthSeats: num('PLAN_GROWTH_SEATS', 15),
      },
    },
    fx,
    payments: {
      /** flutterwave when keys are present; sandbox in development; none (manual only) otherwise. */
      provider: (env('PAYMENT_PROVIDER') ?? (env('FLW_SECRET_KEY') ? 'flutterwave' : nodeEnv === 'production' ? 'none' : 'sandbox')) as 'flutterwave' | 'sandbox' | 'none',
      /** Currency the payer is charged in; mobile money in Rwanda requires RWF. */
      currency: env('PAYMENT_CURRENCY', 'RWF')! as Currency,
      flutterwave: env('FLW_SECRET_KEY')
        ? {
            secretKey: env('FLW_SECRET_KEY')!,
            webhookHash: env('FLW_WEBHOOK_HASH'),
            apiBase: env('FLW_API_BASE', 'https://api.flutterwave.com/v3')!.replace(/\/$/, ''),
            paymentOptions: env('FLW_PAYMENT_OPTIONS', 'mobilemoneyrwanda,card')!,
          }
        : undefined,
      /** Shown on the billing page for paying by transfer, e.g. MoMo pay code and bank details. */
      manualInstructions: env('MANUAL_PAYMENT_INSTRUCTIONS'),
    },
    oauth: {
      /** Where providers send users back; must be the public origin that serves /api. */
      redirectBase: env('OAUTH_REDIRECT_BASE', env('PUBLIC_WEB_URL', 'http://localhost:5174'))!.replace(/\/$/, ''),
      google: env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET')
        ? { clientId: env('GOOGLE_CLIENT_ID')!, clientSecret: env('GOOGLE_CLIENT_SECRET')! }
        : undefined,
      apple: env('APPLE_CLIENT_ID') && env('APPLE_TEAM_ID') && env('APPLE_KEY_ID') && env('APPLE_PRIVATE_KEY')
        ? { clientId: env('APPLE_CLIENT_ID')!, teamId: env('APPLE_TEAM_ID')!, keyId: env('APPLE_KEY_ID')!, privateKey: env('APPLE_PRIVATE_KEY')!.replace(/\\n/g, '\n') }
        : undefined,
    },
    mail: {
      transport: (env('MAIL_TRANSPORT') ?? (env('MAIL_API_KEY') ? 'resend' : 'log')) as 'log' | 'resend',
      apiKey: env('MAIL_API_KEY'),
      from: env('MAIL_FROM', 'SealChain <no-reply@sealchain.example>')!,
    },
    /** Where "talk to us" requests from the public site are sent. */
    contactEmail: env('CONTACT_EMAIL', 'pilot@sealchain.example')!,
    /** Emails that are granted the platform `admin` role on registration. */
    adminEmails: (env('ADMIN_EMAILS', '') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  };

  if (cfg.mail.transport === 'resend' && !cfg.mail.apiKey) throw new Error('MAIL_TRANSPORT=resend requires MAIL_API_KEY');
  if (cfg.anchor.mode === 'evm') {
    if (!cfg.anchor.rpcUrl) throw new Error('ANCHOR_MODE=evm requires RPC_URL');
    if (!cfg.anchor.contract) throw new Error('ANCHOR_MODE=evm requires ANCHOR_CONTRACT (or deploy locally with `pnpm deploy:local`)');
    if (!cfg.anchor.privateKey) throw new Error('ANCHOR_MODE=evm requires ANCHOR_PRIVATE_KEY');
    if (cfg.anchor.privateKey === HARDHAT_DEV_KEY && cfg.anchor.chainId !== 31337) {
      throw new Error('Refusing to use the public Hardhat development key on a non-development chain');
    }
  }
  return cfg;
}

export type Config = ReturnType<typeof loadConfig>;
