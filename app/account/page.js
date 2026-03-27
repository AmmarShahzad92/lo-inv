import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AccountClient from '@/components/AccountClient'

export const metadata = { title: 'My Account — Laptops Officials' }

export default async function AccountPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="app-content">
        <AccountClient user={user} />
      </main>
    </div>
  )
}
