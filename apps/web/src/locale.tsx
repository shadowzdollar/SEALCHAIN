/**
 * Site-wide language. One choice (remembered, and sent as <html lang>) drives
 * every page: the public site, sign-in, the app and the verifier.
 *
 * Text is keyed by its English wording — `tr('Sign in')` — so untranslated
 * text falls back to English instead of breaking. Dictionaries live in
 * ./locales; `pnpm --filter @sealchain/web i18n:check` lists anything missing.
 *
 * REVIEW STATUS: French is final quality. Kiswahili and Kinyarwanda are drafts
 * prepared without a native speaker and must be reviewed before the pilot
 * relies on them (see docs/DECISIONS.md).
 */
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Globe } from 'lucide-react';
import { LANGS, LangContext, detectLang, type Lang } from './i18n';
import { FR } from './locales/fr';
import { SW } from './locales/sw';
import { RW } from './locales/rw';
import { cx } from './components/ui';

const DICT: Record<Exclude<Lang, 'en'>, Record<string, string>> = { fr: FR, sw: SW, rw: RW };

type Vars = Record<string, string | number>;
const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s);

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });

/** The language currently rendered; read by the global t()/tx() helpers. */
let current: Lang = 'en';

/** Translate anywhere (components, helpers). The tree re-renders on a language change. */
export const t = (text: string, vars?: Vars) => translate(current, text, vars);

/** t() with React nodes for {placeholders}, e.g. tx('Read the {link}.', { link: <a …/> }). */
export function tx(text: string, nodes: Record<string, ReactNode>): ReactNode {
  const s = current === 'en' ? text : (DICT[current][text] ?? text);
  return s.split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{m ? (nodes[m[1]!] ?? part) : part}</Fragment>;
  });
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('sc-lang', l);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  current = lang;
  // Keyed by language so every component re-renders with the new text.
  // The verifier's keyed dictionary shares the same choice.
  return (
    <Ctx.Provider value={value}>
      <LangContext.Provider value={value}>
        <Fragment key={lang}>{children}</Fragment>
      </LangContext.Provider>
    </Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);

/** Marks English text defined as data (menus, FAQs) so the checker finds it; translate it with tr() when rendering. */
export const msg = (s: string) => s;

/** Translate by English source text. Also usable outside React via translate(). */
export function translate(lang: Lang, text: string, vars?: Vars): string {
  const hit = lang === 'en' ? undefined : DICT[lang][text];
  return fill(hit ?? text, vars);
}

export function useTr() {
  const { lang } = useLang();
  const tr = useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang]);
  /** Like tr(), but {placeholders} may be React nodes (e.g. an emphasised word). */
  const trx = useCallback(
    (text: string, nodes: Record<string, ReactNode>) => {
      const s = lang === 'en' ? text : (DICT[lang][text] ?? text);
      return s.split(/(\{\w+\})/g).map((part, i) => {
        const m = /^\{(\w+)\}$/.exec(part);
        return <Fragment key={i}>{m ? (nodes[m[1]!] ?? part) : part}</Fragment>;
      });
    },
    [lang],
  );
  return { tr, trx, lang };
}

/** Language picker: a compact globe button with the four languages. */
export function LanguageSwitcher({ className, tone = 'default', align = 'right' }: { className?: string; tone?: 'default' | 'onDark'; align?: 'left' | 'right' }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.id === lang)!;
  return (
    <div className={cx('relative', className)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.label}`}
        className={cx(
          'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] transition-colors',
          tone === 'onDark' ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-navy-200 dark:hover:bg-navy-800 dark:hover:text-white',
        )}
      >
        <Globe className="size-4" />
        <span className="font-mono text-[11.5px] uppercase tracking-[0.08em]">{lang}</span>
      </button>
      {open && (
        <ul role="listbox" aria-label="Language" className={cx('absolute z-50 mt-1.5 w-44 overflow-hidden rounded-[3px] border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10 dark:border-navy-700 dark:bg-navy-900', align === 'right' ? 'right-0' : 'left-0')}>
          {LANGS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={l.id === lang}
                lang={l.id}
                onClick={() => {
                  setLang(l.id);
                  setOpen(false);
                }}
                className={cx('flex w-full items-center justify-between px-3 py-2 text-left text-[13.5px] hover:bg-slate-50 dark:hover:bg-navy-800', l.id === lang && 'font-medium')}
              >
                {l.label}
                <span className="font-mono text-[10.5px] uppercase text-slate-400">{l.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
