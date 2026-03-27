import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const body = await request.json()
    const saleId = body?.sale_id

    if (!saleId) {
      return NextResponse.json({ error: 'sale_id is required.' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      return NextResponse.json({ error: 'Sale not found.' }, { status: 404 })
    }

    if (sale.profit_cleared) {
      return NextResponse.json({ error: 'Sale profit is already settled.' }, { status: 400 })
    }

    const settleAmount = Math.max(Number(sale.net_profit) || 0, 0)

    const { data: capital, error: capitalFetchError } = await supabase
      .from('enterprise_capital')
      .select('*')
      .limit(1)
      .single()

    if (capitalFetchError || !capital) {
      return NextResponse.json({ error: 'Failed to fetch enterprise capital.' }, { status: 500 })
    }

    const liquidAssets = Number(capital.liquid_assets) || 0
    const pettyCash = Number(capital.petty_cash) || 0
    const updatedLiquid = liquidAssets + settleAmount

    const { error: capitalUpdateError } = await supabase
      .from('enterprise_capital')
      .update({
        liquid_assets: updatedLiquid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', capital.id)

    if (capitalUpdateError) {
      return NextResponse.json({ error: 'Failed to update enterprise capital.' }, { status: 500 })
    }

    const { error: saleUpdateError } = await supabase
      .from('sales')
      .update({
        profit_cleared: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sale.id)

    if (saleUpdateError) {
      return NextResponse.json({ error: 'Failed to update sale settlement status.' }, { status: 500 })
    }

    await supabase.from('capital_ledger').insert({
      transaction_type: 'adjustment',
      amount: settleAmount,
      balance_after: updatedLiquid,
      petty_cash_after: pettyCash,
      reference_type: 'sale',
      reference_id: sale.id,
      description: `Settled net profit from sale ${sale.id}`,
      created_by: session.email || sale.sold_by || 'system',
    })

    return NextResponse.json({
      success: true,
      sale_id: sale.id,
      settled_amount: settleAmount,
      liquid_assets: updatedLiquid,
      petty_cash: pettyCash,
    })
  } catch (error) {
    console.error('Settle sale API error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
