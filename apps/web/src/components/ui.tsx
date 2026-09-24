import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Loader2, UploadCloud, X, XCircle } from 'lucide-react';

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

// ----------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-[0_1px_2px_rgba(29,78,216,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] disabled:bg-brand-700/50',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:bg-navy-900 dark:text-slate-100 dark:border-navy-600 dark:hover:bg-navy-800',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-navy-200 dark:hover:bg-navy-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-[0_1px_2px_rgba(220,38,38,0.25)]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }) {
  const sizes = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-9 px-3.5 text-[13px] gap-2', lg: 'h-10 px-5 text-sm gap-2' };
  return (
    <button
      className={cx(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-600/25 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT[variant],
        sizes[size],
        className,
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------- Card
export function Card({ className, children, title, action, subtitle, padded = true }: { className?: string; children: ReactNode; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-3.5 dark:border-navy-700">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-slate-500 dark:text-navy-300">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ Badge
export type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'blue' | 'violet';
const TONE: Record<Tone, string> = {
  neutral: 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-navy-800 dark:text-navy-200 dark:ring-navy-600',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-800',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800',
  red: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-800',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-1.5 py-[3px] text-[11.5px] font-medium leading-none ring-1 ring-inset', TONE[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ Field
export function Field({ label, hint, error, children, className, required, path }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string; required?: boolean; path?: string }) {
  return (
    <label className={cx('block', className)} data-path={path}>
      <span className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500 dark:text-navy-300">{hint}</span> : null}
    </label>
  );
}

// ------------------------------------------------------------------ Alert
export function Alert({ tone = 'info', title, children, className }: { tone?: 'info' | 'success' | 'warning' | 'error'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: ['border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100', Info],
    success: ['border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100', CheckCircle2],
    warning: ['border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100', AlertTriangle],
    error: ['border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100', XCircle],
  } as const;
  const [cls, Icon] = styles[tone];
  return (
    <div className={cx('flex gap-3 rounded-lg border px-4 py-3 text-sm', cls, className)} role={tone === 'error' ? 'alert' : undefined}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(!!title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Spinner
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-slate-400', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner />
    </div>
  );
}

// ------------------------------------------------------------- PageHeader
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-navy-800">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[13px] text-slate-500 dark:text-navy-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ------------------------------------------------------------------- Stat
export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        {icon && <span className="flex size-7 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-navy-800 dark:text-brand-300 [&>svg]:size-3.5">{icon}</span>}
      </div>
      <p className="mt-2.5 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="mt-2 text-[12px] text-slate-500 dark:text-navy-300">{sub}</p>}
    </div>
  );
}

// ------------------------------------------------------------------- Hash
export function Hash({ value, className, full }: { value: string | null | undefined; className?: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-slate-400">—</span>;
  const shown = full ? value : `${value.slice(0, 12)}…${value.slice(-8)}`;
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1.5', className)}>
      <code className={cx('mono rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-navy-800 dark:text-slate-300', full && 'break-all')} title={value}>
        {shown}
      </code>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        aria-label="Copy"
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  );
}

// ------------------------------------------------------------- EmptyState
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500 dark:bg-navy-800">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-navy-300">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// -------------------------------------------------------------- Dropzone
export function Dropzone({ onFile, accept = 'application/pdf', label, sub, compact, file }: { onFile: (f: File) => void; accept?: string; label: ReactNode; sub?: ReactNode; compact?: boolean; file?: File | null }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={cx(
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors',
        compact ? 'px-4 py-5' : 'px-6 py-10',
        over ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50 dark:border-navy-600 dark:hover:bg-slate-900',
      )}
    >
      <UploadCloud className={cx('text-slate-400', compact ? 'mb-1.5 size-6' : 'mb-3 size-8')} />
      {file ? (
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{file.name}</p>
      ) : (
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
      )}
      {sub && <p className="mt-1 text-xs text-slate-500 dark:text-navy-300">{sub}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Tabs
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: ReactNode }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-4 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-navy-700">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-0.5 py-2.5 text-[13px] font-medium transition-colors',
            value === t.id ? 'border-brand-700 text-slate-900 dark:border-brand-400 dark:text-white' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-navy-300 dark:hover:text-white',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Modal
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cx('card max-h-[90vh] w-full overflow-hidden rounded-b-none sm:rounded-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-navy-700">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-navy-800" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-navy-700 dark:bg-navy-900/60">{footer}</div>}
      </div>
    </div>
  );
}
