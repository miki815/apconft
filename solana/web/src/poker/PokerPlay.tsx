import { Idl } from '@coral-xyz/anchor'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { lockForTable, releaseFromTable } from '../vault/tableVault'
import { useVaultBalance } from '../vault/useVaultBalance'
import { CardRow, PlayingCard } from './PlayingCard'
import { RebuyGraceBar } from './RebuyGraceBar'
import { ShowdownBar } from './ShowdownBar'
import { PotBreakdown } from './PotBreakdown'
import { computeDisplayPots } from './pots'
import { isShowdownPhase, SHOWDOWN_MS } from './showdown'
import { cardLabel, preflightSitMessage, shortPk, usePokerWs } from './ws'

const TABLE_MINT = import.meta.env.VITE_MINT || ''
const PROGRAM_ID_STR =
  import.meta.env.VITE_PROGRAM_ID ||
  '842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL'
const SKIP_VAULT =
  import.meta.env.VITE_POKER_SKIP_VAULT_CHECK === '1' ||
  import.meta.env.VITE_POKER_SKIP_VAULT_CHECK === 'true'

const SEAT_POS: readonly [number, number][] = [
  [50, 6],
  [86, 24],
  [86, 76],
  [50, 94],
  [14, 76],
  [14, 24],
]

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
  const [localShowdownEndsAt, setLocalShowdownEndsAt] = useState<number | null>(
    null,
  )

  useEffect(() => {
    if (showdownPhase && !table?.showdownEndsAt) {
      setLocalShowdownEndsAt(Date.now() + SHOWDOWN_MS)
    } else if (!showdownPhase) {
      setLocalShowdownEndsAt(null)
    }
  }, [showdownPhase, table?.showdownEndsAt])

  const showdownEndsAt = table?.showdownEndsAt ?? localShowdownEndsAt

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
    !showdownPhase &&
    table.state.handComplete

  const board = table?.state.board ?? []
  const showBoard =
    table?.handInProgress || board.length > 0 || showdownPhase
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

  const releasableStack =
    table?.you.releasableStack !== undefined
      ? table.you.releasableStack
      : myStack

  const inRebuyGrace = rebuyDeadlineAt !== null && myStack <= 0

  useEffect(() => {
    if (mySeat === null) {
      setPendingStandReleaseTx(null)
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

    const localErr = preflightSitMessage(table, pickSeat, chipAmountNum)
    if (localErr) {
      setTxMsg(localErr)
      return
    }

    setBusy(true)
    setTxMsg(null)
    let locked = false

    try {
      setTxMsg('Provera mesta…')
      const preErr = await checkSit(pickSeat, chipAmountNum)
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

      setTxMsg('Sedanje za stolom…')
      const sitErr = await sitAndWait(pickSeat, chipAmountNum, lockTx)
      if (sitErr) {
        if (locked && idl && mintPk) {
          setTxMsg(
            `${sitErr} — vraćamo ${chipAmountNum} čipova u vault, potpiši u novčaniku…`,
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
              `Sedanje nije uspelo (${sitErr}). Buy-in od ${chipAmountNum} čipova vraćen u vault.`,
            )
          } catch (refundErr) {
            setTxMsg(
              `Sedanje nije uspelo (${sitErr}). Buy-in od ${chipAmountNum} je zaključan — potpiši release u novčaniku (Vault → isti iznos) ili pokušaj ponovo.`,
            )
            if (refundErr instanceof Error) {
              setTxMsg((m) => `${m} (${refundErr.message})`)
            }
          }
        } else {
          setTxMsg(`Sedanje nije uspelo: ${sitErr}`)
        }
        void refreshVault()
        return
      }

      setTxMsg(null)
      void refreshVault()
    } catch (e) {
      if (locked && idl && mintPk) {
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
            chipAmountNum,
          )
          setTxMsg(
            `Greška pri sedenju. Buy-in od ${chipAmountNum} čipova vraćen u vault.`,
          )
        } catch {
          setTxMsg(
            `Greška: ${e instanceof Error ? e.message : String(e)}. Buy-in od ${chipAmountNum} možda je i dalje zaključan — proveri vault.`,
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
      <div className="poker-status-bar">
        <span
          className={`status-pill ${connected ? 'status-pill--on' : 'status-pill--off'}`}
        >
          {connected ? 'Live' : 'Offline'}
        </span>
        {playerId ? (
          <span className="poker-player-id">{shortPk(playerId)}</span>
        ) : (
          <span className="poker-player-id muted">Poveži novčanik</span>
        )}
        {table?.handInProgress ? (
          <span className="poker-meta">
            Blinds {table.smallBlind}/{table.bigBlind}
          </span>
        ) : null}
      </div>

      <section
        className={`poker-table-section panel panel--flush ${showdownPhase ? 'panel--showdown' : ''}${potDisplay.showBreakdown ? ' poker-table-section--pot-breakdown' : ''}`}
      >
        <div
          className={`poker-table-wrap${potDisplay.showBreakdown ? ' poker-table-wrap--pot-breakdown' : ''}`}
        >
          <div
            className={`table-visual table-visual--poker ${showdownPhase ? 'table-visual--showdown' : ''}`}
          >
            <div className="table-rail" />

            <div className="table-center">
              {showBoard ? (
                <div className="board-zone">
                  <CardRow cards={board} size="md" slots={5} />
                </div>
              ) : null}

              <div className="pot-label pot-label--poker">
                <span className="pot-icon" aria-hidden="true">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2.75c-4.97 0-9 1.9-9 4.25S7.03 11.25 12 11.25s9-1.9 9-4.25-4.03-4.25-9-4.25Z"
                    fill="currentColor"
                    opacity="0.95"
                  />
                  <path
                    d="M3 7v3.25C3 12.6 7.03 14.5 12 14.5s9-1.9 9-4.25V7c0 2.35-4.03 4.25-9 4.25S3 9.35 3 7Z"
                    fill="currentColor"
                    opacity="0.75"
                  />
                  <path
                    d="M3 10.25V13.5c0 2.35 4.03 4.25 9 4.25s9-1.9 9-4.25v-3.25c0 2.35-4.03 4.25-9 4.25s-9-1.9-9-4.25Z"
                    fill="currentColor"
                    opacity="0.55"
                  />
                  <path
                    d="M3 13.5v3.5c0 2.35 4.03 4.25 9 4.25s9-1.9 9-4.25v-3.5c0 2.35-4.03 4.25-9 4.25s-9-1.9-9-4.25Z"
                    fill="currentColor"
                    opacity="0.4"
                  />
                </svg>
                </span>
                <span className="pot-amount">{potDisplay.total}</span>
              </div>
            </div>

            {SEAT_POS.map(([left, top], seat) => {
              const info = table?.seats[seat]
              const inHand = table?.state.players.find((p) => p.seat === seat)
              const isMe = mySeat === seat
              const isAction = table?.state.actionSeat === seat
              const folded = inHand?.status === 'folded'
              const displayStack =
                inHand !== undefined ? inHand.stack : (info?.stack ?? 0)
              const revealCards =
                showdownPhase &&
                !isMe &&
                inHand?.holeCards &&
                inHand.holeCards.length === 2 &&
                inHand.status !== 'folded'

              return (
                <div
                  key={seat}
                  className="seat-wrap"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  {revealCards ? (
                    <div className="seat-reveal-cards">
                      {inHand.holeCards!.map((c, i) => (
                        <PlayingCard
                          key={`${cardLabel(c)}-${i}`}
                          card={c}
                          size="sm"
                        />
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className={[
                      'seat',
                      'seat--poker',
                      pickSeat === seat ? 'selected' : '',
                      isMe ? 'you' : '',
                      isAction ? 'action' : '',
                      folded ? 'folded' : '',
                      info ? 'occupied' : 'empty',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setPickSeat(seat)}
                  >
                    <span className="seat-num">{seat + 1}</span>
                    {info ? (
                      <>
                        <span className="seat-name">
                          {isMe ? 'Ti' : shortPk(info.playerId)}
                        </span>
                        <span className="seat-stack">{displayStack}</span>
                        {inHand?.roundAction &&
                        table?.handInProgress &&
                        !showdownPhase ? (
                          <span className="seat-action">{inHand.roundAction}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="seat-empty-label">Slobodno</span>
                    )}
                  </button>
                </div>
              )
            })}

            {showdownPhase ? (
              <div className="showdown-overlay" aria-live="polite">
                <span className="showdown-overlay-title">Showdown</span>
              </div>
            ) : null}
          </div>
          {potDisplay.showBreakdown ? (
            <PotBreakdown pots={potDisplay.pots} />
          ) : null}
        </div>

        <div className="hero-bar">
          <div className="hero-hand">
            <p className="hero-hand-label">Tvoje karte</p>
            {holeCards.length === 2 ? (
              <div className="hero-hand-cards">
                {holeCards.map((c, i) => (
                  <PlayingCard
                    key={`${cardLabel(c)}-${i}`}
                    card={c}
                    size="lg"
                  />
                ))}
              </div>
            ) : (
              <div className="hero-hand-cards hero-hand-cards--idle">
                <PlayingCard size="lg" faceDown />
                <PlayingCard size="lg" faceDown />
              </div>
            )}
          </div>

          {table?.you.canAct ? (
            <div className="hero-actions">
              {table.you.toCall > 0 ? (
                <span className="hero-actions-hint">
                  Call <strong>{table.you.toCall}</strong>
                </span>
              ) : null}
              {canRaise && raiseBounds ? (
                <div className="hero-raise">
                  <div className="hero-raise-head">
                    <span className="hero-raise-label">
                      {raiseBounds.isBet ? 'Bet' : 'Raise'}
                    </span>
                    <span className="hero-raise-value">{raiseTotal}</span>
                  </div>
                  <input
                    type="range"
                    className="hero-raise-slider"
                    min={raiseBounds.min}
                    max={raiseBounds.max}
                    step={raiseBounds.step}
                    value={raiseTotal}
                    onChange={(e) => setRaiseTotal(parseInt(e.target.value, 10))}
                  />
                  <div className="hero-raise-range">
                    <span>{raiseBounds.min}</span>
                    <span>{raiseBounds.max}</span>
                  </div>
                </div>
              ) : null}
              <div className="hero-actions-btns">
                <button
                  type="button"
                  className="btn-fold"
                  onClick={() => act({ type: 'fold' })}
                >
                  Fold
                </button>
                {table.you.toCall === 0 ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => act({ type: 'check' })}
                  >
                    Check
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => act({ type: 'call' })}
                  >
                    Call
                  </button>
                )}
                {canRaise && raiseBounds ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      act(
                        raiseBounds.isBet
                          ? { type: 'bet', total: raiseTotal }
                          : { type: 'raise', total: raiseTotal },
                      )
                    }
                  >
                    {raiseBounds.isBet ? 'Bet' : 'Raise'} {raiseTotal}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-allin"
                  onClick={() => act({ type: 'all-in' })}
                >
                  All-in
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {showdownPhase && showdownEndsAt ? (
          <ShowdownBar key={showdownEndsAt} />
        ) : null}
      </section>

      {showdownPhase && table && table.state.winners.length > 0 ? (
        <div className="winner-banner">
          <span className="winner-banner-title">Showdown</span>
          {table.state.winners.map((w) => (
            <span key={w.playerId} className="winner-chip">
              {shortPk(w.playerId)} <strong>+{w.amount}</strong>
            </span>
          ))}
        </div>
      ) : null}

      {inRebuyGrace && rebuyDeadlineAt ? (
        <RebuyGraceBar key={rebuyDeadlineAt} deadlineAt={rebuyDeadlineAt} />
      ) : null}

      <div className="poker-controls panel">
        <h2 className="panel-title">Sto</h2>
        <p className="panel-hint">
          {SKIP_VAULT
            ? 'Vault provera isključena (dev). Buy-in bez on-chain lock-a.'
            : 'Sedanje i ustajanje zahtevaju potpis u novčaniku (lock / release vault stanja).'}
        </p>
        {!TABLE_MINT || !mintPk ? (
          <p className="err">
            Postavi <strong>VITE_MINT</strong> u solana/web/.env (pokreni{' '}
            <code>npm run vault -- mint-setup</code>).
          </p>
        ) : (
          <p className="stats">
            Dostupno u vault-u:{' '}
            <strong>
              {vaultLoading ? '…' : vaultChips !== null ? vaultChips : '—'}
            </strong>{' '}
            čipova
            <button
              type="button"
              className="link-btn"
              disabled={!playerId}
              onClick={() => void refreshVault()}
            >
              osveži
            </button>
          </p>
        )}
        <div className="row row--compact">
          <div>
            <label>
              {mySeat !== null
                ? `Dopuna (max ${maxAddChips})`
                : `Buy-in (max ${maxBuyIn})`}
            </label>
            <input
              type="text"
              value={buyIn}
              onChange={(e) => {
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
              }}
              disabled={
                !playerId ||
                !connected ||
                busy ||
                (mySeat !== null ? maxAddChips <= 0 : maxBuyIn <= 0)
              }
            />
          </div>
        </div>
        <div className="btn-row">
          {mySeat !== null ? (
            <>
              <button
                type="button"
                className="secondary"
                disabled={maxAddChips <= 0 || busy}
                onClick={() => setBuyIn(String(maxAddChips))}
              >
                Max ({maxAddChips})
              </button>
              <button
                type="button"
                className={inRebuyGrace ? 'accent' : 'primary'}
                disabled={
                  !playerId ||
                  !connected ||
                  !addChipsValid ||
                  maxAddChips <= 0 ||
                  !mintPk ||
                  !vaultTxReady ||
                  busy
                }
                onClick={() => void handleAddChips()}
              >
                {busy ? 'Potpis…' : inRebuyGrace ? 'Dopuni (rebuy)' : 'Dopuni chipove'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary"
                disabled={maxBuyIn <= 0 || busy}
                onClick={() => setBuyIn(String(maxBuyIn))}
              >
                Max ({maxBuyIn})
              </button>
              <button
                type="button"
                className="primary"
                disabled={
                  !playerId ||
                  !connected ||
                  !buyInValid ||
                  maxBuyIn <= 0 ||
                  !mintPk ||
                  !vaultTxReady ||
                  busy
                }
                onClick={() => void handleSit()}
              >
                {busy ? 'Potpis…' : `Sedni · mesto ${pickSeat + 1}`}
              </button>
            </>
          )}
          <button
            type="button"
            className="secondary"
            disabled={!playerId || !connected || mySeat === null || busy}
            onClick={() => void handleStand()}
          >
            {busy ? 'Potpis…' : 'Ustani'}
          </button>
          <button
            type="button"
            className="accent"
            disabled={!playerId || !connected || !canStart || busy}
            onClick={() => startHand()}
          >
            Nova ruka
          </button>
        </div>
        {txMsg ? <p className="stats">{txMsg}</p> : null}
        <p className="stats">
          Za stolom: <strong>{seatedCount}</strong>/6
          {mySeat !== null ? (
            <>
              {' · '}
              Tvoj stack: <strong>{myStack}</strong>
            </>
          ) : null}
        </p>
      </div>

      {error ? <div className="err panel">{error}</div> : null}
    </div>
  )
}
