import { randomUUID } from 'crypto'
import type { AccommodationProvider, SearchParams, SearchRecord } from '../providers/types.js'
import type { ISearchStore } from '../store/ISearchStore.js'

export class SearchService {
  constructor(
    private readonly store: ISearchStore,
    private readonly providers: AccommodationProvider[],
  ) {}

  async initiateSearch(params: SearchParams): Promise<string> {
    const id = randomUUID()
    const existingId = await this.store.acquireSlot(id, params)

    if (existingId !== id) return existingId

    await this.store.create(id)
    void this.runSearch(id, params)

    return id
  }

  async getSearch(id: string): Promise<SearchRecord | null> {
    return this.store.get(id)
  }

  private async runSearch(id: string, params: SearchParams): Promise<void> {
    const calls = this.providers.map((provider) =>
      provider
        .search(params)
        .then((results) => this.store.appendResults(id, results))
        .catch((err: unknown) => {
          console.error('Provider search failed:', err)
        }),
    )

    await Promise.allSettled(calls)
    await this.store.complete(id)
  }
}
