import { create } from 'zustand'
import type { Organization } from '@/api/orgs'
import type { Project } from '@/api/projects'
import type { Environment } from '@/api/environments'

interface NavState {
  currentOrg: Organization | null
  currentProject: Project | null
  currentEnv: Environment | null
  setCurrentOrg: (org: Organization | null) => void
  setCurrentProject: (project: Project | null) => void
  setCurrentEnv: (env: Environment | null) => void
}

export const useNavStore = create<NavState>((set) => ({
  currentOrg: null,
  currentProject: null,
  currentEnv: null,
  setCurrentOrg: (org) => set({ currentOrg: org, currentProject: null, currentEnv: null }),
  setCurrentProject: (project) => set({ currentProject: project, currentEnv: null }),
  setCurrentEnv: (env) => set({ currentEnv: env }),
}))
