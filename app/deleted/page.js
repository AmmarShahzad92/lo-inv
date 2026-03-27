import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DeletedClient from '@/components/DeletedClient'
import Navbar from '@/components/Navbar'

export default async function DeletedPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const { data: deletedItems } = await supabase
    .from('deleted_items')
    .select('*')
    .order('deleted_at', { ascending: false })

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <DeletedClient user={user} initialItems={deletedItems || []} />
      </main>
    </div>
  )
}
