import { randomUUID } from 'crypto'
import type { AccommodationProvider, SearchParams, SearchRecord } from '../providers/types.js'
import type { SearchStore } from '../store/searchStore.js'

export class SearchService {
  constructor(
    private readonly store: SearchStore,
    private readonly providers: AccommodationProvider[],
    private readonly maxGroupSize = 6,
  ) {}

  async initiateSearch(params: SearchParams): Promise<string> {
    const existingId = await this.store.findExistingId(params)
    if (existingId !== null) return existingId

    const id = randomUUID()
    await this.store.create(id, params)

    void this.runSearch(id, params)

    return id
  }

  async getSearch(id: string): Promise<SearchRecord | null> {
    return this.store.get(id)
  }

  private async runSearch(id: string, params: SearchParams): Promise<void> {
    const groupSizes = this.groupSizeVariants(params.group_size)

    const calls = this.providers.flatMap((provider) =>
      groupSizes.map((group_size) =>
        provider
          .search({ ...params, group_size })
          .then((results) => this.store.appendResults(id, results))
          .catch((err: unknown) => {
            console.error(`Provider search failed for group_size=${group_size}:`, err)
          }),
      ),
    )

    await Promise.allSettled(calls)
    await this.store.complete(id)
  }

  private groupSizeVariants(baseSize: number): number[] {
    const sizes: number[] = []
    for (let size = baseSize; size <= Math.min(baseSize + 2, this.maxGroupSize); size++) {
      sizes.push(size)
    }
    return sizes
  }
}
