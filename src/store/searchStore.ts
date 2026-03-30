import type { Redis } from 'ioredis'
import type { Accommodation, SearchParams, SearchRecord, SearchStatus } from '../providers/types.js'
import type { ISearchStore } from './ISearchStore.js'

const SEARCH_TTL_SECONDS = 3600

function isSearchStatus(value: string): value is SearchStatus {
  return value === 'pending' || value === 'complete'
}

export class SearchStore implements ISearchStore {
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

  async acquireSlot(id: string, params: SearchParams): Promise<string> {
    const key = this.cacheKey(params)
    const result = await this.redis.set(key, id, 'EX', SEARCH_TTL_SECONDS, 'NX')
    if (result === 'OK') return id
    const existingId = await this.redis.get(key)
    return existingId ?? id
  }

  async create(id: string): Promise<void> {
    await this.redis.set(this.statusKey(id), 'pending', 'EX', SEARCH_TTL_SECONDS)
  }

  async appendResults(id: string, results: Accommodation[]): Promise<void> {
    if (results.length === 0) return
    const serialized = results.map((r) => JSON.stringify(r))
    await this.redis
      .pipeline()
      .rpush(this.resultsKey(id), ...serialized)
      .expire(this.resultsKey(id), SEARCH_TTL_SECONDS)
      .exec()
  }

  async complete(id: string): Promise<void> {
    await this.redis.set(this.statusKey(id), 'complete', 'KEEPTTL')
  }

  async get(id: string): Promise<SearchRecord | null> {
    const [[, status], [, raw]] = await this.redis
      .pipeline()
      .get(this.statusKey(id))
      .lrange(this.resultsKey(id), 0, -1)
      .exec() as [[null, string | null], [null, string[]]]

    if (status === null || !isSearchStatus(status)) return null

    const results = (raw ?? []).map((item) => JSON.parse(item) as Accommodation)
    return { id, status, results }
  }
}
