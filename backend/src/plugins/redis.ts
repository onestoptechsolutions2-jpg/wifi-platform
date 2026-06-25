import fp from 'fastify-plugin'
import Redis from 'ioredis'
import { env } from '../config/env.js'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

const redisPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const redis = new Redis(env.REDIS_URL)

  redis.on('error', (err) => fastify.log.error({ err }, 'Redis error'))
  redis.on('connect', () => fastify.log.info('Redis connected'))

  fastify.decorate('redis', redis)
  fastify.addHook('onClose', async () => redis.quit())
})

export default redisPlugin
