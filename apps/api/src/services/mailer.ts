/**
 * Outgoing mail. Every message is written to the `outbox` table first (so
 * nothing is lost if the provider is down), then delivered by the configured
 * transport:
 *   - log     development: prints the message (with its links) to the log
 *   - resend  production: Resend HTTP API (MAIL_API_KEY, MAIL_FROM)
 * Invite links are also returned to the inviter directly, because many pilot
 * users will share them over WhatsApp rather than email.
 */
import type { Config } from '../config';
import { newId, nowIso, type Db } from '../db';

export interface Mail {
  to: string;
  subject: string;
  body: string;
}

type Logger = { info: (o: object, m?: string) => void; error: (o: object, m?: string) => void };

export class Mailer {
  constructor(private db: Db, private cfg: Config['mail'], private log: Logger) {}

  async send(mail: Mail): Promise<string> {
    const id = newId('msg', 16);
    this.db.insert('outbox', { id, to_email: mail.to, subject: mail.subject, body: mail.body, status: 'queued', created_at: nowIso() });
    await this.deliver(id, mail);
    return id;
  }

  private async deliver(id: string, mail: Mail) {
    try {
      if (this.cfg.transport === 'resend') {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${this.cfg.apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: this.cfg.from, to: [mail.to], subject: mail.subject, text: mail.body }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      } else {
        this.log.info({ to: mail.to, subject: mail.subject, body: mail.body }, 'mail (log transport)');
      }
      this.db.run("UPDATE outbox SET status = 'sent', sent_at = ? WHERE id = ?", nowIso(), id);
    } catch (err) {
      this.db.run("UPDATE outbox SET status = 'failed', error = ? WHERE id = ?", (err as Error).message, id);
      this.log.error({ err, to: mail.to }, 'mail delivery failed');
    }
  }
}
