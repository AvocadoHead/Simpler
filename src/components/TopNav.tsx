export function TopNav() {
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
