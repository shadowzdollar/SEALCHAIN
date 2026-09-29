/** Navigation structure for the public site: mega menu and footer. */
import type { LucideIcon } from 'lucide-react';
import { msg } from '../locale';
import {
  Activity,
  BadgeCheck,
  Banknote,
  BookOpen,
  Building2,
  FileCheck2,
  FileSearch,
  Fingerprint,
  History,
  Landmark,
  LifeBuoy,
  ListChecks,
  Lock,
  Mail,
  Map,
  Package,
  ScanLine,
  Stamp,
  Terminal,
  Webhook,
} from 'lucide-react';

export interface MenuItem {
  label: string;
  to: string;
  desc: string;
  icon: LucideIcon;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export interface Menu {
  id: string;
  label: string;
  groups: MenuGroup[];
  featured: { eyebrow: string; title: string; body: string; to: string; cta: string; art: 'verify' | 'map' | 'code' | 'seal' };
}

export const MENUS: Menu[] = [
  {
    id: 'product',
    label: msg('Product'),
    groups: [
      {
        title: msg('Prepare'),
        items: [
          { label: msg('Document generation'), to: '/product#generate', desc: msg('Invoice, certificate of origin and packing list from one record.'), icon: FileCheck2 },
          { label: msg('Pre-submission checks'), to: '/product#validate', desc: msg('Corridor rules, HS codes, tax IDs and permits checked before print.'), icon: ListChecks },
        ],
      },
      {
        title: msg('Protect'),
        items: [
          { label: msg('Blockchain anchoring'), to: '/product#anchor', desc: msg('Every PDF fingerprinted, signed and anchored at issue.'), icon: Fingerprint },
          { label: msg('Authority endorsement'), to: '/solutions/authorities', desc: msg('Issuing authorities endorse certificates on the same record.'), icon: Stamp },
        ],
      },
      {
        title: msg('Check'),
        items: [
          { label: msg('Public verifier'), to: '/verify', desc: msg('Anyone scans the QR code or drops the file. No account.'), icon: ScanLine },
          { label: msg('Fraud screening'), to: '/product#screen', desc: msg('Altered copies, fabricated references and editing traces.'), icon: FileSearch },
        ],
      },
    ],
    featured: { eyebrow: msg('Try it now'), title: msg('Verify a document'), body: msg('Drop any SealChain PDF and see its record, signature and on-chain proof in seconds.'), to: '/verify', cta: msg('Open the verifier'), art: 'verify' },
  },
  {
    id: 'solutions',
    label: msg('Solutions'),
    groups: [
      {
        title: msg('By role'),
        items: [
          { label: msg('Exporters & SMEs'), to: '/solutions/exporters', desc: msg('Get documents right the first time and clear the border faster.'), icon: Package },
          { label: msg('Issuing authorities'), to: '/solutions/authorities', desc: msg('Review and endorse certificates of origin digitally.'), icon: Landmark },
          { label: msg('Banks, buyers & insurers'), to: '/solutions/verifiers', desc: msg('Confirm a document is genuine before you pay or finance.'), icon: Banknote },
        ],
      },
      {
        title: msg('By corridor'),
        items: [
          { label: msg('Rwanda → Kenya'), to: '/corridors#RW-KE', desc: msg('Gatuna or Kagitumba to Malaba and Busia.'), icon: Map },
          { label: msg('Rwanda → Uganda'), to: '/corridors#RW-UG', desc: msg('Gatuna, Kagitumba or Cyanika.'), icon: Map },
          { label: msg('Rwanda → Tanzania & Burundi'), to: '/corridors', desc: msg('Rusumo, Akanyaru-Haut and Nemba.'), icon: Map },
        ],
      },
    ],
    featured: { eyebrow: msg('Corridors'), title: msg('Built for the EAC'), body: msg('Rule sets for four corridors out of Rwanda, each showing when it was last verified.'), to: '/corridors', cta: msg('See all corridors'), art: 'map' },
  },
  {
    id: 'developers',
    label: msg('Developers'),
    groups: [
      {
        title: msg('Build'),
        items: [
          { label: msg('API overview'), to: '/developers', desc: msg('Create shipments, issue documents and share bundles.'), icon: Terminal },
          { label: msg('Webhooks'), to: '/developers#webhooks', desc: msg('Signed events when documents are issued, anchored or tampered with.'), icon: Webhook },
          { label: msg('Independent verification'), to: '/developers#independent', desc: msg('Check a document without trusting SealChain at all.'), icon: BadgeCheck },
        ],
      },
      {
        title: msg('Operate'),
        items: [
          { label: msg('System status'), to: '/status', desc: msg('Live health of the API, verification and anchoring.'), icon: Activity },
          { label: msg('Changelog'), to: '/changelog', desc: msg('What shipped, and when.'), icon: History },
        ],
      },
    ],
    featured: { eyebrow: msg('API'), title: msg('Five calls to a verified shipment'), body: msg('Create, validate, issue, download and share — the same engine as the web app.'), to: '/developers', cta: msg('Read the guide'), art: 'code' },
  },
  {
    id: 'resources',
    label: msg('Resources'),
    groups: [
      {
        title: msg('Learn'),
        items: [
          { label: msg('Help centre'), to: '/help', desc: msg('Step-by-step guides for exporters, buyers and officers.'), icon: LifeBuoy },
          { label: msg('Security & trust'), to: '/security', desc: msg('How documents, keys and your data are protected.'), icon: Lock },
          { label: msg('Questions & answers'), to: '/pricing#faq', desc: msg('Pricing, pilots, verification and data.'), icon: BookOpen },
        ],
      },
      {
        title: msg('Company'),
        items: [
          { label: msg('About SealChain'), to: '/about', desc: msg('Why we are building trust into trade paperwork.'), icon: Building2 },
          { label: msg('Contact us'), to: '/contact', desc: msg('Join the pilot, onboard an authority or ask anything.'), icon: Mail },
        ],
      },
    ],
    featured: { eyebrow: msg('Pilot'), title: msg('Join the paid pilot'), body: msg('We are onboarding exporters on EAC corridors from Rwanda now.'), to: '/contact?topic=pilot', cta: msg('Talk to us'), art: 'seal' },
  },
];

export const FOOTER: Array<{ title: string; links: Array<{ label: string; to: string }> }> = [
  {
    title: msg('Product'),
    links: [
      { label: msg('Overview'), to: '/product' },
      { label: msg('Document generation'), to: '/product#generate' },
      { label: msg('Anchoring'), to: '/product#anchor' },
      { label: msg('Fraud screening'), to: '/product#screen' },
      { label: msg('Pricing'), to: '/pricing' },
      { label: msg('Verify a document'), to: '/verify' },
    ],
  },
  {
    title: msg('Solutions'),
    links: [
      { label: msg('Exporters & SMEs'), to: '/solutions/exporters' },
      { label: msg('Issuing authorities'), to: '/solutions/authorities' },
      { label: msg('Banks, buyers & insurers'), to: '/solutions/verifiers' },
      { label: msg('Corridors'), to: '/corridors' },
    ],
  },
  {
    title: msg('Developers'),
    links: [
      { label: msg('API overview'), to: '/developers' },
      { label: msg('Webhooks'), to: '/developers#webhooks' },
      { label: msg('Independent verification'), to: '/developers#independent' },
      { label: msg('System status'), to: '/status' },
      { label: msg('Changelog'), to: '/changelog' },
    ],
  },
  {
    title: msg('Company'),
    links: [
      { label: msg('About'), to: '/about' },
      { label: msg('Help centre'), to: '/help' },
      { label: msg('Security & trust'), to: '/security' },
      { label: msg('Contact'), to: '/contact' },
      { label: msg('Privacy'), to: '/legal/privacy' },
      { label: msg('Terms'), to: '/legal/terms' },
    ],
  },
];
