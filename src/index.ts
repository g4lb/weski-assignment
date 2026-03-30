import { Redis } from 'ioredis'
import { createApp } from './app.js'
import { HotelsSimulatorProvider } from './providers/hotelsSimulator.js'
import { SearchService } from './services/searchService.js'
import { SearchStore } from './store/searchStore.js'

const PORT = Number(process.env['PORT'] ?? 3000)
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const MAX_GROUP_SIZE = Number(process.env['MAX_GROUP_SIZE'] ?? 6)
const HOTELS_SIMULATOR_URL =
  process.env['HOTELS_SIMULATOR_URL'] ??
  'https://gya7b1xubh.execute-api.eu-west-2.amazonaws.com/default/HotelsSimulator'

const redis = new Redis(REDIS_URL)

redis.on('error', (err: unknown) => {
  console.error('Redis connection error:', err)
})

const store = new SearchStore(redis)
const providers = [new HotelsSimulatorProvider(HOTELS_SIMULATOR_URL)]
const searchService = new SearchService(store, providers, MAX_GROUP_SIZE)
const app = createApp(searchService)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
