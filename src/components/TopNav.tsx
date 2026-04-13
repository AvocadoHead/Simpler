import { useStore } from '../store/useStore'

export function TopNav() {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)

  const handleAuthClick = () => {
    alert('Coming soon')
  }

  const handleSaveClick = () => {
    alert('Coming soon')
  }

  return (
    <div className="top-nav">
      <div className="brand">SIMPLER</div>
      <div className="nav-tools">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="mock-auth" onClick={handleAuthClick}>
          Log In
        </button>
        <button className="mock-auth" onClick={handleSaveClick}>
          Save Project
        </button>
      </div>
    </div>
  )
}
