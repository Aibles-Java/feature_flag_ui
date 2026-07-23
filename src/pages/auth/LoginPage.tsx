import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Flag, ToggleRight, Zap, ShieldCheck } from 'lucide-react'

const FEATURES = [
  { icon: <ToggleRight className="w-4 h-4" />, text: 'Instant feature toggles — no deploys needed' },
  { icon: <Zap className="w-4 h-4" />, text: 'Multi-environment management in one place' },
  { icon: <ShieldCheck className="w-4 h-4" />, text: 'Secure API key authentication per environment' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(email, password)
      setAuth(res.token, res.userId, res.email)
      navigate('/orgs')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4338ca 0%, #5b21b6 60%, #4c1d95 100%)' }}>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Floating card preview */}
        <div className="absolute top-1/2 right-[-20px] -translate-y-1/2 w-72 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-2xl">
          <p className="text-white/60 text-xs font-medium mb-3 uppercase tracking-wider">Feature Flags — Production</p>
          {[
            { name: 'dark-mode', on: true },
            { name: 'new-checkout', on: false },
            { name: 'beta-dashboard', on: true },
            { name: 'ai-suggestions', on: false },
          ].map((f) => (
            <div key={f.name} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${f.on ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <span className="text-white/80 text-xs font-mono">{f.name}</span>
              </div>
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.on ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/30'}`}>
                {f.on ? 'ON' : 'OFF'}
              </div>
            </div>
          ))}
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Flag className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-white font-bold text-xl">FlagFlow</span>
        </div>

        {/* Tagline */}
        <div className="relative">
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Ship fearlessly.<br />Release confidently.
          </h2>
          <ul className="space-y-3">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-indigo-200 text-sm">
                <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  {f.icon}
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-indigo-300/50 text-xs">© 2025 FlagFlow · Built for modern teams</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
              <Flag className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">FlagFlow</span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in to your FlagFlow account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="h-11 bg-white text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
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
              {loading ? 'Signing in…' : 'Sign in to FlagFlow'}
            </Button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
