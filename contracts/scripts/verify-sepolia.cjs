const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })
const hre = require('hardhat')
const { ethers } = require('ethers')

function operatorAddress() {
  const explicit = process.env.BATTLE_OPERATOR_ADDRESS?.trim()
  if (explicit) return explicit
  const pk = process.env.FULFILLER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || ''
  if (!pk) {
    throw new Error(
      'Set BATTLE_OPERATOR_ADDRESS to the escrow operator, or set FULFILLER_PRIVATE_KEY / DEPLOYER_PRIVATE_KEY so the operator can be derived.',
    )
  }
  return new ethers.Wallet(pk).address
}

async function main() {
  const collection = process.env.NFT_CONTRACT_ADDRESS?.trim()
  const escrow = process.env.BATTLE_ESCROW_ADDRESS?.trim()
  const which = (process.argv[2] || 'all').toLowerCase()

  if (!collection) {
    throw new Error('NFT_CONTRACT_ADDRESS is missing in .env')
  }

  const op = operatorAddress()

  if (which === 'collection' || which === 'all') {
    console.log('Verifying ApconftCollection', collection)
    await hre.run('verify:verify', {
      address: collection,
      constructorArguments: [],
    })
    console.log('ApconftCollection OK')
  }

  if (which === 'escrow' || which === 'all') {
    if (!escrow) {
      throw new Error('BATTLE_ESCROW_ADDRESS is missing in .env (needed for escrow verify)')
    }
    console.log('Verifying ApconftBattleEscrow', escrow, 'args:', [collection, op])
    await hre.run('verify:verify', {
      address: escrow,
      constructorArguments: [collection, op],
    })
    console.log('ApconftBattleEscrow OK')
  }

  if (which !== 'collection' && which !== 'escrow' && which !== 'all') {
    throw new Error(`Usage: npx hardhat run scripts/verify-sepolia.cjs --network sepolia [collection|escrow|all]`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
