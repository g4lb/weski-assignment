import { Redis } from 'ioredis'
import { createApp } from './app.js'
import { config } from './config.js'
import { HotelsSimulatorProvider } from './providers/hotelsSimulator.js'
import { SearchService } from './services/searchService.js'
import { SearchStore } from './store/searchStore.js'

const redis = new Redis(config.redisUrl)

redis.on('error', (err: unknown) => {
  console.error('Redis connection error:', err)
})

const store = new SearchStore(redis)
const providers = [new HotelsSimulatorProvider(config.hotelsSimulatorUrl)]
const searchService = new SearchService(store, providers, config.maxGroupSize)
const app = createApp(searchService)

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`)
})
