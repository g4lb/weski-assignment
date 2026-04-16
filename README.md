# Accommodation Search API

Stateless REST API for searching accommodation availability across multiple providers.

## Setup

```bash
npm install
cp .env.example .env
docker run -d -p 6379:6379 redis:alpine
npm run dev
```

## API

### POST /search

Starts a search and returns an ID immediately. Poll `GET /search/:id` for results.

```json
{
  "location": "Chamonix",
  "from_date": "03/04/2025",
  "to_date": "03/11/2025",
  "group_size": 2,
  "price_min": 100,
  "price_max": 500,
  "amenities": ["wifi", "pool"]
}
```

- `location` — Destination name (required)
- `from_date` / `to_date` — `MM/DD/YYYY` format (required)
- `group_size` — Number of guests (required)
- `price_min` / `price_max` — Price range filter (optional, `price_min` must be ≤ `price_max`)
- `amenities` — List of desired amenities (optional)

### GET /search/:id

Returns results. Poll until `status` is `"complete"`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `MAX_GROUP_SIZE` | `6` | Maximum room capacity to search |
| `HOTELS_SIMULATOR_URL` | *(provider URL)* | Hotels simulator provider endpoint |
| `BOOKING_URL` | *(provider URL)* | Booking provider endpoint |
