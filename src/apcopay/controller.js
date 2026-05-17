import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { getBasicAuthHeader, calculateSignature, checkSignature } from './auth.js'
import { config } from '../config.js'
import { buildPaymentHash } from '../orders/hash.js'
import { savePending, getPending, deletePending } from '../orders/orderStore.js'
import { fulfillNftAfterPayment } from '../nft/fulfillment.js'

function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim()
  }
  return req.socket.remoteAddress || '127.0.0.1'
}

export async function paymentInitRequest(req, res) {
  const body = req.body || {}
  const {
    userId,
    amount,
    currency,
    currencyId,
    language,
    nftRecipient,
    tokenUri,
    email,
    firstName,
    lastName,
    city,
  } = body

  if (!userId || amount == null || !currency || currencyId == null) {
    return res.status(400).json({ error: 'userId, amount, currency, currencyId required' })
  }
  if (!nftRecipient) {
    return res.status(400).json({ error: 'nftRecipient (wallet address) required' })
  }

  const orderReference = `ORD-${uuidv4()}`
  const uniqueReference = uuidv4()

  const requestToApcopay = {
    TransactionType: 'PURC',
    Amount: Number(amount).toFixed(2),
    Currency: String(currency).toUpperCase(),
    OrderReference: orderReference,
    UniqueReference: uniqueReference,
    RedirectionURL: config.apcopay.redirectUrl,
    CallBackURL: config.apcopay.callbackUrl,
    FailRedirectionURL: config.apcopay.redirectUrl,
    Client: {
      Email: email || 'buyer@example.com',
      FirstName: firstName || 'Buyer',
      LastName: lastName || 'User',
      City: city || 'Belgrade',
      IPAddress: clientIp(req),
    },
    Language: language ?? 'en',
    IsTest: config.apcopay.isTest,
    UDF: {
      userId: String(userId),
      currencyId: String(currencyId),
      nftRecipient: String(nftRecipient),
      tokenUri: tokenUri != null ? String(tokenUri) : '',
    },
  }

  const url = `${config.apcopay.baseUrl}/api/hpptoken/create`
  const response = await axios.post(url, requestToApcopay, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: getBasicAuthHeader(),
      Signature: calculateSignature(requestToApcopay),
    },
  })

  if (!response?.data) {
    return res.status(500).json({ error: 'No response from Apcopay' })
  }

  if (!response.data.isSuccess) {
    return res.status(400).json({ error: response.data.errorMessage || 'Apcopay rejected init' })
  }

  const hash = buildPaymentHash(userId, orderReference, amount, currencyId)
  savePending(orderReference, {
    userId: String(userId),
    amount: String(amount),
    currencyId: String(currencyId),
    hash,
    nftRecipient: String(nftRecipient),
    tokenUri: tokenUri != null ? String(tokenUri) : '',
  })

  return res.json({
    message: 'Payment initialized',
    orderReference,
    apcopay: response.data,
  })
}

export async function seedPendingForTest(req, res) {
  if (process.env.ALLOW_TEST_SEED !== 'true') {
    return res.status(404).json({ error: 'not found' })
  }
  const body = req.body || {}
  const { orderReference, userId, amount, currencyId, nftRecipient, tokenUri } = body
  if (!orderReference || !userId || amount == null || !currencyId || !nftRecipient) {
    return res.status(400).json({
      error: 'orderReference, userId, amount, currencyId, nftRecipient required',
    })
  }
  const hash = buildPaymentHash(userId, orderReference, amount, currencyId)
  savePending(orderReference, {
    userId: String(userId),
    amount: String(amount),
    currencyId: String(currencyId),
    hash,
    nftRecipient: String(nftRecipient),
    tokenUri: tokenUri != null ? String(tokenUri) : '',
  })
  return res.json({ ok: true, orderReference })
}

export async function paymentCallbackHandler(req, res) {
  const callbackData = req.body
  const sig = req.headers['signature'] || req.headers['Signature']

  if (!checkSignature(callbackData, sig)) {
    return res.status(403).json({ error: 'invalid signature' })
  }

  if (callbackData.Status === 'PROCESSED') {
    await handleSuccessfulPayment(callbackData)
  } else {
    await handleFailedPayment(callbackData)
  }

  return res.status(200).json({ ok: true })
}

async function handleSuccessfulPayment(callbackData) {
  const udf = callbackData.UDF || {}
  const userId = udf.userId
  const currencyId = udf.currencyId
  const orderReference = callbackData.OrderReference
  const amount = callbackData.Amount

  const hash = buildPaymentHash(userId, orderReference, amount, currencyId)
  const pending = getPending(orderReference)
  if (!pending || pending.hash !== hash) {
    console.error('[apcopay] pending order mismatch or missing', { orderReference })
    return
  }

  const nftRecipient = pending.nftRecipient || udf.nftRecipient
  const tokenUri = pending.tokenUri ?? udf.tokenUri

  const result = await fulfillNftAfterPayment(nftRecipient, tokenUri)
  if (result.skippedReason) {
    console.warn('[nft]', result.skippedReason)
  } else {
    console.info('[nft] fulfilled', result)
  }

  deletePending(orderReference)
}

async function handleFailedPayment(callbackData) {
  const orderReference = callbackData.OrderReference
  if (orderReference) deletePending(orderReference)
}

export function getHealth(_req, res) {
  res.send('apconft payment + nft 0.1')
}
