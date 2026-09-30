import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { problemMessage, isForbidden } from './problem'

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  } as never)
}

describe('problemMessage', () => {
  it('surfaces the backend detail verbatim — the UI cannot derive it', () => {
    const err = axiosErrorWith(403, {
      title: 'Forbidden',
      detail: 'A custom role cannot include actions you do not have',
      status: 403,
    })
    expect(problemMessage(err)).toBe('A custom role cannot include actions you do not have')
  })

  it('falls back to the title when detail is absent', () => {
    expect(problemMessage(axiosErrorWith(403, { title: 'Forbidden' }))).toBe('Forbidden')
  })

  it('falls back to the axios message for a non-problem body', () => {
    expect(problemMessage(axiosErrorWith(500, 'boom'))).toBe('Request failed')
  })

  it('handles a plain Error', () => {
    expect(problemMessage(new Error('offline'))).toBe('offline')
  })

  it('uses the supplied fallback for an unknown throw', () => {
    expect(problemMessage('nope', 'fallback')).toBe('fallback')
  })
})

describe('isForbidden', () => {
  it('is true only for 403', () => {
    expect(isForbidden(axiosErrorWith(403, {}))).toBe(true)
    expect(isForbidden(axiosErrorWith(404, {}))).toBe(false)
    expect(isForbidden(new Error('x'))).toBe(false)
  })
})

describe('field errors', () => {
  it('prefers the field message over the generic detail on a validation failure', () => {
    // The backend sets detail to "One or more fields are invalid" and puts the useful message
    // in `errors` — showing detail alone would tell the user nothing actionable.
    const err = axiosErrorWith(400, {
      title: 'Validation Failed',
      detail: 'One or more fields are invalid',
      status: 400,
      errors: {
        changeWindowComplete:
          'changeWindowStartHour and changeWindowEndHour must be provided together',
      },
    })
    expect(problemMessage(err)).toBe(
      'changeWindowStartHour and changeWindowEndHour must be provided together'
    )
  })

  it('joins multiple field messages', () => {
    const err = axiosErrorWith(400, { detail: 'invalid', errors: { a: 'A bad', b: 'B bad' } })
    expect(problemMessage(err)).toBe('A bad. B bad')
  })
})
