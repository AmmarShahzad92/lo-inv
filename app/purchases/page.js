import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import PurchasesClient from '@/components/PurchasesClient'
import Navbar from '@/components/Navbar'

export default async function PurchasesPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [{ data: purchases }, { data: inventory }, { data: liabilities }] = await Promise.all([
    supabase.from('purchases').select('*').order('purchase_date', { ascending: false }),
    supabase.from('inventory').select('*').order('created_at', { ascending: false }),
    supabase.from('liabilities').select('*'),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <PurchasesClient
          user={user}
          initialPurchases={purchases || []}
          inventory={inventory || []}
          liabilities={liabilities || []}
        />
      </main>
    </div>
  )
}
