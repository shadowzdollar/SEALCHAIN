/**
 * Site-wide scroll reveal for the marketing pages. Rather than wrapping every
 * block by hand, it tags each page section's direct content (and the items of
 * any grid inside it, staggered) and reveals them as they enter the viewport.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

const TARGETS = [
  'main > section > div > *:not(.grid)',
  'main > section > *:not(div)',
  'main .grid > *',
  'main > div > div > *',
].join(',');

export function useMarketingMotion() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const root = document.querySelector('.marketing');
    const main = document.getElementById('main');
    if (!root || !main) return;
    root.classList.add('motion');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    const tag = () => {
      main.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
        if (el.classList.contains('rv') || el.closest('.hero-in, .no-rv') || el.parentElement?.closest('.rv')) return;
        if (el.parentElement?.classList.contains('grid')) el.style.setProperty('--i', String(Math.min([...el.parentElement.children].indexOf(el), 6)));
        el.classList.add('rv');
        io.observe(el);
      });
      main.querySelectorAll('.kenburns').forEach((el) => io.observe(el));
    };
    tag();
    // Lazy sections (query results, FAQ, etc.) arrive after first paint.
    const mo = new MutationObserver(() => tag());
    mo.observe(main, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname]);
}

/** Counts up to a numeric value the first time the element scrolls into view. */
export function useCountUp(target: string) {
  const ref = useRef<HTMLParagraphElement>(null);
  const n = Number(target);
  const [shown, setShown] = useState(Number.isFinite(n) ? '0' : target);
  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(n) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(target); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 1400);
        setShown(String(Math.round(n * (1 - (1 - p) ** 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [n, target]);
  return [ref, shown] as const;
}
