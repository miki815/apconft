// Pure helperi za parsiranje i formatiranje iznosa u Vault tabu.
import { BN } from '@coral-xyz/anchor'

export function humanToRaw(
  human: string,
  mintDecimals: number | null,
): BN | null {
  if (mintDecimals === null) return null
  const n = parseFloat(human.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return new BN(Math.round(n * 10 ** mintDecimals))
}

export function formatSolFromLamports(lamports: number): string {
  return (lamports / 1e9).toFixed(4)
}

export function formatSplHumanAmount(
  rawAmount: number,
  decimals: number,
): string {
  return (rawAmount / 10 ** decimals).toFixed(Math.min(decimals, 6))
}
