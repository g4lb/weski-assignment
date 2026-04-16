import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Accommodation, SearchParams } from '../src/providers/types.js'

const params: SearchParams = {
  location: 'Chamonix',
  from_date: '03/04/2025',
  to_date: '03/11/2025',
  group_size: 2,
}

const simulatorAccommodation = {
  HotelCode: 'H1',
  HotelName: 'Alpine Lodge',
  HotelDescriptiveContent: {
    Images: [
      { URL: 'main.jpg', MainImage: 'True' },
      { URL: 'other.jpg' },
    ],
  },
  HotelInfo: {
    Position: {
      Latitude: '45.9',
      Longitude: '6.8',
      Distances: [{ type: 'ski_lift', distance: '200m' }],
    },
    Rating: '4',
    Beds: '3',
    Amenities: ['wifi', 'spa'],
  },
  PricesInfo: {
    AmountBeforeTax: '200',
    AmountAfterTax: '240',
  },
}

let mockConfig = {
  accommodationProviderUrl: 'http://test',
  maxGroupSize: 6,
}

vi.mock('../src/config.js', () => ({
  get config() {
    return mockConfig
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  mockConfig = { accommodationProviderUrl: 'http://test', maxGroupSize: 6 }
})

describe('HotelsSimulatorProvider', () => {
  it('normalizes simulator response to Accommodation', async () => {
    mockConfig.maxGroupSize = 2
    const mockResponse = {
      ok: true,
      json: async () => ({ statusCode: 200, body: { accommodations: [simulatorAccommodation] } }),
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

    const { HotelsSimulatorProvider } = await import('../src/providers/hotelsSimulator.js')
    const provider = new HotelsSimulatorProvider()
    const results: Accommodation[] = []
    await provider.search(params, async (r) => { results.push(...r) })

    expect(results.length).toBeGreaterThan(0)
    const acc = results[0]!
    expect(acc.hotelCode).toBe('H1')
    expect(acc.hotelName).toBe('Alpine Lodge')
    expect(acc.mainImage).toBe('main.jpg')
    expect(acc.images).toEqual(['other.jpg'])
    expect(acc.rating).toBe(4)
    expect(acc.beds).toBe(3)
    expect(acc.amenities).toEqual(['wifi', 'spa'])
    expect(acc.position.latitude).toBe(45.9)
    expect(acc.price.amountAfterTax).toBe(240)
  })

  it('defaults amenities to empty array when not present', async () => {
    mockConfig.maxGroupSize = 2
    const noAmenities = { ...simulatorAccommodation, HotelInfo: { ...simulatorAccommodation.HotelInfo, Amenities: undefined } }
    const mockResponse = {
      ok: true,
      json: async () => ({ statusCode: 200, body: { accommodations: [noAmenities] } }),
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

    const { HotelsSimulatorProvider } = await import('../src/providers/hotelsSimulator.js')
    const provider = new HotelsSimulatorProvider()
    const results: Accommodation[] = []
    await provider.search(params, async (r) => { results.push(...r) })

    expect(results[0]!.amenities).toEqual([])
  })

  it('fans out to group_size variants up to maxGroupSize', async () => {
    mockConfig.maxGroupSize = 4
    const mockResponse = {
      ok: true,
      json: async () => ({ statusCode: 200, body: { accommodations: [] } }),
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

    const { HotelsSimulatorProvider } = await import('../src/providers/hotelsSimulator.js')
    const provider = new HotelsSimulatorProvider()
    await provider.search(params, async () => {})

    // group_size=2, maxGroupSize=4 → variants: 2, 3, 4
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('throws on maxGroupSize < 1', async () => {
    mockConfig.maxGroupSize = 0
    const { HotelsSimulatorProvider } = await import('../src/providers/hotelsSimulator.js')
    expect(() => new HotelsSimulatorProvider()).toThrow('maxGroupSize must be at least 1')
  })
})
