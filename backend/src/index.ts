import 'dotenv/config'
import { buildApp } from './app.js'
import { env } from './config/env.js'

const start = async () => {
  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    app.log.info(`🚀 WiFi Platform API running on port ${env.PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
