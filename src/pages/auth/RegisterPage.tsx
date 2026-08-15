import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { register } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await register(form)
      setAuth({
        token: res.accessToken,
        refreshToken: res.refreshToken,
        userId: res.userId,
        email: res.email,
      })
      navigate('/orgs')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          setError('Cannot connect to server. Please make sure the backend is running.')
        } else {
          const message = err.response.data?.message ?? err.response.data?.error
          setError(message || `Registration failed (${err.response.status}).`)
        }
      } else {
        setError('An unexpected error occurred.')
      }
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}>

        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
              <path d="M14 44 L28 34 L38 40 L50 22" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 22 L50 22 L50 32" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-bold text-xl">Onward</span>
        </div>

        {/* Content */}
        <div className="relative">
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            One platform.<br />Every release.
          </h2>
          <p className="text-white/80 text-base leading-relaxed max-w-xs">
            Onward gives your team the confidence to ship fast and roll back instantly — without redeployments.
          </p>

          {/* Testimonial style */}
          <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
            <p className="text-white/90 text-sm leading-relaxed">
              "We went from weekly to daily releases after adopting feature flags. Onward made it seamless."
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">T</div>
              <div>
                <p className="text-white text-xs font-semibold">Team Lead, SaaS Startup</p>
                <p className="text-white/60 text-[11px]">5000+ flags managed</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-white/30 text-xs">© 2026 Onward · Built for modern teams</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] p-8">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#2563EB' }}>
              <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
                <path d="M14 44 L28 34 L38 40 L50 22" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M40 22 L50 22 L50 32" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">Onward</span>
          </div>

          <h1 className="text-3xl font-bold text-[#0F172A] mb-1">Create your account</h1>
          <p className="text-[#64748B] text-sm mb-8">Get started for free — no credit card needed.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">First name</Label>
                <Input value={form.firstName} onChange={set('firstName')} placeholder="Kim" className="h-11 bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Last name</Label>
                <Input value={form.lastName} onChange={set('lastName')} placeholder="Oanh" className="h-11 bg-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Email address</Label>
              <Input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@company.com"
                required
                className="h-11 bg-white text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="h-11 bg-white text-sm"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2 shadow-sm" disabled={loading}>
              {loading ? 'Đang đăng ký…' : 'Đăng ký'}
            </Button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[#2563EB] font-semibold hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-[11px] text-center text-gray-400 mt-4">
            By creating an account you agree to our Terms of Service.
          </p>
        </div>
      </div>
    </div>
  )
}
