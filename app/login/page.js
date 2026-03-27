'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [theme, setTheme] = useState('dark')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlError = searchParams.get('error')

  useEffect(() => {
    const saved = window.localStorage.getItem('loinv-theme')
    const initialTheme = saved === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', initialTheme)
    setTheme(initialTheme)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    window.localStorage.setItem('loinv-theme', nextTheme)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address.')
      return
    }
    if (!password) {
      setFormError('Please enter your password.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })

      setLoading(false)

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'Invalid email or password.')
        return
      }
    } catch {
      setLoading(false)
      setFormError('Something went wrong. Try again.')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(59,130,246,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-fade-in" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '400px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            marginBottom: '16px', boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px 0', letterSpacing: '-0.01em' }}>
            Laptops Officials
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            Inventory Management System
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            Sign in
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px 0', lineHeight: '1.5' }}>
            Use your email and password to access your account.
          </p>

          {urlError === 'not_authorized' && (
            <div className="alert-error" style={{ marginBottom: '20px' }}>
              <strong>Access denied.</strong> This account is not authorised. Contact the administrator.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="email-input">Email address</label>
              <input
                id="email-input"
                type="email"
                className="form-input"
                value={email}
                onChange={e => { setEmail(e.target.value); setFormError('') }}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                className="form-input"
                value={password}
                onChange={e => { setPassword(e.target.value); setFormError('') }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {formError && (
              <div className="alert-error" style={{ marginBottom: '16px' }}>{formError}</div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {loading ? <div className="spinner" /> : 'Sign in'}
            </button>
          </form>
        </div>
        

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          New partner?{' '}
          <Link href="/register" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
            Create account
          </Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Restricted access — authorised partners only
        </p>

        <div style={{ display: 'flex', justifyContent: 'center',marginTop: '14px' }}>
            <button
              type="button"
              onClick={toggleTheme}
              className="nav-theme-toggle"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="nav-theme-icon" aria-hidden="true">
                {theme === 'dark' ? (
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
              <span className="nav-theme-mode">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
