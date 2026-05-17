import { randomInt } from 'node:crypto'
import { ethers } from 'ethers'
import { config } from '../config.js'
import { BATTLE_ESCROW_ABI } from './battleEscrowAbi.js'

function operatorPrivateKeyOrFulfiller() {
  const k = config.battle.operatorPrivateKey
  if (k) return k
  return config.nft.fulfillerPrivateKey
}

function battleContract(readOnly = true) {
  const { rpcUrl, escrowAddress } = config.battle
  if (!rpcUrl || !escrowAddress) {
    throw new Error('Battle not configured (RPC_URL / BATTLE_ESCROW_ADDRESS)')
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  if (readOnly) {
    return new ethers.Contract(escrowAddress, BATTLE_ESCROW_ABI, provider)
  }
  const pk = operatorPrivateKeyOrFulfiller()
  if (!pk) {
    throw new Error('BATTLE_OPERATOR_PRIVATE_KEY or FULFILLER_PRIVATE_KEY is required to settle')
  }
  const wallet = new ethers.Wallet(pk, provider)
  return new ethers.Contract(escrowAddress, BATTLE_ESCROW_ABI, wallet)
}

/**
 * @param {bigint} battleId
 */
export async function getBattleOnChain(battleId) {
  const c = battleContract(true)
  const b = await c.battles(battleId)
  return {
    battleId: battleId.toString(),
    playerA: b.playerA,
    playerB: b.playerB,
    tokenIdA: b.tokenIdA.toString(),
    tokenIdB: b.tokenIdB.toString(),
    ready: b.ready,
    settled: b.settled,
  }
}

/**
 * Verifies battle is ready, picks fair 50/50 winner off-chain, sends settle tx.
 * @param {bigint} battleId
 * @returns {Promise<{ winner: string, loser: string, txHash: string }>}
 */
export async function settleBattleWithRandomWinner(battleId) {
  const c = battleContract(false)
  const b = await c.battles(battleId)

  if (b.playerA === ethers.ZeroAddress) {
    const err = new Error('Battle does not exist')
    err.code = 'INVALID_BATTLE'
    throw err
  }
  if (!b.ready) {
    const err = new Error('Both players must deposit before resolve')
    err.code = 'NOT_READY'
    throw err
  }
  if (b.settled) {
    const err = new Error('Battle already settled')
    err.code = 'ALREADY_SETTLED'
    throw err
  }

  const winner = randomInt(2) === 0 ? b.playerA : b.playerB
  const loser = winner === b.playerA ? b.playerB : b.playerA
  const tx = await c.settle(battleId, winner)
  const receipt = await tx.wait()

  return {
    winner,
    loser,
    txHash: receipt.hash,
  }
}
