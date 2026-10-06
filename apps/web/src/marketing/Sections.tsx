/**
 * Friendly, visual landing-page sections: plain language first, small
 * self-playing illustrations instead of diagrams. All copy goes through tr().
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, BadgeCheck, Bean, Check, Clock3, Coffee, Code2, Cherry, Flower2, Gem, Leaf, Lock, Mountain, Nut, Scale,
  ShieldCheck, Shirt, Signal, Smartphone, Sprout, Stamp as StampIcon, Truck, Wifi, X, type LucideIcon,
} from 'lucide-react';
import { cx } from '../components/ui';
import { msg, useTr } from '../locale';
import { SectionHeading } from './Chrome';
import { QrGlyph } from './Illustrations';
import { useCountUp } from './motion';

const PAGE = 'mx-auto max-w-[1680px] px-5 sm:px-8 lg:px-12 2xl:px-16';

// ------------------------------------------------------------ goods marquee
const GOODS: Array<{ icon: LucideIcon; label: string; tone: string }> = [
  { icon: Coffee, label: msg('Coffee'), tone: 'bg-[#6f4e37]' },
  { icon: Leaf, label: msg('Tea'), tone: 'bg-[#2f6f4f]' },
  { icon: Cherry, label: msg('Avocados'), tone: 'bg-[#5a7d2a]' },
  { icon: Flower2, label: msg('Cut flowers'), tone: 'bg-[#c2416b]' },
  { icon: Gem, label: msg('Tin, tantalum & tungsten'), tone: 'bg-[#4b5563]' },
  { icon: Nut, label: msg('Macadamia'), tone: 'bg-[#a16207]' },
  { icon: Bean, label: msg('Beans & pulses'), tone: 'bg-[#92400e]' },
  { icon: Sprout, label: msg('Pyrethrum'), tone: 'bg-[#4d7c0f]' },
  { icon: Shirt, label: msg('Textiles'), tone: 'bg-[#1d4ed8]' },
  { icon: Mountain, label: msg('Hides & skins'), tone: 'bg-[#78350f]' },
  { icon: Scale, label: msg('Honey'), tone: 'bg-[#d97706]' },
  { icon: Truck, label: msg('Machinery'), tone: 'bg-[#0b1f3a]' },
];

export function GoodsMarquee() {
  const { tr } = useTr();
  const row = (reverse: boolean) => (
    <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className={cx('marquee flex w-max shrink-0 gap-3 pr-3', reverse && 'marquee-reverse')}>
        {[0, 1].map((k) => (
          <div key={k} className="flex gap-3" aria-hidden={k === 1}>
            {(reverse ? [...GOODS].reverse() : GOODS).map((g) => (
              <span key={g.label} className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-paper-rule bg-paper-card py-1.5 pl-1.5 pr-4 text-[14px] font-medium text-ink shadow-[0_1px_0_var(--color-paper-rule)]">
                <span className={cx('flex size-7 items-center justify-center rounded-full text-white', g.tone)}><g.icon className="size-3.5" strokeWidth={2} /></span>
                {tr(g.label)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <section className="no-rv border-b border-paper-rule bg-paper py-10">
      <p className={cx(PAGE, 'mb-6 text-center font-plexmono text-[11px] uppercase tracking-[0.2em] text-slate-500')}>{tr('From Rwandan hills to the world’s ports — whatever you ship')}</p>
      <div className="space-y-3">{row(false)}{row(true)}</div>
    </section>
  );
}

// ------------------------------------------------------------ 1-2-3
function FormArt() {
  const { tr } = useTr();
  const rows = [[tr('Buyer'), 'Savannah Roasters Ltd'], [tr('Goods'), tr('Green coffee, 9,600 kg')], [tr('Destination'), 'Nairobi, Kenya']];
  return (
    <div className="w-full max-w-[300px] rounded-xl border border-paper-rule bg-paper-card p-4 shadow-[0_18px_40px_-26px_rgba(11,31,58,0.5)]">
      {rows.map(([k, v], i) => (
        <div key={k} className="mb-3 last:mb-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">{k}</p>
          <p className="type-in mt-1 h-8 overflow-hidden whitespace-nowrap rounded-md border border-paper-rule bg-paper px-2.5 text-[13px] leading-8 text-ink" style={{ ['--delay' as never]: `${0.3 + i * 0.9}s` }}>{v}</p>
        </div>
      ))}
    </div>
  );
}

function ChecklistArt() {
  const { tr } = useTr();
  const items = [tr('Buyer’s tax number'), tr('Product code'), tr('Weights add up'), tr('Permits attached')];
  return (
    <div className="w-full max-w-[300px] rounded-xl border border-paper-rule bg-paper-card p-4 shadow-[0_18px_40px_-26px_rgba(11,31,58,0.5)]">
      <ul className="space-y-2.5">
        {items.map((t, i) => (
          <li key={t} className="tick-in flex items-center gap-2.5 text-[13.5px] text-ink" style={{ ['--delay' as never]: `${0.3 + i * 0.5}s` }}>
            <span className={cx('tick flex size-5 items-center justify-center rounded-full text-white', i === 2 ? 'tick-fix' : 'bg-emerald-600')}>
              <Check className="size-3" strokeWidth={3} />
            </span>
            {t}
          </li>
        ))}
      </ul>
      <p className="tick-in mt-4 rounded-lg bg-emerald-600/10 px-3 py-2 text-center text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400" style={{ ['--delay' as never]: '2.6s' }}>{tr('Ready to print')}</p>
    </div>
  );
}

function ScanArt() {
  const { tr } = useTr();
  return (
    <div className="relative flex w-full max-w-[300px] items-center justify-center gap-4 rounded-xl border border-paper-rule bg-paper-card p-5 shadow-[0_18px_40px_-26px_rgba(11,31,58,0.5)]">
      <div className="relative overflow-hidden rounded-lg border border-paper-rule bg-white p-1.5">
        <QrGlyph className="size-20" />
        <span className="scan-sweep absolute inset-x-0 h-[2px] bg-stamp shadow-[0_0_10px_2px_rgba(180,35,24,0.55)]" />
      </div>
      <div className="pop-in flex flex-col items-center gap-1.5 text-center" style={{ ['--delay' as never]: '1.4s' }}>
        <span className="flex size-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_8px_20px_-8px_rgba(4,120,87,0.8)]"><BadgeCheck className="size-6" /></span>
        <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">{tr('Genuine')}</span>
        <span className="text-[11px] text-slate-500">{tr('checked in 2 s')}</span>
      </div>
    </div>
  );
}

export function EasySteps() {
  const { tr } = useTr();
  const steps: Array<{ n: string; title: string; body: string; art: ReactNode; tone: string }> = [
    { n: '1', title: tr('Fill in your shipment once'), body: tr('Who’s buying, what you’re sending and where it’s going. That’s it — we write the invoice, certificate of origin and packing list for you.'), art: <FormArt />, tone: 'from-[#fdf2e9]' },
    { n: '2', title: tr('We check it like a customs officer'), body: tr('Every detail is checked against the rules of the border you’ll cross. Mistakes are caught on your screen — not at the border.'), art: <ChecklistArt />, tone: 'from-[#eaf5ee]' },
    { n: '3', title: tr('Share it — anyone can check it’s real'), body: tr('Each document carries a seal and a QR code. Buyers, banks and officers scan it to see it’s genuine. Free, in seconds.'), art: <ScanArt />, tone: 'from-[#eaf0fb]' },
  ];
  return (
    <section id="product" className={cx(PAGE, 'scroll-mt-24 py-24')}>
      <SectionHeading center eyebrow={tr('How it works')} title={tr('As easy as one, two, three.')} body={tr('No training, no jargon. If you can fill in a form, you can use SealChain.')} />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <article key={s.n} className="relative flex flex-col overflow-hidden rounded-2xl border border-paper-rule bg-paper-card p-7">
            <span className="flex size-11 items-center justify-center rounded-full bg-ink font-serif text-[20px] font-semibold text-ink-contrast">{s.n}</span>
            <h3 className="mt-5 font-serif text-[24px] font-semibold leading-snug tracking-[-0.01em]">{s.title}</h3>
            <p className="mt-2 text-[15.5px] leading-relaxed text-slate-600">{s.body}</p>
            <div className="mt-8 flex flex-1 items-end justify-center">{s.art}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ before / after
const WITHOUT = [
  { t: '06:00', d: msg('Truck reaches the border'), bad: false },
  { t: '07:40', d: msg('Officer spots a wrong tax number on the certificate'), bad: true },
  { t: '09:15', d: msg('Exporter is called; a corrected copy is emailed'), bad: true },
  { t: '15:30', d: msg('The copy is doubted — the original is requested'), bad: true },
  { t: msg('Day 2'), d: msg('Cleared at last — with parking and demurrage to pay'), bad: true },
];
const WITH = [
  { t: '06:00', d: msg('Truck reaches the border'), bad: false },
  { t: '06:03', d: msg('Officer scans the QR code — genuine, nothing altered'), bad: false },
  { t: '06:20', d: msg('Documents accepted. The truck rolls on.'), bad: false },
];

export function BorderDay() {
  const { tr } = useTr();
  const [withSc, setWithSc] = useState(false);
  const list = withSc ? WITH : WITHOUT;
  return (
    <section className="border-y border-paper-rule bg-paper-card">
      <div className={cx(PAGE, 'grid grid-cols-1 items-center gap-12 py-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]')}>
        <div className="min-w-0">
          <SectionHeading eyebrow={tr('A day at the border')} title={tr('One small typo can cost a whole day.')} body={tr('Flip the switch to see the same truck, the same border — with and without SealChain.')} />
          <div className="mt-8 inline-flex rounded-full border border-paper-rule bg-paper p-1" role="tablist">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                role="tab"
                aria-selected={withSc === v}
                onClick={() => setWithSc(v)}
                className={cx('rounded-full px-5 py-2.5 text-[14px] font-medium transition-all duration-300', withSc === v ? (v ? 'bg-emerald-600 text-white shadow' : 'bg-stamp text-white shadow') : 'text-slate-600 hover:text-ink')}
              >
                {v ? tr('With SealChain') : tr('Without SealChain')}
              </button>
            ))}
          </div>
          <div className="mt-8 flex items-end gap-3">
            <span key={String(withSc)} className={cx('pop-in font-serif text-[64px] font-semibold leading-none tracking-[-0.03em]', withSc ? 'text-emerald-700 dark:text-emerald-400' : 'text-stamp')}>{withSc ? '20' : '30+'}</span>
            <span className="pb-2 text-[15px] text-slate-600">{withSc ? tr('minutes at the border') : tr('hours at the border')}</span>
          </div>
          <p className="mt-3 text-[12.5px] text-slate-500">{tr('An illustrative example of a common story — not a promise of clearance times.')}</p>
        </div>
        <ol key={String(withSc)} className="relative min-w-0 space-y-3 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-px before:bg-paper-rule">
          {list.map((x, i) => (
            <li key={x.d} className="slide-in relative flex items-start gap-4 rounded-2xl border border-paper-rule bg-paper p-4" style={{ ['--delay' as never]: `${i * 0.12}s` }}>
              <span className={cx('relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full text-white', x.bad ? 'bg-stamp' : 'bg-emerald-600')}>
                {x.bad ? <X className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-plexmono text-[11.5px] text-slate-500"><Clock3 className="size-3.5" /> {tr(x.t)}</p>
                <p className="mt-0.5 text-[15px] text-ink">{tr(x.d)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ phones
const VERDICTS = [
  { lang: 'English', word: 'Genuine' },
  { lang: 'Français', word: 'Authentique' },
  { lang: 'Kiswahili', word: 'Halisi' },
  { lang: 'Ikinyarwanda', word: 'Nyayo' },
];

function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('relative w-[230px] shrink-0 rounded-[36px] border-[9px] border-[#0b0f18] bg-[#0b0f18] shadow-[0_40px_80px_-30px_rgba(11,31,58,0.6)] sm:w-[250px]', className)}>
      <span aria-hidden className="absolute left-1/2 top-1.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#0b0f18]" />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[28px] bg-paper-card">{children}</div>
    </div>
  );
}

export function MobileSection() {
  const { tr } = useTr();
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setV((n) => (n + 1) % VERDICTS.length), 2200);
    return () => window.clearInterval(t);
  }, []);
  const features: Array<{ icon: LucideIcon; t: string; d: string }> = [
    { icon: Smartphone, t: tr('Any phone camera'), d: tr('No app to install. Point the camera at the QR code.') },
    { icon: Signal, t: tr('Built for weak signal'), d: tr('Light pages that load on slow mobile networks at remote border posts.') },
    { icon: Wifi, t: tr('Your shipments in your pocket'), d: tr('Follow every document, endorsement and check from your phone.') },
  ];
  const cur = VERDICTS[v]!;
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_75%_40%,rgba(180,35,24,0.08),transparent_70%)]" />
      <div className={cx(PAGE, 'grid grid-cols-1 items-center gap-14 py-24 lg:grid-cols-2')}>
        <div className="min-w-0">
          <SectionHeading eyebrow={tr('On your phone')} title={tr('The border post is in your pocket.')} body={tr('Officers check documents on their phones. Exporters follow shipments on theirs. Everything works on a small screen — even with one bar of signal.')} />
          <ul className="mt-9 space-y-5">
            {features.map((f) => (
              <li key={f.t} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-ink-contrast"><f.icon className="size-5" strokeWidth={1.8} /></span>
                <div><p className="font-semibold text-ink">{f.t}</p><p className="mt-0.5 text-[15px] text-slate-600">{f.d}</p></div>
              </li>
            ))}
          </ul>
          <Link to="/verify" className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-ink-contrast">{tr('Try the verifier on your phone')} <ArrowRight className="size-4" /></Link>
        </div>

        <div className="relative flex min-w-0 items-center justify-center gap-4 py-6 sm:gap-6">
          {/* exporter phone */}
          <Phone className="float-a hidden -rotate-6 sm:block">
            <div className="p-4 pt-9">
              <p className="font-plexmono text-[9px] uppercase tracking-[0.16em] text-slate-500">{tr('My shipments')}</p>
              {[
                { r: 'KTG-0147', s: tr('Cleared'), c: 'bg-emerald-600' },
                { r: 'KTG-0146', s: tr('At the border'), c: 'bg-amber-500' },
                { r: 'KTG-0145', s: tr('Delivered'), c: 'bg-emerald-600' },
                { r: 'KTG-0144', s: tr('Draft'), c: 'bg-slate-400' },
              ].map((x) => (
                <div key={x.r} className="mt-2.5 rounded-xl border border-paper-rule bg-paper p-2.5">
                  <p className="text-[11px] font-semibold text-ink">{x.r}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500"><span className={cx('size-1.5 rounded-full', x.c)} />{x.s}</p>
                </div>
              ))}
            </div>
          </Phone>
          {/* verifier phone */}
          <Phone className="float-b z-10 rotate-3">
            <div className="flex h-full flex-col items-center p-5 pt-10 text-center">
              <p className="font-plexmono text-[9px] uppercase tracking-[0.16em] text-slate-500">{tr('Document check')}</p>
              <div className="relative mt-4 overflow-hidden rounded-xl border border-paper-rule bg-white p-2">
                <QrGlyph className="size-24" />
                <span className="scan-sweep absolute inset-x-0 h-[2px] bg-stamp shadow-[0_0_10px_2px_rgba(180,35,24,0.55)]" />
              </div>
              <span className="mt-5 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_10px_24px_-8px_rgba(4,120,87,0.8)]"><ShieldCheck className="size-7" /></span>
              <p key={cur.word} className="pop-in mt-3 font-serif text-[24px] font-semibold text-emerald-700 dark:text-emerald-400">{cur.word}</p>
              <p className="font-plexmono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{cur.lang}</p>
              <div className="mt-auto w-full rounded-xl border border-paper-rule bg-paper p-2.5 text-left">
                <p className="text-[10px] text-slate-500">{tr('Certificate of origin')}</p>
                <p className="text-[11px] font-semibold text-ink">Huye Highlands Coffee</p>
              </div>
            </div>
          </Phone>
          {/* floating bubbles */}
          <span className="float-a absolute left-0 top-6 hidden rounded-2xl border border-paper-rule bg-paper-card px-3.5 py-2 text-[12.5px] font-medium text-ink shadow-lg lg:block">📶 {tr('Works on 3G')}</span>
          <span className="float-b absolute bottom-8 right-0 hidden rounded-2xl border border-paper-rule bg-paper-card px-3.5 py-2 text-[12.5px] font-medium text-ink shadow-lg lg:block">🌍 {tr('4 languages')}</span>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ stats
function Stat({ value, suffix, label }: { value: string; suffix?: string; label: string }) {
  const [ref, shown] = useCountUp(value);
  return (
    <div className="rounded-3xl border border-paper-rule bg-paper-card p-6 sm:p-8">
      <p ref={ref} className="font-serif text-[48px] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums sm:text-[60px]">{shown}<span className="text-stamp">{suffix}</span></p>
      <p className="mt-3 text-[15px] leading-snug text-slate-600">{label}</p>
    </div>
  );
}

export function FriendlyStats() {
  const { tr } = useTr();
  return (
    <section className={cx(PAGE, 'py-20')}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat value="4" label={tr('corridors open from Kigali today')} />
        <Stat value="3" label={tr('documents from a single form')} />
        <Stat value="2" suffix="s" label={tr('for anyone to check a document')} />
        <Stat value="0" suffix=" RWF" label={tr('to verify — always free')} />
      </div>
    </section>
  );
}

// ------------------------------------------------------------ trust
export function TrustSection() {
  const { tr } = useTr();
  const cards: Array<{ icon: LucideIcon; t: string; d: string; tone: string }> = [
    { icon: StampIcon, t: tr('A seal that can’t be copied'), d: tr('Change a single comma in the file and the seal breaks. Fakes and edited copies are spotted instantly.'), tone: 'bg-ink text-ink-contrast' },
    { icon: Lock, t: tr('Your business stays private'), d: tr('Your prices, buyers and quantities are never published. Only a tamper-proof fingerprint is.'), tone: 'bg-ink text-ink-contrast' },
    { icon: BadgeCheck, t: tr('Backed by the authorities'), d: tr('Where the issuing authority uses SealChain, its officers approve your certificate right on the document.'), tone: 'bg-ink text-ink-contrast' },
    { icon: ShieldCheck, t: tr('Proof that outlives us'), d: tr('Documents are recorded on a public ledger, so they can be checked even without SealChain.'), tone: 'bg-ink text-ink-contrast' },
  ];
  return (
    <section className="border-y border-paper-rule bg-paper-card">
      <div className={cx(PAGE, 'py-24')}>
        <SectionHeading center eyebrow={tr('Why people trust it')} title={tr('Four promises behind every document.')} />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <article key={c.t} className="lift group rounded-3xl border border-paper-rule bg-paper p-7">
              <span className={cx('flex size-12 items-center justify-center rounded-2xl', c.tone)}><c.icon className="size-6" strokeWidth={1.8} /></span>
              <h3 className="mt-6 font-serif text-[21px] font-semibold leading-snug">{c.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{c.d}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3 text-[14px]">
          <Link to="/security" className="inline-flex items-center gap-2 rounded-full border border-paper-rule bg-paper px-4 py-2 font-medium text-ink hover:border-ink/40"><ShieldCheck className="size-4" /> {tr('How we keep it safe')}</Link>
          <Link to="/developers" className="inline-flex items-center gap-2 rounded-full border border-paper-rule bg-paper px-4 py-2 font-medium text-ink hover:border-ink/40"><Code2 className="size-4" /> {tr('For developers: connect your system')}</Link>
        </div>
      </div>
    </section>
  );
}
