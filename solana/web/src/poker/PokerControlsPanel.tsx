import type { ChangeEvent } from 'react'
import type { PublicKey } from '@solana/web3.js'
import { shortPk } from './ws'

export interface SitRecoveryState {
  amount: number
  seat: number
  lockTx: string
  sitError: string
  releaseError: string | null
}

interface PokerControlsPanelProps {
  skipVault: boolean
  tableMint: string
  mintPk: PublicKey | null
  vaultLoading: boolean
  vaultChips: number | null
  playerId: string | null
  connected: boolean
  onRefreshVault: () => void
  sitRecovery: SitRecoveryState | null
  mySeat: number | null | undefined
  maxAddChips: number
  maxBuyIn: number
  buyIn: string
  onBuyInChange: (e: ChangeEvent<HTMLInputElement>) => void
  buyInDisabled: boolean
  busy: boolean
  sitRecoveryActive: boolean
  inRebuyGrace: boolean
  addChipsValid: boolean
  buyInValid: boolean
  vaultTxReady: boolean
  pickSeat: number
  canStart: boolean | null | undefined
  seatedCount: number
  myStack: number
  txMsg: string | null
  hasIdl: boolean
  onMaxAddChips: () => void
  onMaxBuyIn: () => void
  onAddChips: () => void
  onSit: () => void
  onRecoverLockedChips: () => void
  onStand: () => void
  onStartHand: () => void
}

export function PokerControlsPanel({
  skipVault,
  tableMint,
  mintPk,
  vaultLoading,
  vaultChips,
  playerId,
  connected,
  onRefreshVault,
  sitRecovery,
  mySeat,
  maxAddChips,
  maxBuyIn,
  buyIn,
  onBuyInChange,
  buyInDisabled,
  busy,
  sitRecoveryActive,
  inRebuyGrace,
  addChipsValid,
  buyInValid,
  vaultTxReady,
  pickSeat,
  canStart,
  seatedCount,
  myStack,
  txMsg,
  hasIdl,
  onMaxAddChips,
  onMaxBuyIn,
  onAddChips,
  onSit,
  onRecoverLockedChips,
  onStand,
  onStartHand,
}: PokerControlsPanelProps) {
  return (
    <div className="poker-controls panel">
      <h2 className="panel-title">Sto</h2>
      <p className="panel-hint">
        {skipVault
          ? 'Vault provera isključena (dev). Buy-in bez on-chain lock-a.'
          : 'Sedanje i ustajanje zahtevaju potpis u novčaniku (lock / release vault stanja).'}
      </p>
      {!tableMint || !mintPk ? (
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
            onClick={() => void onRefreshVault()}
          >
            osveži
          </button>
        </p>
      )}
      {sitRecovery ? (
        <div className="err">
          <strong>Recover locked chips:</strong> buy-in od{' '}
          {sitRecovery.amount} čipova za mesto {sitRecovery.seat + 1} nije
          seo za sto posle lock-a. Klikni recovery da pošalješ samo release,
          bez novog lock-a ili sit zahteva.
          <br />
          Lock TX: <code>{shortPk(sitRecovery.lockTx)}</code>
          <br />
          Sit error: {sitRecovery.sitError}
          {sitRecovery.releaseError ? (
            <>
              <br />
              Release error: {sitRecovery.releaseError}
            </>
          ) : null}
        </div>
      ) : null}
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
            onChange={onBuyInChange}
            disabled={buyInDisabled}
          />
        </div>
      </div>
      <div className="btn-row">
        {mySeat !== null ? (
          <>
            <button
              type="button"
              className="secondary"
              disabled={maxAddChips <= 0 || busy || sitRecoveryActive}
              onClick={onMaxAddChips}
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
                sitRecoveryActive ||
                busy
              }
              onClick={() => void onAddChips()}
            >
              {busy
                ? 'Potpis…'
                : inRebuyGrace
                  ? 'Dopuni (rebuy)'
                  : 'Dopuni chipove'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="secondary"
              disabled={maxBuyIn <= 0 || busy || sitRecoveryActive}
              onClick={onMaxBuyIn}
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
                sitRecoveryActive ||
                busy
              }
              onClick={() => void onSit()}
            >
              {busy ? 'Potpis…' : `Sedni · mesto ${pickSeat + 1}`}
            </button>
          </>
        )}
        {sitRecovery ? (
          <button
            type="button"
            className="accent"
            disabled={!playerId || !connected || !hasIdl || !mintPk || busy}
            onClick={() => void onRecoverLockedChips()}
          >
            {busy ? 'Potpis…' : 'Recover locked chips'}
          </button>
        ) : null}
        <button
          type="button"
          className="secondary"
          disabled={
            !playerId ||
            !connected ||
            mySeat === null ||
            busy ||
            sitRecoveryActive
          }
          onClick={() => void onStand()}
        >
          {busy ? 'Potpis…' : 'Ustani'}
        </button>
        <button
          type="button"
          className="accent"
          disabled={
            !playerId || !connected || !canStart || busy || sitRecoveryActive
          }
          onClick={() => onStartHand()}
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
  )
}
