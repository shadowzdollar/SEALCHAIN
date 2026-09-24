/**
 * Security alerts to document owners. Throttled per (kind, document) so a
 * burst of checks produces one email, not fifty.
 */
import type { Config } from '../config';
import { nowIso, type Db } from '../db';
import type { Mailer } from './mailer';
import type { WebhookService } from './webhooks';

const WINDOW_MS = 60 * 60_000;

function shouldSend(db: Db, key: string): boolean {
  const row = db.get<{ sent_at: string }>('SELECT sent_at FROM alerts_sent WHERE key = ?', key);
  if (row && Date.now() - new Date(row.sent_at).getTime() < WINDOW_MS) return false;
  db.run('INSERT INTO alerts_sent (key, sent_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET sent_at = excluded.sent_at', key, nowIso());
  return true;
}

/** Someone presented an altered copy of one of this organisation's documents. */
export async function alertTampered(
  deps: { db: Db; cfg: Config; mailer: Mailer; webhooks: WebhookService },
  doc: { id: string; org_id: string; number: string; shipment_id: string },
  via: 'public verification' | 'a document check by another SealChain user',
) {
  if (!shouldSend(deps.db, `tampered:${doc.id}`)) return;
  deps.webhooks.dispatch(doc.org_id, 'document.tampered', { documentId: doc.id, number: doc.number, shipmentId: doc.shipment_id, detectedVia: via, detectedAt: nowIso() });
  const owners = deps.db.all<{ email: string }>(
    "SELECT email FROM users WHERE org_id = ? AND role IN ('owner','compliance') AND password_hash != 'disabled'", doc.org_id,
  );
  for (const o of owners) {
    await deps.mailer.send({
      to: o.email,
      subject: `Alert: an altered copy of ${doc.number} was presented`,
      body:
        `Someone presented a copy of ${doc.number} that does not match what you issued (detected through ${via}).\n\n` +
        `This usually means the document was edited after you sent it — possibly to change quantities, values, names or origin.\n` +
        `Your original remains valid and verifiable. Consider warning your buyer and, if needed, revoking and re-issuing.\n\n` +
        `Shipment: ${deps.cfg.publicWebUrl}/app/shipments/${doc.shipment_id}\n`,
    });
  }
}
