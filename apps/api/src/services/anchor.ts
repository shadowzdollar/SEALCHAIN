/**
 * Anchoring service.
 *
 * Issued documents are queued (documents.batch_id IS NULL). A single-flight
 * worker periodically — and shortly after each issuance — collects the queue
 * into a Merkle tree, stores every document's inclusion proof, then writes the
 * root through an `AnchorBackend`:
 *
 *   - EvmAnchorBackend: `SealAnchor.anchor(root, …)` on any EVM chain. The
 *     tx hash is persisted *before* waiting for the receipt, so a crash
 *     mid-flight is recovered on restart instead of double-anchoring.
 *   - LocalLedgerBackend: development fallback when no chain is configured.
 *     A hash-chained ledger inside SealChain's own database. It is clearly
 *     labelled as NOT independently verifiable anywhere it is shown.
 *
 * Batches never change once their proofs are written: a failed submission is
 * retried with backoff using the same root.
 */
import crypto from 'node:crypto';
import { Contract, JsonRpcProvider, Wallet, formatEther, formatUnits, parseUnits } from 'ethers';
import { buildMerkleTree } from '@sealchain/core';
import type { Config } from '../config';
import { newId, nowIso, type Db } from '../db';

export const SEAL_ANCHOR_ABI = [
  'function anchor(bytes32 root, uint32 leafCount, string batchId)',
  'function anchoredAt(bytes32 root) view returns (uint64)',
  'function batchCount() view returns (uint256)',
  'function anchorers(address) view returns (bool)',
  'event RootAnchored(bytes32 indexed root, uint256 indexed batchNumber, uint32 leafCount, string batchId, address anchorer)',
];

export interface AnchorReceipt {
  txHash?: string;
  blockNumber?: number;
  anchoredAt: string;
  prevEntry?: string;
  entryHash?: string;
  gasUsed?: number;
  gasPriceWei?: string;
}

export interface BackendHealth {
  ok: boolean;
  detail: string;
  blockNumber?: number;
  wallet?: { address: string; balance: string; low: boolean; authorized: boolean };
  warnings?: string[];
}

/** Thrown when submission should wait (e.g. gas above cap) rather than count as a failure. */
export class DeferredError extends Error {}

export interface BackendInfo {
  backend: 'evm' | 'local';
  networkName: string;
  chainId?: number;
  contract?: string;
  publicRpcUrl?: string;
  explorerTxUrl?: string;
  independentlyVerifiable: boolean;
}

export interface AnchorBackend {
  readonly info: BackendInfo;
  /** Sends the anchor; must call `onSent(txHash)` before waiting for inclusion. */
  submit(batchId: string, root: string, leafCount: number, onSent: (txHash: string) => void): Promise<AnchorReceipt>;
  /** Resumes a submission whose tx hash was persisted. null = tx dropped. */
  resume(txHash: string): Promise<AnchorReceipt | null>;
  /** Live lookup: unix seconds the root was anchored, or null. */
  lookup(root: string): Promise<number | null>;
  health(): Promise<BackendHealth>;
}

export class EvmAnchorBackend implements AnchorBackend {
  readonly info: BackendInfo;
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private contract: Contract;

  constructor(private cfg: Config['anchor']) {
    this.provider = new JsonRpcProvider(cfg.rpcUrl, cfg.chainId, { staticNetwork: true, polling: true, pollingInterval: 1000 } as never);
    this.wallet = new Wallet(cfg.privateKey!, this.provider);
    this.contract = new Contract(cfg.contract!, SEAL_ANCHOR_ABI, this.wallet);
    this.info = {
      backend: 'evm',
      networkName: cfg.networkName,
      chainId: cfg.chainId,
      contract: cfg.contract,
      publicRpcUrl: cfg.publicRpcUrl,
      explorerTxUrl: cfg.explorerTxUrl,
      independentlyVerifiable: true,
    };
  }

  async submit(batchId: string, root: string, leafCount: number, onSent: (txHash: string) => void): Promise<AnchorReceipt> {
    const existing = await this.lookup(root);
    if (existing) return { anchoredAt: new Date(existing * 1000).toISOString() };
    if (this.cfg.maxGasGwei > 0) {
      const fee = await this.provider.getFeeData();
      const price = fee.maxFeePerGas ?? fee.gasPrice;
      if (price && price > parseUnits(String(this.cfg.maxGasGwei), 'gwei')) {
        throw new DeferredError(`Network fee ${formatUnits(price, 'gwei')} gwei is above the ${this.cfg.maxGasGwei} gwei cap; anchoring deferred`);
      }
    }
    const tx = await this.contract.getFunction('anchor')(`0x${root}`, leafCount, batchId);
    onSent(tx.hash);
    const receipt = await tx.wait(this.cfg.confirmations, 120_000);
    if (!receipt || receipt.status !== 1) throw new Error(`Anchor transaction ${tx.hash} failed`);
    const block = await this.provider.getBlock(receipt.blockNumber);
    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      anchoredAt: new Date(Number(block!.timestamp) * 1000).toISOString(),
      gasUsed: Number(receipt.gasUsed),
      gasPriceWei: (receipt.gasPrice ?? 0n).toString(),
    };
  }

  async resume(txHash: string): Promise<AnchorReceipt | null> {
    const receipt = await this.provider.waitForTransaction(txHash, this.cfg.confirmations, 60_000).catch(() => null);
    if (!receipt) {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return null;
      throw new Error(`Anchor transaction ${txHash} still pending`);
    }
    if (receipt.status !== 1) return null;
    const block = await this.provider.getBlock(receipt.blockNumber);
    return {
      txHash,
      blockNumber: receipt.blockNumber,
      anchoredAt: new Date(Number(block!.timestamp) * 1000).toISOString(),
      gasUsed: Number(receipt.gasUsed),
      gasPriceWei: (receipt.gasPrice ?? 0n).toString(),
    };
  }

  async lookup(root: string): Promise<number | null> {
    const ts: bigint = await this.contract.getFunction('anchoredAt')(`0x${root.replace(/^0x/, '')}`);
    return ts > 0n ? Number(ts) : null;
  }

  async health(): Promise<BackendHealth> {
    try {
      const [blockNumber, code, balance] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getCode(this.cfg.contract!),
        this.provider.getBalance(this.wallet.address),
      ]);
      if (code === '0x') return { ok: false, detail: `No contract deployed at ${this.cfg.contract}`, blockNumber };
      const authorized: boolean = await this.contract.getFunction('anchorers')(this.wallet.address);
      const low = Number(formatEther(balance)) < this.cfg.minBalance;
      const warnings: string[] = [];
      if (!authorized) warnings.push(`Wallet ${this.wallet.address} is not an authorised anchorer on the contract — call setAnchorer().`);
      if (low) warnings.push(`Anchor wallet balance ${formatEther(balance)} is below ${this.cfg.minBalance}; top it up to keep anchoring.`);
      return {
        ok: authorized && balance > 0n,
        detail: authorized ? `Connected to ${this.cfg.networkName}` : 'Wallet not authorised to anchor',
        blockNumber,
        wallet: { address: this.wallet.address, balance: formatEther(balance), low, authorized },
        warnings,
      };
    } catch (err) {
      return { ok: false, detail: `RPC unreachable: ${(err as Error).message.split('\n')[0]}` };
    }
  }
}

export class LocalLedgerBackend implements AnchorBackend {
  readonly info: BackendInfo = {
    backend: 'local',
    networkName: 'SealChain local ledger (development only)',
    independentlyVerifiable: false,
  };

  constructor(private db: Db) {}

  async submit(_batchId: string, root: string): Promise<AnchorReceipt> {
    const prev = this.db.get<{ entry_hash: string }>(
      "SELECT entry_hash FROM anchor_batches WHERE backend = 'local' AND status = 'confirmed' ORDER BY anchored_at DESC, rowid DESC LIMIT 1",
    );
    const anchoredAt = nowIso();
    const prevEntry = prev?.entry_hash ?? '0'.repeat(64);
    const entryHash = crypto.createHash('sha256').update(`${prevEntry}${root}${anchoredAt}`).digest('hex');
    return { anchoredAt, prevEntry, entryHash };
  }

  async resume(): Promise<AnchorReceipt | null> {
    return null;
  }

  async lookup(root: string): Promise<number | null> {
    const row = this.db.get<{ anchored_at: string }>("SELECT anchored_at FROM anchor_batches WHERE root = ? AND status = 'confirmed'", root);
    return row ? Math.floor(new Date(row.anchored_at).getTime() / 1000) : null;
  }

  async health(): Promise<BackendHealth> {
    return { ok: true, detail: 'Local ledger (development mode — not independently verifiable)' };
  }
}

interface BatchRow {
  id: string;
  root: string;
  leaf_count: number;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  tx_hash: string | null;
  attempts: number;
  updated_at: string;
}

export class AnchorService {
  private running = false;
  private rerun = false;
  private timer?: NodeJS.Timeout;
  private debounce?: NodeJS.Timeout;
  lastError: string | null = null;
  lastRunAt: string | null = null;
  /** Called after a batch is confirmed (used for webhooks). */
  onConfirmed?: (batchId: string) => void;

  constructor(
    private db: Db,
    readonly backend: AnchorBackend,
    private cfg: Config['anchor'],
    private log: { info: (o: object, m?: string) => void; error: (o: object, m?: string) => void } = console as never,
  ) {}

  start() {
    this.timer = setInterval(() => void this.run(), this.cfg.intervalMs);
    this.timer.unref();
    void this.replayOnDevChain().finally(() => this.run());
  }

  /**
   * A local Hardhat node forgets its state on restart. On the development
   * chain only (31337), re-queue confirmed roots the chain no longer knows so
   * previously issued documents stay verifiable. Roots — and therefore every
   * stored proof — are unchanged. Never runs against a real network.
   */
  private async replayOnDevChain() {
    if (this.backend.info.backend !== 'evm' || this.backend.info.chainId !== 31337) return;
    try {
      const batches = this.db.all<BatchRow>("SELECT * FROM anchor_batches WHERE status = 'confirmed' AND backend = 'evm' AND chain_id = 31337");
      let replayed = 0;
      for (const b of batches) {
        if (!(await this.backend.lookup(b.root))) {
          this.db.run("UPDATE anchor_batches SET status = 'pending', tx_hash = NULL, block_number = NULL, updated_at = ? WHERE id = ?", nowIso(), b.id);
          replayed++;
        }
      }
      if (replayed) this.log.info({ replayed }, 'development chain was reset — re-anchoring previously confirmed batches');
    } catch (err) {
      this.log.error({ err }, 'dev-chain replay check failed');
    }
  }

  stop() {
    clearInterval(this.timer);
    clearTimeout(this.debounce);
  }

  /** Called after issuance so documents anchor within seconds. */
  schedule() {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.run(), this.cfg.debounceMs);
    this.debounce.unref();
  }

  /** Runs one full cycle; concurrent calls coalesce into a single re-run. */
  async run(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.rerun = false;
        await this.cycle();
      } while (this.rerun);
      this.lastError = null;
    } catch (err) {
      this.lastError = (err as Error).message;
      this.log.error({ err }, 'anchor cycle failed');
    } finally {
      this.lastRunAt = nowIso();
      this.running = false;
    }
  }

  private async cycle() {
    // 1. Resume in-flight submissions.
    for (const b of this.db.all<BatchRow>("SELECT * FROM anchor_batches WHERE status = 'submitted'")) {
      try {
        const r = b.tx_hash ? await this.backend.resume(b.tx_hash) : null;
        if (r) this.confirm(b.id, r);
        else this.markFailed(b.id, 'Transaction dropped; will resubmit');
      } catch (err) {
        this.log.error({ err, batch: b.id }, 'resume failed');
      }
    }

    // 2. Retry failed / never-sent batches with exponential backoff.
    const now = Date.now();
    for (const b of this.db.all<BatchRow>("SELECT * FROM anchor_batches WHERE status IN ('pending','failed') ORDER BY created_at")) {
      const wait = b.status === 'pending' ? 0 : Math.min(2 ** b.attempts * 5_000, 300_000);
      if (now - new Date(b.updated_at).getTime() < wait) continue;
      await this.submit(b);
    }

    // 3. Batch everything queued: issued documents and authority endorsements
    //    share the same Merkle tree (an endorsement's leaf is its record hash).
    const queued = [
      ...this.db.all<{ id: string; sha256: string }>('SELECT id, sha256 FROM documents WHERE batch_id IS NULL ORDER BY issued_at, id').map((d) => ({ ...d, table: 'documents' as const })),
      ...this.db.all<{ id: string; sha256: string }>("SELECT id, record_hash AS sha256 FROM endorsements WHERE batch_id IS NULL AND status = 'endorsed' AND record_hash IS NOT NULL ORDER BY decided_at, id").map((e) => ({ ...e, table: 'endorsements' as const })),
    ];
    if (!queued.length) return;
    const tree = buildMerkleTree(queued.map((d) => d.sha256));
    const batchId = newId('bat', 16);
    const ts = nowIso();
    this.db.tx(() => {
      this.db.insert('anchor_batches', {
        id: batchId,
        root: tree.root,
        leaf_count: queued.length,
        backend: this.backend.info.backend,
        status: 'pending',
        chain_id: this.backend.info.chainId ?? null,
        contract: this.backend.info.contract ?? null,
        created_at: ts,
        updated_at: ts,
      });
      queued.forEach((d, i) => {
        this.db.run(`UPDATE ${d.table} SET batch_id = ?, proof = ? WHERE id = ? AND batch_id IS NULL`, batchId, JSON.stringify(tree.proofs[i]), d.id);
      });
    });
    this.log.info({ batchId, leaves: queued.length, root: tree.root }, 'anchor batch created');
    const batch = this.db.get<BatchRow>('SELECT * FROM anchor_batches WHERE id = ?', batchId)!;
    await this.submit(batch);
  }

  private async submit(b: BatchRow) {
    this.db.run('UPDATE anchor_batches SET attempts = attempts + 1, updated_at = ? WHERE id = ?', nowIso(), b.id);
    try {
      const receipt = await this.backend.submit(b.id, b.root, b.leaf_count, (txHash) => {
        this.db.run("UPDATE anchor_batches SET status = 'submitted', tx_hash = ?, updated_at = ? WHERE id = ?", txHash, nowIso(), b.id);
      });
      this.confirm(b.id, receipt);
    } catch (err) {
      this.markFailed(b.id, (err as Error).message.split('\n')[0]!.slice(0, 500));
      if (err instanceof DeferredError) {
        // Waiting for cheaper gas is expected — don't escalate it as a cycle error.
        this.db.run('UPDATE anchor_batches SET attempts = MAX(0, attempts - 1) WHERE id = ?', b.id);
        this.log.info({ batch: b.id }, err.message);
        return;
      }
      throw err;
    }
  }

  private confirm(batchId: string, r: AnchorReceipt) {
    this.db.run(
      `UPDATE anchor_batches SET status = 'confirmed', tx_hash = COALESCE(?, tx_hash), block_number = ?, anchored_at = ?,
         prev_entry = ?, entry_hash = ?, gas_used = COALESCE(?, gas_used), gas_price_wei = COALESCE(?, gas_price_wei), error = NULL, updated_at = ? WHERE id = ?`,
      r.txHash ?? null, r.blockNumber ?? null, r.anchoredAt, r.prevEntry ?? null, r.entryHash ?? null, r.gasUsed ?? null, r.gasPriceWei ?? null, nowIso(), batchId,
    );
    this.log.info({ batchId, tx: r.txHash }, 'anchor batch confirmed');
    try {
      this.onConfirmed?.(batchId);
    } catch (err) {
      this.log.error({ err, batchId }, 'onConfirmed hook failed');
    }
  }

  private markFailed(batchId: string, error: string) {
    this.db.run("UPDATE anchor_batches SET status = 'failed', error = ?, updated_at = ? WHERE id = ?", error, nowIso(), batchId);
  }

  async status() {
    const counts = this.db.all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM anchor_batches GROUP BY status');
    const queued = this.db.get<{ n: number }>(
      "SELECT (SELECT COUNT(*) FROM documents WHERE batch_id IS NULL) + (SELECT COUNT(*) FROM endorsements WHERE batch_id IS NULL AND status = 'endorsed') AS n",
    )!.n;
    const cost = this.db.get<{ batches: number; docs: number; gas: number | null; wei: string | null }>(
      `SELECT COUNT(*) AS batches, COALESCE(SUM(leaf_count), 0) AS docs, SUM(gas_used) AS gas,
              CAST(SUM(CAST(gas_used AS REAL) * CAST(gas_price_wei AS REAL)) AS TEXT) AS wei
         FROM anchor_batches WHERE status = 'confirmed' AND gas_used IS NOT NULL`,
    )!;
    return {
      ...this.backend.info,
      health: await this.backend.health(),
      queuedDocuments: queued,
      batches: Object.fromEntries(counts.map((c) => [c.status, c.n])),
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      cost: {
        batches: cost.batches,
        documents: cost.docs,
        gasUsed: cost.gas ?? 0,
        // Native-currency spend; multiply by the token's fiat price for pricing decisions.
        totalNative: cost.wei ? Number(cost.wei) / 1e18 : 0,
        perDocumentNative: cost.docs ? (cost.wei ? Number(cost.wei) / 1e18 : 0) / cost.docs : 0,
        avgGasPerBatch: cost.batches ? Math.round((cost.gas ?? 0) / cost.batches) : 0,
      },
    };
  }
}

export function createAnchorBackend(cfg: Config, db: Db): AnchorBackend {
  return cfg.anchor.mode === 'evm' ? new EvmAnchorBackend(cfg.anchor) : new LocalLedgerBackend(db);
}
