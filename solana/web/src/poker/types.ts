import type { WinnerResult } from './ws'

export interface SitRecoveryState {
  amount: number
  seat: number
  lockTx: string
  sitError: string
  releaseError: string | null
}

export interface WinnerGroup {
  playerId: string
  total: number
  wins: WinnerResult[]
}

export interface RaiseBounds {
  min: number
  max: number
  step: number
  isBet: boolean
}
