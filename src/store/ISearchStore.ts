import type { Accommodation, SearchParams, SearchRecord } from '../providers/types.js'

export interface ISearchStore {
  acquireSlot(id: string, params: SearchParams): Promise<string>
  create(id: string): Promise<void>
  appendResults(id: string, results: Accommodation[]): Promise<void>
  complete(id: string): Promise<void>
  get(id: string): Promise<SearchRecord | null>
}
