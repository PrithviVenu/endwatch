import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-svh p-6">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-border-custom pb-4">
        <h1 className="text-xl font-semibold text-white">Endwatch</h1>
        <button
          type="button"
          onClick={logout}
          className="rounded border border-border-custom bg-hover px-3 py-1.5 text-sm text-white hover:bg-card"
        >
          Log out
        </button>
      </header>
      <main className="mx-auto mt-8 max-w-4xl">
        <p className="text-white/70">
          Dashboard — add URL lists, charts, and checks here using{' '}
          <code className="rounded bg-card px-1 text-accent">api/urls.js</code>.
        </p>
      </main>
    </div>
  )
}
