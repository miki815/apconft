import express from 'express'
import genErrHandler from '../utils/genErrHandler.js'
import * as apcopay from './controller.js'

const router = express.Router()

router.get('/', apcopay.getHealth)
router.post('/paymentInitRequest', genErrHandler(apcopay.paymentInitRequest))
router.post('/paymentCallback', genErrHandler(apcopay.paymentCallbackHandler))
if (process.env.ALLOW_TEST_SEED === 'true') {
  router.post('/test/seedPending', genErrHandler(apcopay.seedPendingForTest))
}

export default router
