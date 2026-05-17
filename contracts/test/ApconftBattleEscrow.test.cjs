const { expect } = require('chai')
const hre = require('hardhat')

describe('ApconftBattleEscrow', function () {
  it('escrows two NFTs and operator settles both to winner', async function () {
    const [owner, alice, bob, operator] = await hre.ethers.getSigners()
    const Collection = await hre.ethers.getContractFactory('ApconftCollection')
    const col = await Collection.deploy()
    await col.waitForDeployment()
    await (await col.connect(owner).mint(alice.address, 'ipfs://a')).wait()
    await (await col.connect(owner).mint(bob.address, 'ipfs://b')).wait()

    const Escrow = await hre.ethers.getContractFactory('ApconftBattleEscrow')
    const escrow = await Escrow.deploy(await col.getAddress(), operator.address)
    await escrow.waitForDeployment()
    const eAddr = await escrow.getAddress()

    await col.connect(alice).setApprovalForAll(eAddr, true)
    await col.connect(bob).setApprovalForAll(eAddr, true)

    const tx1 = await escrow.connect(alice).depositPlayerOne(0)
    const r1 = await tx1.wait()
    let battleId
    for (const log of r1.logs) {
      try {
        const parsed = escrow.interface.parseLog(log)
        if (parsed?.name === 'BattleOpened') {
          battleId = parsed.args.battleId
          break
        }
      } catch {
        /* ignore */
      }
    }
    expect(battleId).to.equal(0n)
    expect(await col.ownerOf(0)).to.equal(eAddr)

    await escrow.connect(bob).depositPlayerTwo(battleId, 1)
    expect(await col.ownerOf(1)).to.equal(eAddr)

    await escrow.connect(operator).settle(battleId, bob.address)
    expect(await col.ownerOf(0)).to.equal(bob.address)
    expect(await col.ownerOf(1)).to.equal(bob.address)

    const b = await escrow.battles(battleId)
    expect(b.settled).to.equal(true)
  })

  it('reverts settle if not ready', async function () {
    const [owner, alice, operator] = await hre.ethers.getSigners()
    const Collection = await hre.ethers.getContractFactory('ApconftCollection')
    const col = await Collection.deploy()
    await col.waitForDeployment()
    await (await col.connect(owner).mint(alice.address, 'ipfs://a')).wait()

    const Escrow = await hre.ethers.getContractFactory('ApconftBattleEscrow')
    const escrow = await Escrow.deploy(await col.getAddress(), operator.address)
    await escrow.waitForDeployment()
    await col.connect(alice).setApprovalForAll(await escrow.getAddress(), true)
    const tx1 = await escrow.connect(alice).depositPlayerOne(0)
    const r1 = await tx1.wait()
    let battleId
    for (const log of r1.logs) {
      try {
        const parsed = escrow.interface.parseLog(log)
        if (parsed?.name === 'BattleOpened') battleId = parsed.args.battleId
      } catch {
        /* ignore */
      }
    }
    await expect(escrow.connect(operator).settle(battleId, alice.address)).to.be.revertedWithCustomError(
      escrow,
      'InvalidBattle',
    )
  })
})
