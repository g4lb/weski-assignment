import { z } from 'zod'
import { ErrorMessage } from '../constants/index.js'
import { validResortIds } from '../data/resorts.js'
import type { SearchParams } from '../providers/types.js'

const searchSchema = z.object({
  ski_site: z
    .number({ invalid_type_error: ErrorMessage.SkiSiteMustBeNumber })
    .int()
    .refine((id) => validResortIds.has(id), { message: ErrorMessage.SkiSiteInvalid }),
  from_date: z.string().min(1, ErrorMessage.FromDateRequired),
  to_date: z.string().min(1, ErrorMessage.ToDateRequired),
  group_size: z
    .number({ invalid_type_error: ErrorMessage.GroupSizeMustBeNumber })
    .int()
    .positive(ErrorMessage.GroupSizeMustBePositive),
})

export type SearchValidationResult =
  | { success: true; data: SearchParams }
  | { success: false; error: string }

export function validateSearchBody(body: unknown): SearchValidationResult {
  const result = searchSchema.safeParse(body)
  if (!result.success) {
    const error = result.error.errors[0]?.message ?? ErrorMessage.InvalidRequestBody
    return { success: false, error }
  }
  return { success: true, data: result.data }
}
