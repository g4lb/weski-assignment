import type { Accommodation, AccommodationProvider, SearchParams } from './types.js'

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
  }
  PricesInfo: {
    AmountAfterTax: string
    AmountBeforeTax: string
  }
}

interface SimulatorResponse {
  statusCode: number
  body: {
    success: string
    accommodations: SimulatorAccommodation[]
  }
}

export class HotelsSimulatorProvider implements AccommodationProvider {
  constructor(private readonly url: string) {}

  async search(params: SearchParams): Promise<Accommodation[]> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: params }),
    })

    if (!response.ok) {
      throw new Error(`HotelsSimulator responded with status ${response.status}`)
    }

    const data = (await response.json()) as SimulatorResponse
    return data.body.accommodations.map((acc) => this.normalize(acc))
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
