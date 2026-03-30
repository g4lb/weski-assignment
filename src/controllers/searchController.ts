import type { Request, Response } from 'express'
import { ErrorMessage, HttpStatus } from '../constants/index.js'
import type { SearchService } from '../services/searchService.js'
import { validateSearchBody } from '../validations/searchValidation.js'

export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  async initiateSearch(req: Request, res: Response): Promise<void> {
    const validation = validateSearchBody(req.body)
    if (!validation.success) {
      res.status(HttpStatus.BadRequest).json({ error: validation.error })
      return
    }

    const id = await this.searchService.initiateSearch(validation.data)
    res.json({ id })
  }

  async getSearch(req: Request, res: Response): Promise<void> {
    const id = req.params['id'] as string
    const record = await this.searchService.getSearch(id)

    if (record === null) {
      res.status(HttpStatus.NotFound).json({ error: ErrorMessage.SearchNotFound })
      return
    }

    res.json(record)
  }
}
