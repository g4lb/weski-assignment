import express, { type NextFunction, type Request, type Response, type Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ErrorMessage, HttpStatus } from './constants/index.js'

function createRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  })
}

function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const status =
    typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
      ? err.status
      : HttpStatus.InternalServerError

  const message =
    status === HttpStatus.InternalServerError
      ? ErrorMessage.InternalServerError
      : String((err as { message?: unknown }).message ?? ErrorMessage.InternalServerError)

  if (status === HttpStatus.InternalServerError) console.error('Unhandled error:', err)
  res.status(status).json({ error: message })
}

export function createApp(router: Router): express.Application {
  const app = express()

  app.use(express.json({ limit: '4kb' }))
  app.use(createRateLimiter())
  app.use(router)
  app.use(errorHandler)

  return app
}
