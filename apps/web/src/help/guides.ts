/**
 * Help-centre articles. Plain data so the same content serves the public
 * /help pages and in-app links. Keep every statement true to the product;
 * rule-specific figures are phrased as "the corridor's rule set says…".
 */
export interface Section {
  heading: string;
  body?: string[];
  steps?: string[];
  tip?: string;
}

export interface Guide {
  slug: string;
  category: CategoryId;
  title: string;
  summary: string;
  minutes: number;
  sections: Section[];
  /** App routes this guide explains (for contextual help). */
  routes?: string[];
}

export type CategoryId = 'start' | 'documents' | 'verify' | 'screen' | 'account';

export const CATEGORIES: Array<{ id: CategoryId; title: string; description: string }> = [
  { id: 'start', title: 'Getting started', description: 'Set up your company and send your first consignment.' },
  { id: 'documents', title: 'Documents & rules', description: 'Invoices, certificates of origin, checks and corrections.' },
  { id: 'verify', title: 'Sharing & verification', description: 'How buyers, banks and officers check your documents.' },
  { id: 'screen', title: 'Fraud screening', description: 'Checking documents you receive from others.' },
  { id: 'account', title: 'Account, team & billing', description: 'Security, colleagues, integrations and payments.' },
];

export const GUIDES: Guide[] = [
  {
    slug: 'set-up-your-company', category: 'start', minutes: 3, routes: ['/app/company'],
    title: 'Set up your company profile',
    summary: 'Your legal name, address and TIN appear as the exporter on every document. Set them once.',
    sections: [
      { heading: 'Why it matters', body: ['Customs officers compare the exporter on your invoice, certificate of origin and packing list with your registration. SealChain prints the company profile on all three, so they always match.'] },
      { heading: 'Steps', steps: ['Open Company profile in the sidebar.', 'Enter your legal name exactly as registered, your street address, city and TIN.', 'Choose your usual corridor, invoice currency, Incoterm and payment terms. New shipments start with these.', 'Set your invoice numbering prefix and next number, then save.'] },
      { heading: 'Invoice numbers', body: ['In a new shipment, press “Next number” beside the invoice number to take the next number from your sequence. Each number is handed out once, even when two colleagues press it at the same moment.'] },
    ],
  },
  {
    slug: 'your-first-shipment', category: 'start', minutes: 5, routes: ['/app/shipments/new', '/app/shipments'],
    title: 'Create your first shipment',
    summary: 'Enter the shipment once; the invoice, certificate of origin and packing list are produced from it.',
    sections: [
      { heading: 'Before you start', body: ['Have your buyer’s legal name, address and tax ID, the goods (description, quantity, weights, value) and the route (border post and destination) to hand.'] },
      { heading: 'Steps', steps: ['Go to Shipments → New shipment.', 'Pick the corridor and mode of transport; the exit and entry points fill in from the corridor’s rules.', 'Choose the consignee from your address book or type it in.', 'Add each item line: description, HS code, quantity, unit price, net and gross weight, packages and origin. You can import lines from a spreadsheet (CSV).', 'Watch the check panel on the right. Fix every error; read every warning.', 'Save, then Issue.'] },
      { heading: 'Tariff codes', body: ['Start typing a description in the HS code field to get suggestions from the EAC Common External Tariff catalogue. Always confirm the code with your clearing agent when in doubt: the checks compare the code with your description, but the classification is your responsibility.'] },
    ],
  },
  {
    slug: 'fix-validation-errors', category: 'documents', minutes: 4,
    title: 'Understand errors, warnings and notes',
    summary: 'What the pre-submission checks look at, and what to do about each kind of finding.',
    sections: [
      { heading: 'Three levels', body: ['Errors block issuing: something is missing or inconsistent in a way customs would reject — a wrong tax ID format, an HS code that doesn’t match the goods, weights that don’t add up.', 'Warnings must be acknowledged before issuing: things that are allowed but often questioned, such as a sea-only Incoterm (FOB, CIF) on a road shipment.', 'Notes are information: the permits the goods need and who issues them, and what the certificate saves your buyer in duty.'] },
      { heading: 'Where the rules come from', body: ['Each finding names its source. Every corridor rule set shows when the compliance team last verified it; while a rule set is marked draft, treat its requirements as guidance and confirm with your clearing agent.'] },
      { heading: 'Tip', tip: 'Fix errors in the form, not in the PDF. The documents are generated from the shipment record, so a correction always flows to all three.' },
    ],
  },
  {
    slug: 'certificate-of-origin', category: 'documents', minutes: 5,
    title: 'The EAC certificate of origin',
    summary: 'Why it matters, who endorses it, and when the simplified certificate applies.',
    sections: [
      { heading: 'What it does', body: ['The EAC certificate of origin proves the goods originate in an EAC Partner State, so your buyer pays the intra-EAC rate (0%) instead of the Common External Tariff. The check panel shows how much duty that saves your buyer on each shipment.'] },
      { heading: 'Who endorses it', body: ['SealChain generates the certificate from your shipment. It is endorsed by the designated issuing authority — for Rwanda, the Rwanda Revenue Authority (Customs). Where the authority is on SealChain, you can request endorsement from the shipment page and the officer decides in their own workspace.'] },
      { heading: 'Origin criteria', body: ['Goods wholly obtained in the Partner State (for example tea or coffee grown in Rwanda) use the WO criterion. Manufactured goods using imported materials must meet the rules of origin; the checks flag lines where non-originating content exceeds the limit in the corridor’s rule set.'] },
      { heading: 'Simplified certificate (STR)', body: ['For small consignments under the Simplified Trade Regime ceiling shown in the corridor’s rule set (USD 2,000 on the current Rwanda corridors) and goods on the EAC common list, you can use the Simplified Certificate of Origin instead. SealChain pre-fills it; customs stamps it at the border.'] },
    ],
  },
  {
    slug: 'correct-or-revoke', category: 'documents', minutes: 3,
    title: 'Correct, re-issue or revoke a document',
    summary: 'Mistakes after issuing are fixed by a new version — never by editing the PDF.',
    sections: [
      { heading: 'Re-issue', steps: ['Open the shipment and choose Edit.', 'Correct the data and issue again.', 'The new version is sealed and anchored; the old one is marked as superseded.'] },
      { heading: 'What verifiers see', body: ['Anyone verifying the old version is told it has been superseded and shown the current document number. Corrections and re-issues are free.'] },
      { heading: 'Revoke', body: ['If a document should no longer be relied on at all, an owner can revoke it with a reason. Verifiers see the revocation and the reason.'] },
    ],
  },
  {
    slug: 'share-with-your-buyer', category: 'verify', minutes: 2, routes: ['/app/shipments'],
    title: 'Share documents with your buyer or bank',
    summary: 'One link to the whole bundle, with an expiry you choose.',
    sections: [
      { heading: 'Steps', steps: ['Open an issued shipment.', 'Under Shared with, press Share documents.', 'Name the recipient (for example “Buyer’s bank — LC desk”) and choose how long the link works.', 'Copy the link and send it by email or WhatsApp.'] },
      { heading: 'What you’ll see', body: ['Each time the link is opened or a document downloaded, it appears in the shipment’s activity and in your notifications. You can withdraw a link at any time.'] },
    ],
  },
  {
    slug: 'how-verification-works', category: 'verify', minutes: 4, routes: ['/verify'],
    title: 'How buyers, banks and officers verify a document',
    summary: 'Scan the QR code or drop the PDF — no account needed.',
    sections: [
      { heading: 'Two ways to check', body: ['Scanning the QR code on any page opens the document’s record: who issued it, when, and its current status.', 'Dropping the PDF on the verifier also proves the copy is identical to what was issued. The file is fingerprinted in the browser; it is not uploaded.'] },
      { heading: 'Languages', body: ['The verifier works in English, French, Kiswahili and Kinyarwanda.'] },
      { heading: 'Checking without SealChain', body: ['Every result includes the fingerprint, the Merkle proof and the on-chain anchor, so a technical team can confirm it independently. The developer guide explains how.'] },
    ],
  },
  {
    slug: 'verification-results', category: 'verify', minutes: 3,
    title: 'What each verification result means',
    summary: 'Authentic, anchoring, superseded, revoked, altered — and what to do in each case.',
    sections: [
      { heading: 'Results', body: [
        'Authentic — issued through SealChain, unchanged since, and anchored on the blockchain.',
        'Authentic, anchoring in progress — genuine and signed; the blockchain anchor is being written (usually within minutes).',
        'Superseded — a newer version exists; ask for, or check, the current document.',
        'Revoked — the issuer withdrew it, with the reason shown. Do not rely on it.',
        'Altered — the file differs from what was issued. Treat it as not genuine and contact the issuer.',
        'Not found — SealChain never issued a document with that reference.',
      ] },
      { heading: 'Endorsement', body: ['Where the issuing authority endorsed a certificate on SealChain, the result shows it. The absence of an endorsement does not by itself mean a document is false; it means only the exporter’s declaration is proven.'] },
    ],
  },
  {
    slug: 'screen-a-received-document', category: 'screen', minutes: 4, routes: ['/app/check'],
    title: 'Screen a document you received',
    summary: 'Look for signs of alteration or fabrication in certificates and invoices from others.',
    sections: [
      { heading: 'Steps', steps: ['Go to Check a document.', 'Drop the PDF (and, if you have one, the matching invoice as a companion file).', 'Read the risk level and each signal.', 'Record the outcome — genuine or fraud — once you know it. This improves the signals for everyone.'] },
      { heading: 'Risk levels', body: ['High: strong evidence of alteration, such as a certificate number that matches an issued original with a different fingerprint. Medium: signs worth questioning, such as editing traces. Low: nothing unusual found — which is not proof of authenticity.'] },
      { heading: 'The genuine issuer is told', body: ['When an altered copy of a SealChain document is presented, the organisation that issued the original is alerted automatically.'] },
    ],
  },
  {
    slug: 'two-step-sign-in', category: 'account', minutes: 3, routes: ['/app/team'],
    title: 'Turn on two-step sign-in',
    summary: 'Protect your account with a code from an authenticator app.',
    sections: [
      { heading: 'Steps', steps: ['Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy).', 'Go to Team & settings → Security and press Set up.', 'Scan the QR code with the app and enter the 6-digit code it shows.', 'Save the ten recovery codes somewhere safe — each signs you in once if you lose your phone.'] },
      { heading: 'Devices', body: ['Turning it on signs out your other devices. Under “Where you’re signed in” you can see every active session and sign out any you don’t recognise.'] },
    ],
  },
  {
    slug: 'invite-your-team', category: 'account', minutes: 2, routes: ['/app/team'],
    title: 'Invite colleagues',
    summary: 'Owners manage the organisation; members prepare and issue shipments.',
    sections: [
      { heading: 'Steps', steps: ['Go to Team & settings → Members and press Invite.', 'Enter their email and choose a role.', 'They receive an email; you can also copy the invitation link and send it on WhatsApp.'] },
      { heading: 'Roles', body: ['Owners can do everything, including billing, revoking documents, API keys and the company profile. Members create, issue and share shipments.'] },
    ],
  },
  {
    slug: 'billing-and-payment', category: 'account', minutes: 3, routes: ['/app/billing'],
    title: 'How billing and payment work',
    summary: 'A monthly subscription plus a fee when a shipment is first issued.',
    sections: [
      { heading: 'What you pay for', body: ['During the pilot you pay a monthly subscription and a fee per shipment, charged once when its documents are first issued. Drafts, corrections and re-issues are free; verification is free for everyone.'] },
      { heading: 'Paying', body: ['Where online payment is available, owners press Pay now on the billing page and pay by MTN MoMo, Airtel Money or card, in Rwandan francs at the reference rate. Otherwise pay by transfer using the details shown; the payment appears once it is recorded.'] },
      { heading: 'Receipts', body: ['Each payment has a PDF receipt on the billing page.'] },
    ],
  },
  {
    slug: 'api-and-webhooks', category: 'account', minutes: 3, routes: ['/app/team'],
    title: 'Connect your own system (API and webhooks)',
    summary: 'Create shipments from your ERP and receive signed events.',
    sections: [
      { heading: 'API keys', body: ['Owners create keys under Team & settings → Integrations. A key is shown once; revoke it at any time.'] },
      { heading: 'Webhooks', body: ['Add an https endpoint to receive signed events when documents are issued, anchored, revoked or tampered with, and when an authority decides on an endorsement.'] },
      { heading: 'More', body: ['The developer guide has the full flow and code for checking webhook signatures.'] },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);

/** The most relevant guide for an app route, for contextual help. */
export function guideForRoute(pathname: string): Guide | undefined {
  const exact = GUIDES.find((g) => g.routes?.includes(pathname));
  if (exact) return exact;
  return GUIDES.filter((g) => g.routes?.some((r) => pathname.startsWith(r))).sort((a, b) => Math.max(...b.routes!.map((r) => r.length)) - Math.max(...a.routes!.map((r) => r.length)))[0];
}
