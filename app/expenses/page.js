import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ExpensesClient from '@/components/ExpensesClient'
import Navbar from '@/components/Navbar'

export default async function ExpensesPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [{ data: expenses }, { data: purchases }] = await Promise.all([
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('purchases').select('id, supplier_name'),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <ExpensesClient
          user={user}
          initialExpenses={expenses || []}
          purchases={purchases || []}
        />
      </main>
    </div>
  )
}
