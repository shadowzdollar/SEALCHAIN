/**
 * Public verification page — for customs officers, banks and buyers.
 * The file is hashed in the browser; only the hash leaves the device. The
 * Merkle proof is recomputed locally and the chain can be queried directly,
 * so the verifier does not have to trust SealChain's servers.
 */
import { useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlertOctagon, BadgeCheck, CheckCircle2, ChevronDown, Clock, ExternalLink, FileQuestion, FileWarning, HelpCircle, Printer, RefreshCw, RotateCcw, Search, ShieldCheck, XCircle,
} from 'lucide-react';
import { anchoredAtCallData, computeRootFromProof, decodeUint, formatHs, sha256Hex } from '@sealchain/core';
import { ApiError, api, type VerificationResult } from '../api';
import { Logo, ThemeToggle } from '../components/Layout';
import { LanguageSwitcher, useTr } from '../locale';
import { Inspecting, MethodPicker, SealRings, StampedDocument, VERIFY_ICONS, verdictTone } from '../marketing/VerifyDesk';
import { Alert, Badge, Button, Dropzone, Hash, Spinner, cx } from '../components/ui';
import { COUNTRY_NAME, bytes, dateTime, money, num, date } from '../format';
import { EndorsementsView } from '../components/Endorsement';
import { LANGS, LangContext, detectLang, useT, type Lang } from '../i18n';

async function hashFile(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Hex(buf); // non-secure contexts (plain http on a LAN IP)
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; msg: string }
  | { kind: 'result'; result: VerificationResult; file?: { name: string; size: number } }
  | { kind: 'not_found'; sha256?: string; file?: File; message: string }
  | { kind: 'error'; message: string };

const VERDICT: Record<string, { key: 'authentic' | 'pending' | 'superseded' | 'revoked' | 'tampered' | 'missing'; tone: string; icon: ReactNode }> = {
  authentic: {
    key: 'authentic',
    tone: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-50',
    icon: <ShieldCheck className="size-8 text-emerald-600" />,
  },
  authentic_pending_anchor: {
    key: 'pending',
    tone: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-50',
    icon: <Clock className="size-8 text-sky-600" />,
  },
  superseded: {
    key: 'superseded',
    tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50',
    icon: <RefreshCw className="size-8 text-amber-600" />,
  },
  revoked: {
    key: 'revoked',
    tone: 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-50',
    icon: <XCircle className="size-8 text-red-600" />,
  },
  tampered: {
    key: 'tampered',
    tone: 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-50',
    icon: <AlertOctagon className="size-8 text-red-600" />,
  },
  anchor_missing: {
    key: 'missing',
    tone: 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-50',
    icon: <FileWarning className="size-8 text-red-600" />,
  },
};

/** Public verifier. The language is the site-wide choice (see locale.tsx). */
export function Verify() {
  return <VerifyPage />;
}

export function LanguageSelect() {
  const { lang, setLang } = useContext(LangContext);
  return (
    <select aria-label="Language" className="rounded-[3px] border border-slate-200 bg-white px-2 py-1 text-xs text-navy-900 dark:border-white/20 dark:bg-white/5 dark:text-white [&>option]:text-slate-900" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
      {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
    </select>
  );
}

function VerifyPage() {
  const { t } = useT();
  const { tr } = useTr();
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: id ? 'loading' : 'idle', msg: t('lookingUp') } as State);
  // Keep the inspection on screen long enough to read; the checks themselves are real.
  const settle = async <T,>(p: Promise<T>): Promise<T> => {
    const [r] = await Promise.allSettled([p, new Promise((ok) => setTimeout(ok, 1300))]);
    if (r.status === 'rejected') throw r.reason;
    return r.value as T;
  };

  const loadById = useCallback(async (sha?: string, file?: File) => {
    setState({ kind: 'loading', msg: sha ? t('comparing') : t('lookingUp') });
    try {
      const result = await settle(api.get<VerificationResult>(`/verify/${id}${sha ? `?sha256=${sha}` : ''}`));
      setState({ kind: 'result', result, file: file ? { name: file.name, size: file.size } : undefined });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState({ kind: 'not_found', message: e.message });
      else setState({ kind: 'error', message: e instanceof Error ? e.message : 'Verification failed' });
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id) void loadById();
  }, [id, loadById]);

  async function onFile(file: File) {
    setState({ kind: 'loading', msg: t('hashing') });
    const sha = await hashFile(file);
    if (id) return loadById(sha, file);
    try {
      const result = await settle(api.get<VerificationResult>(`/verify/hash/${sha}`));
      setState({ kind: 'result', result, file: { name: file.name, size: file.size } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState({ kind: 'not_found', sha256: sha, file, message: e.message });
      else setState({ kind: 'error', message: e instanceof Error ? e.message : 'Verification failed' });
    }
  }

  async function identify(file: File) {
    setState({ kind: 'loading', msg: t('uploading') });
    const fd = new FormData();
    fd.append('file', file);
    try {
      const result = await settle(api.post<VerificationResult>('/verify/file', fd));
      setState({ kind: 'result', result, file: { name: file.name, size: file.size } });
    } catch (e) {
      setState({ kind: 'not_found', message: e instanceof ApiError ? e.message : 'Not found' });
    }
  }

  const again = () => { setState({ kind: 'idle' }); if (id) void navigate('/verify'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const tone = state.kind === 'result' ? verdictTone(state.result.verdict) : state.kind === 'not_found' ? 'bad' : null;

  return (
    <div className="verify-page min-h-dvh bg-paper">
      {/* the desk */}
      <div className={cx('verify-desk relative isolate overflow-hidden bg-[#08111f] text-white', tone && `tone-${tone}`, state.kind !== 'result' && 'min-h-dvh')}>
        <div aria-hidden className="verify-grid absolute inset-0 -z-10" />
        <div aria-hidden className="verify-glow absolute inset-0 -z-10" />
        <header className="print:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <Link to="/"><Logo light /></Link>
              <span className="hidden h-5 w-px bg-white/20 sm:block" />
              <span className="hidden truncate font-plexmono text-[11px] uppercase tracking-[0.16em] text-white/55 sm:block">{tr('Document verification')}</span>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSwitcher tone="onDark" />
              <ThemeToggle className="!text-inherit opacity-80 hover:!bg-white/10 hover:opacity-100" />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
          {state.kind === 'idle' && (
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="hero-in">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-plexmono text-[11px] uppercase tracking-[0.16em] text-[#f4c542]"><ShieldCheck className="size-3.5" /> {tr('Free · no account · 4 languages')}</p>
                <h1 className="mt-5 font-serif text-[42px] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[58px]">{tr('Is this document real?')}</h1>
                <p className="mt-4 max-w-md text-[17px] leading-relaxed text-white/70">{tr('Find out in seconds. Scan its QR code, drop the PDF, or type its number — we check it against the original that was issued.')}</p>
                <ul className="mt-8 space-y-3 text-[14.5px] text-white/80">
                  {[tr('Spots any change, down to a single character'), tr('Shows whether an authority approved it'), tr('Your file is checked on your device — never uploaded')].map((x) => (
                    <li key={x} className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"><CheckCircle2 className="size-4" /></span>{x}</li>
                  ))}
                </ul>
              </div>
              <MethodPicker onFile={onFile} />
            </div>
          )}

          {state.kind === 'loading' && <Inspecting label={state.msg} />}

          {state.kind === 'error' && <Alert tone="error" title={t('couldNotVerify')}>{state.message}</Alert>}

          {state.kind === 'not_found' && (
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="pop-in">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-300"><FileQuestion className="size-8" /></span>
                <h1 className="mt-5 font-serif text-[36px] font-semibold leading-tight sm:text-[46px]">{t('notFound')}</h1>
                <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-white/70">{state.message}</p>
                {state.sha256 && <p className="mt-4 break-all font-plexmono text-[11px] text-white/40">sha256 {state.sha256}</p>}
                <div className="mt-7 flex flex-wrap gap-3">
                  {state.file && <button type="button" onClick={() => void identify(state.file!)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f4c542] px-5 text-[14px] font-semibold text-[#0b1f3a]"><Search className="size-4" /> {t('identify')}</button>}
                  <button type="button" onClick={again} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-[14px] font-medium text-white hover:bg-white/10"><RotateCcw className="size-4" /> {tr('Check another document')}</button>
                </div>
                {state.file && <p className="mt-3 max-w-md text-[12.5px] text-white/50">{t('identifyHint')}</p>}
              </div>
              <StampedDocument verdict="not_found" kindLabel={tr('Unknown document')} number="—" from="—" to="—" goods="—" issued="—" />
            </div>
          )}

          {state.kind === 'result' && <ResultHero result={state.result} file={state.file} onAgain={again} />}
        </main>
      </div>

      {state.kind === 'result' && (
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <ResultView result={state.result} onFile={onFile} withDrop={!!id} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- result
function ResultHero({ result, file, onAgain }: { result: VerificationResult; file?: { name: string; size: number }; onAgain: () => void }) {
  const { t } = useT();
  const { tr } = useTr();
  const v = VERDICT[result.verdict] ?? VERDICT.authentic_pending_anchor!;
  const d = result.document;
  const s = d.summary;
  const localRoot = result.anchor.proof ? computeRootFromProof(result.integrity.sha256, result.anchor.proof) : null;
  const proofOk = !!localRoot && localRoot === result.anchor.root;
  const ledgerOk = result.anchor.status !== 'confirmed' ? null : result.anchor.onChain.checked ? !!result.anchor.onChain.anchoredAt : null;
  const endorsers = (result.endorsements ?? []).filter((e) => e.signatureValid && e.matchesDocument).map((e) => e.authority);
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <StampedDocument
        verdict={result.verdict}
        kindLabel={d.kindLabel}
        number={d.number}
        from={s.exporterName}
        to={s.consigneeName}
        goods={s.items[0]?.description ?? '—'}
        issued={date(d.issuedAt)}
      />
      <div className="min-w-0">
        <p className="font-plexmono text-[11px] uppercase tracking-[0.2em] text-white/50">{tr('Verdict')}</p>
        <h1 className="verdict-title mt-2 font-serif text-[34px] font-semibold leading-[1.08] tracking-[-0.015em] sm:text-[46px]">{t(`v.${v.key}.t`)}</h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-white/75">{t(`v.${v.key}.b`)}</p>
        {result.verdict === 'superseded' && d.supersededBy && (
          <p className="mt-3 text-[15px]">{t('currentVersion')} <Link className="font-semibold text-[#f4c542] underline" to={`/v/${d.supersededBy.id}`}>{d.supersededBy.number}</Link></p>
        )}
        {result.verdict === 'revoked' && d.revokedReason && <p className="mt-3 text-[15px] font-medium">{t('reasonGiven')} {d.revokedReason}</p>}
        {endorsers.length > 0 && result.verdict === 'authentic' && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3.5 py-1.5 text-[13.5px] font-medium text-emerald-200"><BadgeCheck className="size-4" /> {t('endorsedBy', { who: endorsers.join(', ') })}</p>
        )}
        <div className="mt-8">
          <SealRings checks={[
            { label: result.integrity.matches === null ? tr('File not compared') : tr('Your file matches'), ok: result.integrity.matches, icon: VERIFY_ICONS.file },
            { label: tr('SealChain seal'), ok: result.signature.valid, icon: VERIFY_ICONS.seal },
            { label: tr('Proof rebuilt here'), ok: result.anchor.proof ? proofOk : null, icon: VERIFY_ICONS.proof },
            { label: tr('Public ledger'), ok: ledgerOk, icon: VERIFY_ICONS.ledger },
          ]} />
        </div>
        {file && <p className="mt-6 text-[12.5px] text-white/50">{t('checkedFile')} {file.name} ({bytes(file.size)})</p>}
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-[#0b1f3a]"><Printer className="size-4" /> {tr('Print verification receipt')}</button>
          <button type="button" onClick={onAgain} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-[14px] font-medium hover:bg-white/10"><RotateCcw className="size-4" /> {tr('Check another document')}</button>
        </div>
      </div>
    </div>
  );
}

function ResultView({ result, onFile, withDrop }: { result: VerificationResult; onFile: (f: File) => void; withDrop: boolean }) {
  const { t, status } = useT();
  const d = result.document;
  const s = d.summary;
  const localRoot = result.anchor.proof ? computeRootFromProof(result.integrity.sha256, result.anchor.proof) : null;
  const proofOk = !!localRoot && localRoot === result.anchor.root;

  return (
    <div className="space-y-5">
      {withDrop && result.integrity.matches === null && (
        <Dropzone
          onFile={onFile}
          label={t('compareLabel')}
          sub={t('compareSub')}
        />
      )}

      <div className="grid gap-5 md:grid-cols-5">
        <section className="card p-5 md:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{d.kindLabel}</p>
              <p className="mono mt-0.5 text-sm font-medium">{d.number}</p>
            </div>
            <Badge tone={d.status === 'active' ? 'green' : d.status === 'revoked' ? 'red' : 'amber'}>{status(d.status)} · v{d.version}</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Item k={t('exporter')} v={<>{s.exporterName}<span className="text-slate-500"> · {COUNTRY_NAME[(s as { exporterCountry?: string }).exporterCountry ?? ''] ?? ''}</span></>} />
            <Item k={t('consignee')} v={<>{s.consigneeName}<span className="text-slate-500"> · {COUNTRY_NAME[(s as { consigneeCountry?: string }).consigneeCountry ?? ''] ?? ''}</span></>} />
            <Item k={t('invoice')} v={`${s.invoiceNumber} · ${date(s.invoiceDate)}`} />
            <Item k={t('corridor')} v={s.corridor} />
            <Item k={t('issued')} v={dateTime(d.issuedAt)} />
            <Item k={t('issuedVia')} v={`SealChain · ${d.issuer}`} />
            <Item k={t('packagesGross')} v={`${num(s.packages)} · ${num(s.grossWeightKg)} kg`} />
            <Item k={t('checkedBefore')} v={result.checks?.parties ? t(result.checks.parties === 1 ? 'party' : 'parties', { n: result.checks.parties, date: date(result.checks.since) }) : t('noOne')} />
            {s.invoiceTotal !== undefined && <Item k={t('invoiceTotal')} v={`${money(s.invoiceTotal, s.currency)} · ${s.incoterm}`} />}
          </dl>
          <div className="-mx-5 mt-4 overflow-x-auto border-t border-slate-100 dark:border-navy-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-2 font-medium">{t('goods')}</th>
                  <th className="px-2 py-2 font-medium">{t('hs')}</th>
                  <th className="px-2 py-2 font-medium">{t('origin')}</th>
                  <th className="px-5 py-2 text-right font-medium">{t('qtyGross')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {s.items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2">{it.description}<span className="block text-xs text-slate-500">{it.packageCount} {t('packages')}</span></td>
                    <td className="mono whitespace-nowrap px-2 py-2">{formatHs(it.hsCode)}</td>
                    <td className="whitespace-nowrap px-2 py-2">{it.originCountry} · {it.originCriterion}</td>
                    <td className="whitespace-nowrap px-5 py-2 text-right tabular-nums">{num(it.quantity)} {it.unit}<span className="block text-xs text-slate-500">{num(it.grossWeightKg)} kg</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">{t('compareParticulars')}</p>
        </section>

        <section className="card p-5 md:col-span-2">
          <h2 className="text-sm font-semibold">{t('checks')}</h2>
          <ul className="mt-3 space-y-3">
            <Check
              ok={result.integrity.matches}
              title={result.integrity.matches === null ? t('fileNotCompared') : result.integrity.matches ? t('fileIdentical') : t('fileDiffers')}
              detail={result.integrity.matches === null ? t('dropToCompare') : undefined}
            />
            <Check ok={result.signature.valid} title={result.signature.valid ? t('sigValid') : t('sigInvalid')} detail={`Ed25519 · key ${result.signature.keyId}`} />
            <Check
              ok={result.anchor.proof ? proofOk : null}
              title={result.anchor.proof ? (proofOk ? t('proofOk') : t('proofBad')) : t('waitingBatch')}
              detail={result.anchor.proof ? `${result.anchor.proof.length} step(s) → root ${result.anchor.root?.slice(0, 10)}…` : undefined}
            />
            <ChainCheck result={result} />
          </ul>
          {!result.anchor.independentlyVerifiable && (
            <Alert tone="warning" className="mt-4">{t('devWarning')}</Alert>
          )}
        </section>
      </div>

      {result.checks?.possibleReuse && (
        <Alert tone="warning" title={t('reuseTitle')}>{t('reuseBody', { n: result.checks.parties, date: date(result.checks.since) })}</Alert>
      )}
      {(d.kind === 'certificate_of_origin' || d.kind === 'simplified_certificate_of_origin') && <EndorsementsView endorsements={result.endorsements ?? []} />}

      <TechnicalDetails result={result} />

      {withDrop && result.integrity.matches !== null && <Dropzone onFile={onFile} compact label={t('checkAnotherRecord')} sub={t('hashedLocally')} />}
    </div>
  );
}

function Item({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  );
}

function Check({ ok, title, detail, children }: { ok: boolean | null; title: string; detail?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      {ok === null ? <HelpCircle className="mt-0.5 size-4 shrink-0 text-slate-400" /> : ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />}
      <div className="min-w-0 text-sm">
        <p className="font-medium">{title}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
        {children}
      </div>
    </li>
  );
}

/** Asks the chain directly from the browser — no SealChain server involved. */
function ChainCheck({ result }: { result: VerificationResult }) {
  const { t } = useT();
  const a = result.anchor;
  const [direct, setDirect] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; ts?: number; error?: string }>({ state: 'idle' });

  async function checkDirect() {
    if (!a.publicRpcUrl || !a.contract || !a.root) return;
    setDirect({ state: 'loading' });
    try {
      const res = await fetch(a.publicRpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: a.contract, data: anchoredAtCallData(a.root) }, 'latest'] }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error.message);
      setDirect({ state: 'done', ts: decodeUint(body.result) });
    } catch (e) {
      setDirect({ state: 'error', error: e instanceof Error ? e.message : 'RPC error' });
    }
  }

  if (a.status !== 'confirmed') {
    return <Check ok={null} title={t('anchorPending')} detail={t('anchorPendingD')} />;
  }
  const ok = a.onChain.checked ? !!a.onChain.anchoredAt : null;
  return (
    <Check
      ok={ok}
      title={a.backend === 'local' ? t('devLedger') : ok ? t('rootOk') : a.onChain.checked ? t('rootMissing') : t('chainDown')}
      detail={a.onChain.anchoredAt ? `${t('blockTime')} ${dateTime(a.onChain.anchoredAt)} · ${a.networkName}` : a.onChain.error}
    >
      {a.backend === 'evm' && a.publicRpcUrl && (
        <div className="mt-1.5">
          {direct.state === 'idle' && <button onClick={() => void checkDirect()} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">{t('checkChain')}</button>}
          {direct.state === 'loading' && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Spinner className="size-3" /> {t('querying')} {new URL(a.publicRpcUrl).host}…</span>}
          {direct.state === 'done' && (
            <span className={cx('text-xs font-medium', direct.ts ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>
              {direct.ts ? `${t('chainOk')} ${dateTime(new Date(direct.ts * 1000).toISOString())}` : t('chainNo')}
            </span>
          )}
          {direct.state === 'error' && <span className="text-xs text-red-600">{t('rpcError')} {direct.error}</span>}
        </div>
      )}
    </Check>
  );
}

function TechnicalDetails({ result }: { result: VerificationResult }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const a = result.anchor;
  const rows: Array<[string, ReactNode]> = [
    ['Document SHA-256', <Hash value={result.integrity.sha256} full />],
    ...(result.integrity.providedSha256 && !result.integrity.matches ? [['Your file SHA-256', <Hash value={result.integrity.providedSha256} full />] as [string, ReactNode]] : []),
    ['Merkle root', <Hash value={a.root} full />],
    ['Batch size', a.leafCount ? `${a.leafCount} document(s)` : '—'],
    ['Network', `${a.networkName}${a.chainId ? ` (chain id ${a.chainId})` : ''}`],
    ['Contract', <Hash value={a.contract} />],
    ['Transaction', a.explorerUrl ? <a className="inline-flex items-center gap-1 text-brand-700 underline dark:text-brand-300" href={a.explorerUrl} target="_blank" rel="noreferrer">{a.txHash?.slice(0, 18)}… <ExternalLink className="size-3" /></a> : <Hash value={a.txHash} />],
    ['Block', a.blockNumber ?? '—'],
    ['Issuer public key', <Hash value={result.signature.publicKey} />],
    ['Signature', <Hash value={result.signature.signature} />],
  ];
  return (
    <section className="card">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold">
        <span className="flex items-center gap-2"><BadgeCheck className="size-4 text-slate-400" /> {t('technicalProof')}</span>
        <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-navy-700">
          <dl className="grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-xs text-slate-500 sm:pt-0.5">{k}</dt>
                <dd className="min-w-0 break-all">{v}</dd>
              </div>
            ))}
          </dl>
          {a.proof && a.proof.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500">Inclusion proof (leaf = SHA256(0x00‖doc), node = SHA256(0x01‖left‖right))</p>
              <ol className="mt-2 space-y-1">
                {a.proof.map((p, i) => (
                  <li key={i} className="mono flex gap-2 break-all text-slate-600 dark:text-navy-300"><span className="w-6 shrink-0 text-slate-400">{p.side}</span>{p.hash}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
