import { screen, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from '@/api/axios'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useEnvParam } from './useEnvParam'

// Synthetic ids only.
const P = '11111111-1111-4111-8111-111111111111'
const ENV_DEV = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ENV_PROD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ENV_UNKNOWN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function Probe() {
  const { envId, environments } = useEnvParam(P)
  const loc = useLocation()
  return (
    <div>
      <p data-testid="env">{envId ?? 'none'}</p>
      <p data-testid="envs">{environments.length}</p>
      <p data-testid="search">{loc.search}</p>
    </div>
  )
}

let mock: MockAdapter
beforeEach(() => {
  mock = new MockAdapter(api)
  mock
    .onGet('/environments')
    .reply(200, { content: [{ id: ENV_DEV }, { id: ENV_PROD }], page: 0, size: 100, totalElements: 2, totalPages: 1 })
})
afterEach(() => mock.restore())

const mount = (search: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/flags" element={<Probe />} />
    </Routes>,
    { route: `/flags${search}` },
  )

const urls = () => mock.history.get.map((r) => `${r.url}?${JSON.stringify(r.params ?? {})}`)

describe('useEnvParam (S-1.2, T-UI-ENV)', () => {
  it('keeps a valid ?env= that belongs to the project (survives refresh / shared link)', async () => {
    mount(`?env=${ENV_PROD}`)
    await waitFor(() => expect(screen.getByTestId('env')).toHaveTextContent(ENV_PROD))
    expect(screen.getByTestId('search')).toHaveTextContent(`?env=${ENV_PROD}`)
  })

  it('drops a non-UUID value, shows no env, and sends 0 requests containing it', async () => {
    mount('?env=not-a-uuid')
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/))
    expect(screen.getByTestId('env')).toHaveTextContent('none')
    expect(urls().join('|')).not.toContain('not-a-uuid')
  })

  it('drops a well-formed UUID that is not in the project env list', async () => {
    mount(`?env=${ENV_UNKNOWN}`)
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/))
    expect(screen.getByTestId('env')).toHaveTextContent('none')
    expect(urls().join('|')).not.toContain(ENV_UNKNOWN)
  })

  it('never exposes the value before the env list has loaded', async () => {
    mount(`?env=${ENV_DEV}`)
    expect(screen.getByTestId('env')).toHaveTextContent('none')
    await waitFor(() => expect(screen.getByTestId('env')).toHaveTextContent(ENV_DEV))
  })

  it('keeps other params when dropping a bad env', async () => {
    mount('?env=zzz&q=abc')
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?q=abc'))
  })

  it('treats no ?env= as "all environments"', async () => {
    mount('')
    await waitFor(() => expect(screen.getByTestId('envs')).toHaveTextContent('2'))
    expect(screen.getByTestId('env')).toHaveTextContent('none')
  })
})
