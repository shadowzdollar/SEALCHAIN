#!/usr/bin/env node
/**
 * Lists English source strings that have no translation.
 *   node scripts/i18n-check.mjs            # summary per language
 *   node scripts/i18n-check.mjs fr --list  # the missing French strings
 * Finds tr('…'), trx('…') and msg('…') calls with literal text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'locales') walk(p); } else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(root);

// Verify.tsx and Endorsement.tsx use the verifier's keyed dictionary (i18n.ts), fully translated already.
const SKIP = new Set(['i18n.ts', path.join('pages', 'Verify.tsx'), path.join('components', 'Endorsement.tsx')]);
const RE = /\b(?:tr|trx|msg|t|tx)\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
const keys = new Map();
for (const f of files) {
  if (SKIP.has(path.relative(root, f))) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(RE)) {
    if (m[1] === '`' && m[2].includes('${')) continue;
    const text = m[2].replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
    if (!keys.has(text)) keys.set(text, path.relative(root, f));
  }
}

const [only, flag] = process.argv.slice(2);
let missingTotal = 0;
for (const lang of ['fr', 'sw', 'rw']) {
  if (only && only !== lang) continue;
  const mod = await import(pathToFileURL(path.join(root, 'locales', `${lang}.ts`)).href);
  const dict = mod[lang.toUpperCase()];
  const missing = [...keys.keys()].filter((k) => !(k in dict));
  const unused = Object.keys(dict).filter((k) => !keys.has(k));
  missingTotal += missing.length;
  console.log(`${lang}: ${keys.size - missing.length}/${keys.size} translated${unused.length ? `, ${unused.length} unused` : ''}`);
  if (flag === '--list') for (const k of missing) console.log(`  [${keys.get(k)}] ${JSON.stringify(k)}`);
  if (flag === '--unused') for (const k of unused) console.log(`  ${JSON.stringify(k)}`);
}
process.exit(missingTotal && process.argv.includes('--strict') ? 1 : 0);
