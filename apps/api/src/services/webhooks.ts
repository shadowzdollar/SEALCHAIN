/**
 * Outgoing webhooks for integrators (forwarders' TMS, ERPs).
 *
 * Every delivery is signed like Stripe's: header
 *   SealChain-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${body}`)>
 * so receivers can verify authenticity and reject replays (check t is recent).
 * Deliveries are queued in the database and retried with backoff; the
 * delivery log is visible to the organisation.
 */
import crypto from 'node:crypto';
import net from 'node:net';
import type { Config } from '../config';
import { newId, nowIso, type Db } from '../db';

export const WEBHOOK_EVENTS = [
  'document.issued',
  'document.anchored',
  'document.revoked',
  'document.tampered',
  'endorsement.decided',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | 'ping';

const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;

type Log = { info: (o: object, m?: string) => void; error: (o: object, m?: string) => void };

export function sign(secret: string, timestamp: number, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (net.isIPv4(h)) {
    const [a, b] = h.split('.').map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIPv6(h)) return h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h === '::';
  return false;
}

/** Returns an error message if the URL is not an acceptable webhook target. */
export function checkWebhookUrl(raw: string, cfg: Config): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'Not a valid URL.';
  }
  if (cfg.isProd) {
    if (u.protocol !== 'https:') return 'Webhook URLs must use https.';
    if (isPrivateHost(u.hostname)) return 'Webhook URLs cannot point to private or local addresses.';
  } else if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return 'Webhook URLs must use http(s).';
  }
  if (u.username || u.password) return 'Put credentials in your receiver, not in the URL.';
  return null;
}

export class WebhookService {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private db: Db, private log: Log, private intervalMs = 15_000) {}

  start() {
    this.timer = setInterval(() => void this.process(), this.intervalMs);
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
  }

  /** Queues an event for every active webhook of the organisation subscribed to it. */
  dispatch(orgId: string, event: WebhookEvent, data: object) {
    const hooks = this.db.all<{ id: string; events: string }>('SELECT id, events FROM webhooks WHERE org_id = ? AND active = 1', orgId);
    let queued = 0;
    for (const h of hooks) {
      const events = JSON.parse(h.events) as string[];
      if (event !== 'ping' && !events.includes(event)) continue;
      this.enqueue(h.id, event, data);
      queued++;
    }
    if (queued) setImmediate(() => void this.process());
    return queued;
  }

  enqueue(webhookId: string, event: WebhookEvent, data: object): string {
    const id = newId('whd', 16);
    const payload = JSON.stringify({ id, type: event, createdAt: nowIso(), data });
    this.db.insert('webhook_deliveries', { id, webhook_id: webhookId, event, payload, status: 'pending', next_attempt_at: nowIso(), created_at: nowIso() });
    return id;
  }

  /** Delivers everything due. Single-flight. */
  async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = this.db.all<{ id: string; webhook_id: string; event: string; payload: string; attempts: number; url: string; secret: string }>(
        `SELECT d.id, d.webhook_id, d.event, d.payload, d.attempts, w.url, w.secret
           FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id
          WHERE d.status = 'pending' AND d.next_attempt_at <= ? AND w.active = 1
          ORDER BY d.next_attempt_at LIMIT 50`,
        nowIso(),
      );
      await Promise.all(due.map((d) => this.deliver(d)));
    } finally {
      this.running = false;
    }
  }

  private async deliver(d: { id: string; event: string; payload: string; attempts: number; url: string; secret: string }) {
    const t = Math.floor(Date.now() / 1000);
    const attempts = d.attempts + 1;
    let code: number | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(d.url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'SealChain-Webhooks/1',
          'sealchain-event': d.event,
          'sealchain-delivery': d.id,
          'sealchain-signature': `t=${t},v1=${sign(d.secret, t, d.payload)}`,
        },
        body: d.payload,
      });
      code = res.status;
      if (res.ok) {
        this.db.run("UPDATE webhook_deliveries SET status = 'delivered', attempts = ?, response_code = ?, error = NULL, delivered_at = ? WHERE id = ?", attempts, code, nowIso(), d.id);
        return;
      }
      error = `HTTP ${res.status}`;
    } catch (err) {
      error = (err as Error).message.slice(0, 300);
    }
    const final = attempts >= MAX_ATTEMPTS;
    const next = new Date(Date.now() + (BACKOFF_MS[attempts - 1] ?? 0)).toISOString();
    this.db.run(
      'UPDATE webhook_deliveries SET status = ?, attempts = ?, response_code = ?, error = ?, next_attempt_at = ? WHERE id = ?',
      final ? 'failed' : 'pending', attempts, code, error, next, d.id,
    );
    if (final) this.log.error({ delivery: d.id, error }, 'webhook delivery failed permanently');
  }
}
