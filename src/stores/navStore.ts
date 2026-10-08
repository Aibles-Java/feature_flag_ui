import { create } from 'zustand'
import type { Organization } from '@/api/orgs'
import type { Project } from '@/api/projects'

interface NavState {
  currentOrg: Organization | null
  currentProject: Project | null
  setCurrentOrg: (org: Organization | null) => void
  setCurrentProject: (project: Project | null) => void
}

export const useNavStore = create<NavState>((set) => ({
  currentOrg: null,
  currentProject: null,
  setCurrentOrg: (org) => set({ currentOrg: org, currentProject: null }),
  setCurrentProject: (project) => set({ currentProject: project }),
}))
