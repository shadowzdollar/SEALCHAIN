/**
 * Photographs, presented the paper way: prints with a card-stock border and a
 * strip of tape, or full-bleed bands washed in navy ink. Every photo carries
 * its credit (see /credits for licences).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../components/ui';
import type { Photo } from './photos';

export function Credit({ photo, className, light, plain }: { photo: Photo; className?: string; light?: boolean; plain?: boolean }) {
  const cls = cx('font-plexmono text-[10px] tracking-[0.04em]', light ? 'text-white/70' : 'text-slate-500', className);
  // Inside another link (e.g. a card), render as text: links cannot nest.
  if (plain) return <span className={cls} title={`${photo.author} · ${photo.license}`}>Photo: {photo.author} · {photo.license}</span>;
  return (
    <a
      href={photo.source}
      target="_blank"
      rel="noreferrer"
      className={cx('font-plexmono text-[10px] tracking-[0.04em] hover:underline', light ? 'text-white/70' : 'text-slate-500', className)}
      title={`${photo.author} · ${photo.license}`}
    >
      Photo: {photo.author} · {photo.license}
    </a>
  );
}

/** A print on card stock, optionally taped and tilted. */
export function PhotoPrint({ photo, className, ratio = 'aspect-[4/3]', tilt = 0, tape = true, caption, size = 'sm', priority }: {
  photo: Photo;
  className?: string;
  ratio?: string;
  tilt?: number;
  tape?: boolean;
  caption?: ReactNode;
  size?: 'sm' | 'lg';
  priority?: boolean;
}) {
  return (
    <figure className={cx('relative bg-paper-card p-2.5 pb-3 shadow-[0_1px_2px_rgba(11,31,58,0.08),0_18px_36px_-18px_rgba(11,31,58,0.35)] ring-1 ring-paper-rule', className)} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      {tape && <span aria-hidden className="absolute -top-3 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rotate-[-3deg] bg-[#efe6cf]/85 shadow-[0_1px_1px_rgba(0,0,0,0.06)]" />}
      <div className={cx('overflow-hidden bg-paper-tint', ratio)}>
        <img src={size === 'lg' ? photo.src : photo.sm} alt={photo.alt} loading={priority ? 'eager' : 'lazy'} decoding="async" className="size-full object-cover [filter:saturate(0.92)_contrast(1.02)]" />
      </div>
      <figcaption className="mt-2 flex items-baseline justify-between gap-3">
        <span className="shrink-0 font-plexmono text-[10.5px] uppercase tracking-[0.12em] text-slate-600">{caption ?? photo.place}</span>
        <Credit photo={photo} className="min-w-0 truncate" />
      </figcaption>
    </figure>
  );
}

/** Full-bleed photograph with a navy ink wash and content on top. */
export function PhotoBand({ photo, children, className, align = 'left', minH = 'min-h-[520px]' }: { photo: Photo; children: ReactNode; className?: string; align?: 'left' | 'center'; minH?: string }) {
  return (
    <section className={cx('relative isolate overflow-hidden bg-navy-900 text-white', minH, className)}>
      <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" className="kenburns absolute inset-0 -z-20 size-full object-cover" />
      <div aria-hidden className={cx('absolute inset-0 -z-10', align === 'left' ? 'bg-gradient-to-r from-navy-950/92 via-navy-900/70 to-navy-900/10' : 'bg-navy-950/65')} />
      {children}
      <Credit photo={photo} light className="absolute bottom-3 right-4" />
    </section>
  );
}

/** Link to the full photo credits page, for footers of photo-heavy sections. */
export function CreditsLink({ className }: { className?: string }) {
  return <Link to="/credits" className={cx('font-plexmono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 hover:text-ink', className)}>Photo credits</Link>;
}
