/**
 * Organisation profile: company details (kept as the default exporter in the
 * address book), shipment defaults, invoice numbering and the onboarding
 * checklist shown on the dashboard.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CORRIDORS, CURRENCIES } from '@sealchain/core';
import { json, newId, nowIso, type Db } from '../db';
import { audit, requireAuth, requireOwner } from '../services/auth';
import { HttpError, type Deps } from '../services/documents';
import { partySchema } from '../schemas';

const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'] as const;

interface Settings {
  invoice_prefix: string | null;
  invoice_next: number;
  default_corridor: string | null;
  default_currency: string | null;
  default_incoterm: string | null;
  default_payment_terms: string | null;
  website: string | null;
  onboarding_dismissed_at: string | null;
}

/** "Ubwiza Coffee Exporters Ltd" → "UCE-INV". */
export function defaultInvoicePrefix(orgName: string): string {
  const words = orgName.replace(/\(.*?\)/g, ' ').split(/[^A-Za-z0-9]+/).filter((w) => w && !/^(ltd|limited|plc|sarl|co|company|inc|the|and|of)$/i.test(w));
  const initials = words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join('') || 'SC';
  return `${initials}-INV`;
}

function settingsOf(db: Db, orgId: string): Settings {
  return db.get<Settings>('SELECT * FROM org_settings WHERE org_id = ?', orgId) ?? {
    invoice_prefix: null, invoice_next: 1, default_corridor: null, default_currency: null, default_incoterm: null,
    default_payment_terms: null, website: null, onboarding_dismissed_at: null,
  };
}

function ensureSettings(db: Db, orgId: string) {
  db.run('INSERT INTO org_settings (org_id, updated_at) VALUES (?, ?) ON CONFLICT(org_id) DO NOTHING', orgId, nowIso());
}

const formatInvoice = (prefix: string, seq: number, year = new Date().getUTCFullYear()) => `${prefix}-${year}-${String(seq).padStart(4, '0')}`;

const settingsBody = z.object({
  invoicePrefix: z.string().trim().max(20).regex(/^[A-Za-z0-9-]*$/, 'Letters, digits and dashes only').optional(),
  invoiceNext: z.number().int().min(1).max(999999).optional(),
  defaultCorridor: z.string().max(10).nullable().optional(),
  defaultCurrency: z.enum(CURRENCIES as [string, ...string[]]).nullable().optional(),
  defaultIncoterm: z.enum(INCOTERMS).nullable().optional(),
  defaultPaymentTerms: z.string().trim().max(200).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
});

export async function orgRoutes(api: FastifyInstance, { db }: Deps) {
  const exporterParty = (orgId: string) => db.get<{ id: string; data: string }>("SELECT id, data FROM parties WHERE org_id = ? AND role = 'exporter' ORDER BY created_at LIMIT 1", orgId);

  const profile = (orgId: string) => {
    const org = db.get<{ id: string; name: string; country: string; plan: string; kind: string; created_at: string }>('SELECT * FROM orgs WHERE id = ?', orgId)!;
    const s = settingsOf(db, orgId);
    const exp = exporterParty(orgId);
    const prefix = s.invoice_prefix || defaultInvoicePrefix(org.name);
    return {
      org: { id: org.id, name: org.name, country: org.country, plan: org.plan, kind: org.kind, createdAt: org.created_at },
      settings: {
        invoicePrefix: prefix,
        invoiceNext: s.invoice_next,
        nextInvoiceNumber: formatInvoice(prefix, s.invoice_next),
        defaultCorridor: s.default_corridor,
        defaultCurrency: s.default_currency,
        defaultIncoterm: s.default_incoterm,
        defaultPaymentTerms: s.default_payment_terms,
        website: s.website,
      },
      exporter: exp ? { id: exp.id, party: json(exp.data) } : null,
    };
  };

  api.get('/org', { preHandler: requireAuth }, async (req) => profile(req.auth!.org.id));

  api.put('/org', { preHandler: requireOwner }, async (req) => {
    const body = z.object({
      name: z.string().trim().min(2).max(200).optional(),
      settings: settingsBody.optional(),
      exporter: partySchema.optional(),
    }).parse(req.body);
    const orgId = req.auth!.org.id;
    if (body.settings?.defaultCorridor && !CORRIDORS[body.settings.defaultCorridor]) throw new HttpError(400, 'invalid_request', 'Unknown corridor');
    db.tx(() => {
      if (body.name) db.run('UPDATE orgs SET name = ? WHERE id = ?', body.name, orgId);
      if (body.settings) {
        ensureSettings(db, orgId);
        const map: Record<string, string> = {
          invoicePrefix: 'invoice_prefix', invoiceNext: 'invoice_next', defaultCorridor: 'default_corridor', defaultCurrency: 'default_currency',
          defaultIncoterm: 'default_incoterm', defaultPaymentTerms: 'default_payment_terms', website: 'website',
        };
        for (const [k, col] of Object.entries(map)) {
          const v = (body.settings as Record<string, unknown>)[k];
          if (v !== undefined) db.run(`UPDATE org_settings SET ${col} = ?, updated_at = ? WHERE org_id = ?`, (v === '' ? null : v) as string | number | null, nowIso(), orgId);
        }
      }
      if (body.exporter) {
        const exp = exporterParty(orgId);
        if (exp) db.run('UPDATE parties SET name = ?, data = ?, updated_at = ? WHERE id = ?', body.exporter.name, JSON.stringify(body.exporter), nowIso(), exp.id);
        else db.insert('parties', { id: newId('pty', 16), org_id: orgId, role: 'exporter', name: body.exporter.name, data: JSON.stringify(body.exporter), created_at: nowIso(), updated_at: nowIso() });
      }
    });
    audit(db, req.auth, 'org.update', 'org', orgId, { name: body.name, settings: body.settings, exporter: !!body.exporter });
    return profile(orgId);
  });

  /** Reserves the next invoice number (atomic; never handed out twice). */
  api.post('/org/invoice-number', { preHandler: requireAuth }, async (req) => {
    const orgId = req.auth!.org.id;
    const number = db.tx(() => {
      ensureSettings(db, orgId);
      const s = settingsOf(db, orgId);
      db.run('UPDATE org_settings SET invoice_next = invoice_next + 1, updated_at = ? WHERE org_id = ?', nowIso(), orgId);
      return formatInvoice(s.invoice_prefix || defaultInvoicePrefix(req.auth!.org.name), s.invoice_next);
    });
    return { number };
  });

  // ------------------------------------------------------------ onboarding
  api.get('/onboarding', { preHandler: requireAuth }, async (req) => {
    const orgId = req.auth!.org.id;
    const has = (sql: string, ...p: string[]) => !!db.get(sql, ...p);
    const s = settingsOf(db, orgId);
    const exp = exporterParty(orgId);
    const expParty = exp ? json<{ taxId?: string; address?: string }>(exp.data) : null;
    const teamGrown = has('SELECT 1 FROM users WHERE org_id = ? LIMIT 1 OFFSET 1', orgId) || has('SELECT 1 FROM invites WHERE org_id = ?', orgId);

    const steps = req.auth!.org.kind === 'authority'
      ? [
          { id: 'team', title: 'Invite your fellow officers', description: 'Each officer signs in with their own account.', done: teamGrown, href: '/app/team' },
          { id: 'decide', title: 'Decide your first endorsement request', description: 'Endorse or decline a certificate from your queue.', done: has("SELECT 1 FROM endorsements WHERE authority_org_id = ? AND status != 'pending'", orgId), href: '/app/authority' },
        ]
      : [
          { id: 'profile', title: 'Complete your company profile', description: 'Your address and TIN are printed on every document.', done: !!(expParty?.taxId && expParty.address), href: '/app/company' },
          { id: 'buyer', title: 'Save your first buyer', description: 'Consignees in the address book fill shipments in one click.', done: has("SELECT 1 FROM parties WHERE org_id = ? AND role = 'consignee'", orgId), href: '/app/parties' },
          { id: 'shipment', title: 'Create a shipment', description: 'Enter it once — invoice, certificate and packing list follow.', done: has('SELECT 1 FROM shipments WHERE org_id = ?', orgId), href: '/app/shipments/new' },
          { id: 'issue', title: 'Issue your first documents', description: 'Fix the errors the checks find, then issue and download.', done: has('SELECT 1 FROM documents WHERE org_id = ?', orgId), href: '/app/shipments' },
          { id: 'share', title: 'Share them with your buyer', description: 'One link to the whole bundle — they can verify every file.', done: has('SELECT 1 FROM share_links WHERE org_id = ?', orgId), href: '/app/shipments' },
          { id: 'team', title: 'Invite a colleague', description: 'Add the people who prepare or approve shipments.', done: teamGrown, href: '/app/team' },
        ];
    const done = steps.filter((x) => x.done).length;
    return { steps, done, total: steps.length, complete: done === steps.length, dismissed: !!s.onboarding_dismissed_at };
  });

  api.post('/onboarding/dismiss', { preHandler: requireAuth }, async (req) => {
    ensureSettings(db, req.auth!.org.id);
    db.run('UPDATE org_settings SET onboarding_dismissed_at = ? WHERE org_id = ?', nowIso(), req.auth!.org.id);
    return { ok: true };
  });
}
