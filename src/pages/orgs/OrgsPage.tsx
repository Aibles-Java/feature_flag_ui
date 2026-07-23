import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrgs, createOrg } from '@/api/orgs'
import { useNavStore } from '@/stores/navStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Building2, Plus, ArrowRight, Users } from 'lucide-react'

export default function OrgsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const setCurrentOrg = useNavStore((s) => s.setCurrentOrg)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })

  const { data: orgs = [], isLoading } = useQuery({ queryKey: ['orgs'], queryFn: getOrgs })

  const create = useMutation({
    mutationFn: () => createOrg(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orgs'] }); setOpen(false); setForm({ name: '', slug: '' }) },
  })

  const select = (org: (typeof orgs)[0]) => { setCurrentOrg(org); navigate(`/orgs/${org.id}`) }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-500 mt-1.5">Select a workspace to manage its feature flags.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 h-10 px-5 shadow-sm text-sm font-semibold">
          <Plus className="w-4 h-4" /> New organization
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-200 animate-pulse" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && orgs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-5">
            <Building2 className="w-9 h-9 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No organizations yet</h3>
          <p className="text-gray-500 mb-6 text-center max-w-xs">Create your first organization to start managing feature flags across your projects.</p>
          <Button onClick={() => setOpen(true)} className="gap-2 h-10 px-6">
            <Plus className="w-4 h-4" /> Create organization
          </Button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orgs.map((org) => (
          <button
            key={org.id}
            onClick={() => select(org)}
            className="group flex items-center gap-5 bg-white border border-gray-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-50 transition-all text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
              <span className="text-2xl font-bold text-white">{org.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900 truncate">{org.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Users className="w-3 h-3 text-gray-400" />
                <p className="text-sm text-gray-400 font-mono truncate">{org.slug}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-lg">New organization</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="font-semibold">Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="acme-corp" className="h-10 font-mono text-sm" />
            </div>
            <Button className="w-full h-10" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create organization'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
