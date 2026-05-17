#!/usr/bin/env node
/**
 * Local E2E: seeds pending order on the running server, then POSTs a signed
 * paymentCallback (simulates ApcoPay after successful payment).
 *
 * Requires: ALLOW_TEST_SEED=true on the server process.
 * Same .env as the server for signature (APCOPAY_SIGNATURE_SECRET_KEY, etc.).
 * For NFT mint: RPC_URL, FULFILLER_PRIVATE_KEY, NFT_CONTRACT_ADDRESS.
 *
 * Usage (from repo root, server already running):
 *   ALLOW_TEST_SEED=true npm start
 *   NFT_RECIPIENT=0x... npm run simulate:callback
 */
import 'dotenv/config'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { calculateSignature } from '../src/apcopay/auth.js'

const port = process.env.PORT || '3080'
const baseUrl = (process.env.SIMULATE_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '')

const userId = process.env.SIM_USER_ID || 'test-user-1'
const amount = process.env.SIM_AMOUNT != null ? process.env.SIM_AMOUNT : '1.00'
const currencyId = process.env.SIM_CURRENCY_ID != null ? process.env.SIM_CURRENCY_ID : '978'
const nftRecipient = process.env.NFT_RECIPIENT || process.env.SIM_NFT_RECIPIENT
const tokenUri = process.env.TOKEN_URI || process.env.SIM_TOKEN_URI || ''

if (!nftRecipient) {
  console.error('Set NFT_RECIPIENT (or SIM_NFT_RECIPIENT) to a valid wallet address.')
  process.exit(1)
}

const orderReference = process.env.ORDER_REFERENCE || `ORD-${uuidv4()}`

const seedUrl = `${baseUrl}/apcopay/test/seedPending`
console.info('[simulate] POST', seedUrl, { orderReference })

const seedRes = await axios.post(
  seedUrl,
  {
    orderReference,
    userId,
    amount,
    currencyId,
    nftRecipient,
    tokenUri,
  },
  { validateStatus: () => true },
)

if (seedRes.status >= 400) {
  console.error('[simulate] seed failed', seedRes.status, seedRes.data)
  console.error('Is the server running with ALLOW_TEST_SEED=true ?')
  process.exit(1)
}

const callbackData = {
  Status: 'PROCESSED',
  OrderReference: orderReference,
  Amount: Number(amount).toFixed(2),
  UDF: {
    userId: String(userId),
    currencyId: String(currencyId),
    nftRecipient: String(nftRecipient),
    tokenUri: String(tokenUri),
  },
}

const signature = calculateSignature(callbackData)
const callbackUrl = `${baseUrl}/apcopay/paymentCallback`

console.info('[simulate] POST', callbackUrl)
console.info('[simulate] OrderReference', orderReference)

const res = await axios.post(callbackUrl, callbackData, {
  headers: {
    'Content-Type': 'application/json',
    Signature: signature,
  },
  validateStatus: () => true,
})

console.info('[simulate] HTTP', res.status, res.data)
if (res.status >= 400) process.exit(1)
