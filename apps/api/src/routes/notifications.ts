/** The signed-in user's notifications and email preferences. */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireSession } from '../services/auth';
import type { Deps } from '../services/documents';
import { NOTIFICATION_TYPES, type NotificationType } from '../services/notifications';

export async function notificationRoutes(api: FastifyInstance, { notifications }: Deps) {
  api.get<{ Querystring: { unread?: string; before?: string; limit?: string } }>('/notifications', { preHandler: requireAuth }, async (req) => {
    const { org, user } = req.auth!;
    return {
      unread: notifications.unreadCount(org.id, user.id),
      items: notifications.list(org.id, user.id, { unread: req.query.unread === '1', before: req.query.before, limit: Number(req.query.limit) || 30 }),
    };
  });

  api.get('/notifications/count', { preHandler: requireAuth }, async (req) => ({ unread: notifications.unreadCount(req.auth!.org.id, req.auth!.user.id) }));

  api.post('/notifications/read', { preHandler: requireAuth }, async (req) => {
    const body = z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().max(40)).max(200) })]).parse(req.body);
    const marked = notifications.markRead(req.auth!.org.id, req.auth!.user.id, 'all' in body ? 'all' : body.ids);
    return { marked, unread: notifications.unreadCount(req.auth!.org.id, req.auth!.user.id) };
  });

  api.get('/notifications/prefs', { preHandler: requireSession }, async (req) => notifications.prefs(req.auth!.user.id));

  api.put('/notifications/prefs', { preHandler: requireSession }, async (req) => {
    const types = Object.keys(NOTIFICATION_TYPES) as [NotificationType, ...NotificationType[]];
    const body = z.object({ type: z.enum(types), email: z.boolean() }).parse(req.body);
    if (!NOTIFICATION_TYPES[body.type].optional) return notifications.prefs(req.auth!.user.id);
    notifications.setPref(req.auth!.user.id, body.type, body.email);
    return notifications.prefs(req.auth!.user.id);
  });
}
