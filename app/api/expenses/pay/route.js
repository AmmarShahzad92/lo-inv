import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

async function deductFromUnsettledProfitPool(supabase, amount) {
  let remaining = amount

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, net_profit, profit_cleared, expenses_deducted')
    .eq('profit_cleared', false)
    .order('net_profit', { ascending: true })
    .order('sale_date', { ascending: true })

  if (salesError) {
    throw new Error('Failed to fetch unsettled sales.')
  }

  const pool = (sales || []).filter((sale) => num(sale.net_profit) > 0)
  const totalAvailable = pool.reduce((sum, sale) => sum + num(sale.net_profit), 0)

  if (remaining > totalAvailable) {
    throw new Error('Insufficient unsettled profit for this payment.')
  }

  const touched = []

  for (const sale of pool) {
    if (remaining <= 0) break

    const available = num(sale.net_profit)
    const take = Math.min(available, remaining)
    const newNet = available - take

    const { error: saleUpdateError } = await supabase
      .from('sales')
      .update({
        net_profit: newNet,
        expenses_deducted: num(sale.expenses_deducted) + take,
        profit_cleared: newNet <= 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sale.id)

    if (saleUpdateError) {
      throw new Error('Failed to apply unsettled-profit deduction.')
    }

    touched.push({ sale_id: sale.id, deducted: take, net_profit_after: newNet })
    remaining -= take
  }

  return {
    deducted: amount,
    touched_sales: touched,
  }
}

async function deductFromSingleSale(supabase, amount, saleId) {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('id, net_profit, profit_cleared, expenses_deducted')
    .eq('id', saleId)
    .single()

  if (saleError || !sale) {
    throw new Error('Selected sale was not found.')
  }

  const available = num(sale.net_profit)
  if (sale.profit_cleared || available <= 0) {
    throw new Error('Selected sale has no unsettled profit available.')
  }
  if (amount > available) {
    throw new Error('Selected sale does not have enough unsettled profit.')
  }

  const newNet = available - amount

  const { error: saleUpdateError } = await supabase
    .from('sales')
    .update({
      net_profit: newNet,
      expenses_deducted: num(sale.expenses_deducted) + amount,
      profit_cleared: newNet <= 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sale.id)

  if (saleUpdateError) {
    throw new Error('Failed to apply selected-sale deduction.')
  }

  return {
    deducted: amount,
    touched_sales: [{ sale_id: sale.id, deducted: amount, net_profit_after: newNet }],
  }
}

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const body = await request.json()
    const expenseId = body?.expense_id
    const source = body?.source
    const selectedSaleId = body?.sale_id || null

    if (!expenseId) {
      return NextResponse.json({ error: 'expense_id is required.' }, { status: 400 })
    }
    if (!['petty_cash', 'net_unsettled_profit', 'individual_unsettled_sale'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source.' }, { status: 400 })
    }
    if (source === 'individual_unsettled_sale' && !selectedSaleId) {
      return NextResponse.json({ error: 'sale_id is required for individual unsettled sale source.' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single()

    if (expenseError || !expense) {
      return NextResponse.json({ error: 'Expense not found.' }, { status: 404 })
    }

    if (expense.status !== 'pending') {
      return NextResponse.json({ error: 'Expense is already settled.' }, { status: 400 })
    }

    const amount = num(expense.amount)
    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid expense amount.' }, { status: 400 })
    }

    const { data: capital, error: capitalFetchError } = await supabase
      .from('enterprise_capital')
      .select('*')
      .limit(1)
      .single()

    if (capitalFetchError || !capital) {
      return NextResponse.json({ error: 'Failed to load enterprise capital.' }, { status: 500 })
    }

    let deduction = null
    let updatedLiquid = num(capital.liquid_assets)
    let updatedPetty = num(capital.petty_cash)
    let saleIdForExpense = null

    if (source === 'petty_cash') {
      if (amount > updatedPetty) {
        return NextResponse.json({ error: 'Insufficient petty cash balance.' }, { status: 400 })
      }

      updatedPetty -= amount

      const { error: capitalUpdateError } = await supabase
        .from('enterprise_capital')
        .update({ petty_cash: updatedPetty, updated_at: new Date().toISOString() })
        .eq('id', capital.id)

      if (capitalUpdateError) {
        throw new Error('Failed to update petty cash.')
      }

      await supabase.from('capital_ledger').insert({
        transaction_type: 'expense_payment',
        amount: -amount,
        balance_after: updatedLiquid,
        petty_cash_after: updatedPetty,
        reference_type: 'expense',
        reference_id: expense.id,
        description: `Expense paid from petty cash: ${expense.description || expense.id}`,
        created_by: session.email || 'system',
      })
    }

    if (source === 'net_unsettled_profit') {
      deduction = await deductFromUnsettledProfitPool(supabase, amount)
      saleIdForExpense = deduction.touched_sales[0]?.sale_id || null

      await supabase.from('capital_ledger').insert({
        transaction_type: 'expense_payment',
        amount: -amount,
        balance_after: updatedLiquid,
        petty_cash_after: updatedPetty,
        reference_type: 'expense',
        reference_id: expense.id,
        description: `Expense paid from net unsettled profit pool: ${expense.description || expense.id}`,
        created_by: session.email || 'system',
      })
    }

    if (source === 'individual_unsettled_sale') {
      deduction = await deductFromSingleSale(supabase, amount, selectedSaleId)
      saleIdForExpense = selectedSaleId

      await supabase.from('capital_ledger').insert({
        transaction_type: 'expense_payment',
        amount: -amount,
        balance_after: updatedLiquid,
        petty_cash_after: updatedPetty,
        reference_type: 'expense',
        reference_id: expense.id,
        description: `Expense paid from selected unsettled sale ${selectedSaleId}: ${expense.description || expense.id}`,
        created_by: session.email || 'system',
      })
    }

    const { error: expenseUpdateError } = await supabase
      .from('expenses')
      .update({
        status: source === 'petty_cash' ? 'deducted_from_petty_cash' : 'deducted_from_profit',
        sale_id: saleIdForExpense,
        updated_at: new Date().toISOString(),
      })
      .eq('id', expense.id)

    if (expenseUpdateError) {
      throw new Error('Failed to update expense status.')
    }

    return NextResponse.json({
      success: true,
      expense_id: expense.id,
      amount,
      source,
      liquid_assets: updatedLiquid,
      petty_cash: updatedPetty,
      deduction,
    })
  } catch (error) {
    console.error('Expense pay API error:', error)
    return NextResponse.json({ error: error.message || 'Something went wrong.' }, { status: 500 })
  }
}
