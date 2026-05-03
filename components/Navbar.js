'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

function emailToName(email) {
  if (!email) return 'User'
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function getDisplayName(user) {
  if (!user) return 'Unknown'
  return user.display_name || emailToName(user.email)
}

const NAV_LINKS = [
  { href: '/', label: 'Inventory' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/sales', label: 'Sales' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/finance', label: 'Finance' },
  { href: '/investors', label: 'Investors' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/liabilities', label: 'Liabilities' },
  { href: '/offers', label: 'Offers' },
  { href: '/knowledge-base', label: 'KB' },
  { href: '/archive', label: 'Archive' },
  { href: '/deleted', label: 'Deleted' },
  { href: '/account', label: 'Account' },
  { href: '/settings', label: 'Settings' },
]

export default function Navbar({ user }) {
  const router = useRouter()
  const pathname = usePathname()
  const [theme, setTheme] = useState('dark')
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const nameInputRef = useRef(null)

  const displayName = getDisplayName(user)
  const isAdmin = user?.is_admin === true

  useEffect(() => {
    const saved = window.localStorage.getItem('loinv-theme')
    const initialTheme = saved === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', initialTheme)
    setTheme(initialTheme)
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('loinv-sidebar-collapsed')
    setDesktopCollapsed(saved === '1')
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    if (editingName) {
      setNameInput(displayName)
      setNameError('')
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [editingName, displayName])

  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [menuOpen])

  const handleSignOut = async () => {
    setSigningOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    window.localStorage.setItem('loinv-theme', nextTheme)
  }

  const toggleDesktopSidebar = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem('loinv-sidebar-collapsed', next ? '1' : '0')
      return next
    })
  }

  const handleSaveName = async (e) => {
    e?.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed.length < 2) {
      setNameError('Name must be at least 2 characters.')
      return
    }
    setSavingName(true)
    const res = await fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: trimmed }),
    })
    setSavingName(false)
    if (!res.ok) { setNameError('Failed to save. Try again.'); return }
    setEditingName(false)
    router.refresh()
  }

  const isActive = (href) => href === '/' ? pathname === '/' : pathname.startsWith(href)
  const isDark = theme === 'dark'

  return (
    <header className={`navbar ${desktopCollapsed ? 'navbar-collapsed' : ''}`}>
      <button
        type="button"
        className="navbar-rail-btn"
        onClick={toggleDesktopSidebar}
        aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {desktopCollapsed ? (
            <polyline points="9 18 15 12 9 6" />
          ) : (
            <polyline points="15 18 9 12 15 6" />
          )}
        </svg>
      </button>
      <div className="navbar-inner">

        {/* Brand */}
        <div className="navbar-brand-row">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', boxShadow: 'var(--neu-shadow-raised-sm)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <span className="navbar-brand-text text-[15px] font-bold text-[var(--text-primary)] tracking-tight hidden sm:block lg:block">
              Laptops Officials
            </span>
          </Link>
          <button
            type="button"
            className="navbar-inline-toggle"
            onClick={toggleDesktopSidebar}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Desktop Nav */}
        <nav className="navbar-desktop-nav hidden lg:flex flex-col items-stretch gap-1 flex-1 min-w-0 overflow-y-auto pr-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`nav-link nav-link-desktop whitespace-nowrap shrink-0 ${isActive(href) ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop user section */}
        <div className="navbar-desktop-user hidden lg:flex flex-col items-stretch gap-2.5 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg neu-raised-sm"
            style={{ background: 'var(--bg-card)' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #10b981)' }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            {editingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={e => { setNameInput(e.target.value); setNameError('') }}
                  onKeyDown={e => e.key === 'Escape' && setEditingName(false)}
                  maxLength={40}
                  className="form-input text-[13px] !w-[130px] !py-1 !px-2"
                />
                <button type="submit" disabled={savingName}
                  className="px-2 py-1 rounded text-[12px] text-white cursor-pointer flex items-center"
                  style={{ background: 'var(--accent-blue)', border: 'none', boxShadow: 'var(--neu-shadow-raised-xs)' }}>
                  {savingName ? <div className="spinner" style={{ width: '12px', height: '12px' }} /> : '✓'}
                </button>
                <button type="button" onClick={() => setEditingName(false)}
                  className="text-[13px] px-1 cursor-pointer"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>✕</button>
              </form>
            ) : (
              <>
                <span className="text-[13px] text-[var(--text-primary)] font-medium select-none">{displayName}</span>
                {isAdmin && <span className="badge badge-blue text-[10px] px-1.5 py-0">Admin</span>}
                <button onClick={() => setEditingName(true)} title="Edit name"
                  className="flex items-center p-0.5 rounded cursor-pointer transition-colors"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                  onMouseOver={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </>
            )}
          </div>
          <button
            onClick={toggleTheme}
            className="nav-theme-toggle nav-theme-toggle-desktop"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="nav-theme-icon" aria-hidden="true">
              {isDark ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                </svg>
              )}
            </span>
            <span className="nav-theme-mode">{isDark ? 'Light' : 'Dark'}</span>
          </button>
          {nameError && <span className="text-[11px] text-[var(--accent-red)]">{nameError}</span>}
          <button onClick={handleSignOut} disabled={signingOut}
            className="btn-xs-red flex items-center justify-center gap-1.5 !px-3 !py-2 !text-[13px] w-full">
            {signingOut ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            )}
            Sign out
          </button>
        </div>

        {/* Mobile: hamburger */}
        <div className="lg:hidden flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={toggleTheme}
            className="nav-theme-toggle nav-theme-toggle-mobile"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="nav-theme-icon" aria-hidden="true">
              {isDark ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                </svg>
              )}
            </span>
            <span className="nav-theme-text">Theme</span>
            <span className="nav-theme-mode">{isDark ? 'Light' : 'Dark'}</span>
          </button>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #10b981)' }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer transition-all"
            style={{
              background: menuOpen ? 'var(--bg-card)' : 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              boxShadow: menuOpen ? 'var(--neu-shadow-pressed-sm)' : 'var(--neu-shadow-raised-xs)',
            }}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu-panel animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #10b981)' }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{displayName}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">{user?.email}</div>
                </div>
                {isAdmin && <span className="badge badge-blue text-[10px] px-1.5 py-0 shrink-0">Admin</span>}
              </div>

              <button
                onClick={() => setMenuOpen(false)}
                className="mobile-menu-close"
                aria-label="Close menu"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <nav className="mobile-menu-nav">
              {NAV_LINKS.map(({ href, label }) => (
                <Link key={href} href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`nav-link mobile-nav-link ${isActive(href) ? 'active' : ''}`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mobile-menu-footer">
              <button onClick={handleSignOut} disabled={signingOut}
                className="btn-xs-red flex items-center justify-center gap-1.5 !px-3 !py-2.5 !text-[13px] w-full">
                {signingOut ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                )}
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
