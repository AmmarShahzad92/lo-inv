'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function emailToName(email) {
  if (!email) return ''
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const router = useRouter()

  const handleEmailChange = (e) => {
    const val = e.target.value
    setEmail(val)
    setFormError('')
    if (!displayName || displayName === emailToName(email)) {
      setDisplayName(emailToName(val))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = displayName.trim()

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address.')
      return
    }
    if (!trimmedName || trimmedName.length < 2) {
      setFormError('Display name must be at least 2 characters.')
      return
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          display_name: trimmedName,
        }),
      })

      setLoading(false)

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'Registration failed.')
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

  const passwordStrength = () => {
    if (!password) return null
    if (password.length < 8) return { label: 'Too short', color: 'var(--accent-red)', width: '25%' }
    if (password.length < 10 || !/[0-9]/.test(password)) return { label: 'Weak', color: 'var(--accent-amber)', width: '50%' }
    if (!/[!@#$%^&*]/.test(password)) return { label: 'Good', color: '#60a5fa', width: '75%' }
    return { label: 'Strong', color: 'var(--accent-green)', width: '100%' }
  }

  const strength = passwordStrength()

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

      <div className="animate-fade-in" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
            Create your partner account
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            Create account
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 24px 0', lineHeight: '1.5' }}>
            Your email must be added by an existing partner before registering.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="email-input">Email address</label>
              <input
                id="email-input"
                type="email"
                className="form-input"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="name-input">
                Display name
                <span style={{ color: 'var(--text-muted)', fontWeight: '400', marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>
                  — shown to all partners
                </span>
              </label>
              <input
                id="name-input"
                type="text"
                className="form-input"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setFormError('') }}
                placeholder="e.g. Abdullah"
                autoComplete="name"
                maxLength={40}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                className="form-input"
                value={password}
                onChange={e => { setPassword(e.target.value); setFormError('') }}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              {strength && (
                <div style={{ marginTop: '8px' }}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: strength.width, background: strength.color }} />
                  </div>
                  <span style={{ fontSize: '11px', color: strength.color, marginTop: '4px', display: 'block' }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="confirm-input">Confirm password</label>
              <input
                id="confirm-input"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setFormError('') }}
                placeholder="Re-enter password"
                autoComplete="new-password"
                style={{
                  borderColor: confirmPassword
                    ? confirmPassword === password ? 'var(--accent-green)' : 'var(--accent-red)'
                    : undefined,
                }}
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
              {loading ? <div className="spinner" /> : 'Create account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
