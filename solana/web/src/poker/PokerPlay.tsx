import { Idl } from '@coral-xyz/anchor'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useVaultBalance } from '../vault/useVaultBalance'
import { PokerControlsPanel } from './PokerControlsPanel'
import { PokerHeroBar } from './PokerHeroBar'
import { PokerStatusBar } from './PokerStatusBar'
import { PokerTableVisual } from './PokerTableVisual'
import { PokerWinnerBanner } from './PokerWinnerBanner'
import { RebuyGraceBar } from './RebuyGraceBar'
import { ShowdownBar } from './ShowdownBar'
import { computeRaiseBounds } from './betting'
import { computeDisplayPots } from './pots'
import {
  computeResultCountdownState,
  isResultDisplayActive,
  isShowdownPhase,
} from './showdown'
import { usePokerSeating } from './usePokerSeating'
import { groupWinners } from './winners'
import { usePokerWs } from './ws'

const TABLE_MINT = import.meta.env.VITE_MINT || ''
const PROGRAM_ID_STR =
  import.meta.env.VITE_PROGRAM_ID ||
  '842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL'
const SKIP_VAULT =
  import.meta.env.VITE_POKER_SKIP_VAULT_CHECK === '1' ||
  import.meta.env.VITE_POKER_SKIP_VAULT_CHECK === 'true'

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
  const {
    resultEndsAt,
    resultDurationMs,
    countdownReady,
    showDeadlineFallback,
  } = computeResultCountdownState(table, resultPhase)
  const winnerGroups = useMemo(
    () => groupWinners(table?.state.winners ?? []),
    [table],
  )
  const winnerIds = useMemo(
    () => new Set(winnerGroups.map((winner) => winner.playerId)),
    [winnerGroups],
  )

  const [raiseTotal, setRaiseTotal] = useState(0)

  const raiseBounds = useMemo(
    () => computeRaiseBounds(table, mySeat),
    [table, mySeat],
  )

  useEffect(() => {
    if (!raiseBounds) return
    setRaiseTotal((prev) => {
      if (prev >= raiseBounds.min && prev <= raiseBounds.max) return prev
      return raiseBounds.min
    })
  }, [raiseBounds, table?.state.actionSeat])

  const canRaise =
    raiseBounds !== null && raiseBounds.max >= raiseBounds.min

  const canStart = Boolean(
    eligibleCount >= 2 &&
      table &&
      !table.handInProgress &&
      !resultPhase &&
      table.state.handComplete,
  )

  const board = table?.state.board ?? []
  const showBoard =
    table?.handInProgress || board.length > 0 || showdownPhase || resultPhase
  const maxBuyIn = mySeat !== null ? 0 : (vaultChips ?? 0)
  const maxAddChips = mySeat !== null ? (vaultChips ?? 0) : 0

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

  const {
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
  } = usePokerSeating({
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
  })

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

  const holeCards = useMemo(() => {
    if (table?.you.holeCards?.length === 2) return table.you.holeCards
    if (mySeat === null || mySeat === undefined || !table) return []
    const me = table.state.players.find((p) => p.seat === mySeat)
    return me?.holeCards ?? []
  }, [table, mySeat])

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
