import {
  AnchorProvider,
  BN,
  Idl,
  Program,
} from '@coral-xyz/anchor'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getMint,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  ConnectionProvider,
  useAnchorWallet,
  useConnection,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import {
  WalletModalProvider,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import '@solana/wallet-adapter-react-ui/styles.css'

const PROGRAM_ID_STR =
  import.meta.env.VITE_PROGRAM_ID ||
  '842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL'

const DEFAULT_RPC =
  import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com'

const SEAT_POS: readonly [number, number][] = [
  [50, 7],
  [84, 26],
  [84, 74],
  [50, 93],
  [16, 74],
  [16, 26],
]

function vaultPdas(programId: PublicKey, mint: PublicKey) {
  const [vaultConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), mint.toBuffer()],
    programId,
  )
  const vaultToken = getAssociatedTokenAddressSync(mint, vaultConfig, true)
  return { vaultConfig, vaultToken }
}

function userBalancePda(
  programId: PublicKey,
  user: PublicKey,
  mint: PublicKey,
) {
  const [userBalance] = PublicKey.findProgramAddressSync(
    [Buffer.from('balance'), user.toBuffer(), mint.toBuffer()],
    programId,
  )
  return userBalance
}

function endpointNetwork(): WalletAdapterNetwork {
  if (DEFAULT_RPC.includes('mainnet')) return WalletAdapterNetwork.Mainnet
  if (DEFAULT_RPC.includes('devnet')) return WalletAdapterNetwork.Devnet
  return WalletAdapterNetwork.Devnet
}

function RootProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter({
        network: endpointNetwork(),
      }),
    ],
    [],
  )

  return (
    <ConnectionProvider endpoint={DEFAULT_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default function App() {
  return (
    <RootProviders>
      <VaultPlay />
    </RootProviders>
  )
}

function VaultPlay() {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()

  const [seat, setSeat] = useState(1)
  const [mintStr, setMintStr] = useState(import.meta.env.VITE_MINT || '')
  const [amountHuman, setAmountHuman] = useState('1')
  const [mintDecimals, setMintDecimals] = useState<number | null>(null)
  const [walletTokenBal, setWalletTokenBal] = useState<string>('—')
  const [vaultCredit, setVaultCredit] = useState<string>('—')
  const [solBal, setSolBal] = useState<string>('—')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [idl, setIdl] = useState<Idl | null>(null)

  const programId = useMemo(() => new PublicKey(PROGRAM_ID_STR), [])

  useEffect(() => {
    fetch('/idl/table_vault.json')
      .then((r) => r.json())
      .then(setIdl)
      .catch(() =>
        setErr(
          'Ne mogu učitati /idl/table_vault.json — u solana/web pokreni: npm run copy-idl',
        ),
      )
  }, [])

  const mintPk = useMemo(() => {
    if (!mintStr.trim()) return null
    try {
      return new PublicKey(mintStr.trim())
    } catch {
      return null
    }
  }, [mintStr])

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
      setSolBal((sol / LAMPORTS_PER_SOL).toFixed(4))

      const mintInfo = await getMint(connection, mintPk)
      setMintDecimals(mintInfo.decimals)

      const userAta = getAssociatedTokenAddressSync(mintPk, pk)
      try {
        const acc = await getAccount(connection, userAta)
        const v = Number(acc.amount) / 10 ** mintInfo.decimals
        setWalletTokenBal(v.toFixed(Math.min(mintInfo.decimals, 6)))
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
        const raw = typeof amt.toNumber === 'function' ? amt.toNumber() : Number(amt)
        setVaultCredit(
          (raw / 10 ** mintInfo.decimals).toFixed(Math.min(mintInfo.decimals, 6)),
        )
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

  const humanToRaw = (human: string): BN | null => {
    if (mintDecimals === null) return null
    const n = parseFloat(human.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return null
    const raw = Math.round(n * 10 ** mintDecimals)
    return new BN(raw)
  }

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
    const raw = humanToRaw(amountHuman)
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
    const raw = humanToRaw(amountHuman)
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

  const pkShort = anchorWallet?.publicKey?.toBase58().slice(0, 8)

  return (
    <div className="app-wrap">
      <h1>Deposit - Withdraw - Fee testing</h1>

      <div className="panel">
        <label>RPC</label>
        <input type="text" readOnly value={DEFAULT_RPC} />
        <div style={{ marginTop: '0.5rem' }}>
          <WalletMultiButton />
        </div>
        {pkShort ? (
          <p className="stats" style={{ marginTop: '0.75rem' }}>
            Povezan: <strong>{anchorWallet!.publicKey!.toBase58()}</strong>
          </p>
        ) : null}
      </div>

      <div className="panel">
        <div className="table-visual">
          <div className="pot-label">
            Dostupno za igru
            <span>{vaultCredit}</span>
          </div>
          {SEAT_POS.map(([left, top], i) => {
            const n = i + 1
            return (
              <button
                key={n}
                type="button"
                className={`seat ${seat === n ? 'selected you' : ''}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                onClick={() => setSeat(n)}
              >
                {seat === n ? `Ti · ${n}` : `${n}`}
              </button>
            )
          })}
        </div>
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
    </div>
  )
}
