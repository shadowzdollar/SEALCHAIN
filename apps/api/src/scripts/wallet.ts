/**
 * Creates a fresh anchor wallet. Prints the private key ONCE — store it in
 * your secret manager as ANCHOR_PRIVATE_KEY and never commit it. Then fund the
 * address and authorise it on the contract (the deployer is authorised by
 * default; use a separate hot wallet with a small balance for anchoring).
 */
import { Wallet } from 'ethers';

const w = Wallet.createRandom();
console.log(`Address:     ${w.address}
Private key: ${w.privateKey}

Next steps:
  1. Store the private key as ANCHOR_PRIVATE_KEY in your secret store (not in git).
  2. Send a small amount of the chain's native token to ${w.address}.
  3. From the contract owner: setAnchorer(${w.address}, true).
  4. Run: pnpm --filter @sealchain/api anchor:preflight`);
