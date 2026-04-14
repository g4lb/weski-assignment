import type { Accommodation, AccommodationProvider, OnResults, SearchParams } from './types.js'

const FETCH_TIMEOUT_MS = 5000

interface BookingHotel {
  id: string
  name: string
  photo_url: string
  star_rating: number
  bed_count: number
  lat: number
  lng: number
  price_total: number
  price_net: number
}

interface BookingResponse {
  hotels: BookingHotel[]
}

export class BookingProvider implements AccommodationProvider {
  constructor(private readonly url: string) {}

  async search(params: SearchParams, onResults: OnResults): Promise<void> {
    const hotels = await this.fetchHotels(params)
    if (hotels.length > 0) {
      await onResults(hotels)
    }
  }

  private async fetchHotels(params: SearchParams): Promise<Accommodation[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const query = new URLSearchParams({
        resort: String(params.ski_site),
        checkin: params.from_date,
        checkout: params.to_date,
        guests: String(params.group_size),
      })

      const response = await fetch(`${this.url}?${query.toString()}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`BookingProvider responded with status ${response.status}`)
      }

      const data = (await response.json()) as BookingResponse
      if (!Array.isArray(data.hotels)) {
        throw new Error('BookingProvider returned an unexpected response shape')
      }

      return data.hotels.map((h) => this.normalize(h))
    } finally {
      clearTimeout(timeout)
    }
  }

  private normalize(h: BookingHotel): Accommodation {
    return {
      hotelCode: h.id,
      hotelName: h.name,
      mainImage: h.photo_url,
      images: [],
      rating: h.star_rating,
      beds: h.bed_count,
      position: {
        latitude: h.lat,
        longitude: h.lng,
        distances: [],
      },
      price: {
        amountBeforeTax: h.price_net,
        amountAfterTax: h.price_total,
      },
    }
  }
}
