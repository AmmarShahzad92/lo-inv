import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import LiabilitiesClient from '@/components/LiabilitiesClient'
import Navbar from '@/components/Navbar'

export default async function LiabilitiesPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [{ data: liabilities }, { data: purchases }, { data: sales }] = await Promise.all([
    supabase.from('liabilities').select('*').order('created_at', { ascending: false }),
    supabase.from('purchases').select('id, supplier_name'),
    supabase.from('sales').select('net_profit, profit_cleared').eq('profit_cleared', false),
  ])

  const initialUnsettledNetProfit = (sales || []).reduce(
    (sum, sale) => sum + Math.max(Number(sale.net_profit) || 0, 0),
    0
  )

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <LiabilitiesClient
          user={user}
          initialLiabilities={liabilities || []}
          purchases={purchases || []}
          initialUnsettledNetProfit={initialUnsettledNetProfit}
        />
      </main>
    </div>
  )
}
