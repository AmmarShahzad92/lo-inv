import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import KnowledgeBaseClient from '@/components/KnowledgeBaseClient'
import Navbar from '@/components/Navbar'

export default async function KnowledgeBasePage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const supabase = createClient()
  const [
    { data: processors },
    { data: laptopModels },
  ] = await Promise.all([
    supabase.from('processors').select('*').order('brand').order('release_year'),
    supabase.from('laptop_models').select('*').order('company').order('model_name'),
  ])

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <KnowledgeBaseClient
          user={user}
          initialProcessors={processors || []}
          initialLaptopModels={laptopModels || []}
        />
      </main>
    </div>
  )
}
