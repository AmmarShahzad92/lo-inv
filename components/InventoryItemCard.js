// import { useState } from 'react'
// import Link from 'next/link'
// import { formatDate } from '@/lib/utils'
// import { CATEGORY_LABELS, CATEGORY_BADGE_CLASS } from '@/lib/constants'

// /* ─── InventoryItemCard ──────────────────────────────────── */

// export default function InventoryItemCard({ item, onSell,onArchive,onMarkDamaged,onReserve, onReturn, onDelete, user, deletingId }) {
//   const [open, setOpen] = useState(false)
//   const isDeleting = deletingId === item.id
//   const isLaptop = item.category === 'laptop'

//   const title = isLaptop
//     ? [item.company, item.model].filter(Boolean).join(' ')
//     : item.item_name || 'Unnamed Item'

//   const hasExtras = item.screen_size || item.graphics_card || item.battery_health ||
//     item.notes || item.processor || item.ram_speed || item.ssd_name ||
//     (item.specifications && Object.keys(item.specifications).length > 0)

//   return (
//     <div>
//       <div className="item-row">

//         {/* Col 1: Title + subtitle */}
//         <div className="flex-1 min-w-0">
//           <div className="flex items-start justify-between gap-2 md:block">
//             <div className="font-bold text-[14px] text-[var(--text-primary)] leading-snug truncate">
//               {title}
//             </div>
//             {/* Mobile: category badge */}
//             <div className="md:hidden shrink-0 mt-0.5">
//               <span className={CATEGORY_BADGE_CLASS[item.category] || 'badge badge-amber'} style={{ fontSize: '10px' }}>
//                 {CATEGORY_LABELS[item.category] || item.category}
//               </span>
//             </div>
//           </div>
//           {isLaptop && item.processor && (
//             <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{item.processor}</div>
//           )}
//           {!isLaptop && item.company && (
//             <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{item.company}</div>
//           )}
//         </div>

//         {/* Col 2: Spec badges (laptops: ram + ssd, others: category) */}
//         <div className="flex flex-wrap gap-1.5 shrink-0 md:w-40">
//           {isLaptop ? (
//             <>
//               {item.ram_size && <span className="badge badge-blue text-[11px]">{item.ram_size}</span>}
//               {(item.ssd_size || item.ssd_category) && (
//                 <span className="badge badge-green text-[11px]">
//                   {[item.ssd_size, item.ssd_category].filter(Boolean).join(' ')}
//                 </span>
//               )}
//             </>
//           ) : (
//             <span className={`${CATEGORY_BADGE_CLASS[item.category] || 'badge badge-amber'} text-[11px] hidden md:inline-flex`}>
//               {CATEGORY_LABELS[item.category] || item.category}
//             </span>
//           )}
//         </div>

//         {/* Mobile-only: Cost + Min Sale row */}
//         <div className="md:hidden flex gap-6">
//           <div>
//             <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Cost</div>
//             <div className="text-[13px] font-bold text-[var(--text-primary)]">{formatPKR(item.cost_price)}</div>
//           </div>
//           <div>
//             <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Min Sale</div>
//             <div className="text-[13px] font-semibold text-[var(--accent-green)]">{formatPKR(item.min_sale_price)}</div>
//           </div>
//         </div>

//         {/* Col 3: Cost (desktop) */}
//         <div className="hidden md:block w-28 shrink-0 text-right">
//           <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Cost</div>
//           <div className="text-[13px] font-bold text-[var(--text-primary)]">{formatPKR(item.cost_price)}</div>
//         </div>

//         {/* Col 4: Min Sale (desktop) */}
//         <div className="hidden md:block w-28 shrink-0 text-right">
//           <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Min Sale</div>
//           <div className="text-[13px] font-semibold text-[var(--accent-green)]">{formatPKR(item.min_sale_price)}</div>
//         </div>

//         {/* Col 5: Date (large desktop) */}
//         <div className="hidden lg:block w-24 shrink-0">
//           <div className="text-[11px] text-[var(--text-muted)] truncate">{formatDate(item.created_at)}</div>
//         </div>

//         {/* Col 6: Actions */}
//         <div className="flex items-center gap-1 shrink-0 flex-wrap">
//           <button className="btn-xs btn-xs-green" onClick={() => onSell(item)}>
//             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
//               <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
//             </svg>
//             Sell
//           </button>
//           <Link href={`/inventory/${item.id}/edit`} className="btn-xs no-underline">
//             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
//               <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
//             </svg>
//             Edit
//           </Link>
//           <button className="btn-xs btn-xs-amber" onClick={() => onReserve(item.id)}>
//             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
//             </svg>
//             Reserve
//           </button>
//             <button className="btn-xs btn-xs-red" onClick={() => onMarkDamaged(item.id)}>
//               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                 <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
//                 <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
//               </svg>
//               Damaged
//             </button>

//             <button className="btn-xs btn-xs-amber" onClick={() => onArchive(item.id)}>
//             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
//               <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
//             </svg>
//             Archive
//           </button>
          
//           <button className="btn-xs btn-xs-red" onClick={() => onDelete(item)} disabled={isDeleting}>
//             {isDeleting ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : (
//               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                 <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
//                 <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
//               </svg>
//             )}
//             Delete
//           </button>
//           {hasExtras && (
//             <button className="btn-details" onClick={() => setOpen(o => !o)}>
//               {open ? '\u25B2' : '\u25BC'} {open ? 'Less' : 'More'}
//             </button>
//           )}
//         </div>
//       </div>

//       {/* Expandable details */}
//       {open && (
//         <div className="mx-0 mt-1 mb-1 px-4 py-3 rounded-lg text-[12px]"
//           style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mb-3">
//             {item.screen_size && (
//               <div><span className="text-[var(--text-muted)]">Screen: </span><span className="text-[var(--text-secondary)]">{item.screen_size}</span></div>
//             )}
//             {item.graphics_card && (
//               <div><span className="text-[var(--text-muted)]">GPU: </span><span className="text-[var(--text-secondary)]">{item.graphics_card}</span></div>
//             )}
//             {item.battery_health && (
//               <div><span className="text-[var(--text-muted)]">Battery: </span><span className="text-[var(--text-secondary)]">{item.battery_health}</span></div>
//             )}
//             {item.ram_speed && (
//               <div><span className="text-[var(--text-muted)]">RAM Speed: </span><span className="text-[var(--text-secondary)]">{item.ram_speed}</span></div>
//             )}
//             {item.ssd_name && (
//               <div><span className="text-[var(--text-muted)]">SSD: </span><span className="text-[var(--text-secondary)]">{item.ssd_name}</span></div>
//             )}
//             {item.purchase_id && (
//               <div><span className="text-[var(--text-muted)]">Purchase ID: </span><span className="text-[var(--text-secondary)]">{item.purchase_id}</span></div>
//             )}
//             <div><span className="text-[var(--text-muted)]">Added: </span><span className="text-[var(--text-secondary)]">{formatDate(item.created_at)}</span></div>
//             {item.updated_at && (
//               <div><span className="text-[var(--text-muted)]">Edited: </span><span className="text-[var(--text-secondary)]">{formatDate(item.updated_at)}</span></div>
//             )}
//             {item.created_by && (
//               <div><span className="text-[var(--text-muted)]">Created by: </span><span className="text-[var(--text-secondary)]">{item.created_by}</span></div>
//             )}
//           </div>

//           {item.notes && (
//             <div className="px-3 py-2 rounded-md text-[11px] text-[var(--text-muted)] mb-3"
//               style={{ background: 'var(--bg-card)' }}>
//               {item.notes}
//             </div>
//           )}

//           {item.specifications && Object.keys(item.specifications).length > 0 && (
//             <div className="flex flex-wrap gap-1.5 mb-3">
//               {Object.entries(item.specifications).map(([key, value]) => (
//                 <span key={key} className="px-2 py-0.5 rounded text-[11px] text-[var(--text-muted)]"
//                   style={{ background: 'var(--bg-card)' }}>
//                   {key}: {String(value)}
//                 </span>
//               ))}
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   )
// }