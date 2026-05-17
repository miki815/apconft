const { expect } = require('chai')
const hre = require('hardhat')

describe('ApconftCollection', function () {
  it('mints with uri', async function () {
    const [owner, buyer] = await hre.ethers.getSigners()
    const Factory = await hre.ethers.getContractFactory('ApconftCollection')
    const c = await Factory.deploy()
    await c.waitForDeployment()
    await (await c.connect(owner).mint(buyer.address, 'ipfs://test/1')).wait()
    expect(await c.ownerOf(0)).to.equal(buyer.address)
    expect(await c.tokenURI(0)).to.equal('ipfs://test/1')
  })
})
