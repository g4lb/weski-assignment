import { Redis } from 'ioredis'
import { createApp } from './app.js'
import { config } from './config.js'
import { BookingProvider } from './providers/bookingProvider.js'
import { HotelsSimulatorProvider } from './providers/hotelsSimulator.js'
import { createSearchRouter } from './routes/search.js'
import { SearchService } from './services/searchService.js'
import { SearchStore } from './store/searchStore.js'

const redis = new Redis(config.redisUrl)

redis.on('error', (err: unknown) => {
  console.error('Redis connection error:', err)
})

const store = new SearchStore(redis)
const providers = [
  new HotelsSimulatorProvider(),
  new BookingProvider(config.bookingUrl),
]
const searchService = new SearchService(store, providers)
const router = createSearchRouter(searchService)
const app = createApp(router)

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`)
})
