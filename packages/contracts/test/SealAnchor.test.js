const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('SealAnchor', () => {
  const root = '0x' + 'ab'.repeat(32);

  async function deploy() {
    const [owner, other] = await ethers.getSigners();
    const c = await (await ethers.getContractFactory('SealAnchor')).deploy();
    return { c, owner, other };
  }

  it('anchors a root and records its timestamp', async () => {
    const { c, owner } = await deploy();
    await expect(c.anchor(root, 3, 'batch-1'))
      .to.emit(c, 'RootAnchored')
      .withArgs(root, 1n, 3, 'batch-1', owner.address);
    const block = await ethers.provider.getBlock('latest');
    expect(await c.anchoredAt(root)).to.equal(BigInt(block.timestamp));
    expect(await c.batchCount()).to.equal(1n);
  });

  it('never overwrites an anchored root', async () => {
    const { c } = await deploy();
    await c.anchor(root, 1, 'a');
    await expect(c.anchor(root, 1, 'b')).to.be.revertedWithCustomError(c, 'AlreadyAnchored');
  });

  it('rejects the zero root', async () => {
    const { c } = await deploy();
    await expect(c.anchor(ethers.ZeroHash, 1, 'a')).to.be.revertedWithCustomError(c, 'EmptyRoot');
  });

  it('only authorised anchorers can anchor', async () => {
    const { c, other } = await deploy();
    await expect(c.connect(other).anchor(root, 1, 'x')).to.be.revertedWithCustomError(c, 'NotAnchorer');
    await c.setAnchorer(other.address, true);
    await expect(c.connect(other).anchor(root, 1, 'x')).to.emit(c, 'RootAnchored');
  });

  it('only the owner manages anchorers and ownership', async () => {
    const { c, other } = await deploy();
    await expect(c.connect(other).setAnchorer(other.address, true)).to.be.revertedWithCustomError(c, 'NotOwner');
    await c.transferOwnership(other.address);
    expect(await c.owner()).to.equal(other.address);
    await expect(c.setAnchorer(other.address, true)).to.be.revertedWithCustomError(c, 'NotOwner');
  });

  it('returns 0 for unknown roots', async () => {
    const { c } = await deploy();
    expect(await c.anchoredAt('0x' + '01'.repeat(32))).to.equal(0n);
  });
});
