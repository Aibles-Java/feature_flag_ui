import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import AppLayout from '@/components/layout/AppLayout'
import OrgsPage from '@/pages/orgs/OrgsPage'
import ProjectsPage from '@/pages/projects/ProjectsPage'
import EnvironmentsPage from '@/pages/envs/EnvironmentsPage'
import FlagsPage from '@/pages/flags/FlagsPage'
import OrgMembersPage from '@/pages/orgs/OrgMembersPage'
import CustomRolesPage from '@/pages/orgs/CustomRolesPage'
import ProjectMembersPage from '@/pages/projects/ProjectMembersPage'
import AuditLogPage from '@/pages/audit/AuditLogPage'

const qc = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<AppLayout />}>
            <Route path="/orgs" element={<OrgsPage />} />
            <Route path="/orgs/:orgId" element={<ProjectsPage />} />
            {/* Org-scoped ABAC administration. `members` and `roles` sit before the project
                routes only for readability; the paths do not overlap. */}
            <Route path="/orgs/:orgId/members" element={<OrgMembersPage />} />
            <Route path="/orgs/:orgId/roles" element={<CustomRolesPage />} />
            <Route path="/orgs/:orgId/audit-log" element={<AuditLogPage />} />
            <Route path="/orgs/:orgId/projects/:projectId" element={<EnvironmentsPage />} />
            <Route path="/orgs/:orgId/projects/:projectId/members" element={<ProjectMembersPage />} />
            <Route path="/orgs/:orgId/projects/:projectId/envs/:envId/flags" element={<FlagsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/orgs" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
