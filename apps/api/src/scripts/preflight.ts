/**
 * Anchoring pre-flight: run before pointing a deployment at a real chain.
 *
 *   RPC_URL=… ANCHOR_CONTRACT=… ANCHOR_PRIVATE_KEY=… CHAIN_ID=… pnpm --filter @sealchain/api anchor:preflight
 *
 * Checks RPC reachability and chain id, contract bytecode, anchorer
 * authorisation, wallet balance, current fees and the estimated cost of one
 * anchor transaction (= the chain cost of one batch, shared by every document
 * in it). Exits non-zero if anchoring would fail.
 */
import { Contract, JsonRpcProvider, Wallet, formatEther, formatUnits } from 'ethers';
import { loadConfig } from '../config';
import { SEAL_ANCHOR_ABI } from '../services/anchor';

const cfg = loadConfig();
let failed = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => {
  failed++;
  console.log(`  ✗ ${msg}`);
};
const warn = (msg: string) => console.log(`  ! ${msg}`);

console.log(`SealChain anchoring pre-flight\n`);
if (cfg.anchor.mode !== 'evm') {
  console.log('  ANCHOR_MODE is "local" — documents go to the development ledger. Set RPC_URL, ANCHOR_CONTRACT and ANCHOR_PRIVATE_KEY for on-chain anchoring.');
  process.exit(1);
}

const provider = new JsonRpcProvider(cfg.anchor.rpcUrl, undefined, { staticNetwork: false } as never);
const wallet = new Wallet(cfg.anchor.privateKey!, provider);
const contract = new Contract(cfg.anchor.contract!, SEAL_ANCHOR_ABI, wallet);

try {
  const net = await provider.getNetwork();
  if (Number(net.chainId) === cfg.anchor.chainId) ok(`RPC ${cfg.anchor.rpcUrl} reachable, chain id ${net.chainId}`);
  else bad(`RPC reports chain id ${net.chainId} but CHAIN_ID is ${cfg.anchor.chainId}`);
} catch (err) {
  bad(`RPC unreachable: ${(err as Error).message.split('\n')[0]}`);
  process.exit(1);
}

const code = await provider.getCode(cfg.anchor.contract!);
if (code === '0x') bad(`No contract at ${cfg.anchor.contract}`);
else ok(`SealAnchor found at ${cfg.anchor.contract} (${(code.length - 2) / 2} bytes)`);

if (code !== '0x') {
  const authorized: boolean = await contract.getFunction('anchorers')(wallet.address);
  if (authorized) ok(`Wallet ${wallet.address} is an authorised anchorer`);
  else bad(`Wallet ${wallet.address} is NOT authorised — the contract owner must call setAnchorer(${wallet.address}, true)`);
  const batches: bigint = await contract.getFunction('batchCount')();
  ok(`${batches} batch(es) anchored on this contract so far`);
}

const balance = await provider.getBalance(wallet.address);
if (balance === 0n) bad('Anchor wallet balance is 0 — fund it before issuing documents');
else if (Number(formatEther(balance)) < cfg.anchor.minBalance) warn(`Balance ${formatEther(balance)} is below ANCHOR_MIN_BALANCE (${cfg.anchor.minBalance})`);
else ok(`Wallet balance ${formatEther(balance)}`);

const fee = await provider.getFeeData();
const price = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
ok(`Current max fee ${formatUnits(price, 'gwei')} gwei${cfg.anchor.maxGasGwei ? ` (cap ${cfg.anchor.maxGasGwei} gwei)` : ' (no cap set — consider ANCHOR_MAX_GAS_GWEI)'}`);

if (code !== '0x') {
  try {
    const probe = `0x${'5c'.repeat(32)}`;
    const gas = await contract.getFunction('anchor').estimateGas(probe, 50, 'preflight-estimate');
    const cost = gas * price;
    ok(`One anchor ≈ ${gas} gas ≈ ${formatEther(cost)} native units per batch`);
    if (balance > 0n) ok(`Balance covers ≈ ${(balance / (cost || 1n)).toString()} batches at current fees`);
  } catch (err) {
    bad(`Gas estimation failed: ${(err as Error).message.split('\n')[0]}`);
  }
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nReady to anchor.');
process.exit(failed ? 1 : 0);
