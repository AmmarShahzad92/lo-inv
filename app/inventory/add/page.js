import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import InventoryForm from '@/components/InventoryForm'

export const metadata = { title: 'Add Item — Laptops Officials' }

export default async function AddItemPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [
    { data: users },
    { data: purchases },
  ] = await Promise.all([
    supabase.from('users').select('email, display_name'),
    supabase.from('purchases').select('*').order('purchase_date', { ascending: false }),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <InventoryForm
          user={user}
          partners={users || []}
          purchases={purchases || []}
          mode="add"
        />
      </main>
    </div>
  )
}
