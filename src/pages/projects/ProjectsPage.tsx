import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProjects, createProject, updateProject, deleteProject, type Project } from '@/api/projects'
import { useNavStore } from '@/stores/navStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FolderKanban, Plus, ArrowRight, Pencil, Trash2 } from 'lucide-react'

export default function ProjectsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const setCurrentProject = useNavStore((s) => s.setCurrentProject)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', orgId], queryFn: () => getProjects(orgId!), enabled: !!orgId,
  })

  const create = useMutation({
    mutationFn: () => createProject({ organisationId: orgId!, ...form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects', orgId] }); setOpen(false); setForm({ name: '', description: '' }) },
  })

  const editMutation = useMutation({
    mutationFn: () => updateProject(editTarget!.id, editForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects', orgId] }); setEditTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(deleteTarget!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects', orgId] }); setDeleteTarget(null) },
  })

  const select = (p: Project) => { setCurrentProject(p); navigate(`/orgs/${orgId}/projects/${p.id}`) }

  const openEdit = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation()
    setEditTarget(p)
    setEditForm({ name: p.name, description: p.description ?? '' })
  }

  const openDelete = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation()
    setDeleteTarget(p)
  }

  const colors = ['from-violet-500 to-purple-700', 'from-blue-500 to-[#1D4ED8]', 'from-emerald-500 to-teal-700', 'from-rose-500 to-pink-700', 'from-amber-500 to-orange-700']

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1.5">Select a project to manage its environments and feature flags.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 h-10 px-5 shadow-sm text-sm font-semibold">
          <Plus className="w-4 h-4" /> New project
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-200 animate-pulse" />)}
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 rounded-3xl bg-[#EFF6FF] flex items-center justify-center mb-5">
            <FolderKanban className="w-9 h-9 text-[#60A5FA]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No projects yet</h3>
          <p className="text-gray-500 mb-6 text-center max-w-xs">Create your first project to start adding environments and managing feature flags.</p>
          <Button onClick={() => setOpen(true)} className="gap-2 h-10 px-6"><Plus className="w-4 h-4" /> Create project</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p, i) => (
          <div
            key={p.id}
            className="group relative flex items-center gap-5 bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#93C5FD] hover:shadow-md hover:shadow-[#EFF6FF] transition-all cursor-pointer"
            onClick={() => select(p)}
          >
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors[i % colors.length]} flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
              <FolderKanban className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900 truncate">{p.name}</p>
              {p.description
                ? <p className="text-sm text-gray-400 truncate mt-0.5">{p.description}</p>
                : <p className="text-sm text-gray-300 mt-0.5">No description</p>}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => openEdit(e, p)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => openDelete(e, p)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-[#60A5FA] group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-lg">New project</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="font-semibold">Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My App" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this project?" className="h-10" />
            </div>
            <Button className="w-full h-10" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-lg">Edit project</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="font-semibold">Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this project?" className="h-10" />
            </div>
            <Button className="w-full h-10" onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editForm.name}>
              {editMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-lg">Delete project</DialogTitle></DialogHeader>
          <div className="pt-2 space-y-4">
            <p className="text-sm text-gray-600">
              Delete <span className="font-semibold text-gray-900">«{deleteTarget?.name}»</span>? All its environments and flags will be removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
