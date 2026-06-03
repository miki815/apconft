import './loadEnv.js'
import { PublicKey } from '@solana/web3.js'

export const POKER_WS_PORT = Number(process.env.POKER_WS_PORT ?? 3081)

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.ANCHOR_PROVIDER_URL ||
  'https://api.devnet.solana.com'

export const TABLE_VAULT_PROGRAM_ID = new PublicKey(
  process.env.SOLANA_TABLE_PROGRAM_ID ||
    process.env.VITE_PROGRAM_ID ||
    '842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL',
)

export const POKER_TABLE_MINT = process.env.POKER_TABLE_MINT?.trim() || ''

export const SKIP_VAULT_CHECK =
  process.env.POKER_SKIP_VAULT_CHECK === '1' ||
  process.env.POKER_SKIP_VAULT_CHECK === 'true'

/** Read at call time so tests can set env before sit(). */
export function isSkipVaultCheck(): boolean {
  return (
    process.env.POKER_SKIP_VAULT_CHECK === '1' ||
    process.env.POKER_SKIP_VAULT_CHECK === 'true'
  )
}
