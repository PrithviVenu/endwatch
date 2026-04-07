import axios from 'axios'

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api'

const client = axios.create({
  baseURL,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      const path = window.location.pathname
      if (
        path !== '/login' &&
        path !== '/signup' &&
        path !== '/verify-email'
      ) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

export default client
