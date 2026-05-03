import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'

function formatPrice(amount) {
    return amount != null ? `PKR ${Number(amount).toLocaleString('en-PK')}` : '—'
}

function getStorageLabel(storage) {
    if (!storage) return ''
    if (typeof storage === 'string') return storage
    if (storage.primary) return storage.primary
    return ''
}

function getGpuLabel(gpu) {
    if (!gpu) return ''
    if (typeof gpu === 'string') return gpu
    if (Array.isArray(gpu.dedicated) && gpu.dedicated[0]) return gpu.dedicated[0]
    if (gpu.dedicated) return gpu.dedicated
    if (gpu.integrated) return gpu.integrated
    return ''
}

function getItemTitle(item) {
    return [item.brand, item.model].filter(Boolean).join(' ') || item.item_name || 'Untitled item'
}

export default async function CatalogPage() {
    const user = await getSession()
    if (!user) redirect('/login')

    const supabase = createClient()
    const { data: items, error } = await supabase
        .from('laptops')
        .select('*')
        .eq('status', 'live')
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(error.message)
    }

    return (
        <div className="app-shell">
            <Navbar user={user} />
            <main className="app-content p-6">
                <div className="mb-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-sm uppercase tracking-[0.25em] text-[var(--text-muted)] mb-2">Catalog</p>
                            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Live listings</h1>
                            <p className="mt-2 text-[var(--text-secondary)]">
                                Showing {items?.length ?? 0} live catalog item{items?.length === 1 ? '' : 's'}.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="card overflow-hidden">
                    {items && items.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-2">
                                <thead>
                                    <tr className="text-left text-[var(--text-secondary)] text-[12px] uppercase tracking-wider">
                                        <th className="px-4 py-3">Product</th>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3">Storage</th>
                                        <th className="px-4 py-3">GPU</th>
                                        <th className="px-4 py-3">Qty</th>
                                        <th className="px-4 py-3">Price</th>
                                        <th className="px-4 py-3">Updated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.id} className="bg-[var(--bg-secondary)] border-b border-[var(--border)] odd:bg-[var(--bg-card)]">
                                            <td className="px-4 py-4 align-top">
                                                <div className="font-semibold text-[var(--text-primary)]">{getItemTitle(item)}</div>
                                                <div className="text-[11px] text-[var(--text-muted)] mt-1">{item.cpu || 'CPU unknown'}</div>
                                            </td>
                                            <td className="px-4 py-4 align-top text-[var(--text-secondary)]">{item.category}</td>
                                            <td className="px-4 py-4 align-top text-[var(--text-secondary)]">{getStorageLabel(item.storage)}</td>
                                            <td className="px-4 py-4 align-top text-[var(--text-secondary)]">{getGpuLabel(item.gpu)}</td>
                                            <td className="px-4 py-4 align-top text-[var(--text-secondary)]">{item.qty ?? 0}</td>
                                            <td className="px-4 py-4 align-top font-semibold text-[var(--text-primary)]">{formatPrice(item.price)}</td>
                                            <td className="px-4 py-4 align-top text-[var(--text-secondary)]">{item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-GB') : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-[var(--text-secondary)]">
                            No live catalog items found.
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
