export interface Resort {
  id: number
  name: string
}

const resorts: Resort[] = [
  { id: 1, name: 'Val Thorens' },
  { id: 2, name: 'Courchevel' },
  { id: 3, name: 'Tignes' },
  { id: 4, name: 'La Plagne' },
  { id: 5, name: 'Chamonix' },
]

export const validResortIds = new Set(resorts.map((r) => r.id))
