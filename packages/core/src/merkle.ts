/**
 * Merkle batching for document anchoring.
 *
 * Anchoring every document in its own transaction would make the per-shipment
 * fee depend on gas prices. Instead, pending document hashes are batched into
 * a Merkle tree and only the 32-byte root is written on-chain. Each document
 * keeps its inclusion proof, so anyone can recompute the root from the
 * document's SHA-256 and check that root against the chain — without trusting
 * SealChain's servers.
 *
 * Construction (domain-separated to prevent second-preimage attacks):
 *   leaf = SHA256(0x00 || docHash)
 *   node = SHA256(0x01 || left || right)
 * An odd node at any level is promoted unchanged (never duplicated).
 *
 * Isomorphic: runs in Node and the browser.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export interface ProofStep {
  /** Sibling hash, hex (no 0x). */
  hash: string;
  /** Whether the sibling sits to the left or right of the running hash. */
  side: 'L' | 'R';
}

const strip0x = (h: string) => (h.startsWith('0x') ? h.slice(2) : h).toLowerCase();

export function sha256Hex(data: Uint8Array | string): string {
  return bytesToHex(sha256(typeof data === 'string' ? utf8ToBytes(data) : data));
}

export function leafHash(docHashHex: string): string {
  return bytesToHex(sha256(concat(new Uint8Array([0]), hexToBytes(strip0x(docHashHex)))));
}

function nodeHash(leftHex: string, rightHex: string): string {
  return bytesToHex(sha256(concat(new Uint8Array([1]), hexToBytes(leftHex), hexToBytes(rightHex))));
}

export interface MerkleTree {
  root: string;
  leaves: string[];
  /** proofs[i] proves inclusion of the i-th input hash. */
  proofs: ProofStep[][];
}

export function buildMerkleTree(docHashes: string[]): MerkleTree {
  if (docHashes.length === 0) throw new Error('Cannot build a Merkle tree with no leaves');
  const leaves = docHashes.map(leafHash);
  const proofs: ProofStep[][] = docHashes.map(() => []);
  // positions[i] = index of input i's running node within the current level
  let positions = docHashes.map((_, i) => i);
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const right = level[i + 1];
      next.push(right === undefined ? level[i]! : nodeHash(level[i]!, right));
    }
    positions = positions.map((pos, input) => {
      const isRight = pos % 2 === 1;
      const siblingIdx = isRight ? pos - 1 : pos + 1;
      const sibling = level[siblingIdx];
      if (sibling !== undefined) proofs[input]!.push({ hash: sibling, side: isRight ? 'L' : 'R' });
      return Math.floor(pos / 2);
    });
    level = next;
  }
  return { root: level[0]!, leaves, proofs };
}

export function computeRootFromProof(docHashHex: string, proof: ProofStep[]): string {
  let acc = leafHash(docHashHex);
  for (const step of proof) {
    const sib = strip0x(step.hash);
    acc = step.side === 'L' ? nodeHash(sib, acc) : nodeHash(acc, sib);
  }
  return acc;
}

export function verifyMerkleProof(docHashHex: string, proof: ProofStep[], rootHex: string): boolean {
  return computeRootFromProof(docHashHex, proof) === strip0x(rootHex);
}

// ------------------------------------------------------------------ chain
/**
 * Minimal ABI encoding for the read-only `SealAnchor.anchoredAt(bytes32)`
 * call, so a browser can query any public RPC directly with `eth_call`
 * without shipping a full Ethereum library.
 */
export function anchoredAtCallData(rootHex: string): string {
  const selector = bytesToHex(keccak_256(utf8ToBytes('anchoredAt(bytes32)'))).slice(0, 8);
  return `0x${selector}${strip0x(rootHex).padStart(64, '0')}`;
}

/** Decodes the uint64 timestamp returned by `anchoredAt`; 0 = never anchored. */
export function decodeUint(resultHex: string): number {
  const h = strip0x(resultHex);
  return h ? Number(BigInt(`0x${h}`)) : 0;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
