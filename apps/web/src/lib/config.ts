/**
 * Base URL of the Lieferzonen API, e.g. `http://localhost:4000/api/v1`.
 *
 * This is the single source of truth for the API base URL in the web app.
 * Other modules must import `apiBaseUrl` from here rather than re-reading
 * `process.env.NEXT_PUBLIC_API_BASE_URL` with their own fallback.
 */
import { resolveApiBaseUrl } from '@shared/api-base-url';

export const apiBaseUrl = resolveApiBaseUrl();
