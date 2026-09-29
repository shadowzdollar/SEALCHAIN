/**
 * In-app notifications, with optional email per user and type.
 *
 * Notifications belong to an organisation and are shown to all its members;
 * read state is per user. Bursts of the same event (e.g. a buyer's bank
 * checking one certificate ten times) collapse into one notification with a
 * count while they arrive within an hour of each other.
 *
 * Security and workflow emails (tamper alerts, endorsement requests and
 * decisions, receipts) are always sent by their own code paths; preferences
 * here only govern the optional emails.
 */
import type { Config } from '../config';
import { newId, nowIso, type Db } from '../db';
import type { Mailer } from './mailer';

export const NOTIFICATION_TYPES = {
  'document.verified': { label: 'Someone outside your organisation verified one of your documents', email: false, optional: true },
  'share.viewed': { label: 'A shared link was opened or a document downloaded', email: false, optional: true },
  'document.anchored': { label: 'Documents were anchored on the blockchain', email: false, optional: true },
  'document.revoked': { label: 'A colleague revoked a document', email: true, optional: true },
  'document.tampered': { label: 'An altered copy of your document was presented', email: true, optional: false },
  'endorsement.requested': { label: 'An exporter requested endorsement', email: true, optional: false },
  'endorsement.decided': { label: 'An authority endorsed or declined your certificate', email: true, optional: false },
  'payment.succeeded': { label: 'A payment was received', email: true, optional: false },
  'team.joined': { label: 'Someone joined your team', email: true, optional: true },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;
const DEDUPE_WINDOW_MS = 60 * 60_000;

export interface NotifyInput {
  title: string;
  body?: string;
  link?: string;
  severity?: 'info' | 'success' | 'warning' | 'critical';
  /** Events with the same key within an hour collapse into one notification. */
  dedupeKey?: string;
  /** The user who caused it — not notified, and not emailed. */
  actorUserId?: string;
}

interface Row {
  id: string;
  type: NotificationType;
  severity: string;
  title: string;
  body: string | null;
  link: string | null;
  count: number;
  created_at: string;
  read_at: string | null;
}

export class NotificationService {
  constructor(private db: Db, private cfg: Config, private mailer: Mailer) {}

  notify(orgId: string, type: NotificationType, n: NotifyInput): string {
    const now = nowIso();
    if (n.dedupeKey) {
      const recent = this.db.get<{ id: string }>(
        'SELECT id FROM notifications WHERE org_id = ? AND dedupe_key = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1',
        orgId, n.dedupeKey, new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString(),
      );
      if (recent) {
        // Bump it and make it unread again for everyone.
        this.db.run('UPDATE notifications SET count = count + 1, created_at = ?, title = ?, body = ? WHERE id = ?', now, n.title, n.body ?? null, recent.id);
        this.db.run('DELETE FROM notification_reads WHERE notification_id = ?', recent.id);
        return recent.id;
      }
    }
    const id = newId('ntf', 16);
    this.db.insert('notifications', {
      id, org_id: orgId, type, severity: n.severity ?? 'info', title: n.title, body: n.body ?? null, link: n.link ?? null,
      dedupe_key: n.dedupeKey ?? null, count: 1, actor_user_id: n.actorUserId ?? null, created_at: now,
    });
    if (NOTIFICATION_TYPES[type].optional) void this.email(orgId, type, n).catch(() => undefined);
    return id;
  }

  private async email(orgId: string, type: NotificationType, n: NotifyInput) {
    const users = this.db.all<{ id: string; email: string; pref: number | null }>(
      `SELECT u.id, u.email, p.email AS pref FROM users u
         LEFT JOIN notification_prefs p ON p.user_id = u.id AND p.type = ?
        WHERE u.org_id = ? AND u.password_hash != 'disabled'`,
      type, orgId,
    );
    for (const u of users) {
      if (u.id === n.actorUserId) continue;
      const wants = u.pref === null ? NOTIFICATION_TYPES[type].email : u.pref === 1;
      if (!wants) continue;
      await this.mailer.send({
        to: u.email,
        subject: n.title,
        body: `${n.body ?? n.title}\n\n${n.link ? `${this.cfg.publicWebUrl}${n.link}\n\n` : ''}Change which emails you receive: ${this.cfg.publicWebUrl}/app/notifications?tab=settings\n`,
      });
    }
  }

  list(orgId: string, userId: string, opts: { limit?: number; unread?: boolean; before?: string } = {}) {
    const rows = this.db.all<Row>(
      `SELECT n.id, n.type, n.severity, n.title, n.body, n.link, n.count, n.created_at, r.read_at
         FROM notifications n LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
        WHERE n.org_id = ? AND (n.actor_user_id IS NULL OR n.actor_user_id != ?)
          ${opts.unread ? 'AND r.read_at IS NULL' : ''} ${opts.before ? 'AND n.created_at < ?' : ''}
        ORDER BY n.created_at DESC LIMIT ?`,
      ...([userId, orgId, userId, ...(opts.before ? [opts.before] : []), Math.min(opts.limit ?? 30, 100)] as string[]),
    );
    return rows.map((r) => ({ id: r.id, type: r.type, severity: r.severity, title: r.title, body: r.body, link: r.link, count: r.count, createdAt: r.created_at, read: !!r.read_at }));
  }

  unreadCount(orgId: string, userId: string): number {
    return this.db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM notifications n LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
        WHERE n.org_id = ? AND r.read_at IS NULL AND (n.actor_user_id IS NULL OR n.actor_user_id != ?)`,
      userId, orgId, userId,
    )!.n;
  }

  markRead(orgId: string, userId: string, ids: string[] | 'all') {
    const now = nowIso();
    const targets = ids === 'all'
      ? this.db.all<{ id: string }>('SELECT n.id FROM notifications n LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ? WHERE n.org_id = ? AND r.read_at IS NULL', userId, orgId).map((r) => r.id)
      : ids.filter((id) => this.db.get('SELECT 1 FROM notifications WHERE id = ? AND org_id = ?', id, orgId));
    this.db.tx(() => {
      for (const id of targets) this.db.run('INSERT INTO notification_reads (notification_id, user_id, read_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', id, userId, now);
    });
    return targets.length;
  }

  prefs(userId: string) {
    const saved = new Map(this.db.all<{ type: string; email: number }>('SELECT type, email FROM notification_prefs WHERE user_id = ?', userId).map((p) => [p.type, p.email === 1]));
    return (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).map((type) => ({
      type,
      label: NOTIFICATION_TYPES[type].label,
      optional: NOTIFICATION_TYPES[type].optional,
      email: NOTIFICATION_TYPES[type].optional ? (saved.get(type) ?? NOTIFICATION_TYPES[type].email) : true,
    }));
  }

  setPref(userId: string, type: NotificationType, email: boolean) {
    this.db.run('INSERT INTO notification_prefs (user_id, type, email) VALUES (?, ?, ?) ON CONFLICT(user_id, type) DO UPDATE SET email = excluded.email', userId, type, email ? 1 : 0);
  }
}
