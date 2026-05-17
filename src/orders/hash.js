import crypto from 'crypto'

export function buildPaymentHash(userId, orderReference, amount, currencyId) {
  const hashInput = `${userId}|${orderReference}|${Number(amount).toFixed(2)}|${currencyId}`
  return crypto.createHash('sha256').update(hashInput).digest('hex')
}
