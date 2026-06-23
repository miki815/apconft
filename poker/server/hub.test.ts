import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { YouState } from '../src/protocol.js'
import type { RoomSnapshot } from './room.js'
import { buildTableMessage } from './hub.js'

const INPUT_SERVER_NOW = 1_700_000_000_000
const INPUT_SERVER_NOW_2 = 1_700_000_001_234

const snap: RoomSnapshot = {
  tableId: 'main',
  smallBlind: 5,
  bigBlind: 10,
  seats: [null, null, null, null, null, null],
  state: null,
  handInProgress: false,
  showdownActive: false,
  showdownEndsAt: null,
  resultKind: null,
  resultDurationMs: null,
}

const you: YouState = {
  seat: null,
  holeCards: null,
  canAct: false,
  toCall: 0,
  rebuyDeadlineAt: null,
  releasableStack: 0,
}

describe('buildTableMessage', () => {
  it('includes exact serverNow passed in', () => {
    const msg = buildTableMessage(snap, you, INPUT_SERVER_NOW)
    assert.equal(msg.type, 'table')
    assert.equal(msg.serverNow, INPUT_SERVER_NOW)
    assert.equal(typeof msg.serverNow, 'number')
  })

  it('uses distinct serverNow values independently', () => {
    const msg = buildTableMessage(snap, you, INPUT_SERVER_NOW)
    const msg2 = buildTableMessage(snap, you, INPUT_SERVER_NOW_2)
    assert.equal(msg.serverNow, INPUT_SERVER_NOW)
    assert.equal(msg2.serverNow, INPUT_SERVER_NOW_2)
  })
})
