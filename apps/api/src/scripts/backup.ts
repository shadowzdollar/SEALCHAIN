/**
 * Online backup of the SealChain database (safe while the API is running —
 * uses SQLite's backup API, not a file copy). Keeps the newest BACKUP_KEEP
 * files (default 14).
 *
 *   pnpm --filter @sealchain/api backup [target-dir]
 *
 * Schedule it (cron / systemd timer) and ship the directory off the machine:
 * the database holds every issued document and its proof. The issuer key in
 * DATA_DIR must be backed up separately and kept secret.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { loadConfig } from '../config';

const cfg = loadConfig();
const dir = path.resolve(process.argv[2] ?? path.join(cfg.dataDir, 'backups'));
const keep = Number(process.env.BACKUP_KEEP ?? 14);
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(dir, `sealchain-${stamp}.sqlite`);
const source = new DatabaseSync(cfg.dbFile);
const pages = await backup(source, target);
source.close();

// Verify the copy opens and is consistent.
const check = new DatabaseSync(target, { readOnly: true });
const integrity = (check.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
const docs = (check.prepare('SELECT COUNT(*) AS n FROM documents').get() as { n: number }).n;
check.close();
if (integrity !== 'ok') {
  console.error(`Backup ${target} failed integrity check: ${integrity}`);
  process.exit(1);
}

const old = fs.readdirSync(dir).filter((f) => /^sealchain-.*\.sqlite$/.test(f)).sort().reverse().slice(keep);
for (const f of old) fs.rmSync(path.join(dir, f));

console.log(`Backed up ${pages} pages (${docs} documents) to ${target}${old.length ? `; pruned ${old.length} old backup(s)` : ''}`);
