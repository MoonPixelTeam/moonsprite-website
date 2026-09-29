import { API_MODE, type ApiClient } from './types'
import { localAdapter } from './local'
import { httpAdapter } from './http'

/** Adapter selection. Backend integration contract: docs/backend-api.md. */
export const api: ApiClient = API_MODE === 'http' ? httpAdapter : localAdapter

/** Which adapter is live, for the pages that have to say so out loud. */
export const apiIsLocal = API_MODE === 'local'

export type * from './types'

