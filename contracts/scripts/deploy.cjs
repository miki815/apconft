const hre = require('hardhat')

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const Factory = await hre.ethers.getContractFactory('ApconftCollection')
  const c = await Factory.deploy()
  await c.waitForDeployment()
  const collectionAddress = await c.getAddress()

  const operatorAddr =
    process.env.BATTLE_OPERATOR_ADDRESS && process.env.BATTLE_OPERATOR_ADDRESS.trim() !== ''
      ? process.env.BATTLE_OPERATOR_ADDRESS
      : deployer.address

  const Escrow = await hre.ethers.getContractFactory('ApconftBattleEscrow')
  const escrow = await Escrow.deploy(collectionAddress, operatorAddr)
  await escrow.waitForDeployment()
  const escrowAddress = await escrow.getAddress()

  console.log('ApconftCollection:', collectionAddress, 'deployer:', deployer.address)
  console.log('ApconftBattleEscrow:', escrowAddress, 'operator:', operatorAddr)
  console.log('')
  console.log('Add to repo root .env (FULFILLER_PRIVATE_KEY must be this deployer — onlyOwner can mint):')
  console.log(`RPC_URL=${process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || '(your Sepolia RPC)'}`)
  console.log(`NFT_CONTRACT_ADDRESS=${collectionAddress}`)
  console.log(`BATTLE_ESCROW_ADDRESS=${escrowAddress}`)
  if (operatorAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log('# Operator is not deployer — set private key for that address:')
    console.log('# BATTLE_OPERATOR_PRIVATE_KEY=...')
  } else {
    console.log(`BATTLE_OPERATOR_PRIVATE_KEY=(same as FULFILLER_PRIVATE_KEY if operator is deployer)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
