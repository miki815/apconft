import express from 'express'
import { config } from './config.js'
import apcopayRoutes from './apcopay/routes.js'
import battleRoutes from './battle/routes.js'

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use('/apcopay', apcopayRoutes)
app.use('/apcopay/battles', battleRoutes)

app.listen(config.port, () => {
  console.log(`listening on :${config.port}`)
})
