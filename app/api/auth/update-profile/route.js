import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession, createSession } from '@/lib/auth'

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const { display_name } = await request.json()
    const trimmed = display_name?.trim()

    if (!trimmed || trimmed.length < 2) {
      return NextResponse.json({ error: 'Display name must be at least 2 characters.' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: updated, error } = await supabase
      .from('users')
      .update({ display_name: trimmed })
      .eq('id', session.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
    }

    // Re-issue JWT with updated display_name
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
