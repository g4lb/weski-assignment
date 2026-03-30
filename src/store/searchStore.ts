import type { Redis } from 'ioredis'
import type { Accommodation, SearchParams, SearchRecord, SearchStatus } from '../providers/types.js'

const SEARCH_TTL_SECONDS = 3600

export class SearchStore {
  constructor(private readonly redis: Redis) {}

  private statusKey(id: string): string {
    return `search:${id}:status`
  }

  private resultsKey(id: string): string {
    return `search:${id}:results`
  }

  private cacheKey(params: SearchParams): string {
    return `search:key:${params.ski_site}:${params.from_date}:${params.to_date}:${params.group_size}`
  }

  async findExistingId(params: SearchParams): Promise<string | null> {
    return this.redis.get(this.cacheKey(params))
  }

  async create(id: string, params: SearchParams): Promise<void> {
    await Promise.all([
      this.redis.set(this.statusKey(id), 'pending', 'EX', SEARCH_TTL_SECONDS),
      this.redis.set(this.cacheKey(params), id, 'EX', SEARCH_TTL_SECONDS),
    ])
  }

  async appendResults(id: string, results: Accommodation[]): Promise<void> {
    if (results.length === 0) return
    const serialized = results.map((r) => JSON.stringify(r))
    await this.redis.rpush(this.resultsKey(id), ...serialized)
    await this.redis.expire(this.resultsKey(id), SEARCH_TTL_SECONDS)
  }

  async complete(id: string): Promise<void> {
    await this.redis.set(this.statusKey(id), 'complete', 'KEEPTTL')
  }

  async get(id: string): Promise<SearchRecord | null> {
    const status = await this.redis.get(this.statusKey(id))
    if (status === null) return null

    const raw = await this.redis.lrange(this.resultsKey(id), 0, -1)
    const results = raw.map((item) => JSON.parse(item) as Accommodation)

    return { id, status: status as SearchStatus, results }
  }
}
