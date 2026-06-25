import { PublicKey } from '@solana/web3.js'

export const DEFAULT_TABLE_VAULT_PROGRAM_ID =
  '842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL'

export const TABLE_VAULT_PROGRAM_ID_STR =
  import.meta.env.VITE_PROGRAM_ID || DEFAULT_TABLE_VAULT_PROGRAM_ID

export const TABLE_MINT = import.meta.env.VITE_MINT || ''

export const SKIP_VAULT =
  import.meta.env.VITE_POKER_SKIP_VAULT_CHECK === '1' ||
  import.meta.env.VITE_POKER_SKIP_VAULT_CHECK === 'true'

export function getTableVaultProgramId(): PublicKey {
  return new PublicKey(TABLE_VAULT_PROGRAM_ID_STR)
}

export function parseMintPublicKey(mintStr: string): PublicKey | null {
  if (!mintStr.trim()) return null
  try {
    return new PublicKey(mintStr.trim())
  } catch {
    return null
  }
}
