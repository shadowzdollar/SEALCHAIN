/** Navigation structure for the public site: mega menu and footer. */
import type { LucideIcon } from 'lucide-react';
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
    label: 'Product',
    groups: [
      {
        title: 'Prepare',
        items: [
          { label: 'Document generation', to: '/product#generate', desc: 'Invoice, certificate of origin and packing list from one record.', icon: FileCheck2 },
          { label: 'Pre-submission checks', to: '/product#validate', desc: 'Corridor rules, HS codes, tax IDs and permits checked before print.', icon: ListChecks },
        ],
      },
      {
        title: 'Protect',
        items: [
          { label: 'Blockchain anchoring', to: '/product#anchor', desc: 'Every PDF fingerprinted, signed and anchored at issue.', icon: Fingerprint },
          { label: 'Authority endorsement', to: '/solutions/authorities', desc: 'Issuing authorities endorse certificates on the same record.', icon: Stamp },
        ],
      },
      {
        title: 'Check',
        items: [
          { label: 'Public verifier', to: '/verify', desc: 'Anyone scans the QR code or drops the file. No account.', icon: ScanLine },
          { label: 'Fraud screening', to: '/product#screen', desc: 'Altered copies, fabricated references and editing traces.', icon: FileSearch },
        ],
      },
    ],
    featured: { eyebrow: 'Try it now', title: 'Verify a document', body: 'Drop any SealChain PDF and see its record, signature and on-chain proof in seconds.', to: '/verify', cta: 'Open the verifier', art: 'verify' },
  },
  {
    id: 'solutions',
    label: 'Solutions',
    groups: [
      {
        title: 'By role',
        items: [
          { label: 'Exporters & SMEs', to: '/solutions/exporters', desc: 'Get documents right the first time and clear the border faster.', icon: Package },
          { label: 'Issuing authorities', to: '/solutions/authorities', desc: 'Review and endorse certificates of origin digitally.', icon: Landmark },
          { label: 'Banks, buyers & insurers', to: '/solutions/verifiers', desc: 'Confirm a document is genuine before you pay or finance.', icon: Banknote },
        ],
      },
      {
        title: 'By corridor',
        items: [
          { label: 'Rwanda → Kenya', to: '/corridors#RW-KE', desc: 'Gatuna or Kagitumba to Malaba and Busia.', icon: Map },
          { label: 'Rwanda → Uganda', to: '/corridors#RW-UG', desc: 'Gatuna, Kagitumba or Cyanika.', icon: Map },
          { label: 'Rwanda → Tanzania & Burundi', to: '/corridors', desc: 'Rusumo, Akanyaru-Haut and Nemba.', icon: Map },
        ],
      },
    ],
    featured: { eyebrow: 'Corridors', title: 'Built for the EAC', body: 'Rule sets for four corridors out of Rwanda, each showing when it was last verified.', to: '/corridors', cta: 'See all corridors', art: 'map' },
  },
  {
    id: 'developers',
    label: 'Developers',
    groups: [
      {
        title: 'Build',
        items: [
          { label: 'API overview', to: '/developers', desc: 'Create shipments, issue documents and share bundles.', icon: Terminal },
          { label: 'Webhooks', to: '/developers#webhooks', desc: 'Signed events when documents are issued, anchored or tampered with.', icon: Webhook },
          { label: 'Independent verification', to: '/developers#independent', desc: 'Check a document without trusting SealChain at all.', icon: BadgeCheck },
        ],
      },
      {
        title: 'Operate',
        items: [
          { label: 'System status', to: '/status', desc: 'Live health of the API, verification and anchoring.', icon: Activity },
          { label: 'Changelog', to: '/changelog', desc: 'What shipped, and when.', icon: History },
        ],
      },
    ],
    featured: { eyebrow: 'API', title: 'Five calls to a verified shipment', body: 'Create, validate, issue, download and share — the same engine as the web app.', to: '/developers', cta: 'Read the guide', art: 'code' },
  },
  {
    id: 'resources',
    label: 'Resources',
    groups: [
      {
        title: 'Learn',
        items: [
          { label: 'Help centre', to: '/help', desc: 'Step-by-step guides for exporters, buyers and officers.', icon: LifeBuoy },
          { label: 'Security & trust', to: '/security', desc: 'How documents, keys and your data are protected.', icon: Lock },
          { label: 'Questions & answers', to: '/pricing#faq', desc: 'Pricing, pilots, verification and data.', icon: BookOpen },
        ],
      },
      {
        title: 'Company',
        items: [
          { label: 'About SealChain', to: '/about', desc: 'Why we are building trust into trade paperwork.', icon: Building2 },
          { label: 'Contact us', to: '/contact', desc: 'Join the pilot, onboard an authority or ask anything.', icon: Mail },
        ],
      },
    ],
    featured: { eyebrow: 'Pilot', title: 'Join the paid pilot', body: 'We are onboarding exporters on EAC corridors from Rwanda now.', to: '/contact?topic=pilot', cta: 'Talk to us', art: 'seal' },
  },
];

export const FOOTER: Array<{ title: string; links: Array<{ label: string; to: string }> }> = [
  {
    title: 'Product',
    links: [
      { label: 'Overview', to: '/product' },
      { label: 'Document generation', to: '/product#generate' },
      { label: 'Anchoring', to: '/product#anchor' },
      { label: 'Fraud screening', to: '/product#screen' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Verify a document', to: '/verify' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Exporters & SMEs', to: '/solutions/exporters' },
      { label: 'Issuing authorities', to: '/solutions/authorities' },
      { label: 'Banks, buyers & insurers', to: '/solutions/verifiers' },
      { label: 'Corridors', to: '/corridors' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'API overview', to: '/developers' },
      { label: 'Webhooks', to: '/developers#webhooks' },
      { label: 'Independent verification', to: '/developers#independent' },
      { label: 'System status', to: '/status' },
      { label: 'Changelog', to: '/changelog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Help centre', to: '/help' },
      { label: 'Security & trust', to: '/security' },
      { label: 'Contact', to: '/contact' },
      { label: 'Privacy', to: '/legal/privacy' },
      { label: 'Terms', to: '/legal/terms' },
    ],
  },
];
