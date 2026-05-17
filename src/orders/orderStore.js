/**
 * In-memory pending orders (replace with DB if needed).
 * Keyed by ApcoPay OrderReference.
 */

/** @type {Map<string, import('./types.js').PendingOrder>} */
const byReference = new Map()

/**
 * @param {string} orderReference
 * @param {import('./types.js').PendingOrder} order
 */
export function savePending(orderReference, order) {
  byReference.set(orderReference, order)
}

/**
 * @param {string} orderReference
 * @returns {import('./types.js').PendingOrder | undefined}
 */
export function getPending(orderReference) {
  return byReference.get(orderReference)
}

/**
 * @param {string} orderReference
 */
export function deletePending(orderReference) {
  byReference.delete(orderReference)
}
