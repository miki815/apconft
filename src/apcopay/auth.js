import { Buffer } from 'buffer'
import crypto from 'crypto'
import { config } from '../config.js'

export function getBasicAuthHeader() {
  const credentials = `${config.apcopay.clientId}:${config.apcopay.clientSecret}`
  const encodedCredentials = Buffer.from(credentials).toString('base64')
  return `Basic ${encodedCredentials}`
}

export function calculateSignature(payload) {
  const flattenPayload = flattenObject(payload)
  const sortedKeys = Object.keys(flattenPayload).sort()
  const concatenated = sortedKeys.map((key) => `${key}=${flattenPayload[key]}`).join('&').toLowerCase()
  const hmac = crypto.createHmac('sha256', config.apcopay.signatureSecret)
  hmac.update(concatenated)
  return hmac.digest('base64')
}

export function checkSignature(payload, signatureHeader) {
  if (!signatureHeader) return false
  const expected = calculateSignature(payload)
  return expected === signatureHeader
}

function flattenObject(obj, parentKey = '', result = {}) {
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    const fullKey = parentKey ? (Array.isArray(obj) ? `${parentKey}[${key}]` : `${parentKey}.${key}`) : key
    if (value === null || value === undefined) {
      result[fullKey] = ''
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, fullKey, result)
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        flattenObject(item, `${fullKey}[${index}]`, result)
      })
    } else {
      result[fullKey] = value
    }
  }
  return result
}
