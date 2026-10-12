import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import axios, { type AxiosInstance } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from './renderWithProviders'

function Counter() {
  const [n, setN] = useState(0)
  return (
    <main>
      <h1>Counter</h1>
      <button type="button" onClick={() => setN((v) => v + 1)}>
        Increment
      </button>
      <p role="status">Count: {n}</p>
    </main>
  )
}

function SaveButton({ client }: { client: AxiosInstance }) {
  const save = useMutation({
    mutationFn: (body: { enabled: boolean; version: number }) =>
      client.put('/flags/flag-1/state', body),
  })
  return (
    <button type="button" onClick={() => save.mutate({ enabled: true, version: 3 })}>
      {save.isSuccess ? 'Saved' : 'Save'}
    </button>
  )
}

describe('test harness', () => {
  it('renders and handles a user-event click', async () => {
    const { user } = renderWithProviders(<Counter />)
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    expect(screen.getByRole('status')).toHaveTextContent('Count: 1')
  })

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<Counter />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('asserts the PUT request body via axios-mock-adapter', async () => {
    const client = axios.create({ baseURL: window.__ENV__?.VITE_API_URL })
    const mock = new MockAdapter(client)
    mock.onPut('/flags/flag-1/state').reply(200, {})
    const { user } = renderWithProviders(<SaveButton client={client} />)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ enabled: true, version: 3 })
    expect(mock.history.put[0].baseURL).toBe('http://api.test')
  })
})
