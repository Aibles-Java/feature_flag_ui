import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { logout as revokeSession } from '@/api/auth'
import { useNavStore } from '@/stores/navStore'
import { useQuery } from '@tanstack/react-query'
import { getOrgs } from '@/api/orgs'
import { getProjects } from '@/api/projects'
import { getEnvironments } from '@/api/environments'
import { cn } from '@/lib/utils'
import { isFlagCentricNavEnabled } from '@/config/runtimeFlags'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import type { EnvType } from '@/api/abac'
import { Flag, FolderKanban, LogOut, ChevronRight, Layers, ChevronDown, Users, KeyRound, ScrollText, UserCog } from 'lucide-react'

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, email, refreshToken, logout } = useAuthStore()
  const params = useParams<{ orgId: string; projectId: string; envId: string }>()
  const { currentOrg: storeOrg, currentProject: storeProject, setCurrentOrg, setCurrentProject } = useNavStore()
  // Kill-switch (S-1.11): off/unset = old env-first sidebar. Read per render (runtime config).
  const flagCentric = isFlagCentricNavEnabled()

  useEffect(() => { if (!token) navigate('/login') }, [token, navigate])

  const { data: orgs = [] } = useQuery({ queryKey: ['orgs'], queryFn: getOrgs, enabled: !!token })
  // Org/project context follows the URL first (survives reload - the store is empty then), then the store.
  const orgId = params.orgId ?? storeOrg?.id
  const currentOrg = orgs.find((o) => o.id === orgId) ?? (storeOrg?.id === orgId ? storeOrg : null)
  const { data: projects = [] } = useQuery({ queryKey: ['projects', orgId], queryFn: () => getProjects(orgId!), enabled: !!orgId && !!token })
  const projectId = params.projectId ?? storeProject?.id
  const currentProject = projects.find((p) => p.id === projectId) ?? (storeProject?.id === projectId ? storeProject : null)
  // Env switcher only exists in the old (kill-switch off) sidebar; the flag-centric UI takes env from ?env= (S-1.2/S-1.3).
  const { data: envs = [] } = useQuery({ queryKey: ['envs', currentProject?.id], queryFn: () => getEnvironments(currentProject!.id), enabled: !flagCentric && !!currentProject })
  const urlEnv = flagCentric ? null : envs.find((e) => e.id === params.envId) ?? null

  const handleLogout = async () => {
    // Best-effort server-side revoke; log out locally regardless of the result.
    if (refreshToken) await revokeSession(refreshToken).catch(() => undefined)
    logout()
    navigate('/login')
  }

  const selectOrg = (id: string | null) => {
    const org = orgs.find((o) => o.id === id) ?? null
    setCurrentOrg(org)
    if (org) navigate(`/orgs/${org.id}`)
  }

  const selectProject = (p: (typeof projects)[0]) => {
    setCurrentProject(p)
    navigate(`/orgs/${currentOrg!.id}/projects/${p.id}`)
  }

  const selectEnv = (e: (typeof envs)[0]) => {
    navigate(`/orgs/${currentOrg!.id}/projects/${currentProject!.id}/envs/${e.id}/flags`)
  }

  // Keyed off the backend's real `type`, not the name. The name is a label; `type` is what the
  // authorization rules actually read, so a dot coloured from the name could say "development"
  // about an environment the backend protects as production.
  const ENV_DOT: Record<EnvType, string> = {
    PRODUCTION: 'bg-rose-500',
    STAGING: 'bg-amber-400',
    DEVELOPMENT: 'bg-emerald-400',
  }
  const envBadge = (type: EnvType) => ENV_DOT[type] ?? 'bg-sky-400'

  const avatarLetter = email?.charAt(0).toUpperCase() ?? '?'
  const onFlagsPage = location.pathname.includes('/flags')

  /** Org-scoped admin destinations, shown once a workspace is picked. */
  const orgLinks = currentOrg
    ? [
        { to: `/orgs/${currentOrg.id}/members`, label: 'Members', icon: Users },
        { to: `/orgs/${currentOrg.id}/roles`, label: 'Custom roles', icon: KeyRound },
        { to: `/orgs/${currentOrg.id}/audit-log`, label: 'Audit log', icon: ScrollText },
      ]
    : []

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── DARK SIDEBAR ── */}
      <aside className="w-64 shrink-0 flex flex-col bg-sidebar">

        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary">
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
              <path d="M14 44 L28 34 L38 40 L50 22" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 22 L50 22 L50 32" className="stroke-success" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-white leading-none text-[15px]">Onward</p>
            <p className="text-[10px] text-white/35 leading-none mt-0.5 font-semibold tracking-widest">FEATURE FLAGS</p>
          </div>
        </div>

        {/* Org switcher */}
        <div className="px-4 pt-4 pb-3 border-b border-white/5">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.1em] mb-2 px-1">Workspace</p>
          <Select value={currentOrg?.id ?? ''} onValueChange={selectOrg}>
            <SelectTrigger className="h-9 border-white/10 bg-white/5 text-white text-sm hover:bg-white/10 transition-colors [&>svg]:hidden">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {currentOrg ? (
                  <>
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-primary">
                      {currentOrg.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-white/90 font-medium">{currentOrg.name}</span>
                  </>
                ) : (
                  <span className="text-white/30">Select workspace…</span>
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0 ml-1" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-brand-soft flex items-center justify-center text-[10px] font-bold text-primary">
                      {o.name.charAt(0).toUpperCase()}
                    </div>
                    {o.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {!currentOrg && (
            <p className="text-xs text-white/25 text-center mt-6 px-2">Select a workspace above to get started.</p>
          )}

          {currentOrg && projects.length > 0 && (
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.1em] px-3 pb-1.5 pt-1">Projects</p>
          )}

          {projects.map((p) => {
            const isActive = currentProject?.id === p.id || location.pathname.includes(`/projects/${p.id}`)
            const showEnvs = !flagCentric && currentProject?.id === p.id && envs.length > 0

            return (
              <div key={p.id}>
                <button type="button"
                  onClick={() => selectProject(p)}
                  className={cn(
                    'w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm transition-all font-medium',
                    isActive
                      ? 'bg-primary/[0.18] text-white border border-primary/[0.35]'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80 border border-transparent'
                  )}
                >
                  <FolderKanban className={cn('w-4 h-4 shrink-0', isActive ? 'text-brand-light' : 'text-white/30')} />
                  <span className="truncate flex-1">{p.name}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-light shrink-0" />}
                </button>

                {isActive && (
                  <div className="ml-4 mt-1 pl-3 border-l border-white/10 pb-1 space-y-0.5">
                    {flagCentric && (
                      <button type="button"
                        onClick={() => navigate(`/orgs/${currentOrg!.id}/projects/${p.id}/flags`)}
                        className={cn(
                          'w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-md text-xs transition-all',
                          location.pathname.startsWith(`/orgs/${currentOrg?.id}/projects/${p.id}/flags`)
                            ? 'bg-white/10 text-white font-semibold'
                            : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                        )}
                      >
                        <Flag className="w-3 h-3 shrink-0" />
                        <span className="truncate flex-1">Flags</span>
                      </button>
                    )}
                    <button type="button"
                      onClick={() => navigate(`/orgs/${currentOrg!.id}/projects/${p.id}/members`)}
                      className={cn(
                        'w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-md text-xs transition-all',
                        location.pathname === `/orgs/${currentOrg?.id}/projects/${p.id}/members`
                          ? 'bg-white/10 text-white font-semibold'
                          : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                      )}
                    >
                      <UserCog className="w-3 h-3 shrink-0" />
                      <span className="truncate flex-1">Project access</span>
                    </button>
                  </div>
                )}

                {showEnvs && (
                  <div className="ml-4 mt-1 pl-3 border-l border-white/10 space-y-0.5 pb-1">
                    {envs.map((e) => {
                      const active = urlEnv?.id === e.id
                      return (
                        <button type="button"
                          key={e.id}
                          onClick={() => selectEnv(e)}
                          className={cn(
                            'w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-md text-xs transition-all',
                            active
                              ? 'bg-white/10 text-white font-semibold'
                              : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-full shrink-0', envBadge(e.type))} />
                          <span className="truncate flex-1">{e.name}</span>
                          {active && <Layers className="w-3 h-3 shrink-0 text-white/40" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {orgLinks.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.1em] px-3 pb-1.5 pt-4">
                Administration
              </p>
              {orgLinks.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to
                return (
                  <button type="button"
                    key={to}
                    onClick={() => navigate(to)}
                    className={cn(
                      'w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm transition-all font-medium border',
                      active
                        ? 'bg-primary/[0.18] text-white border-primary/[0.35]'
                        : 'text-white/50 hover:bg-white/5 hover:text-white/80 border-transparent'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-brand-light' : 'text-white/30')} />
                    <span className="truncate flex-1">{label}</span>
                  </button>
                )
              })}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 bg-primary">
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/80 truncate">{email}</p>
              <p className="text-[10px] text-white/30 font-medium">Administrator</p>
            </div>
            <button type="button"
              onClick={() => void handleLogout()}
              title="Sign out"
              className="p-1.5 rounded-md hover:bg-white/10 text-white/25 hover:text-white/70 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── CONTENT AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top breadcrumb bar */}
        <header className="h-14 bg-white border-b border-border flex items-center px-8 gap-2 shrink-0 shadow-sm">
          <button type="button" onClick={() => navigate('/orgs')} className="text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium">
            {currentOrg?.name ?? 'Organizations'}
          </button>
          {currentProject && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              <button type="button"
                onClick={() => navigate(`/orgs/${currentOrg?.id}/projects/${currentProject.id}`)}
                className="text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium"
              >
                {currentProject.name}
              </button>
            </>
          )}
          {onFlagsPage && flagCentric && currentProject && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary bg-brand-soft border border-brand-border px-2.5 py-0.5 rounded-full">
                <Flag className="w-3 h-3" />
                Flags
              </span>
            </>
          )}
          {urlEnv && onFlagsPage && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              <span className="text-sm font-semibold text-gray-800">{urlEnv.name}</span>
              <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary bg-brand-soft border border-brand-border px-2.5 py-0.5 rounded-full">
                <Flag className="w-3 h-3" />
                Flags
              </span>
            </>
          )}
        </header>

        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
