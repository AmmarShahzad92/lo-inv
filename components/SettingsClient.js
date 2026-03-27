'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function formatDate(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

function extractName(email) {
  if (!email) return email
  const local = email.split('@')[0]
  return local.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function SettingsClient({ user, initialUsers }) {
  const [users, setUsers] = useState(initialUsers)
  const [newEmail, setNewEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [removingId, setRemovingId] = useState(null)

  const supabase = createClient()

  // Real-time
  useEffect(() => {
    const channel = supabase
      .channel('users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('id, email, display_name, is_admin, added_by, created_at')
      .order('created_at', { ascending: true })
    if (data) setUsers(data)
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async function handleAddEmail(e) {
    e.preventDefault()
    setAddError('')
    setAddSuccess('')
    const email = newEmail.trim().toLowerCase()

    if (!validateEmail(email)) {
      setAddError('Please enter a valid email address.')
      return
    }
    if (users.some(u => u.email === email)) {
      setAddError('This email is already in the allowed list.')
      return
    }

    setAddLoading(true)
    const { error } = await supabase.from('users').insert([{
      email,
      added_by: user.email,
    }])

    if (error) {
      setAddError(error.message)
    } else {
      setAddSuccess(`${email} has been granted access.`)
      setNewEmail('')
    }
    setAddLoading(false)
  }

  async function handleRemove(userRecord) {
    if (userRecord.is_admin) return // Protect admin
    if (!confirm(`Remove access for ${userRecord.email}? They will be signed out on their next request.`)) return

    setRemovingId(userRecord.id)
    await supabase.from('users').delete().eq('id', userRecord.id)
    setRemovingId(null)
  }

  return (
    <div style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
          Access Management
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
          Control which email accounts can access the system. All partners can manage this list.
        </p>
      </div>

      {/* Add Email Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Grant Access
        </h2>
        <form onSubmit={handleAddEmail} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <input
              type="email"
              className="form-input"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setAddError(''); setAddSuccess('') }}
              placeholder="partner@gmail.com"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={addLoading} style={{ whiteSpace: 'nowrap' }}>
            {addLoading ? <div className="spinner" /> : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Grant Access
              </>
            )}
          </button>
        </form>
        {addError && <div className="alert-error" style={{ marginTop: '12px' }}>{addError}</div>}
        {addSuccess && <div className="alert-success" style={{ marginTop: '12px' }}>{addSuccess}</div>}
      </div>

      {/* Authorised Accounts Table */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Authorised Accounts
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            {users.length} {users.length === 1 ? 'account' : 'accounts'} authorised
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Added by</th>
                <th>Date Added</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(record => {
                const isAdminRow = record.is_admin
                const name = record.display_name || extractName(record.email)
                return (
                  <tr key={record.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #3b82f6, #10b981)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0,
                        }}>
                          {name.charAt(0)}
                        </div>
                        <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                          {name}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{record.email}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {record.added_by === 'system' ? (
                        <span className="badge badge-blue">System</span>
                      ) : (
                        extractName(record.added_by)
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {formatDate(record.created_at)}
                    </td>
                    <td>
                      {isAdminRow ? (
                        <span className="badge badge-blue">Admin</span>
                      ) : (
                        <span className="badge badge-green">Partner</span>
                      )}
                    </td>
                    <td>
                      {isAdminRow ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Protected</span>
                      ) : (
                        <button
                          onClick={() => handleRemove(record)}
                          disabled={removingId === record.id}
                          className="btn-danger"
                          style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {removingId === record.id ? (
                            <div className="spinner" style={{ width: '11px', height: '11px' }} />
                          ) : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                              Revoke
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security notice */}
      <div style={{
        marginTop: '20px', padding: '14px 16px',
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: '8px', fontSize: '13px',
        color: 'var(--accent-amber)',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <strong>Security note:</strong> Only add trusted partners here. Every allowed account has full read/write access to inventory data. Revoking access takes effect on the user&apos;s next request.
        </div>
      </div>
    </div>
  )
}
