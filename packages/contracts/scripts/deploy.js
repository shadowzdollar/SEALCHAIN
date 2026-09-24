// Deploys SealAnchor and records the address in deployments/<network>.json,
// which the API reads at start-up (ANCHOR_CONTRACT overrides it).
const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const Factory = await hre.ethers.getContractFactory('SealAnchor');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const { chainId } = await hre.ethers.provider.getNetwork();
  const tx = contract.deploymentTransaction();
  const record = {
    network: hre.network.name,
    chainId: Number(chainId),
    address,
    deployer: deployer.address,
    txHash: tx ? tx.hash : null,
    deployedAt: new Date().toISOString(),
  };
  const local = ['localhost', 'hardhat'].includes(hre.network.name);
  const file = path.join(__dirname, '..', 'deployments', `${hre.network.name}${local ? '.local' : ''}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  console.log(`SealAnchor deployed to ${address} on chain ${chainId} (${hre.network.name})`);
  console.log(`Recorded in ${path.relative(process.cwd(), file)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
