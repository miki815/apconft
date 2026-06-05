import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PokerRoom, SHOWDOWN_MS } from './room.js'

process.env.POKER_SKIP_VAULT_CHECK = '1'

function finishHandByFold(room: PokerRoom) {
  const state = room.snapshot().state!
  const first = state.players.find((p) => p.seat === state.actionSeat)!
  const second = state.players.find((p) => p.id !== first.id)!
  if (first.betThisRound < state.currentBet) {
    room.applyAction(first.id, { type: 'call' })
    room.applyAction(second.id, { type: 'fold' })
  } else {
    room.applyAction(first.id, { type: 'fold' })
  }
}

describe('PokerRoom', () => {
  it('sit, start hand, fold wins', async () => {
    const room = new PokerRoom('test')
    assert.equal(await room.sit('a', 0, 500), null)
    assert.equal(await room.sit('b', 1, 500), null)

    const snap = room.snapshot()
    assert.equal(snap.handInProgress, true)
    const state = snap.state!
    const first = state.players.find((p) => p.seat === state.actionSeat)!
    const second = state.players.find((p) => p.id !== first.id)!

    if (first.betThisRound < state.currentBet) {
      assert.equal(room.applyAction(first.id, { type: 'call' }), null)
      assert.equal(room.applyAction(second.id, { type: 'fold' }), null)
    } else {
      assert.equal(room.applyAction(first.id, { type: 'fold' }), null)
    }

    const end = room.snapshot()
    assert.equal(end.handInProgress, false)
    assert.equal(end.state, null)
    const total = end.seats.reduce((n, s) => n + (s?.stack ?? 0), 0)
    assert.equal(total, 1000)
  })

  it('enters showdown phase with revealed cards', async () => {
    const room = new PokerRoom('test')
    await room.sit('a', 0, 200)
    await room.sit('b', 1, 200)

    for (let i = 0; i < 60; i++) {
      const snap = room.snapshot()
      const st = snap.state
      if (!st) break
      if (st.handComplete) {
        assert.equal(snap.showdownActive, true)
        assert.ok(snap.showdownEndsAt)
        const revealed = st.players.filter(
          (p) => p.holeCards && p.holeCards.length === 2,
        )
        assert.equal(revealed.length, 2)
        return
      }
      if (st.actionSeat === null) break
      const p = st.players.find((x) => x.seat === st.actionSeat)
      if (!p) break
      const toCall = st.currentBet - p.betThisRound
      room.applyAction(
        p.id,
        toCall > 0 ? { type: 'call' } : { type: 'check' },
      )
    }
    assert.fail('expected showdown')
  })

  it('stand clears seat without vault tx when skip enabled', async () => {
    const room = new PokerRoom('test')
    await room.sit('a', 0, 500)
    assert.equal(await room.stand('a'), null)
    assert.equal(room.snapshot().seats[0], null)
  })

  it('checkSit rejects taken seat before lock', async () => {
    const room = new PokerRoom('test')
    await room.sit('a', 0, 500)
    assert.equal(room.checkSit('b', 0, 200), 'Seat taken')
    assert.equal(room.checkSit('a', 1, 200), 'Already seated')
  })

  it('removes busted player after hand ends', async () => {
    const room = new PokerRoom('test')
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)

    const snap = room.snapshot()
    const state = snap.state!
    const first = state.players.find((p) => p.seat === state.actionSeat)!
    const second = state.players.find((p) => p.id !== first.id)!
    room.applyAction(first.id, { type: 'all-in' })
    room.applyAction(second.id, { type: 'call' })

    if (room.snapshot().showdownActive) {
      await new Promise((r) => setTimeout(r, SHOWDOWN_MS + 100))
    }

    const end = room.snapshot()
    const bustedSeat = end.seats.findIndex((s) => s?.stack === 0)
    if (bustedSeat !== -1) {
      assert.equal(end.seats[bustedSeat], null)
    } else {
      const zero = end.seats.find((s) => s !== null && s.stack <= 0)
      assert.equal(zero ?? null, null)
    }
  })

  it('first sit does not auto-start', async () => {
    const room = new PokerRoom('test')
    assert.equal(await room.sit('a', 0, 500), null)
    assert.equal(room.snapshot().handInProgress, false)
    assert.equal(room.snapshot().state, null)
  })

  it('second sit auto-starts hand', async () => {
    const room = new PokerRoom('test')
    await room.sit('a', 0, 500)
    assert.equal(await room.sit('b', 1, 500), null)
    const snap = room.snapshot()
    assert.equal(snap.handInProgress, true)
    assert.ok(snap.state)
    assert.notEqual(snap.state!.actionSeat, null)
  })

  it('manual startHand after auto-start rejects duplicate', async () => {
    const room = new PokerRoom('test')
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(room.startHand(), 'Hand already in progress')
  })

  it('third sit after hand ends does not auto-start', async () => {
    const room = new PokerRoom('test')
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(room.snapshot().handInProgress, true)

    finishHandByFold(room)
    assert.equal(room.snapshot().handInProgress, false)

    assert.equal(await room.sit('c', 2, 300), null)
    assert.equal(room.snapshot().handInProgress, false)
  })

  it('failed sit does not auto-start', async () => {
    const room = new PokerRoom('test')
    await room.sit('a', 0, 500)
    assert.equal(room.snapshot().handInProgress, false)

    assert.notEqual(await room.sit('b', 0, 200), null)
    assert.equal(room.snapshot().handInProgress, false)

    assert.notEqual(await room.sit('a', 1, 200), null)
    assert.equal(room.snapshot().handInProgress, false)
    assert.equal(room.snapshot().seats.filter(Boolean).length, 1)
  })
})
