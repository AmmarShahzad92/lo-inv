import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CatalogForm from '@/components/CatalogForm'

export const metadata = { title: 'Add to Catalog — Laptops Officials' }

export default async function AddCatalogItemPage() {
    const user = await getSession()
    if (!user) redirect('/login')

    return (
        <div className="app-shell">
            <Navbar user={user} />
            <main className="app-content">
                <CatalogForm user={user} mode="add" />
            </main>
        </div>
    )
}
