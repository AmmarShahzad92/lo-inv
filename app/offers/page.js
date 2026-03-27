import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import OffersClient from '@/components/OffersClient'
import Navbar from '@/components/Navbar'

export default async function OffersPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const { data: offers } = await supabase
    .from('vendor_offers')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <OffersClient user={user} initialOffers={offers || []} />
      </main>
    </div>
  )
}
