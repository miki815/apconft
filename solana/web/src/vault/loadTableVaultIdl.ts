import type { Idl } from '@coral-xyz/anchor'

export const TABLE_VAULT_IDL_URL = '/idl/table_vault.json'

export async function loadTableVaultIdl(): Promise<Idl | null> {
  try {
    const r = await fetch(TABLE_VAULT_IDL_URL)
    return (await r.json()) as Idl
  } catch {
    return null
  }
}
