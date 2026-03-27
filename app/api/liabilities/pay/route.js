import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

async function deductFromUnsettledProfitPool(supabase, amount, fieldName) {
  let remaining = amount

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, net_profit, profit_cleared, liabilities_deducted, expenses_deducted')
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

    const updatePayload = {
      net_profit: newNet,
      profit_cleared: newNet <= 0,
      updated_at: new Date().toISOString(),
    }

    if (fieldName === 'liabilities_deducted') {
      updatePayload.liabilities_deducted = num(sale.liabilities_deducted) + take
    }
    if (fieldName === 'expenses_deducted') {
      updatePayload.expenses_deducted = num(sale.expenses_deducted) + take
    }

    const { error: saleUpdateError } = await supabase
      .from('sales')
      .update(updatePayload)
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

async function deductFromSingleSale(supabase, amount, saleId, fieldName) {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('id, net_profit, profit_cleared, liabilities_deducted, expenses_deducted')
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
  const updatePayload = {
    net_profit: newNet,
    profit_cleared: newNet <= 0,
    updated_at: new Date().toISOString(),
  }

  if (fieldName === 'liabilities_deducted') {
    updatePayload.liabilities_deducted = num(sale.liabilities_deducted) + amount
  }
  if (fieldName === 'expenses_deducted') {
    updatePayload.expenses_deducted = num(sale.expenses_deducted) + amount
  }

  const { error: saleUpdateError } = await supabase
    .from('sales')
    .update(updatePayload)
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
    const liabilityId = body?.liability_id
    const source = body?.source || 'net_unsettled_profit'
    const selectedSaleId = body?.sale_id || null
    const amount = num(body?.amount)

    if (!liabilityId) {
      return NextResponse.json({ error: 'liability_id is required.' }, { status: 400 })
    }
    if (!['net_unsettled_profit', 'individual_unsettled_sale'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source.' }, { status: 400 })
    }
    if (source === 'individual_unsettled_sale' && !selectedSaleId) {
      return NextResponse.json({ error: 'sale_id is required for individual unsettled sale source.' }, { status: 400 })
    }
    if (amount <= 0) {
      return NextResponse.json({ error: 'amount must be greater than zero.' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: liability, error: liabilityError } = await supabase
      .from('liabilities')
      .select('*')
      .eq('id', liabilityId)
      .single()

    if (liabilityError || !liability) {
      return NextResponse.json({ error: 'Liability not found.' }, { status: 404 })
    }

    if (liability.status === 'cleared') {
      return NextResponse.json({ error: 'Liability is already cleared.' }, { status: 400 })
    }

    const currentRemaining = num(liability.remaining_amount)
    const paymentAmount = Math.min(amount, currentRemaining)

    if (paymentAmount <= 0) {
      return NextResponse.json({ error: 'Nothing to pay for this liability.' }, { status: 400 })
    }

    const nextRemaining = Math.max(currentRemaining - paymentAmount, 0)
    const nextStatus = nextRemaining <= 0 ? 'cleared' : 'partial'

    const deduction = source === 'individual_unsettled_sale'
      ? await deductFromSingleSale(supabase, paymentAmount, selectedSaleId, 'liabilities_deducted')
      : await deductFromUnsettledProfitPool(supabase, paymentAmount, 'liabilities_deducted')

    const liabilityUpdate = {
      remaining_amount: nextRemaining,
      status: nextStatus,
      settled_from: 'profit',
      updated_at: new Date().toISOString(),
    }
    if (nextStatus === 'cleared') {
      liabilityUpdate.cleared_at = new Date().toISOString()
    }

    const { error: updateLiabilityError } = await supabase
      .from('liabilities')
      .update(liabilityUpdate)
      .eq('id', liabilityId)

    if (updateLiabilityError) {
      throw new Error('Failed to update liability.')
    }

    const { data: capital } = await supabase
      .from('enterprise_capital')
      .select('*')
      .limit(1)
      .single()

    await supabase.from('capital_ledger').insert({
      transaction_type: 'liability_payment',
      amount: -paymentAmount,
      balance_after: num(capital?.liquid_assets),
      petty_cash_after: num(capital?.petty_cash),
      reference_type: 'liability',
      reference_id: liabilityId,
      description: source === 'individual_unsettled_sale'
        ? `Liability paid from selected unsettled sale ${selectedSaleId}: ${liability.description || liabilityId}`
        : `Liability paid from net unsettled profit pool: ${liability.description || liabilityId}`,
      created_by: session.email || 'system',
    })

    return NextResponse.json({
      success: true,
      liability_id: liabilityId,
      paid_amount: paymentAmount,
      remaining_amount: nextRemaining,
      status: nextStatus,
      source,
      deduction,
    })
  } catch (error) {
    console.error('Liability pay API error:', error)
    return NextResponse.json({ error: error.message || 'Something went wrong.' }, { status: 500 })
  }
}
