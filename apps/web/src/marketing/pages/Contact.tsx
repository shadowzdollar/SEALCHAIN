import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Activity, ArrowRight, BookOpen, ScanLine } from 'lucide-react';
import { ApiError, api } from '../../api';
import { cx } from '../../components/ui';
import { Eyebrow, INK_BTN, PAGE_X } from '../Chrome';
import { Stamp } from '../Illustrations';
import { PhotoPrint } from '../Photo';
import { PHOTOS } from '../photos';

const TOPICS = [
  { id: 'pilot', label: 'Join the pilot as an exporter' },
  { id: 'authority', label: 'Onboard an issuing authority' },
  { id: 'verification', label: 'Verification for a bank, buyer or insurer' },
  { id: 'integration', label: 'Integration, volumes or partnership' },
  { id: 'press', label: 'Press' },
  { id: 'other', label: 'Something else (including security reports)' },
] as const;

const COUNTRIES = ['Rwanda', 'Kenya', 'Uganda', 'Tanzania', 'Burundi', 'DR Congo', 'South Sudan', 'Other'];

const FIELD = 'block h-11 w-full rounded-[3px] border border-paper-rule bg-paper-card px-3 text-[15px] text-ink placeholder:text-slate-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-navy-900/10';

export function ContactPage() {
  const [params] = useSearchParams();
  const initial = TOPICS.some((t) => t.id === params.get('topic')) ? params.get('topic')! : 'pilot';
  const [form, setForm] = useState({ name: '', email: '', company: '', country: 'Rwanda', topic: initial, message: '', website: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const send = useMutation({ mutationFn: () => api.post<{ id: string }>('/contact', { ...form, website: form.website || undefined }) });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate();
  };

  return (
    <section className="paper-grid">
      <div className={cx('mx-auto grid max-w-[1680px] gap-14 pb-24 pt-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:pt-20', PAGE_X)}>
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-5 font-serif text-[40px] font-semibold leading-[1.06] tracking-[-0.02em] sm:text-[52px]">Talk to <em className="font-medium text-stamp">us</em>.</h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-slate-600">Join the pilot, bring your authority or bank on board, or ask us anything. Every message is read by the team building SealChain.</p>
          <ul className="mt-10 divide-y divide-paper-rule border-y border-paper-rule">
            {[
              { icon: <ScanLine />, t: 'Checking a document?', d: 'You don’t need to contact us — use the verifier.', to: '/verify' },
              { icon: <BookOpen />, t: 'Common questions', d: 'Pricing, pilots, verification and data.', to: '/pricing#faq' },
              { icon: <Activity />, t: 'Something not working?', d: 'See live system status.', to: '/status' },
            ].map((x) => (
              <li key={x.t}>
                <Link to={x.to} className="group flex items-start gap-3 py-4">
                  <span className="mt-0.5 text-ink [&>svg]:size-[18px] [&>svg]:stroke-[1.6]">{x.icon}</span>
                  <span className="flex-1"><span className="block font-medium">{x.t}</span><span className="text-[14px] text-slate-600">{x.d}</span></span>
                  <ArrowRight className="mt-1 size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
          <PhotoPrint photo={PHOTOS.kigaliSkyline} tilt={-2} className="mt-12 hidden max-w-sm lg:block" caption="Kigali, Rwanda" />
        </div>

        <div className="relative rounded-[2px] border border-paper-rule bg-paper-card p-6 shadow-[0_12px_32px_-14px_rgba(11,31,58,0.2)] sm:p-9">
          {send.isSuccess ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <Stamp className="rotate-[-5deg]">Received</Stamp>
              <h2 className="mt-8 font-serif text-[28px] font-semibold">Thank you, {form.name.split(' ')[0]}.</h2>
              <p className="mt-3 max-w-sm text-[15px] text-slate-600">We’ve received your message and will reply to <span className="font-medium text-ink">{form.email}</span>.</p>
              <p className="mt-6 font-plexmono text-[12px] text-slate-500">Reference {send.data.id}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="flex items-center justify-between border-b border-dashed border-paper-rule pb-3 font-plexmono text-[12px] text-slate-500">
                <span>FORM SC-01 · ENQUIRY</span><span>All fields marked * are required</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Full name *</span><input required minLength={2} maxLength={120} autoComplete="name" className={FIELD} value={form.name} onChange={set('name')} /></label>
                <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Work email *</span><input required type="email" autoComplete="email" className={FIELD} value={form.email} onChange={set('email')} /></label>
                <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Organisation</span><input maxLength={160} autoComplete="organization" className={FIELD} value={form.company} onChange={set('company')} /></label>
                <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Country</span>
                  <select className={FIELD} value={form.country} onChange={set('country')}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
              </div>
              <label className="block"><span className="mb-1.5 block text-[13px] font-medium">How can we help? *</span>
                <select className={FIELD} value={form.topic} onChange={set('topic')}>{TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              </label>
              <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Message *</span>
                <textarea required minLength={10} maxLength={4000} rows={6} className={cx(FIELD, 'h-auto py-2.5')} placeholder="Tell us about your goods, corridors and volumes — or your question." value={form.message} onChange={set('message')} />
              </label>
              {/* Honeypot: hidden from people, tempting to bots. */}
              <label className="absolute -left-[9999px]" aria-hidden>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
              {send.isError && <p className="rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-800" role="alert">{send.error instanceof ApiError ? send.error.message : 'Could not send your message. Please try again.'}</p>}
              <div className="flex flex-col-reverse gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12.5px] text-slate-500">We use your details only to reply. See our <Link to="/legal/privacy" className="underline">privacy notice</Link>.</p>
                <button type="submit" disabled={send.isPending} className={cx(INK_BTN, 'shrink-0 disabled:opacity-60')}>{send.isPending ? 'Sending…' : 'Send message'} <ArrowRight className="size-4" /></button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
