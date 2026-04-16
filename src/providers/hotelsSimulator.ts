import { config } from '../config.js'
import type { Accommodation, AccommodationProvider, OnResults, SearchParams } from './types.js'

const FETCH_TIMEOUT_MS = 5000

interface SimulatorImage {
  URL: string
  MainImage?: string
}

interface SimulatorAccommodation {
  HotelCode: string
  HotelName: string
  HotelDescriptiveContent: {
    Images: SimulatorImage[]
  }
  HotelInfo: {
    Position: {
      Latitude: string
      Longitude: string
      Distances: Array<{ type: string; distance: string }>
    }
    Rating: string
    Beds: string
    Amenities?: string[]
  }
  PricesInfo: {
    AmountAfterTax: string
    AmountBeforeTax: string
  }
}

interface SimulatorResponse {
  statusCode: number
  body: {
    accommodations: SimulatorAccommodation[]
  }
}

export class HotelsSimulatorProvider implements AccommodationProvider {
  private readonly url = config.accommodationProviderUrl
  private readonly maxGroupSize = config.maxGroupSize

  constructor() {
    if (this.maxGroupSize < 1) {
      throw new Error(`maxGroupSize must be at least 1, got ${this.maxGroupSize}`)
    }
  }

  async search(params: SearchParams, onResults: OnResults): Promise<void> {
    const groupSizes = this.groupSizeVariants(params.group_size)

    await Promise.allSettled(
      groupSizes.map((group_size) =>
        this.fetchAccommodations({ ...params, group_size }).then((results) => onResults(results)),
      ),
    )
  }

  private groupSizeVariants(baseSize: number): number[] {
    const sizes: number[] = []
    for (let size = baseSize; size <= Math.min(baseSize + 2, this.maxGroupSize); size++) {
      sizes.push(size)
    }
    return sizes
  }

  private async fetchAccommodations(params: SearchParams): Promise<Accommodation[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: params }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HotelsSimulator responded with status ${response.status}`)
      }

      const data = (await response.json()) as SimulatorResponse
      const accommodations = data.body?.accommodations

      if (!Array.isArray(accommodations)) {
        throw new Error('HotelsSimulator returned an unexpected response shape')
      }

      return accommodations.map((acc) => this.normalize(acc))
    } finally {
      clearTimeout(timeout)
    }
  }

  private normalize(acc: SimulatorAccommodation): Accommodation {
    const images = acc.HotelDescriptiveContent.Images
    const mainImage = images.find((img) => img.MainImage === 'True')?.URL ?? images[0]?.URL ?? ''
    const otherImages = images.filter((img) => img.MainImage !== 'True').map((img) => img.URL)
    const position = acc.HotelInfo.Position

    return {
      hotelCode: acc.HotelCode,
      hotelName: acc.HotelName,
      mainImage,
      images: otherImages,
      rating: Number(acc.HotelInfo.Rating),
      beds: Number(acc.HotelInfo.Beds),
      amenities: acc.HotelInfo.Amenities ?? [],
      position: {
        latitude: Number(position.Latitude),
        longitude: Number(position.Longitude),
        distances: position.Distances,
      },
      price: {
        amountBeforeTax: Number(acc.PricesInfo.AmountBeforeTax),
        amountAfterTax: Number(acc.PricesInfo.AmountAfterTax),
      },
    }
  }
}
