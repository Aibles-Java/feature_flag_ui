import { isAxiosError, type AxiosError } from 'axios'

/**
 * RFC 7807 body returned by the backend's `GlobalExceptionHandler` for every handled error.
 * Only `detail` carries the human-readable reason.
 */
interface ProblemDetail {
  title?: string
  detail?: string
  status?: number
  /**
   * Field-level messages on a 400. The backend sets `detail` to a generic "One or more fields
   * are invalid" and puts the message that actually helps in here, so dropping this map would
   * turn a precise complaint into a useless one.
   */
  errors?: Record<string, string>
}

const fieldErrors = (problem: ProblemDetail | undefined): string =>
  Object.values(problem?.errors ?? {})
    .filter(Boolean)
    .join('. ')

/**
 * The backend's explanation, in the order of usefulness: the field-level messages beat the
 * generic `detail` they accompany, and both beat axios's own transport message.
 *
 * Written as a `||` chain rather than nested ifs so the precedence is readable in one line, and
 * because the chain is what keeps this and its caller inside the cognitive-complexity budget.
 */
function axiosMessage(error: AxiosError): string {
  const problem = error.response?.data as ProblemDetail | undefined
  return fieldErrors(problem) || problem?.detail || problem?.title || error.message || ''
}

/**
 * Pulls the backend's own explanation out of a failed request.
 *
 * This matters most for 403s in the ABAC screens. The backend refuses with a specific reason —
 * "A custom role cannot include actions you do not have", "You cannot grant or revoke permissions
 * beyond your own", or a change-window rejection — and the UI has no way to derive any of those
 * on its own: there is no endpoint exposing the caller's effective action set, so it cannot
 * pre-empt the check. Showing `detail` verbatim is the only accurate thing to say.
 *
 * Note the response interceptor in `axios.ts` deliberately leaves 403 alone (it only recovers a
 * 401), so a permission denial reaches here intact rather than logging the user out.
 */
export function problemMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError(error)) {
    const fromResponse = axiosMessage(error)
    if (fromResponse) return fromResponse
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** True when the request failed the backend's permission check rather than anything else. */
export const isForbidden = (error: unknown): boolean =>
  isAxiosError(error) && error.response?.status === 403
