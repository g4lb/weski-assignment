import express, { type NextFunction, type Request, type Response } from 'express'
import { ErrorMessage, HttpStatus } from './constants/index.js'
import { createSearchRouter } from './routes/search.js'
import type { SearchService } from './services/searchService.js'

export function createApp(searchService: SearchService): express.Application {
  const app = express()

  app.use(express.json({ limit: '4kb' }))
  app.use(createSearchRouter(searchService))

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err)
    res.status(HttpStatus.InternalServerError).json({ error: ErrorMessage.InternalServerError })
  })

  return app
}
