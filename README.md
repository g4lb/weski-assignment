# WeSki — Accommodation Search API

Stateless REST API for searching ski accommodation availability.

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
  "ski_site": 4,
  "from_date": "03/04/2025",
  "to_date": "03/11/2025",
  "group_size": 2
}
```

- `ski_site` — Resort ID: 1 Val Thorens, 2 Courchevel, 3 Tignes, 4 La Plagne, 5 Chamonix
- `from_date` / `to_date` — `MM/DD/YYYY` format
- `group_size` — Number of guests

### GET /search/:id

Returns results. Poll until `status` is `"complete"`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `MAX_GROUP_SIZE` | `6` | Maximum room capacity to search |
| `HOTELS_SIMULATOR_URL` | *(provider URL)* | Accommodation provider endpoint |
