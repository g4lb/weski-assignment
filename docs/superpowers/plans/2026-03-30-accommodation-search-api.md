# Accommodation Search API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stateless Node.js/TypeScript REST API for ski accommodation availability search with async background fan-out to external providers and Redis-backed result storage.

**Architecture:** POST /search validates input, deduplicates against Redis, and kicks off a background fan-out to one or more providers for group_size variants. Results accumulate in Redis as each call resolves. GET /search/:id reads from Redis only — the provider is never called at read time.

**Tech Stack:** Node.js 20+, TypeScript (nodenext/ESM), Express 4, ioredis, Zod.

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/providers/types.ts` | All shared interfaces: `AccommodationProvider`, `SearchParams`, `Accommodation`, `SearchRecord`, `SearchStatus` |
| `src/data/resorts.ts` | Static list of valid ski resorts with pre-built ID set for O(1) validation |
| `src/store/searchStore.ts` | Redis-backed store: create/read/append/complete search records |
| `src/providers/hotelsSimulator.ts` | `HotelsSimulatorProvider`: calls external mock API, normalizes response |
| `src/services/searchService.ts` | Fan-out orchestration, deduplication, background execution |
| `src/routes/search.ts` | Express route handlers for POST /search and GET /search/:id |
| `src/app.ts` | Express app factory: middleware, routes, error handler |
| `src/index.ts` | Entry point: wire Redis, store, providers, service, app, start server |
| `.env.example` | Environment variable template |

---

### Task 1: Project setup

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install express ioredis zod
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D tsx @types/express @types/node
```

- [ ] **Step 3: Update package.json**

Replace the contents of `package.json` with:

```json
{
  "name": "weski-assignment",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "ioredis": "^5.4.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/express": "^5.0.1",
    "@types/node": "^22.13.14",
    "tsx": "^4.19.3",
    "typescript": "^6.0.2"
  }
}
```

- [ ] **Step 4: Update tsconfig.json**

Replace the contents of `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "esnext",
    "lib": ["esnext"],
    "types": ["node"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create .env.example**

```
PORT=3000
REDIS_URL=redis://localhost:6379
MAX_GROUP_SIZE=6
HOTELS_SIMULATOR_URL=https://gya7b1xubh.execute-api.eu-west-2.amazonaws.com/default/HotelsSimulator
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.env
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .env.example .gitignore
git commit -m "chore: project setup — deps, tsconfig, env template"
```

---

### Task 2: Core types

**Files:**
- Create: `src/providers/types.ts`

- [ ] **Step 1: Create `src/providers/types.ts`**

```typescript
export interface SearchParams {
  ski_site: number
  from_date: string
  to_date: string
  group_size: number
}

export interface AccommodationDistance {
  type: string
  distance: string
}

export interface AccommodationPosition {
  latitude: number
  longitude: number
  distances: AccommodationDistance[]
}

export interface AccommodationPrice {
  amountBeforeTax: number
  amountAfterTax: number
}

export interface Accommodation {
  hotelCode: string
  hotelName: string
  mainImage: string
  images: string[]
  rating: number
  beds: number
  position: AccommodationPosition
  price: AccommodationPrice
}

export interface AccommodationProvider {
  search(params: SearchParams): Promise<Accommodation[]>
}

export type SearchStatus = 'pending' | 'complete'

export interface SearchRecord {
  id: string
  status: SearchStatus
  results: Accommodation[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/types.ts
git commit -m "feat: add shared types and AccommodationProvider interface"
```

---

### Task 3: Resorts data

**Files:**
- Create: `src/data/resorts.ts`

- [ ] **Step 1: Create `src/data/resorts.ts`**

```typescript
export interface Resort {
  id: number
  name: string
}

export const resorts: Resort[] = [
  { id: 1, name: 'Val Thorens' },
  { id: 2, name: 'Courchevel' },
  { id: 3, name: 'Tignes' },
  { id: 4, name: 'La Plagne' },
  { id: 5, name: 'Chamonix' },
]

export const validResortIds = new Set(resorts.map((r) => r.id))
```

- [ ] **Step 2: Commit**

```bash
git add src/data/resorts.ts
git commit -m "feat: add static resorts data"
```

---

### Task 4: Redis store

**Files:**
- Create: `src/store/searchStore.ts`

The store uses three Redis key patterns:
- `search:{id}:status` — string: `"pending"` or `"complete"`
- `search:{id}:results` — Redis List: each element is a JSON-serialized `Accommodation`
- `search:key:{cacheKey}` — string: search ID for deduplication

Using a Redis List for results makes `RPUSH` atomic, avoiding race conditions when multiple fan-out calls resolve concurrently across instances.

- [ ] **Step 1: Create `src/store/searchStore.ts`**

```typescript
import type { Redis } from 'ioredis'
import type { Accommodation, SearchParams, SearchRecord, SearchStatus } from '../providers/types.js'

const SEARCH_TTL_SECONDS = 3600

export class SearchStore {
  constructor(private readonly redis: Redis) {}

  private statusKey(id: string): string {
    return `search:${id}:status`
  }

  private resultsKey(id: string): string {
    return `search:${id}:results`
  }

  private cacheKey(params: SearchParams): string {
    return `search:key:${params.ski_site}:${params.from_date}:${params.to_date}:${params.group_size}`
  }

  async findExistingId(params: SearchParams): Promise<string | null> {
    return this.redis.get(this.cacheKey(params))
  }

  async create(id: string, params: SearchParams): Promise<void> {
    await Promise.all([
      this.redis.set(this.statusKey(id), 'pending', 'EX', SEARCH_TTL_SECONDS),
      this.redis.set(this.cacheKey(params), id, 'EX', SEARCH_TTL_SECONDS),
    ])
  }

  async appendResults(id: string, results: Accommodation[]): Promise<void> {
    if (results.length === 0) return
    const serialized = results.map((r) => JSON.stringify(r))
    await this.redis.rpush(this.resultsKey(id), ...serialized)
    await this.redis.expire(this.resultsKey(id), SEARCH_TTL_SECONDS)
  }

  async complete(id: string): Promise<void> {
    await this.redis.set(this.statusKey(id), 'complete', 'KEEPTTL')
  }

  async get(id: string): Promise<SearchRecord | null> {
    const status = await this.redis.get(this.statusKey(id))
    if (status === null) return null

    const raw = await this.redis.lrange(this.resultsKey(id), 0, -1)
    const results = raw.map((item) => JSON.parse(item) as Accommodation)

    return { id, status: status as SearchStatus, results }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/store/searchStore.ts
git commit -m "feat: add Redis-backed search store"
```

---

### Task 5: HotelsSimulator provider

**Files:**
- Create: `src/providers/hotelsSimulator.ts`

- [ ] **Step 1: Create `src/providers/hotelsSimulator.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/hotelsSimulator.ts
git commit -m "feat: add HotelsSimulator provider"
```

---

### Task 6: Search service

**Files:**
- Create: `src/services/searchService.ts`

- [ ] **Step 1: Create `src/services/searchService.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/searchService.ts
git commit -m "feat: add search service with parallel fan-out and deduplication"
```

---

### Task 7: Route handlers

**Files:**
- Create: `src/routes/search.ts`

- [ ] **Step 1: Create `src/routes/search.ts`**

```typescript
import { Router } from 'express'
import { z } from 'zod'
import { validResortIds } from '../data/resorts.js'
import type { SearchService } from '../services/searchService.js'

const searchBodySchema = z.object({
  ski_site: z
    .number({ invalid_type_error: 'ski_site must be a number' })
    .int()
    .refine((id) => validResortIds.has(id), { message: 'ski_site is not a valid resort ID' }),
  from_date: z.string().min(1, 'from_date is required'),
  to_date: z.string().min(1, 'to_date is required'),
  group_size: z
    .number({ invalid_type_error: 'group_size must be a number' })
    .int()
    .positive('group_size must be a positive integer'),
})

export function createSearchRouter(searchService: SearchService): Router {
  const router = Router()

  router.post('/search', async (req, res, next) => {
    try {
      const parsed = searchBodySchema.safeParse(req.body)
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? 'Invalid request body'
        res.status(400).json({ error: message })
        return
      }

      const id = await searchService.initiateSearch(parsed.data)
      res.json({ id })
    } catch (err) {
      next(err)
    }
  })

  router.get('/search/:id', async (req, res, next) => {
    try {
      const id = req.params['id'] as string
      const record = await searchService.getSearch(id)

      if (record === null) {
        res.status(404).json({ error: 'Search not found' })
        return
      }

      res.json(record)
    } catch (err) {
      next(err)
    }
  })

  return router
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/search.ts
git commit -m "feat: add search route handlers with Zod validation"
```

---

### Task 8: App wiring

**Files:**
- Create: `src/app.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/app.ts`**

```typescript
import express, { type NextFunction, type Request, type Response } from 'express'
import { createSearchRouter } from './routes/search.js'
import type { SearchService } from './services/searchService.js'

export function createApp(searchService: SearchService): express.Application {
  const app = express()

  app.use(express.json())
  app.use(createSearchRouter(searchService))

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
```

- [ ] **Step 2: Create `src/index.ts`**

```typescript
import Redis from 'ioredis'
import { createApp } from './app.js'
import { HotelsSimulatorProvider } from './providers/hotelsSimulator.js'
import { SearchService } from './services/searchService.js'
import { SearchStore } from './store/searchStore.js'

const PORT = Number(process.env['PORT'] ?? 3000)
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const MAX_GROUP_SIZE = Number(process.env['MAX_GROUP_SIZE'] ?? 6)
const HOTELS_SIMULATOR_URL =
  process.env['HOTELS_SIMULATOR_URL'] ??
  'https://gya7b1xubh.execute-api.eu-west-2.amazonaws.com/default/HotelsSimulator'

const redis = new Redis(REDIS_URL)
const store = new SearchStore(redis)
const providers = [new HotelsSimulatorProvider(HOTELS_SIMULATOR_URL)]
const searchService = new SearchService(store, providers, MAX_GROUP_SIZE)
const app = createApp(searchService)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build
```

Expected: no errors, `dist/` directory created.

- [ ] **Step 4: Start Redis and run the dev server**

```bash
docker run -d -p 6379:6379 redis:alpine
npm run dev
```

Expected: `Server running on port 3000`

- [ ] **Step 5: Verify POST /search**

```bash
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"ski_site":4,"from_date":"03/04/2025","to_date":"03/11/2025","group_size":2}' | jq
```

Expected: `{ "id": "<uuid>" }`

- [ ] **Step 6: Verify GET /search/:id returns results**

Use the `id` returned from step 5:

```bash
curl -s http://localhost:3000/search/<id> | jq
```

Expected: `status` is `"pending"` or `"complete"`, `results` is an array of accommodation objects.

- [ ] **Step 7: Verify deduplication — same params return same id**

```bash
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"ski_site":4,"from_date":"03/04/2025","to_date":"03/11/2025","group_size":2}' | jq
```

Expected: same `id` as step 5.

- [ ] **Step 8: Verify 400 on invalid resort**

```bash
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"ski_site":99,"from_date":"03/04/2025","to_date":"03/11/2025","group_size":2}' | jq
```

Expected: `{ "error": "ski_site is not a valid resort ID" }`

- [ ] **Step 9: Verify 404 on unknown id**

```bash
curl -s http://localhost:3000/search/nonexistent | jq
```

Expected: `{ "error": "Search not found" }`

- [ ] **Step 10: Commit**

```bash
git add src/app.ts src/index.ts
git commit -m "feat: wire app — Express setup, Redis, service composition"
```

---

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the Commands section in CLAUDE.md with**

```markdown
## Commands

\`\`\`bash
# Install dependencies
npm install

# Start Redis (required before running the server)
docker run -d -p 6379:6379 redis:alpine

# Development — hot reload via tsx
npm run dev

# Type-check without emitting
npx tsc --noEmit

# Compile to dist/
npm run build

# Run compiled output
npm start
\`\`\`

Copy `.env.example` to `.env` before running. All config (port, Redis URL, provider URL, max group size) is set via environment variables.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with build and run commands"
```
