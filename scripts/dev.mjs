#!/usr/bin/env node
/**
 * One-command development environment:
 *   1. local EVM chain (Hardhat node, chain id 31337) on :8546
 *   2. deploys SealAnchor (deterministic address on a fresh chain)
 *   3. API on :4100 (tsx watch)
 *   4. web app on :5174 (Vite)
 *
 *   pnpm dev              full stack with on-chain anchoring
 *   pnpm dev --no-chain   skip the chain; API anchors to the local dev ledger
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const noChain = process.argv.includes('--no-chain');
const children = [];
const COLORS = { chain: 35, deploy: 36, api: 33, web: 32 };

function run(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1', ...opts.env }, cwd: opts.cwd });
  const tag = `\x1b[${COLORS[name] ?? 37}m${name.padEnd(6)}\x1b[0m│ `;
  const pipe = (stream) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) if (!opts.quiet?.(l)) process.stdout.write(tag + l + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  if (opts.persistent !== false) children.push(child);
  return child;
}

function exited(child) {
  return new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
}

async function waitForRpc(url, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`RPC ${url} did not come up`);
}

function shutdown(code = 0) {
  for (const c of children) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500).unref();
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const env = {};
if (noChain) {
  env.ANCHOR_MODE = 'local';
} else {
  let external = false;
  try {
    await waitForRpc('http://127.0.0.1:8546', 1000);
    external = true;
    console.log('Using the chain already running on :8546');
  } catch {
    run('chain', 'pnpm', ['--filter', '@sealchain/contracts', 'exec', 'hardhat', 'node', '--hostname', '127.0.0.1', '--port', '8546'], {
      env: { HARDHAT_DISABLE_TELEMETRY_PROMPT: 'true' },
      // Hardhat logs every eth_call; keep only the interesting lines.
      quiet: (l) => /hardhat_metadata|eth_(call|blockNumber|getCode|chainId|getBlockByNumber|getTransactionReceipt|getTransactionByHash|estimateGas|getTransactionCount|feeHistory|gasPrice|maxPriorityFeePerGas)|^\s*$|Account #|Private Key|WARNING|^\s+(Contract|Transaction|From|To|Value|Gas used|Block #)/.test(l),
    });
  }
  await waitForRpc('http://127.0.0.1:8546');
  const deploy = run('deploy', 'pnpm', ['--filter', '@sealchain/contracts', 'deploy:local'], { persistent: false, env: { HARDHAT_DISABLE_TELEMETRY_PROMPT: 'true' } });
  if ((await exited(deploy)) !== 0) {
    console.error('Contract deployment failed');
    shutdown(1);
  }
  if (external) console.log('(If that chain was not fresh, SealAnchor was deployed at a new address — the API picks it up from the deployment file.)');
}

run('api', 'pnpm', ['--filter', '@sealchain/api', 'dev'], { env });
run('web', 'pnpm', ['--filter', '@sealchain/web', 'dev', '--host', '127.0.0.1'], {});

console.log('\n  SealChain dev: web http://localhost:5174 · api http://localhost:4100' + (noChain ? ' · anchoring to local dev ledger' : ' · chain http://127.0.0.1:8546') + '\n');
