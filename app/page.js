import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Dashboard from '@/components/Dashboard'

export default async function Home() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [
    { data: inventory },
    { data: sales },
    { data: partners },
    { data: enterpriseCapital },
    { data: liabilities },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('inventory').select('*').eq('status', 'in_stock').order('created_at', { ascending: false }),
    supabase.from('sales').select('*').order('sale_date', { ascending: false }),
    supabase.from('users').select('id, email, display_name'),
    supabase.from('enterprise_capital').select('*').limit(1).single(),
    supabase.from('liabilities').select('*').neq('status', 'cleared').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <Dashboard
          user={user}
          initialInventory={inventory || []}
          initialSales={sales || []}
          partners={partners || []}
          enterpriseCapital={enterpriseCapital || { liquid_assets: 0, petty_cash: 0 }}
          pendingLiabilities={liabilities || []}
          pendingExpenses={expenses || []}
        />
      </main>
    </div>
  )
}
