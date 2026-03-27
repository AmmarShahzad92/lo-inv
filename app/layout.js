import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from '@/lib/AppContext'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Laptops Officials — ERP",
  description: "Internal inventory & finance management for Laptops Officials",
};

export default async function RootLayout({ children }) {
  let initial = {}
  try {
    const user = await getSession()
    if (user) {
      const supabase = createClient()
      const [
        { data: inventory },
        { data: sales },
        { data: partners },
        { data: offers },
        { data: processors },
        { data: laptopModels },
        { data: investors },
        { data: purchases },
        { data: liabilities },
        { data: expenses },
        { data: enterpriseCapital },
        { data: capitalLedger },
        { data: profitDistributions },
        { data: withdrawalRequests },
      ] = await Promise.all([
        supabase.from('inventory').select('*').eq('status', 'in_stock').order('created_at', { ascending: false }),
        supabase.from('sales').select('*').order('sale_date', { ascending: false }),
        supabase.from('users').select('email,display_name,is_admin').not('password_hash', 'is', null),
        supabase.from('vendor_offers').select('*').order('created_at', { ascending: false }),
        supabase.from('processors').select('*').order('brand').order('release_year'),
        supabase.from('laptop_models').select('*').order('company').order('model_name'),
        supabase.from('investors').select('*').order('created_at', { ascending: false }),
        supabase.from('purchases').select('*').order('purchase_date', { ascending: false }),
        supabase.from('liabilities').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('enterprise_capital').select('*').limit(1).single(),
        supabase.from('capital_ledger').select('*').order('created_at', { ascending: false }),
        supabase.from('profit_distributions').select('*').order('created_at', { ascending: false }),
        supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }),
      ])
      initial = {
        inventory:            inventory            || [],
        sales:                sales                || [],
        partners:             partners             || [],
        offers:               offers               || [],
        processors:           processors           || [],
        laptopModels:         laptopModels         || [],
        investors:            investors            || [],
        purchases:            purchases            || [],
        liabilities:          liabilities          || [],
        expenses:             expenses             || [],
        enterpriseCapital:    enterpriseCapital     || null,
        capitalLedger:        capitalLedger        || [],
        profitDistributions:  profitDistributions  || [],
        withdrawalRequests:   withdrawalRequests   || [],
      }
    }
  } catch {
    // Not logged in or session error — initial stays empty, pages handle auth redirect
  }

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppProvider initial={initial}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
