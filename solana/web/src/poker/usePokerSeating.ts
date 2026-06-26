// Seating flow: buy-in ulaz, vault lock/release i WS sit/stand/add-chips koraci.
import { Idl } from '@coral-xyz/anchor'
import type { AnchorWallet } from '@solana/wallet-adapter-react'
import type { Connection, PublicKey } from '@solana/web3.js'
import { useEffect, useState } from 'react'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { lockForTable, releaseFromTable } from '../vault/tableVault'
import { SKIP_VAULT } from '../vault/vaultConfig'
import type { SitRecoveryState } from './types'
import { preflightSitMessage, type AddChipsWaitResult, type PokerTableView } from './ws'

export interface UsePokerSeatingParams {
  wallet: AnchorWallet | undefined
  connection: Connection
  connected: boolean
  table: PokerTableView | null
  mySeat: number | null | undefined
  releasableStack: number
  maxBuyIn: number
  maxAddChips: number
  idl: Idl | null
  mintPk: PublicKey | null
  programId: PublicKey
  refreshVault: () => void | Promise<void>
  checkSit: (seat: number, buyIn: number) => Promise<string | null>
  sitAndWait: (
    seat: number,
    buyIn: number,
    lockTx?: string,
  ) => Promise<string | null>
  checkAddChips: (amount: number) => Promise<string | null>
  addChipsAndWait: (
    amount: number,
    lockTx?: string,
  ) => Promise<AddChipsWaitResult>
  standAndWait: (releaseTx?: string) => Promise<string | null>
}

export interface UsePokerSeatingResult {
  pickSeat: number
  setPickSeat: Dispatch<SetStateAction<number>>
  buyIn: string
  setBuyIn: Dispatch<SetStateAction<string>>
  busy: boolean
  txMsg: string | null
  sitRecovery: SitRecoveryState | null
  sitRecoveryActive: boolean
  handleBuyInChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleAddChips: () => Promise<void>
  handleSit: () => Promise<void>
  handleRecoverLockedChips: () => Promise<void>
  handleStand: () => Promise<void>
}

export function usePokerSeating({
  wallet,
  connection,
  connected,
  table,
  mySeat,
  releasableStack,
  maxBuyIn,
  maxAddChips,
  idl,
  mintPk,
  programId,
  refreshVault,
  checkSit,
  sitAndWait,
  checkAddChips,
  addChipsAndWait,
  standAndWait,
}: UsePokerSeatingParams): UsePokerSeatingResult {
  const [pickSeat, setPickSeat] = useState(0)
  const [buyIn, setBuyIn] = useState('200')
  const [busy, setBusy] = useState(false)
  const [txMsg, setTxMsg] = useState<string | null>(null)
  const [pendingStandReleaseTx, setPendingStandReleaseTx] = useState<
    string | null
  >(null)
  const [sitRecovery, setSitRecovery] = useState<SitRecoveryState | null>(null)

  const sitRecoveryActive = sitRecovery !== null

  useEffect(() => {
    if (mySeat === null) {
      setPendingStandReleaseTx(null)
    } else {
      setSitRecovery(null)
    }
  }, [mySeat])

  useEffect(() => {
    const cap = mySeat !== null ? maxAddChips : maxBuyIn
    if (cap > 0) {
      setBuyIn((prev) => {
        const n = parseInt(prev, 10)
        if (!Number.isFinite(n) || n <= 0) return String(Math.min(200, cap))
        return String(Math.min(n, cap))
      })
    }
  }, [maxBuyIn, maxAddChips, mySeat])

  const handleBuyInChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^\d]/g, '')
    if (v === '') {
      setBuyIn('')
      return
    }
    const n = parseInt(v, 10)
    const cap = mySeat !== null ? maxAddChips : maxBuyIn
    if (n > cap) {
      setBuyIn(String(cap))
    } else {
      setBuyIn(v)
    }
  }

  const handleAddChips = async () => {
    const chipAmountNum = parseInt(buyIn, 10)
    const addChipsValid =
      Number.isInteger(chipAmountNum) &&
      chipAmountNum > 0 &&
      chipAmountNum <= maxAddChips

    if (!addChipsValid || !wallet || !connected || mySeat === null) return

    setBusy(true)
    setTxMsg(null)
    let locked = false

    try {
      setTxMsg('Provera dopune…')
      const preErr = await checkAddChips(chipAmountNum)
      if (preErr) {
        setTxMsg(preErr)
        return
      }

      let lockTx: string | undefined
      if (!SKIP_VAULT && idl && mintPk) {
        setTxMsg('Potpiši lock u novčaniku…')
        lockTx = await lockForTable(
          connection,
          wallet,
          programId,
          mintPk,
          idl,
          chipAmountNum,
        )
        locked = true
      }

      setTxMsg('Dopuna chipova…')
      const addResult = await addChipsAndWait(chipAmountNum, lockTx)
      if ('error' in addResult) {
        const addErr = addResult.error
        if (locked && idl && mintPk) {
          setTxMsg(
            `${addErr} — vraćamo ${chipAmountNum} čipova u vault, potpiši u novčaniku…`,
          )
          try {
            await releaseFromTable(
              connection,
              wallet,
              programId,
              mintPk,
              idl,
              chipAmountNum,
            )
            setTxMsg(
              `Dopuna nije uspela (${addErr}). ${chipAmountNum} čipova vraćeno u vault.`,
            )
          } catch {
            setTxMsg(
              `Dopuna nije uspela (${addErr}). ${chipAmountNum} je zaključano — potpiši release u novčaniku ili pokušaj ponovo.`,
            )
          }
        } else {
          setTxMsg(`Dopuna nije uspela: ${addErr}`)
        }
        void refreshVault()
        return
      }

      if (addResult.appliesFromNextHand) {
        setTxMsg(
          `Dopuna od ${chipAmountNum} čipova primljena. Važi od sledeće ruke.`,
        )
      } else {
        setTxMsg(`Dopuna od ${chipAmountNum} čipova uspešna.`)
      }
      void refreshVault()
    } catch (e) {
      if (locked && idl && mintPk) {
        setTxMsg(
          'Lock je prošao, ali dopuna nije završena — pokušavamo vraćanje u vault…',
        )
        try {
          await releaseFromTable(
            connection,
            wallet,
            programId,
            mintPk,
            idl,
            chipAmountNum,
          )
          setTxMsg(
            `Greška pri dopuni. ${chipAmountNum} čipova vraćeno u vault.`,
          )
        } catch {
          setTxMsg(
            `Greška: ${e instanceof Error ? e.message : String(e)}. ${chipAmountNum} možda je i dalje zaključano — proveri vault.`,
          )
        }
        void refreshVault()
      } else {
        setTxMsg(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSit = async () => {
    const chipAmountNum = parseInt(buyIn, 10)
    const buyInValid =
      Number.isInteger(chipAmountNum) &&
      chipAmountNum > 0 &&
      chipAmountNum <= maxBuyIn

    if (!buyInValid || !wallet || !connected) return
    if (sitRecovery) {
      setTxMsg(
        `Prvo vrati zaključani buy-in od ${sitRecovery.amount} čipova preko Recover locked chips.`,
      )
      return
    }

    const seatToSit = pickSeat
    const buyInToLock = chipAmountNum

    const localErr = preflightSitMessage(table, seatToSit, buyInToLock)
    if (localErr) {
      setTxMsg(localErr)
      return
    }

    setBusy(true)
    setTxMsg(null)
    let locked = false
    let lockTx: string | undefined

    try {
      setTxMsg('Provera mesta…')
      const preErr = await checkSit(seatToSit, buyInToLock)
      if (preErr) {
        setTxMsg(preErr)
        return
      }

      if (!SKIP_VAULT && idl && mintPk) {
        setTxMsg('Potpiši lock u novčaniku…')
        lockTx = await lockForTable(
          connection,
          wallet,
          programId,
          mintPk,
          idl,
          buyInToLock,
        )
        locked = true
      }

      setTxMsg('Sedanje za stolom…')
      const sitErr = await sitAndWait(seatToSit, buyInToLock, lockTx)
      if (sitErr) {
        if (locked && idl && mintPk) {
          setTxMsg(
            `${sitErr} — vraćamo ${buyInToLock} čipova u vault, potpiši u novčaniku…`,
          )
          try {
            await releaseFromTable(
              connection,
              wallet,
              programId,
              mintPk,
              idl,
              buyInToLock,
            )
            setSitRecovery(null)
            setTxMsg(
              `Sedanje nije uspelo (${sitErr}). Buy-in od ${buyInToLock} čipova vraćen u vault.`,
            )
          } catch (refundErr) {
            const releaseError =
              refundErr instanceof Error ? refundErr.message : String(refundErr)
            setSitRecovery({
              amount: buyInToLock,
              seat: seatToSit,
              lockTx: lockTx ?? '',
              sitError: sitErr,
              releaseError,
            })
            setTxMsg(
              `Sedanje nije uspelo (${sitErr}). Buy-in od ${buyInToLock} je zaključan — klikni Recover locked chips da pokušaš release bez novog lock-a.`,
            )
            setTxMsg((m) => `${m} (${releaseError})`)
          }
        } else {
          setTxMsg(`Sedanje nije uspelo: ${sitErr}`)
        }
        void refreshVault()
        return
      }

      setTxMsg(null)
      setSitRecovery(null)
      void refreshVault()
    } catch (e) {
      if (locked && idl && mintPk) {
        const sitError = e instanceof Error ? e.message : String(e)
        setTxMsg(
          'Lock je prošao, ali sedanje nije završeno — pokušavamo vraćanje u vault…',
        )
        try {
          await releaseFromTable(
            connection,
            wallet,
            programId,
            mintPk,
            idl,
            buyInToLock,
          )
          setSitRecovery(null)
          setTxMsg(
            `Greška pri sedenju. Buy-in od ${buyInToLock} čipova vraćen u vault.`,
          )
        } catch (refundErr) {
          const releaseError =
            refundErr instanceof Error ? refundErr.message : String(refundErr)
          setSitRecovery({
            amount: buyInToLock,
            seat: seatToSit,
            lockTx: lockTx ?? '',
            sitError,
            releaseError,
          })
          setTxMsg(
            `Greška: ${sitError}. Buy-in od ${buyInToLock} možda je i dalje zaključan — klikni Recover locked chips da pokušaš release bez novog lock-a. (${releaseError})`,
          )
        }
        void refreshVault()
      } else {
        setTxMsg(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
    }
  }

  // Vraća zaključane chipove u vault kad lock prođe a sit ili dopuna ne uspe.
  const handleRecoverLockedChips = async () => {
    if (!sitRecovery) return
    if (!wallet || !connected || !idl || !mintPk) {
      setTxMsg(
        'Poveži novčanik i sačekaj da se vault program učita pre recover release pokušaja.',
      )
      return
    }

    setBusy(true)
    setTxMsg(
      `Recover locked chips: potpiši release za ${sitRecovery.amount} čipova…`,
    )
    try {
      await releaseFromTable(
        connection,
        wallet,
        programId,
        mintPk,
        idl,
        sitRecovery.amount,
      )
      setSitRecovery(null)
      await refreshVault()
      setTxMsg(
        `Locked buy-in od ${sitRecovery.amount} čipova vraćen je u vault.`,
      )
    } catch (e) {
      const releaseError = e instanceof Error ? e.message : String(e)
      setSitRecovery((current) =>
        current ? { ...current, releaseError } : current,
      )
      setTxMsg(
        `Recover release nije uspeo. Zaključani buy-in od ${sitRecovery.amount} ostaje u recovery stanju. (${releaseError})`,
      )
    } finally {
      setBusy(false)
    }
  }

  const handleStand = async () => {
    if (!wallet || !connected || mySeat === null) return
    setBusy(true)
    setTxMsg(null)
    try {
      let releaseTx = pendingStandReleaseTx ?? undefined
      if (!releaseTx && !SKIP_VAULT && idl && mintPk && releasableStack > 0) {
        setTxMsg('Potpiši release u novčaniku…')
        releaseTx = await releaseFromTable(
          connection,
          wallet,
          programId,
          mintPk,
          idl,
          releasableStack,
        )
      }
      if (releaseTx) {
        setPendingStandReleaseTx(releaseTx)
      }
      setTxMsg('Čekamo potvrdu servera da je mesto oslobođeno…')
      const standErr = await standAndWait(releaseTx)
      if (standErr) {
        void refreshVault()
        setTxMsg(
          releaseTx
            ? `${standErr}. Release je već potpisan; klikni Stand ponovo da pošalješ isti release TX bez novog potpisa.`
            : standErr,
        )
        return
      }
      setPendingStandReleaseTx(null)
      setTxMsg('Mesto oslobođeno.')
      void refreshVault()
    } catch (e) {
      setTxMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return {
    pickSeat,
    setPickSeat,
    buyIn,
    setBuyIn,
    busy,
    txMsg,
    sitRecovery,
    sitRecoveryActive,
    handleBuyInChange,
    handleAddChips,
    handleSit,
    handleRecoverLockedChips,
    handleStand,
  }
}
