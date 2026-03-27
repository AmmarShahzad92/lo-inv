import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ArchiveClient from '@/components/ArchiveClient'
import Navbar from '@/components/Navbar'

export default async function ArchivePage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [
    { data: items },
    { data: sales },
  ] = await Promise.all([
    supabase
      .from('inventory')
      .select('*')
      .in('status', ['sold', 'returned', 'damaged'])
      .order('updated_at', { ascending: false }),
    supabase
      .from('sales')
      .select('*')
      .order('sale_date', { ascending: false }),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <ArchiveClient
          user={user}
          initialItems={items || []}
          initialSales={sales || []}
        />
      </main>
    </div>
  )
}
