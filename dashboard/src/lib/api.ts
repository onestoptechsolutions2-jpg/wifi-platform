import axios from 'axios'

const api = axios.create({ baseURL: '/api', withCredentials: true })

// Attach access token
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        localStorage.setItem('access_token', data.accessToken)
        err.config.headers.Authorization = `Bearer ${data.accessToken}`
        return api(err.config)
      } catch {
        localStorage.removeItem('access_token')
        // Guard: without this check, page reloads -> AuthProvider calls /auth/me
        // -> 401 -> interceptor retries -> infinite loop (20-60s freeze in logs).
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
