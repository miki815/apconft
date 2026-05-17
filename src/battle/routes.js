import { Router } from 'express'
import { config } from '../config.js'
import genErrHandler from '../utils/genErrHandler.js'
import { getBattleOnChain, settleBattleWithRandomWinner } from './battleService.js'

const router = Router()

function parseBattleId(raw) {
  try {
    const id = BigInt(raw)
    if (id < 0n) return null
    return id
  } catch {
    return null
  }
}

function assertResolveAuth(req, res) {
  const secret = config.battle.resolveSecret
  if (!secret) {
    res.status(503).json({ error: 'BATTLE_RESOLVE_SECRET is not configured' })
    return false
  }
  const got = req.get('X-Battle-Resolve-Secret')
  if (got !== secret) {
    res.status(401).json({ error: 'Invalid or missing X-Battle-Resolve-Secret' })
    return false
  }
  return true
}

router.get(
  '/:battleId',
  genErrHandler(async function battleGet(req, res) {
    const battleId = parseBattleId(req.params.battleId)
    if (battleId === null) {
      res.status(400).json({ error: 'Invalid battleId' })
      return
    }
    const state = await getBattleOnChain(battleId)
    res.json(state)
  }),
)

router.post(
  '/:battleId/resolve',
  genErrHandler(async function battleResolve(req, res) {
    if (!assertResolveAuth(req, res)) return
    const battleId = parseBattleId(req.params.battleId)
    if (battleId === null) {
      res.status(400).json({ error: 'Invalid battleId' })
      return
    }
    try {
      const result = await settleBattleWithRandomWinner(battleId)
      res.json({
        battleId: battleId.toString(),
        winner: result.winner,
        loser: result.loser,
        txHash: result.txHash,
      })
    } catch (e) {
      if (e.code === 'INVALID_BATTLE') {
        res.status(404).json({ error: e.message })
        return
      }
      if (e.code === 'NOT_READY' || e.code === 'ALREADY_SETTLED') {
        res.status(409).json({ error: e.message })
        return
      }
      throw e
    }
  }),
)

export default router
