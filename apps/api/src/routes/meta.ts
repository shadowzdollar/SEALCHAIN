import type { FastifyInstance } from 'fastify';
import { CORRIDORS, CURRENCIES, LocalCatalogClassifier, REQUIREMENTS, TARIFF_CATALOG, type Corridor } from '@sealchain/core';
import type { Deps } from '../services/documents';
import { rulesetVerifiedAt, tariffLookup } from '../services/rules';
import { enabledProviders } from '../services/oidc';

const classifier = new LocalCatalogClassifier();

export function publicCorridor(c: Corridor, verifiedAt: string | null) {
  return {
    ...c,
    rulesetVerifiedAt: verifiedAt,
    taxId: {
      exporter: { ...c.taxId.exporter, pattern: c.taxId.exporter.pattern.source },
      consignee: { ...c.taxId.consignee, pattern: c.taxId.consignee.pattern.source },
    },
  };
}

export async function metaRoutes(api: FastifyInstance, { db, cfg, signer, anchor }: Deps) {
  api.get('/health', async () => ({ ok: true, anchor: (await anchor.backend.health()).ok }));

  api.get('/meta', async () => ({
    corridors: Object.values(CORRIDORS).map((c) => publicCorridor(c, rulesetVerifiedAt(db, c.id))),
    requirements: REQUIREMENTS,
    currencies: CURRENCIES,
    catalogSize: TARIFF_CATALOG.length,
    anchor: anchor.backend.info,
    billing: cfg.billing,
    publicWebUrl: cfg.publicWebUrl,
    oauthProviders: enabledProviders(cfg),
    issuerKey: { keyId: signer.keyId, algorithm: 'Ed25519', publicKey: signer.publicKeyRawHex },
  }));

  api.get('/keys', async () => ({
    keys: [{ keyId: signer.keyId, algorithm: 'Ed25519', publicKeyHex: signer.publicKeyRawHex, publicKeyPem: signer.publicKeyPem, status: 'active' }],
  }));

  /** Tariff classification suggestions (compliance overrides applied). */
  api.get<{ Querystring: { q?: string; limit?: string } }>('/tariff/search', async (req) => {
    const q = (req.query.q ?? '').slice(0, 200);
    const limit = Math.min(10, Math.max(1, Number(req.query.limit ?? 6)));
    const lookup = tariffLookup(db);
    const results = await classifier.classify(q, limit);
    return {
      provider: classifier.name,
      results: results.map((r) => ({ ...r, line: lookup(r.line.code) ?? r.line })),
    };
  });

  api.get<{ Params: { code: string } }>('/tariff/:code', async (req, reply) => {
    const line = tariffLookup(db)(req.params.code);
    if (!line) return reply.code(404).send({ error: 'not_found', message: 'HS code not in catalog' });
    return line;
  });
}
