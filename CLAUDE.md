# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
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
```

Copy `.env.example` to `.env` before running. All config (port, Redis URL, provider URL, max group size) is set via environment variables.

## Architecture

Stateless REST API — any number of instances can run in parallel, sharing a Redis store.

**Request flow:**
- `POST /search` validates input, deduplicates against Redis by cache key, kicks off a background fan-out to all registered providers for `group_size`, `group_size+1`, `group_size+2` (capped at `MAX_GROUP_SIZE`). Returns a UUID immediately.
- `GET /search/:id` reads from Redis only — never calls a provider. Returns partial results while status is `pending`, full results when `complete`.

**Layer responsibilities:**

| Layer | Path | Job |
|-------|------|-----|
| Routes | `src/routes/` | Map HTTP verbs/paths to controller methods |
| Controllers | `src/controllers/` | Parse requests, validate with Zod, format responses |
| Middleware | `src/middleware/` | `asyncHandler` — wraps async handlers, forwards errors to Express error middleware |
| Services | `src/services/` | Business logic — fan-out, deduplication, background execution |
| Providers | `src/providers/` | External API integrations (one per provider, all implement `AccommodationProvider`) |
| Store | `src/store/` | Redis read/write — search records, result accumulation, deduplication index |
| Data | `src/data/` | Static reference data (ski resorts) |

## TypeScript Configuration

The `tsconfig.json` uses strict settings worth noting:
- `noUncheckedIndexedAccess: true` — array/object index access returns `T | undefined`, requiring null checks
- `exactOptionalPropertyTypes: true` — optional props cannot be explicitly set to `undefined` unless the type includes `undefined`
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `module: "nodenext"` — requires file extensions in relative imports (e.g. `./foo.js` not `./foo`)
- `jsx: "react-jsx"` — JSX support enabled (no explicit React import needed)

`rootDir` and `outDir` are commented out in tsconfig — set these when source layout is established.
