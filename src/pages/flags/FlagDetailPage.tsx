import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Archive, ArrowLeft } from 'lucide-react'
import { deleteFlag } from '@/api/flags'
import { getEnvironments } from '@/api/environments'
import { ENV_TYPES } from '@/api/abac'
import { getFlagDetail, getFlagStates, type EnvironmentWindow } from '@/api/flagEnvironments'
import ApiError from '@/components/ApiError'
import FlagEnvCard from '@/components/flags/FlagEnvCard'
import FlagStateEditor from '@/components/flags/FlagStateEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const sortEnvs = (envs: EnvironmentWindow[]) =>
  [...envs].sort((a, b) => ENV_TYPES.indexOf(a.type) - ENV_TYPES.indexOf(b.type) || a.name.localeCompare(b.name))

const formatDate = (iso: string) => {
  // Calendar date as the server sent it; avoids the browser zone shifting it by a day.
  const m = /^\d{4}-\d{2}-\d{2}/.exec(iso)
  return m ? m[0] : iso
}

/**
 * S-1.7 Flag detail: header (key, description, type, expiry, archive) + one card per environment.
 * No history tab in this phase (solution-design 10). Editing is S-1.8; PROD guard is S-1.9.
 */
export default function FlagDetailPage() {
  const { orgId, projectId, flagId } = useParams<{ orgId: string; projectId: string; flagId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editEnvId, setEditEnvId] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const listPath = `/orgs/${orgId}/projects/${projectId}/flags`

  const flag = useQuery({ queryKey: ['flag', flagId], queryFn: () => getFlagDetail(flagId!), enabled: !!flagId, retry: false })
  const envs = useQuery({ queryKey: ['environments', projectId], queryFn: () => getEnvironments(projectId!), enabled: !!projectId })
  const states = useQuery({ queryKey: ['flag-states', flagId], queryFn: () => getFlagStates(flagId!), enabled: !!flagId })

  const archive = useMutation({
    mutationFn: () => deleteFlag(flagId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
      qc.invalidateQueries({ queryKey: ['flags-archived', projectId] })
      navigate(listPath)
    },
  })

  if (flag.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading flag...</p>

  if (flag.isError) {
    const notFound = isAxiosError(flag.error) && flag.error.response?.status === 404
    return (
      <div className="space-y-3">
        <BackLink to={listPath} />
        {notFound ? (
          <div role="alert">
            <h1 className="text-2xl font-bold">Flag not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">This flag does not exist or you do not have access to it.</p>
          </div>
        ) : (
          <ApiError error={flag.error} />
        )}
      </div>
    )
  }

  const f = flag.data
  const envList = sortEnvs((envs.data ?? []) as EnvironmentWindow[])
  const stateByEnv = new Map((states.data ?? []).map((s) => [s.environmentId, s]))
  const editing = envList.find((e) => e.id === editEnvId)

  return (
    <div className="space-y-6">
      <BackLink to={listPath} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h1 className="break-words text-2xl font-bold">{f.name}</h1>
          <p><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{f.key}</code></p>
          {f.description && <p className="break-words text-sm text-muted-foreground">{f.description}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{f.valueType}</Badge>
            {f.archived && <Badge variant="outline">Archived</Badge>}
            <span className="text-muted-foreground">{f.expiresAt ? `Expires ${formatDate(f.expiresAt)}` : 'No expiry'}</span>
          </div>
        </div>
        {!f.archived && (
          <Button type="button" variant="outline" onClick={() => setArchiveOpen(true)}>
            <Archive aria-hidden="true" /> Archive
          </Button>
        )}
      </header>

      {(envs.isError || states.isError) && <ApiError error={envs.error ?? states.error} />}

      <section aria-label="Environments" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {envList.map((env) => (
          <FlagEnvCard key={env.id} env={env} state={stateByEnv.get(env.id)} onEdit={() => setEditEnvId(env.id)} />
        ))}
      </section>
      {envs.isSuccess && envList.length === 0 && <p className="text-sm text-muted-foreground">This project has no environments yet.</p>}

      {editing && <FlagStateEditor flag={f} env={editing} open onClose={() => setEditEnvId(null)} />}

      <Dialog open={archiveOpen} onOpenChange={(o) => { if (!o) { setArchiveOpen(false); archive.reset() } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Archive flag</DialogTitle>
            <DialogDescription>Archive <code className="font-mono">{f.key}</code>? It can be restored from the flags list.</DialogDescription>
          </DialogHeader>
          <ApiError error={archive.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setArchiveOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={archive.isPending} onClick={() => archive.mutate()}>
              {archive.isPending ? 'Archiving...' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BackLink({ to }: Readonly<{ to: string }>) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to flags
    </Link>
  )
}
