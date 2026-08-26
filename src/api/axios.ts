import axios from 'axios'

// Resolution order:
//   1. window.__ENV__  — runtime config injected by the container (build once, deploy anywhere)
//   2. import.meta.env — Vite build-time value (dev via .env)
//   3. hardcoded fallback
const baseURL =
  window.__ENV__?.VITE_API_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:8080/api/v1'

const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
