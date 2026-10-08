import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string
}

/** Render with a fresh QueryClient (no retries/cache) and a MemoryRouter. */
export function renderWithProviders(ui: ReactElement, { route = '/', ...options }: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const user = userEvent.setup()
  const result = render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    ),
    ...options,
  })
  return { user, queryClient, ...result }
}
