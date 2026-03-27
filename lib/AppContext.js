'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const AppContext = createContext(null)

export function AppProvider({ children, initial = {} }) {
  const [inventory,            setInventory]            = useState(initial.inventory            || [])
  const [sales,                setSales]                = useState(initial.sales                || [])
  const [partners,             setPartners]             = useState(initial.partners             || [])
  const [offers,               setOffers]               = useState(initial.offers               || [])
  const [processors,           setProcessors]           = useState(initial.processors           || [])
  const [laptopModels,         setLaptopModels]         = useState(initial.laptopModels         || [])
  const [investors,            setInvestors]            = useState(initial.investors            || [])
  const [purchases,            setPurchases]            = useState(initial.purchases            || [])
  const [liabilities,          setLiabilities]          = useState(initial.liabilities          || [])
  const [expenses,             setExpenses]             = useState(initial.expenses             || [])
  const [enterpriseCapital,    setEnterpriseCapital]    = useState(initial.enterpriseCapital    || null)
  const [capitalLedger,        setCapitalLedger]        = useState(initial.capitalLedger        || [])
  const [profitDistributions,  setProfitDistributions]  = useState(initial.profitDistributions  || [])
  const [withdrawalRequests,   setWithdrawalRequests]   = useState(initial.withdrawalRequests   || [])

  const supabase = createClient()

  useEffect(() => {
    const channels = [
      supabase.channel('ctx-inventory')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
          supabase.from('inventory').select('*').eq('status', 'in_stock').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setInventory(data) })
        }).subscribe(),

      supabase.channel('ctx-sales')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
          supabase.from('sales').select('*').order('sale_date', { ascending: false })
            .then(({ data }) => { if (data) setSales(data) })
        }).subscribe(),

      supabase.channel('ctx-offers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_offers' }, () => {
          supabase.from('vendor_offers').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setOffers(data) })
        }).subscribe(),

      supabase.channel('ctx-procs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'processors' }, () => {
          supabase.from('processors').select('*').order('brand').order('release_year')
            .then(({ data }) => { if (data) setProcessors(data) })
        }).subscribe(),

      supabase.channel('ctx-lm')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'laptop_models' }, () => {
          supabase.from('laptop_models').select('*').order('company').order('model_name')
            .then(({ data }) => { if (data) setLaptopModels(data) })
        }).subscribe(),

      supabase.channel('ctx-investors')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'investors' }, () => {
          supabase.from('investors').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setInvestors(data) })
        }).subscribe(),

      supabase.channel('ctx-purchases')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => {
          supabase.from('purchases').select('*').order('purchase_date', { ascending: false })
            .then(({ data }) => { if (data) setPurchases(data) })
        }).subscribe(),

      supabase.channel('ctx-liabilities')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'liabilities' }, () => {
          supabase.from('liabilities').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setLiabilities(data) })
        }).subscribe(),

      supabase.channel('ctx-expenses')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
          supabase.from('expenses').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setExpenses(data) })
        }).subscribe(),

      supabase.channel('ctx-ec')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_capital' }, () => {
          supabase.from('enterprise_capital').select('*').limit(1).single()
            .then(({ data }) => { if (data) setEnterpriseCapital(data) })
        }).subscribe(),

      supabase.channel('ctx-ledger')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'capital_ledger' }, () => {
          supabase.from('capital_ledger').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setCapitalLedger(data) })
        }).subscribe(),

      supabase.channel('ctx-profit-dist')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profit_distributions' }, () => {
          supabase.from('profit_distributions').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setProfitDistributions(data) })
        }).subscribe(),

      supabase.channel('ctx-withdrawals')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, () => {
          supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setWithdrawalRequests(data) })
        }).subscribe(),
    ]
    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppContext.Provider value={{
      inventory,            setInventory,
      sales,                setSales,
      partners,             setPartners,
      offers,               setOffers,
      processors,           setProcessors,
      laptopModels,         setLaptopModels,
      investors,            setInvestors,
      purchases,            setPurchases,
      liabilities,          setLiabilities,
      expenses,             setExpenses,
      enterpriseCapital,    setEnterpriseCapital,
      capitalLedger,        setCapitalLedger,
      profitDistributions,  setProfitDistributions,
      withdrawalRequests,   setWithdrawalRequests,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
