import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import FinanceClient from '@/components/FinanceClient'
import Navbar from '@/components/Navbar'

export default async function FinancePage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [
    { data: enterpriseCapital },
    { data: investors },
    { data: capitalLedger },
    { data: profitDistributions },
    { data: withdrawalRequests },
  ] = await Promise.all([
    supabase.from('enterprise_capital').select('*').limit(1).single(),
    supabase.from('investors').select('*').order('created_at', { ascending: false }),
    supabase.from('capital_ledger').select('*').order('created_at', { ascending: false }),
    supabase.from('profit_distributions').select('*').order('created_at', { ascending: false }),
    supabase.from('withdrawal_requests').select('*').order('requested_at', { ascending: false }),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <FinanceClient
          user={user}
          enterpriseCapital={enterpriseCapital || { liquid_assets: 0, petty_cash: 0 }}
          investors={investors || []}
          capitalLedger={capitalLedger || []}
          profitDistributions={profitDistributions || []}
          withdrawalRequests={withdrawalRequests || []}
        />
      </main>
    </div>
  )
}
