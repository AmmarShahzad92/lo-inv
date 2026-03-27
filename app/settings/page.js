import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import SettingsClient from '@/components/SettingsClient'

export const metadata = { title: 'Settings — Laptops Officials' }

export default async function SettingsPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, email, display_name, is_admin, added_by, created_at')
    .order('created_at', { ascending: true })

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <SettingsClient user={user} initialUsers={users || []} />
      </main>
    </div>
  )
}
