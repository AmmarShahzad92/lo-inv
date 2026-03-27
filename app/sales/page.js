import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SalesClient from '@/components/SalesClient'
import Navbar from '@/components/Navbar'

export default async function SalesPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [{ data: sales }, { data: partners }, { data: enterpriseCapital }] = await Promise.all([
    supabase.from('sales').select('*').order('sale_date', { ascending: false }),
    supabase.from('users').select('id, email, display_name'),
    supabase.from('enterprise_capital').select('liquid_assets').limit(1).single(),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <SalesClient
          user={user}
          initialSales={sales || []}
          partners={partners || []}
          initialLiquidAssets={Number(enterpriseCapital?.liquid_assets) || 0}
        />
      </main>
    </div>
  )
}
