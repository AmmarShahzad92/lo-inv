import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession, verifyPassword, hashPassword } from '@/lib/auth'

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const { current_password, new_password } = await request.json()

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Both current and new passwords are required.' }, { status: 400 })
    }

    if (new_password.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', session.id)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const valid = await verifyPassword(current_password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 })
    }

    const newHash = await hashPassword(new_password)
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', session.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update password.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
