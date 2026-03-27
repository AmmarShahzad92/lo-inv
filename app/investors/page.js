import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import InvestorsClient from '@/components/InvestorsClient'
import Navbar from '@/components/Navbar'

export default async function InvestorsPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [
    { data: investors },
    { data: enterpriseCapital },
  ] = await Promise.all([
    supabase.from('investors').select('*').order('name'),
    supabase.from('enterprise_capital').select('*').limit(1).single(),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <InvestorsClient
          user={user}
          initialInvestors={investors || []}
          enterpriseCapital={enterpriseCapital || { liquid_assets: 0, petty_cash: 0 }}
        />
      </main>
    </div>
  )
}
