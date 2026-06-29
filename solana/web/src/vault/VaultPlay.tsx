// Vault tab — deposit/withdraw i prikaz SOL, wallet token i vault kredita.
import {
  AnchorProvider,
  BN,
  Idl,
  Program,
} from '@coral-xyz/anchor'
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getMint,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadTableVaultIdl } from './loadTableVaultIdl'
import {
  getTableVaultProgramId,
  parseMintPublicKey,
} from './vaultConfig'
import {
  formatSolFromLamports,
  formatSplHumanAmount,
  humanToRaw,
} from './vaultAmount'
import { userBalancePda, vaultPdas } from './vaultPdas'

export function VaultPlay() {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()

  const [mintStr, setMintStr] = useState(import.meta.env.VITE_MINT || '')
  const [amountHuman, setAmountHuman] = useState('1')
  const [mintDecimals, setMintDecimals] = useState<number | null>(null)
  const [walletTokenBal, setWalletTokenBal] = useState('—')
  const [vaultCredit, setVaultCredit] = useState('—')
  const [solBal, setSolBal] = useState('—')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [idl, setIdl] = useState<Idl | null>(null)

  const programId = useMemo(() => getTableVaultProgramId(), [])

  useEffect(() => {
    let cancelled = false
    void loadTableVaultIdl().then((loaded) => {
      if (cancelled) return
      setIdl(loaded)
      if (!loaded) {
        setErr(
          'Ne mogu učitati /idl/table_vault.json — u solana/web pokreni: npm run copy-idl',
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const mintPk = useMemo(() => parseMintPublicKey(mintStr), [mintStr])

  const refreshBalances = useCallback(async () => {
    setErr(null)
    if (!anchorWallet?.publicKey || !mintPk || !idl) {
      setWalletTokenBal('—')
      setVaultCredit('—')
      setSolBal('—')
      setMintDecimals(null)
      return
    }

    const pk = anchorWallet.publicKey

    try {
      const sol = await connection.getBalance(pk)
      setSolBal(formatSolFromLamports(sol))

      const mintInfo = await getMint(connection, mintPk)
      setMintDecimals(mintInfo.decimals)

      const userAta = getAssociatedTokenAddressSync(mintPk, pk)
      try {
        const acc = await getAccount(connection, userAta)
        setWalletTokenBal(
          formatSplHumanAmount(Number(acc.amount), mintInfo.decimals),
        )
      } catch {
        setWalletTokenBal('0 (nema ATA)')
      }

      const provider = new AnchorProvider(
        connection,
        anchorWallet,
        AnchorProvider.defaultOptions(),
      )
      const program = new Program(idl as Idl, provider)
      const ub = userBalancePda(programId, pk, mintPk)
      try {
        const row = await program.account.userBalance.fetch(ub)
        const amt = row.amount as BN
        const raw =
          typeof amt.toNumber === 'function' ? amt.toNumber() : Number(amt)
        setVaultCredit(formatSplHumanAmount(raw, mintInfo.decimals))
      } catch {
        setVaultCredit('0')
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [connection, anchorWallet, mintPk, idl, programId])

  useEffect(() => {
    void refreshBalances()
  }, [refreshBalances])

  const ensureProgram = (): Program | null => {
    if (!idl || !anchorWallet?.publicKey || !anchorWallet.signTransaction)
      return null
    const provider = new AnchorProvider(
      connection,
      anchorWallet,
      AnchorProvider.defaultOptions(),
    )
    return new Program(idl as Idl, provider)
  }

  const createUserAta = async () => {
    if (!anchorWallet?.publicKey || !anchorWallet.signTransaction || !mintPk)
      return
    const pk = anchorWallet.publicKey
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const ata = getAssociatedTokenAddressSync(mintPk, pk)
      const ix = createAssociatedTokenAccountIdempotentInstruction(
        pk,
        ata,
        pk,
        mintPk,
      )
      const tx = new Transaction().add(ix)
      tx.feePayer = pk
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      const signed = await anchorWallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setMsg(`ATA: ${sig}`)
      await refreshBalances()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const doDeposit = async () => {
    const program = ensureProgram()
    const raw = humanToRaw(amountHuman, mintDecimals)
    if (!program || !anchorWallet?.publicKey || !mintPk || !raw) {
      setErr('Poveži novčanik, validan mint i iznos.')
      return
    }
    const pk = anchorWallet.publicKey
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const { vaultConfig, vaultToken } = vaultPdas(programId, mintPk)
      const userAta = getAssociatedTokenAddressSync(mintPk, pk)
      const userBalance = userBalancePda(programId, pk, mintPk)
      const sig = await program.methods
        .deposit(raw)
        .accounts({
          user: pk,
          mint: mintPk,
          vaultConfig,
          vaultToken,
          userToken: userAta,
          userBalance,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      setMsg(`Deposit: ${sig}`)
      await refreshBalances()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const doWithdraw = async () => {
    const program = ensureProgram()
    const raw = humanToRaw(amountHuman, mintDecimals)
    if (
      !program ||
      !anchorWallet?.publicKey ||
      !anchorWallet.signTransaction ||
      !mintPk ||
      !raw
    ) {
      setErr('Poveži novčanik, validan mint i iznos.')
      return
    }
    const pk = anchorWallet.publicKey
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const cfgAcc = await program.account.vaultConfig.fetch(
        vaultPdas(programId, mintPk).vaultConfig,
      )
      const treasuryOwner = cfgAcc.treasury as PublicKey
      const { vaultConfig, vaultToken } = vaultPdas(programId, mintPk)
      const userAta = getAssociatedTokenAddressSync(mintPk, pk)
      const userBalance = userBalancePda(programId, pk, mintPk)
      const treasuryAta = getAssociatedTokenAddressSync(mintPk, treasuryOwner)
      const tx = new Transaction()
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          pk,
          treasuryAta,
          treasuryOwner,
          mintPk,
        ),
      )
      const ix = await program.methods
        .withdraw(raw)
        .accounts({
          user: pk,
          mint: mintPk,
          vaultConfig,
          vaultToken,
          userToken: userAta,
          userBalance,
          treasuryToken: treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
      tx.add(ix)
      tx.feePayer = pk
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      const signed = await anchorWallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setMsg(`Withdraw: ${sig}`)
      await refreshBalances()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="page-lead">
        Uplata i isplata SPL tokena u table vault (devnet).
      </p>

      <div className="panel">
        <p className="stats">
          Dostupno u vault-u: <strong>{vaultCredit}</strong>
        </p>
      </div>

      <div className="panel">
        <label>Mint (SPL token pubkey)</label>
        <input
          type="text"
          placeholder="npr. mint iz npm run vault -- demo"
          value={mintStr}
          onChange={(e) => setMintStr(e.target.value)}
        />
        <div className="row">
          <div>
            <label>SOL</label>
            <input readOnly value={solBal} />
          </div>
          <div>
            <label>Token u novčaniku</label>
            <input readOnly value={walletTokenBal} />
          </div>
        </div>
        <label>Iznos (deposit / withdraw)</label>
        <input
          type="text"
          value={amountHuman}
          onChange={(e) => setAmountHuman(e.target.value)}
        />
        <div className="btn-row">
          <button
            type="button"
            className="secondary"
            disabled={busy || !anchorWallet?.publicKey}
            onClick={() => void refreshBalances()}
          >
            Osveži
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || !anchorWallet?.publicKey || !mintPk}
            onClick={() => void createUserAta()}
          >
            Kreiraj token ATA
          </button>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="primary"
            disabled={
              busy ||
              !anchorWallet?.publicKey ||
              !mintPk ||
              mintDecimals === null
            }
            onClick={() => void doDeposit()}
          >
            Deposit
          </button>
          <button
            type="button"
            className="primary"
            disabled={
              busy ||
              !anchorWallet?.publicKey ||
              !mintPk ||
              mintDecimals === null
            }
            onClick={() => void doWithdraw()}
          >
            Withdraw
          </button>
        </div>
        {err ? <div className="err">{err}</div> : null}
        {msg ? <div className="ok">{msg}</div> : null}
      </div>
    </>
  )
}
