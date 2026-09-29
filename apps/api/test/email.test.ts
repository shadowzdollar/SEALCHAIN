import { describe, expect, it } from 'vitest';
import { buttonLabel, renderEmailHtml } from '../src/services/emailTemplate';

describe('HTML email', () => {
  const html = renderEmailHtml({
    subject: 'Aline invited you to Kivu <Fresh>',
    body: 'Aline has invited you to join Kivu <script>alert(1)</script> on SealChain.\n\nAccept the invitation (valid 7 days):\nhttps://app.sealchain.rw/invite/abc123\n\nQuestions? Write to https://app.sealchain.rw/contact',
    webUrl: 'https://app.sealchain.rw',
  });

  it('escapes all text', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Kivu &lt;Fresh&gt;');
  });

  it('turns a trailing URL into a labelled button and links other URLs', () => {
    expect(html).toContain('href="https://app.sealchain.rw/invite/abc123"');
    expect(html).toContain('Accept the invitation &rarr;');
    expect(html).toMatch(/<a href="https:\/\/app\.sealchain\.rw\/contact"[^>]*>https:\/\/app\.sealchain\.rw\/contact<\/a>/);
    expect(html).toContain('https://app.sealchain.rw/brand/sealchain-seal-128.png');
  });

  it('labels buttons by destination', () => {
    expect(buttonLabel('https://x/reset-password/t')).toBe('Choose a new password');
    expect(buttonLabel('https://x/app/shipments/shp_1')).toBe('Open the shipment');
    expect(buttonLabel('https://x/elsewhere')).toBe('Open SealChain');
  });
});
