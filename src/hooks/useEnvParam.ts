import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getEnvironments, type Environment } from '@/api/environments'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (v: string | null | undefined): v is string => !!v && UUID_RE.test(v)

/**
 * Environment context from the URL (`?env=`) instead of zustand (S-1.2, ADR-01, solution-design
 * §6.1 "Kiểm tra ?env="). The value is accepted only if it is a UUID AND present in the project's
 * loaded environment list; otherwise the param is removed (replace, no history entry) and the
 * caller sees `envId === undefined`. While the list is loading the value is not exposed, so no
 * request can carry an unvalidated value (T-UI-ENV). This is UX; the server enforces env ∈ project (§8.1).
 */
export function useEnvParam(projectId: string | undefined) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('env')
  const { data: environments = [], isSuccess } = useQuery({
    queryKey: ['envs', projectId],
    queryFn: () => getEnvironments(projectId!),
    enabled: !!projectId,
  })

  const valid = isUuid(raw) && environments.some((e) => e.id === raw)
  const malformed = raw !== null && !isUuid(raw)
  const unknown = raw !== null && isSuccess && !valid

  useEffect(() => {
    if (malformed || unknown) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('env')
          return next
        },
        { replace: true },
      )
    }
  }, [malformed, unknown, setParams])

  const envId = valid && raw ? raw : undefined
  const environment: Environment | undefined = environments.find((e) => e.id === envId)
  return { envId, environment, environments }
}
