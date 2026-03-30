import { randomUUID } from 'crypto'
import type { AccommodationProvider, SearchParams, SearchRecord } from '../providers/types.js'
import type { ISearchStore } from '../store/ISearchStore.js'

export class SearchService {
  private readonly maxGroupSize: number

  constructor(
    private readonly store: ISearchStore,
    private readonly providers: AccommodationProvider[],
    maxGroupSize = 6,
  ) {
    if (maxGroupSize < 1) {
      throw new Error(`MAX_GROUP_SIZE must be at least 1, got ${maxGroupSize}`)
    }
    this.maxGroupSize = maxGroupSize
  }

  async initiateSearch(params: SearchParams): Promise<string> {
    const id = randomUUID()
    const winnerId = await this.store.acquireSlot(id, params)

    if (winnerId !== id) return winnerId

    await this.store.create(id)
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
