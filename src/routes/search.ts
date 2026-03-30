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
