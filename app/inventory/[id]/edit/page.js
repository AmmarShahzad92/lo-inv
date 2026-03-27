import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import InventoryForm from '@/components/InventoryForm'

export const metadata = { title: 'Edit Item — Laptops Officials' }

export default async function EditItemPage({ params }) {
  const user = await getSession()
  if (!user) redirect('/login')

  const { id } = await params

  const supabase = createClient()
  const [
    { data: item },
    { data: users },
    { data: purchases },
  ] = await Promise.all([
    supabase.from('inventory').select('*').eq('id', id).single(),
    supabase.from('users').select('email, display_name'),
    supabase.from('purchases').select('*').order('purchase_date', { ascending: false }),
  ])

  if (!item) notFound()

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <InventoryForm
          user={user}
          partners={users || []}
          purchases={purchases || []}
          mode="edit"
          item={item}
        />
      </main>
    </div>
  )
}
