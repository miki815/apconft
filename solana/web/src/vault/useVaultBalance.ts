// Učitava IDL i čita vault chip balance; izlaže programId i mint za poker seating.
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import type { Idl } from '@coral-xyz/anchor'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadTableVaultIdl } from './loadTableVaultIdl'
import {
  getTableVaultProgramId,
  parseMintPublicKey,
} from './vaultConfig'
import { fetchVaultChipBalance } from './vaultBalance'

export function useVaultBalance(mintStr: string) {
  const { connection } = useConnection()
  const wallet = useAnchorWallet()
  const [idl, setIdl] = useState<Idl | null>(null)
  const [chips, setChips] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const programId = useMemo(() => getTableVaultProgramId(), [])

  const mintPk = useMemo(() => parseMintPublicKey(mintStr), [mintStr])

  useEffect(() => {
    let cancelled = false
    void loadTableVaultIdl().then((loaded) => {
      if (cancelled) return
      setIdl(loaded)
    })
    return () => {
      cancelled = true
    }
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
