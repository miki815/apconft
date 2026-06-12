import type { WebSocket } from 'ws'
import type { ClientMessage, ServerMessage } from '../src/protocol.js'
import { DEFAULT_TABLE_ID } from '../src/protocol.js'
import { PokerRoom } from './room.js'

interface Connection {
  ws: WebSocket
  playerId: string
  tableId: string
}

export class PokerHub {
  private readonly rooms = new Map<string, PokerRoom>()
  private readonly connections = new Map<WebSocket, Connection>()

  private room(tableId: string): PokerRoom {
    let r = this.rooms.get(tableId)
    if (!r) {
      r = new PokerRoom(tableId)
      r.onTableUpdate = () => this.broadcastTable(tableId)
      this.rooms.set(tableId, r)
    }
    return r
  }

  async handleMessage(ws: WebSocket, raw: string) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw) as ClientMessage
    } catch {
      this.send(ws, { type: 'error', message: 'Invalid JSON' })
      return
    }

    switch (msg.type) {
      case 'join':
        this.join(ws, msg.playerId, msg.tableId ?? DEFAULT_TABLE_ID)
        break
      case 'sit-check': {
        const conn = this.connections.get(ws)
        if (!conn) {
          this.send(ws, { type: 'error', message: 'Send join first' })
          return
        }
        const room = this.room(conn.tableId)
        const checkErr = room.checkSit(conn.playerId, msg.seat, msg.buyIn)
        if (checkErr) {
          this.send(ws, { type: 'error', message: checkErr })
        } else {
          this.send(ws, {
            type: 'sit-check-ok',
            seat: msg.seat,
            buyIn: msg.buyIn,
          })
        }
        break
      }
      case 'add-chips-check': {
        const conn = this.connections.get(ws)
        if (!conn) {
          this.send(ws, { type: 'error', message: 'Send join first' })
          return
        }
        const room = this.room(conn.tableId)
        const checkErr = room.checkAddChips(conn.playerId, msg.amount)
        if (checkErr) {
          this.send(ws, { type: 'error', message: checkErr })
        } else {
          this.send(ws, {
            type: 'add-chips-check-ok',
            amount: msg.amount,
          })
        }
        break
      }
      case 'sit':
      case 'add-chips':
      case 'stand':
      case 'start-hand':
      case 'action': {
        const conn = this.connections.get(ws)
        if (!conn) {
          this.send(ws, { type: 'error', message: 'Send join first' })
          return
        }
        const room = this.room(conn.tableId)
        let err: string | null = null
        if (msg.type === 'sit')
          err = await room.sit(conn.playerId, msg.seat, msg.buyIn, msg.lockTx)
        else if (msg.type === 'add-chips') {
          const addResult = await room.addChips(
            conn.playerId,
            msg.amount,
            msg.lockTx,
          )
          if (typeof addResult === 'string') {
            err = addResult
          } else {
            this.send(ws, {
              type: 'add-chips-ok',
              amount: msg.amount,
              appliesFromNextHand: addResult.appliesFromNextHand,
            })
          }
        } else if (msg.type === 'stand')
          err = await room.stand(conn.playerId, msg.releaseTx)
        else if (msg.type === 'start-hand') err = room.startHand()
        else err = room.applyAction(conn.playerId, msg.action)
        if (err) this.send(ws, { type: 'error', message: err })
        this.broadcastTable(conn.tableId)
        break
      }
      default:
        this.send(ws, { type: 'error', message: 'Unknown message type' })
    }
  }

  handleClose(ws: WebSocket) {
    this.connections.delete(ws)
  }

  private join(ws: WebSocket, playerId: string, tableId: string) {
    if (!playerId || typeof playerId !== 'string' || playerId.length < 8) {
      this.send(ws, { type: 'error', message: 'Invalid playerId' })
      return
    }
    this.connections.set(ws, { ws, playerId, tableId })
    this.send(ws, { type: 'joined', tableId, playerId })
    this.sendTableTo(ws, this.room(tableId), playerId)
  }

  private broadcastTable(tableId: string) {
    const room = this.room(tableId)
    for (const conn of this.connections.values()) {
      if (conn.tableId === tableId) {
        this.sendTableTo(conn.ws, room, conn.playerId)
      }
    }
  }

  private sendTableTo(ws: WebSocket, room: PokerRoom, playerId: string) {
    const snap = room.snapshot()
    const msg: ServerMessage = {
      type: 'table',
      tableId: snap.tableId,
      state: snap.state ?? emptyTableState(),
      you: room.youState(playerId),
      seats: snap.seats,
      smallBlind: snap.smallBlind,
      bigBlind: snap.bigBlind,
      handInProgress: snap.handInProgress,
      showdownActive: snap.showdownActive,
      showdownEndsAt: snap.showdownEndsAt,
    }
    this.send(ws, msg)
  }

  private send(ws: WebSocket, msg: ServerMessage | Record<string, unknown>) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }
}

function emptyTableState() {
  return {
    handNumber: 0,
    buttonSeat: 0,
    smallBlindSeat: 0,
    bigBlindSeat: 0,
    bettingRound: 'preflop' as const,
    board: [],
    pots: [],
    players: [],
    currentBet: 0,
    minRaiseTo: 0,
    actionSeat: null,
    lastAggressorSeat: null,
    handComplete: true,
    winners: [],
  }
}
