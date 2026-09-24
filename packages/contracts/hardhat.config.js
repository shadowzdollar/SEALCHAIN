require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');

const { RPC_URL, DEPLOYER_KEY, CHAIN_ID } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    localhost: { url: process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8546' },
    // Any EVM chain (e.g. Polygon Amoy, Base Sepolia, or a mainnet L2):
    //   RPC_URL=... DEPLOYER_KEY=0x... pnpm --filter @sealchain/contracts deploy remote
    ...(RPC_URL && DEPLOYER_KEY
      ? { remote: { url: RPC_URL, accounts: [DEPLOYER_KEY], chainId: CHAIN_ID ? Number(CHAIN_ID) : undefined } }
      : {}),
  },
};
