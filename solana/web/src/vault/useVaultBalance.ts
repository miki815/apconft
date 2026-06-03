import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import type { Idl } from '@coral-xyz/anchor'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchVaultChipBalance } from './vaultBalance'

const PROGRAM_ID_STR =
  import.meta.env.VITE_PROGRAM_ID ||
  '842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL'

export function useVaultBalance(mintStr: string) {
  const { connection } = useConnection()
  const wallet = useAnchorWallet()
  const [idl, setIdl] = useState<Idl | null>(null)
  const [chips, setChips] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const programId = useMemo(() => new PublicKey(PROGRAM_ID_STR), [])

  const mintPk = useMemo(() => {
    if (!mintStr.trim()) return null
    try {
      return new PublicKey(mintStr.trim())
    } catch {
      return null
    }
  }, [mintStr])

  useEffect(() => {
    fetch('/idl/table_vault.json')
      .then((r) => r.json())
      .then(setIdl)
      .catch(() => setIdl(null))
  }, [])

  const refresh = useCallback(async () => {
    if (!wallet?.publicKey || !mintPk || !idl) {
      setChips(null)
      return
    }
    setLoading(true)
    try {
      const n = await fetchVaultChipBalance(
        connection,
        wallet,
        programId,
        mintPk,
        idl,
      )
      setChips(n)
    } catch {
      setChips(0)
    } finally {
      setLoading(false)
    }
  }, [connection, wallet, mintPk, idl, programId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { chips, loading, refresh, mintPk, idl, programId }
}
