import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CatalogForm from '@/components/CatalogForm'

export const metadata = { title: 'Edit Catalog Item — Laptops Officials' }

export default async function EditCatalogItemPage({ params }) {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const { data: item } = await supabase
    .from('laptops')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!item) redirect('/catalog')

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <CatalogForm user={user} mode="edit" item={item} />
      </main>
    </div>
  )
}
