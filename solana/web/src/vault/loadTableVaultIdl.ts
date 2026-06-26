// Učitava Anchor IDL sa /public/idl za vault transakcije.
import type { Idl } from '@coral-xyz/anchor'

export const TABLE_VAULT_IDL_URL = '/idl/table_vault.json'

// Učitava table_vault.json; greška vraća null umesto crash-a aplikacije.
export async function loadTableVaultIdl(): Promise<Idl | null> {
  try {
    const r = await fetch(TABLE_VAULT_IDL_URL)
    return (await r.json()) as Idl
  } catch {
    return null
  }
}
