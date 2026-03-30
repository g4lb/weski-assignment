export enum HttpStatus {
  BadRequest = 400,
  NotFound = 404,
  InternalServerError = 500,
}

export enum ErrorMessage {
  SearchNotFound = 'Search not found',
  InternalServerError = 'Internal server error',
  InvalidRequestBody = 'Invalid request body',
  SkiSiteMustBeNumber = 'ski_site must be a number',
  SkiSiteRequired = 'ski_site is required',
  SkiSiteInvalid = 'ski_site is not a valid resort ID',
  FromDateRequired = 'from_date is required',
  ToDateRequired = 'to_date is required',
  GroupSizeMustBeNumber = 'group_size must be a number',
  GroupSizeRequired = 'group_size is required',
  GroupSizeMustBePositive = 'group_size must be a positive integer',
}
