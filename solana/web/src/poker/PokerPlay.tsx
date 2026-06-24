import { Idl } from '@coral-xyz/anchor'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { PublicKey } from '@solana/web3.js'
import { lockForTable, releaseFromTable } from '../vault/tableVault'
import { useVaultBalance } from '../vault/useVaultBalance'
import { PokerControlsPanel } from './PokerControlsPanel'
import { PokerHeroBar } from './PokerHeroBar'
import { PokerStatusBar } from './PokerStatusBar'
import { PokerTableVisual } from './PokerTableVisual'
import { PokerWinnerBanner } from './PokerWinnerBanner'
import { RebuyGraceBar } from './RebuyGraceBar'
import { ShowdownBar } from './ShowdownBar'
import { computeDisplayPots } from './pots'
import { isResultDisplayActive, isShowdownPhase } from './showdown'
import {
  preflightSitMessage,
  usePokerWs,
  isValidClockAnchor,
  isValidResultDurationMs,
  isValidShowdownEndsAt,
} from './ws'
import type { WinnerResult } from './ws'

const TABLE_MINT = import.meta.env.VITE_MINT || ''
const PROGRAM_ID_STR =
  import.meta.env.VITE_PROGRAM_ID ||
  '842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL'
const SKIP_VAULT =
  import.meta.env.VITE_POKER_SKIP_VAULT_CHECK === '1' ||
  import.meta.env.VITE_POKER_SKIP_VAULT_CHECK === 'true'

interface SitRecoveryState {
  amount: number
  seat: number
  lockTx: string
  sitError: string
  releaseError: string | null
}

interface WinnerGroup {
  playerId: string
  total: number
  wins: WinnerResult[]
}

function potLabel(index: number): string {
  return index === 0 ? 'Glavni pot' : `Side pot ${index}`
}

function groupWinners(winners: WinnerResult[]): WinnerGroup[] {
  const byPlayer = new Map<string, WinnerGroup>()
  for (const winner of winners) {
    const group =
      byPlayer.get(winner.playerId) ??
      { playerId: winner.playerId, total: 0, wins: [] }
    group.total += winner.amount
    group.wins.push(winner)
    byPlayer.set(winner.playerId, group)
  }
  return [...byPlayer.values()].map((group) => ({
    ...group,
    wins: [...group.wins].sort((a, b) => a.potIndex - b.potIndex),
  }))
}

export function PokerPlay() {
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
  const playerId = wallet?.publicKey?.toBase58() ?? null
  const {
    connected,
    table,
    error,
    checkSit,
    sitAndWait,
    checkAddChips,
    addChipsAndWait,
    standAndWait,
    startHand,
    act,
  } = usePokerWs(playerId)

  const [pickSeat, setPickSeat] = useState(0)
  const [buyIn, setBuyIn] = useState('200')
  const [busy, setBusy] = useState(false)
  const [txMsg, setTxMsg] = useState<string | null>(null)
  const [pendingStandReleaseTx, setPendingStandReleaseTx] = useState<
    string | null
  >(null)
  const [sitRecovery, setSitRecovery] = useState<SitRecoveryState | null>(null)
  const [idl, setIdl] = useState<Idl | null>(null)
  const {
    chips: vaultChips,
    loading: vaultLoading,
    refresh: refreshVault,
    mintPk,
  } = useVaultBalance(TABLE_MINT)

  const programId = useMemo(() => new PublicKey(PROGRAM_ID_STR), [])

  useEffect(() => {
    fetch('/idl/table_vault.json')
      .then((r) => r.json())
      .then(setIdl)
      .catch(() => setIdl(null))
  }, [])

  const potDisplay = useMemo(() => {
    if (!table) {
      return { total: 0, showBreakdown: false, pots: [] }
    }
    return computeDisplayPots(
      table.state,
      playerId,
      table.handInProgress,
    )
  }, [table, playerId])

  const seatedCount = table?.seats.filter(Boolean).length ?? 0
  const eligibleCount =
    table?.seats.filter((s) => s && s.stack > 0).length ?? 0
  const mySeat = table?.you.seat
  const rebuyDeadlineAt = table?.you.rebuyDeadlineAt ?? null
  const showdownPhase = useMemo(() => isShowdownPhase(table), [table])
  const resultPhase = useMemo(() => isResultDisplayActive(table), [table])
  const resultEndsAt = table?.showdownEndsAt ?? null
  const resultDurationMs = table?.resultDurationMs ?? null
  const hasDeadlineFields =
    isValidShowdownEndsAt(resultEndsAt) &&
    isValidResultDurationMs(resultDurationMs)
  const countdownReady =
    resultPhase &&
    hasDeadlineFields &&
    isValidClockAnchor(table?.clockAnchor)
  const showDeadlineFallback = resultPhase && !hasDeadlineFields
  const winnerGroups = useMemo(
    () => groupWinners(table?.state.winners ?? []),
    [table],
  )
  const winnerIds = useMemo(
    () => new Set(winnerGroups.map((winner) => winner.playerId)),
    [winnerGroups],
  )

  const [raiseTotal, setRaiseTotal] = useState(0)

  const raiseBounds = useMemo(() => {
    if (!table?.you.canAct || mySeat === null) return null
    const me = table.state.players.find((p) => p.seat === mySeat)
    if (!me) return null
    const min = table.state.minRaiseTo
    const max = me.betThisRound + me.stack
    if (max <= table.state.currentBet) return null
    return {
      min: Math.min(min, max),
      max,
      step: Math.max(1, table.bigBlind),
      isBet: table.state.currentBet === 0,
    }
  }, [table, mySeat])

  useEffect(() => {
    if (!raiseBounds) return
    setRaiseTotal((prev) => {
      if (prev >= raiseBounds.min && prev <= raiseBounds.max) return prev
      return raiseBounds.min
    })
  }, [raiseBounds, table?.state.actionSeat])

  const canRaise =
    raiseBounds !== null && raiseBounds.max >= raiseBounds.min

  const canStart =
    eligibleCount >= 2 &&
    table &&
    !table.handInProgress &&
    !resultPhase &&
    table.state.handComplete

  const board = table?.state.board ?? []
  const showBoard =
    table?.handInProgress || board.length > 0 || showdownPhase || resultPhase
  const maxBuyIn = mySeat !== null ? 0 : (vaultChips ?? 0)
  const maxAddChips = mySeat !== null ? (vaultChips ?? 0) : 0
  const chipAmountNum = parseInt(buyIn, 10)
  const buyInValid =
    Number.isInteger(chipAmountNum) &&
    chipAmountNum > 0 &&
    chipAmountNum <= maxBuyIn
  const addChipsValid =
    Number.isInteger(chipAmountNum) &&
    chipAmountNum > 0 &&
    chipAmountNum <= maxAddChips
  const vaultTxReady = SKIP_VAULT || (!!idl && !!mintPk)

  const myStack = useMemo(() => {
    if (mySeat === null || mySeat === undefined || !table) return 0
    const inHand = table.state.players.find((p) => p.seat === mySeat)
    if (inHand) return inHand.stack
    return table.seats[mySeat]?.stack ?? 0
  }, [table, mySeat])

  const isShortStackCall =
    table?.you.canAct === true &&
    table.you.toCall > 0 &&
    myStack > 0 &&
    table.you.toCall > myStack

  const releasableStack =
    table?.you.releasableStack !== undefined
      ? table.you.releasableStack
      : myStack

  const inRebuyGrace = rebuyDeadlineAt !== null && myStack <= 0
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

  const holeCards = useMemo(() => {
    if (table?.you.holeCards?.length === 2) return table.you.holeCards
    if (mySeat === null || mySeat === undefined || !table) return []
    const me = table.state.players.find((p) => p.seat === mySeat)
    return me?.holeCards ?? []
  }, [table, mySeat])

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

  return (
    <div className="poker-page">
      <PokerStatusBar
        connected={connected}
        playerId={playerId}
        handInProgress={table?.handInProgress}
        smallBlind={table?.smallBlind}
        bigBlind={table?.bigBlind}
      />

      <section
        className={`poker-table-section panel panel--flush ${resultPhase ? 'panel--showdown' : ''}${potDisplay.showBreakdown ? ' poker-table-section--pot-breakdown' : ''}`}
      >
        <PokerTableVisual
          table={table}
          mySeat={mySeat}
          pickSeat={pickSeat}
          showdownPhase={showdownPhase}
          resultPhase={resultPhase}
          winnerIds={winnerIds}
          potDisplay={potDisplay}
          showBoard={showBoard}
          board={board}
          onPickSeat={setPickSeat}
        />

        <PokerHeroBar
          holeCards={holeCards}
          table={table}
          myStack={myStack}
          isShortStackCall={isShortStackCall}
          canRaise={canRaise}
          raiseBounds={raiseBounds}
          raiseTotal={raiseTotal}
          onRaiseTotalChange={setRaiseTotal}
          onAct={act}
        />

        {countdownReady ? (
          <ShowdownBar
            key={resultEndsAt}
            endsAt={resultEndsAt}
            durationMs={resultDurationMs}
            clockAnchor={table!.clockAnchor!}
          />
        ) : showDeadlineFallback ? (
          <p className="showdown-bar-fallback">Čeka se server deadline.</p>
        ) : null}
      </section>

      {resultPhase && table && winnerGroups.length > 0 ? (
        <PokerWinnerBanner
          table={table}
          winnerGroups={winnerGroups}
          playerId={playerId}
          potLabel={potLabel}
        />
      ) : null}

      {inRebuyGrace && rebuyDeadlineAt ? (
        <RebuyGraceBar key={rebuyDeadlineAt} deadlineAt={rebuyDeadlineAt} />
      ) : null}

      <PokerControlsPanel
        skipVault={SKIP_VAULT}
        tableMint={TABLE_MINT}
        mintPk={mintPk}
        vaultLoading={vaultLoading}
        vaultChips={vaultChips}
        playerId={playerId}
        connected={connected}
        onRefreshVault={refreshVault}
        sitRecovery={sitRecovery}
        mySeat={mySeat}
        maxAddChips={maxAddChips}
        maxBuyIn={maxBuyIn}
        buyIn={buyIn}
        onBuyInChange={handleBuyInChange}
        buyInDisabled={
          !playerId ||
          !connected ||
          busy ||
          sitRecoveryActive ||
          (mySeat !== null ? maxAddChips <= 0 : maxBuyIn <= 0)
        }
        busy={busy}
        sitRecoveryActive={sitRecoveryActive}
        inRebuyGrace={inRebuyGrace}
        addChipsValid={addChipsValid}
        buyInValid={buyInValid}
        vaultTxReady={vaultTxReady}
        pickSeat={pickSeat}
        canStart={canStart}
        seatedCount={seatedCount}
        myStack={myStack}
        txMsg={txMsg}
        hasIdl={!!idl}
        onMaxAddChips={() => setBuyIn(String(maxAddChips))}
        onMaxBuyIn={() => setBuyIn(String(maxBuyIn))}
        onAddChips={() => void handleAddChips()}
        onSit={() => void handleSit()}
        onRecoverLockedChips={() => void handleRecoverLockedChips()}
        onStand={() => void handleStand()}
        onStartHand={() => startHand()}
      />

      {error ? <div className="err panel">{error}</div> : null}
    </div>
  )
}
