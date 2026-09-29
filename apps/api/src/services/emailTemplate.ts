/**
 * Branded HTML for every outgoing email, built from the plain-text body so
 * each message is written once. Table layout and inline styles for email
 * clients; every piece of text is HTML-escaped.
 *
 *   - blank lines separate paragraphs
 *   - a line that is only a URL becomes a button
 *   - "Label: https://…" lines and bare URLs inside text become links
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const URL_RE = /https?:\/\/[^\s<>"']+/g;

const INK = '#0b1f3a';
const TEXT = '#36404e';
const MUTED = '#6c6c69';
const PAPER = '#f8f5ee';
const CARD = '#fffdf8';
const RULE = '#e2dac8';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'IBM Plex Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

/** A button label that says where the link goes. */
export function buttonLabel(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  if (path.startsWith('/invite/')) return 'Accept the invitation';
  if (path.startsWith('/reset-password')) return 'Choose a new password';
  if (path.startsWith('/app/billing')) return 'Open billing';
  if (path.startsWith('/app/authority')) return 'Review the request';
  if (path.startsWith('/app/shipments/')) return 'Open the shipment';
  if (path.startsWith('/v/')) return 'Verify the document';
  if (path.startsWith('/s/')) return 'View the documents';
  return 'Open SealChain';
}

const linkify = (text: string) => {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    out += esc(text.slice(last, m.index));
    out += `<a href="${esc(m[0])}" style="color:${INK};text-decoration:underline;word-break:break-all">${esc(m[0])}</a>`;
    last = m.index! + m[0].length;
  }
  return out + esc(text.slice(last));
};

function button(url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="background:${INK};border-radius:3px">
<a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${esc(buttonLabel(url))} &rarr;</a>
</td></tr></table>`;
}

export function renderEmailHtml(opts: { subject: string; body: string; webUrl: string }): string {
  const blocks = opts.body.trim().split(/\n\s*\n/);
  let buttons = 0;
  const html = blocks
    .map((block) => {
      const lines = block.split('\n');
      const para = (ls: string[]) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.6;color:${TEXT}">${ls.map(linkify).join('<br>')}</p>`;
      // A URL alone on the last line of a paragraph becomes a button (at most two per email).
      const lastLine = lines.at(-1)!.trim();
      if (/^https?:\/\/\S+$/.test(lastLine) && buttons < 2) {
        buttons++;
        return (lines.length > 1 ? para(lines.slice(0, -1)) : '') + button(lastLine);
      }
      return para(lines);
    })
    .join('\n');
  const preheader = esc(blocks[0]!.replace(URL_RE, '').slice(0, 140));
  const logo = `${opts.webUrl}/brand/sealchain-seal-128.png`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 4px 18px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle"><img src="${esc(logo)}" width="40" height="40" alt="" style="display:block;border:0"></td>
        <td style="vertical-align:middle;padding-left:10px;font-family:${SERIF};font-size:21px;font-weight:bold;color:${INK}">SealChain</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${CARD};border:1px solid ${RULE};border-top:3px solid ${INK};border-radius:2px;padding:32px 32px 16px">
      <h1 style="margin:0 0 20px;font-family:${SERIF};font-size:23px;line-height:1.25;font-weight:bold;color:${INK}">${esc(opts.subject)}</h1>
      ${html}
    </td></tr>
    <tr><td style="padding:20px 4px;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED}">
      SealChain · compliant cross-border trade documents with authenticity anyone can check.<br>
      <a href="${esc(opts.webUrl)}" style="color:${MUTED}">${esc(opts.webUrl.replace(/^https?:\/\//, ''))}</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
