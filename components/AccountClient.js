'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function emailToName(email) {
  if (!email) return ''
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function AccountClient({ user }) {
  const router = useRouter()
  const currentName = user?.display_name || emailToName(user?.email)

  // ── Name form state ──────────────────────────────────────────────
  const [name, setName] = useState(currentName)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')

  // ── Password form state ──────────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState('')
  const [pwdError, setPwdError] = useState('')

  // ── Save name ────────────────────────────────────────────────────
  const handleSaveName = async (e) => {
    e.preventDefault()
    setNameError('')
    setNameSuccess('')
    const trimmed = name.trim()
    if (!trimmed || trimmed.length < 2) {
      setNameError('Name must be at least 2 characters.')
      return
    }
    setNameSaving(true)
    const res = await fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: trimmed }),
    })
    setNameSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setNameError(data.error || 'Failed to save.')
    } else {
      setNameSuccess('Display name updated.')
      router.refresh()
    }
  }

  // ── Change password ──────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwdError('')
    setPwdSuccess('')

    if (!currentPwd) { setPwdError('Enter your current password to confirm identity.'); return }
    if (newPwd.length < 8) { setPwdError('New password must be at least 8 characters.'); return }
    if (newPwd !== confirmPwd) { setPwdError('New passwords do not match.'); return }
    if (currentPwd === newPwd) { setPwdError('New password must be different from the current one.'); return }

    setPwdSaving(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
    })
    setPwdSaving(false)

    if (!res.ok) {
      const data = await res.json()
      setPwdError(data.error || 'Failed to change password.')
    } else {
      setPwdSuccess('Password updated successfully.')
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    }
  }

  const pwdStrength = () => {
    if (!newPwd) return null
    if (newPwd.length < 8) return { label: 'Too short', color: 'var(--accent-red)', width: '25%' }
    if (newPwd.length < 10 || !/[0-9]/.test(newPwd)) return { label: 'Weak', color: 'var(--accent-amber)', width: '50%' }
    if (!/[!@#$%^&*]/.test(newPwd)) return { label: 'Good', color: '#60a5fa', width: '75%' }
    return { label: 'Strong', color: 'var(--accent-green)', width: '100%' }
  }
  const strength = pwdStrength()

  return (
    <div style={{ padding: '40px 24px', maxWidth: '560px', margin: '0 auto' }}>
      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none',
        marginBottom: '24px', transition: 'color 0.1s',
      }}
      onMouseOver={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to inventory
      </Link>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
          My Account
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
          {user?.email}
        </p>
      </div>

      {/* ── Update display name ── */}
      <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Display name
        </h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
          This name is visible to all partners on entries you create or edit.
        </p>

        <form onSubmit={handleSaveName}>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="name-field">Name</label>
            <input
              id="name-field"
              type="text"
              className="form-input"
              value={name}
              onChange={e => { setName(e.target.value); setNameError(''); setNameSuccess('') }}
              placeholder="Your display name"
              maxLength={40}
            />
          </div>
          {nameError && <div className="alert-error" style={{ marginBottom: '12px' }}>{nameError}</div>}
          {nameSuccess && <div className="alert-success" style={{ marginBottom: '12px' }}>{nameSuccess}</div>}
          <button
            type="submit"
            className="btn-primary"
            disabled={nameSaving || name.trim() === currentName}
          >
            {nameSaving ? <div className="spinner" /> : 'Save name'}
          </button>
        </form>
      </div>

      {/* ── Change password ── */}
      <div className="card" style={{ padding: '28px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Change password
        </h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
          Enter your current password to confirm your identity, then set a new one.
        </p>

        <form onSubmit={handleChangePassword}>
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label" htmlFor="current-pwd">Current password</label>
            <input
              id="current-pwd"
              type="password"
              className="form-input"
              value={currentPwd}
              onChange={e => { setCurrentPwd(e.target.value); setPwdError(''); setPwdSuccess('') }}
              placeholder="Your current password"
              autoComplete="current-password"
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="form-label" htmlFor="new-pwd">New password</label>
            <input
              id="new-pwd"
              type="password"
              className="form-input"
              value={newPwd}
              onChange={e => { setNewPwd(e.target.value); setPwdError(''); setPwdSuccess('') }}
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
            <label className="form-label" htmlFor="confirm-pwd">Confirm new password</label>
            <input
              id="confirm-pwd"
              type="password"
              className="form-input"
              value={confirmPwd}
              onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); setPwdSuccess('') }}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              style={{
                borderColor: confirmPwd
                  ? confirmPwd === newPwd ? 'var(--accent-green)' : 'var(--accent-red)'
                  : undefined,
              }}
            />
          </div>

          {pwdError && <div className="alert-error" style={{ marginBottom: '12px' }}>{pwdError}</div>}
          {pwdSuccess && <div className="alert-success" style={{ marginBottom: '12px' }}>{pwdSuccess}</div>}

          <button type="submit" className="btn-primary" disabled={pwdSaving}>
            {pwdSaving ? <div className="spinner" /> : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
