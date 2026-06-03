import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { POKER_TABLE_MINT, POKER_WS_PORT, SKIP_VAULT_CHECK } from './config.js'
import { PokerHub } from './hub.js'

const hub = new PokerHub()

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true, service: 'apconft-poker-ws' }))
})

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    void hub.handleMessage(ws, data.toString()).catch((e) => {
      console.error(e)
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'Server error' }))
      }
    })
  })
  ws.on('close', () => hub.handleClose(ws))
})

httpServer.listen(POKER_WS_PORT, () => {
  console.log(`poker ws listening on :${POKER_WS_PORT}`)
  if (SKIP_VAULT_CHECK) {
    console.log('POKER_SKIP_VAULT_CHECK=1 — buy-in not verified on-chain')
  } else if (POKER_TABLE_MINT) {
    console.log(`Table mint: ${POKER_TABLE_MINT}`)
  } else {
    console.warn(
      'POKER_TABLE_MINT not set — set it to the SPL mint used in Vault (buy-in unchecked)',
    )
  }
})
