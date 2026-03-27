import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hashPassword, createSession } from '@/lib/auth'

export async function POST(request) {
  try {
    const { email, password, display_name } = await request.json()

    if (!email || !password || !display_name) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    const trimmedEmail = email.toLowerCase().trim()
    const trimmedName = display_name.trim()

    if (trimmedName.length < 2) {
      return NextResponse.json({ error: 'Display name must be at least 2 characters.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', trimmedEmail)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'This email has not been added to the system. Ask an existing partner to add your email first, then come back to register.' },
        { status: 403 }
      )
    }

    if (user.password_hash) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please login instead.' },
        { status: 409 }
      )
    }

    const password_hash = await hashPassword(password)

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ password_hash, display_name: trimmedName })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Registration failed. Try again.' }, { status: 500 })
    }

    await createSession(updated)

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      display_name: updated.display_name,
      is_admin: updated.is_admin,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
