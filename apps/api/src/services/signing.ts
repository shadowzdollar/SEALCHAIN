/**
 * Issuer signatures.
 *
 * Besides the on-chain anchor (which proves *when* a hash existed), every
 * document is signed with the platform's Ed25519 issuer key (which proves
 * *who* issued it). The public key is published at /api/keys so relying
 * parties can verify signatures offline. The key is generated on first start
 * and stored in DATA_DIR; production deployments should mount it from a
 * secret store (ISSUER_KEY_PEM).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '@sealchain/core';

export interface SignedPayload {
  v: 1;
  documentId: string;
  number: string;
  sha256: string;
  issuedAt: string;
  issuer: string;
}

export class IssuerSigner {
  readonly keyId: string;
  readonly publicKeyPem: string;
  readonly publicKeyRawHex: string;
  private readonly privateKey: crypto.KeyObject;

  constructor(dataDir: string) {
    const pemFromEnv = process.env.ISSUER_KEY_PEM;
    const file = path.join(dataDir, 'issuer-ed25519.pem');
    let pem = pemFromEnv;
    if (!pem) {
      if (fs.existsSync(file)) {
        pem = fs.readFileSync(file, 'utf8');
      } else {
        const { privateKey } = crypto.generateKeyPairSync('ed25519');
        pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
        fs.writeFileSync(file, pem, { mode: 0o600 });
      }
    }
    this.privateKey = crypto.createPrivateKey(pem);
    const publicKey = crypto.createPublicKey(this.privateKey);
    this.publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const der = publicKey.export({ type: 'spki', format: 'der' });
    // Raw 32-byte key is the tail of the SPKI DER encoding.
    this.publicKeyRawHex = der.subarray(der.length - 32).toString('hex');
    this.keyId = crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
  }

  sign(payload: SignedPayload): string {
    return crypto.sign(null, Buffer.from(canonicalJson(payload)), this.privateKey).toString('base64');
  }

  /** Signs any record (canonical JSON), e.g. authority endorsements. */
  signRecord(record: object): string {
    return crypto.sign(null, Buffer.from(canonicalJson(record)), this.privateKey).toString('base64');
  }

  verifyRecord(record: object, signatureB64: string): boolean {
    try {
      return crypto.verify(null, Buffer.from(canonicalJson(record)), crypto.createPublicKey(this.privateKey), Buffer.from(signatureB64, 'base64'));
    } catch {
      return false;
    }
  }

  verify(payload: SignedPayload, signatureB64: string): boolean {
    try {
      return crypto.verify(null, Buffer.from(canonicalJson(payload)), crypto.createPublicKey(this.privateKey), Buffer.from(signatureB64, 'base64'));
    } catch {
      return false;
    }
  }
}
