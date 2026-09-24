/**
 * Persistence on Node's built-in SQLite (node:sqlite) — zero native
 * dependencies and ample for a pilot. All access goes through this module's
 * small helpers so moving to Postgres later is a contained change.
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import crypto from 'node:crypto';

export type Row = Record<string, unknown>;

const MIGRATIONS: string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'RW',
    plan TEXT NOT NULL DEFAULT 'pilot',
    created_at TEXT NOT NULL
  );
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE parties (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    role TEXT NOT NULL CHECK (role IN ('exporter','consignee')),
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX parties_org ON parties(org_id, role);
  CREATE TABLE shipments (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    reference TEXT NOT NULL,
    corridor_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    data TEXT NOT NULL,
    validation TEXT,
    issued_version INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX shipments_org ON shipments(org_id, updated_at);
  CREATE TABLE anchor_batches (
    id TEXT PRIMARY KEY,
    root TEXT NOT NULL,
    leaf_count INTEGER NOT NULL,
    backend TEXT NOT NULL,
    status TEXT NOT NULL,
    chain_id INTEGER,
    contract TEXT,
    tx_hash TEXT,
    block_number INTEGER,
    anchored_at TEXT,
    prev_entry TEXT,
    entry_hash TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX anchor_batches_status ON anchor_batches(status);
  CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    kind TEXT NOT NULL,
    number TEXT NOT NULL UNIQUE,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    data_hash TEXT NOT NULL,
    size INTEGER NOT NULL,
    pdf BLOB NOT NULL,
    summary TEXT NOT NULL,
    signature TEXT NOT NULL,
    signing_key_id TEXT NOT NULL,
    batch_id TEXT REFERENCES anchor_batches(id),
    proof TEXT,
    superseded_by TEXT,
    revoked_reason TEXT,
    issued_by TEXT NOT NULL,
    issued_at TEXT NOT NULL
  );
  CREATE INDEX documents_sha ON documents(sha256);
  CREATE INDEX documents_shipment ON documents(shipment_id, version);
  CREATE INDEX documents_pending ON documents(batch_id, status);
  CREATE TABLE sequences (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  CREATE TABLE verification_events (
    id TEXT PRIMARY KEY,
    document_id TEXT,
    method TEXT NOT NULL,
    outcome TEXT NOT NULL,
    client_hash TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX verification_events_doc ON verification_events(document_id, created_at);
  CREATE TABLE forensic_reports (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    result TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX forensic_reports_org ON forensic_reports(org_id, created_at);
  CREATE TABLE seal_references (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    authority TEXT NOT NULL,
    label TEXT NOT NULL,
    dhash TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE usage_events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    shipment_id TEXT,
    kind TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    period TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX usage_org_period ON usage_events(org_id, period);
  CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    period TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    recorded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE tariff_overrides (
    code TEXT PRIMARY KEY,
    cet_rate REAL NOT NULL,
    note TEXT,
    verified_at TEXT NOT NULL,
    verified_by TEXT NOT NULL
  );
  CREATE TABLE ruleset_verifications (
    corridor_id TEXT PRIMARY KEY,
    ruleset_version TEXT NOT NULL,
    verified_at TEXT NOT NULL,
    verified_by TEXT NOT NULL,
    note TEXT
  );
  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX audit_org ON audit_log(org_id, created_at);
  `,
  /* 2 — rules checklist, managed rule changes, team invites, password resets, mail outbox */ `
  CREATE TABLE rule_checks (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmed','incorrect')),
    note TEXT,
    checked_by TEXT NOT NULL,
    checked_at TEXT NOT NULL
  );
  CREATE TABLE rule_changes (
    id TEXT PRIMARY KEY,
    corridor_id TEXT,
    effective_from TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    hs_prefixes TEXT NOT NULL DEFAULT '[]',
    source_title TEXT NOT NULL,
    source_url TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE invites (
    token_hash TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    invited_by TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX invites_org ON invites(org_id);
  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE outbox (
    id TEXT PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    error TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT
  );
  `,
  /* 3 — anchoring cost accounting */ `
  ALTER TABLE anchor_batches ADD COLUMN gas_used INTEGER;
  ALTER TABLE anchor_batches ADD COLUMN gas_price_wei TEXT;
  `,
  /* 4 — share links, forensic outcomes, API keys */ `
  CREATE TABLE share_links (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    label TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX share_links_shipment ON share_links(shipment_id);
  CREATE TABLE share_views (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL REFERENCES share_links(id),
    action TEXT NOT NULL,
    document_id TEXT,
    client_hash TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX share_views_link ON share_views(link_id, created_at);
  ALTER TABLE forensic_reports ADD COLUMN outcome TEXT;
  ALTER TABLE forensic_reports ADD COLUMN outcome_note TEXT;
  ALTER TABLE forensic_reports ADD COLUMN outcome_by TEXT;
  ALTER TABLE forensic_reports ADD COLUMN outcome_at TEXT;
  CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked_at TEXT
  );
  `,
  /* 5 — sign in with Google / Apple */ `
  CREATE TABLE oauth_states (
    state_hash TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    nonce TEXT NOT NULL,
    code_verifier TEXT,
    next TEXT NOT NULL,
    invite_hash TEXT,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE user_identities (
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    email TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    PRIMARY KEY (provider, subject)
  );
  CREATE INDEX user_identities_user ON user_identities(user_id);
  CREATE TABLE oauth_pending (
    token_hash TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    next TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  `,
  /* 6 — explicit account linking from settings */ `
  ALTER TABLE oauth_states ADD COLUMN link_user_id TEXT;
  `,
  /* 7 — issuing-authority endorsement */ `
  ALTER TABLE orgs ADD COLUMN kind TEXT NOT NULL DEFAULT 'business';
  CREATE TABLE endorsements (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    requester_org_id TEXT NOT NULL REFERENCES orgs(id),
    authority_org_id TEXT NOT NULL REFERENCES orgs(id),
    status TEXT NOT NULL CHECK (status IN ('pending','endorsed','rejected','cancelled')),
    request_note TEXT,
    decision_note TEXT,
    decided_by TEXT,
    decided_by_name TEXT,
    decided_at TEXT,
    record_hash TEXT,
    signature TEXT,
    batch_id TEXT REFERENCES anchor_batches(id),
    proof TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX endorsements_doc ON endorsements(document_id);
  CREATE INDEX endorsements_authority ON endorsements(authority_org_id, status);
  CREATE INDEX endorsements_anchor ON endorsements(batch_id, status);
  `,
  /* 8 — keep the exact signed endorsement record */ `
  ALTER TABLE endorsements ADD COLUMN record TEXT;
  `,
  /* 9 — network fraud intelligence + alert throttling */ `
  ALTER TABLE forensic_reports ADD COLUMN cert_number TEXT;
  CREATE INDEX forensic_reports_sha ON forensic_reports(sha256);
  CREATE INDEX forensic_reports_cert ON forensic_reports(cert_number);
  CREATE TABLE alerts_sent (
    key TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL
  );
  `,
  /* 10 — webhooks */ `
  CREATE TABLE webhooks (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX webhooks_org ON webhooks(org_id);
  CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL REFERENCES webhooks(id),
    event TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL,
    response_code INTEGER,
    error TEXT,
    created_at TEXT NOT NULL,
    delivered_at TEXT
  );
  CREATE INDEX webhook_deliveries_due ON webhook_deliveries(status, next_attempt_at);
  CREATE INDEX webhook_deliveries_hook ON webhook_deliveries(webhook_id, created_at);
  `,
];

export class Db {
  readonly raw: DatabaseSync;

  constructor(file: string) {
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  private migrate() {
    this.raw.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
    const row = this.raw.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    let version = row?.version ?? 0;
    if (!row) this.raw.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
    while (version < MIGRATIONS.length) {
      this.tx(() => {
        this.raw.exec(MIGRATIONS[version]!);
        this.raw.prepare('UPDATE schema_version SET version = ?').run(version + 1);
      });
      version++;
    }
  }

  all<T = Row>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  get<T = Row>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.raw.prepare(sql).get(...params) as T | undefined;
  }

  run(sql: string, ...params: SQLInputValue[]) {
    return this.raw.prepare(sql).run(...params);
  }

  insert(table: string, values: Record<string, SQLInputValue | undefined>) {
    const entries = Object.entries(values).filter(([, v]) => v !== undefined) as [string, SQLInputValue][];
    const cols = entries.map(([k]) => k).join(', ');
    const qs = entries.map(() => '?').join(', ');
    return this.run(`INSERT INTO ${table} (${cols}) VALUES (${qs})`, ...entries.map(([, v]) => v));
  }

  /** Runs fn in a transaction (nested calls join the outer one). */
  tx<T>(fn: () => T): T {
    if (this.raw.isTransaction) return fn();
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.raw.exec('COMMIT');
      return out;
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    }
  }

  /** Atomically increments and returns a named counter. */
  nextSequence(name: string): number {
    return this.tx(() => {
      this.run('INSERT INTO sequences (name, value) VALUES (?, 0) ON CONFLICT(name) DO NOTHING', name);
      this.run('UPDATE sequences SET value = value + 1 WHERE name = ?', name);
      return (this.get<{ value: number }>('SELECT value FROM sequences WHERE name = ?', name))!.value;
    });
  }

  close() {
    this.raw.close();
  }
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Unguessable, URL-safe id with a type prefix, e.g. doc_k3m9... */
export function newId(prefix: string, length = 20): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function json<T>(v: unknown): T {
  return JSON.parse(String(v)) as T;
}
