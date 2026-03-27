import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

export async function POST(request) {
  try {
    // 1. Verify authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      inventory_item_id,
      sale_price,
      sold_by,
      agent_commission_pct = 0,
      liabilities_to_deduct = [],
      expenses_to_deduct = [],
      petty_cash_contribution = 3000,
      notes,
    } = body

    if (!inventory_item_id || sale_price == null || !sold_by) {
      return NextResponse.json(
        { error: 'Missing required fields: inventory_item_id, sale_price, and sold_by are required.' },
        { status: 400 }
      )
    }

    const salePriceNum = Number(sale_price)
    const commissionPct = Number(agent_commission_pct)
    const pettyCashNum = Number(petty_cash_contribution)

    if (salePriceNum <= 0) {
      return NextResponse.json({ error: 'sale_price must be greater than zero.' }, { status: 400 })
    }
    if (commissionPct < 0 || commissionPct > 100) {
      return NextResponse.json({ error: 'agent_commission_pct must be between 0 and 100.' }, { status: 400 })
    }
    if (pettyCashNum < 0) {
      return NextResponse.json({ error: 'petty_cash_contribution cannot be negative.' }, { status: 400 })
    }

    const supabase = createClient()

    // 2. Fetch inventory item and validate status
    const { data: item, error: itemError } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', inventory_item_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Inventory item not found.' }, { status: 404 })
    }

    if (item.status !== 'in_stock') {
      return NextResponse.json(
        { error: `Item is not available for sale. Current status: ${item.status}` },
        { status: 400 }
      )
    }

    // 3. Build item_description
    const itemCategory = item.category || 'Uncategorized'
    let itemDescription
    if (itemCategory.toLowerCase() === 'laptop' || itemCategory.toLowerCase() === 'laptops') {
      itemDescription = `${item.company || ''} ${item.model || ''}`.trim()
    } else {
      itemDescription = item.item_name || itemCategory
    }

    // 4. Compute P&L waterfall
    const costPrice = Number(item.cost_price) || 0
    const grossProfit = salePriceNum - costPrice

    const normalizeLiabilityEntries = Array.isArray(liabilities_to_deduct)
      ? liabilities_to_deduct
          .map((entry) => {
            if (typeof entry === 'string') {
              return { liability_id: entry, amount: null }
            }
            if (!entry || typeof entry !== 'object') {
              return null
            }
            const amount = entry.amount == null ? null : Number(entry.amount)
            return {
              liability_id: entry.liability_id || entry.id,
              amount: Number.isFinite(amount) && amount > 0 ? amount : null,
            }
          })
          .filter((entry) => entry?.liability_id)
      : []

    const normalizeExpenseEntries = Array.isArray(expenses_to_deduct)
      ? expenses_to_deduct
          .map((entry) => {
            if (typeof entry === 'string') {
              return { expense_id: entry, amount: null }
            }
            if (!entry || typeof entry !== 'object') {
              return null
            }
            const amount = entry.amount == null ? null : Number(entry.amount)
            return {
              expense_id: entry.expense_id || entry.id,
              amount: Number.isFinite(amount) && amount > 0 ? amount : null,
            }
          })
          .filter((entry) => entry?.expense_id)
      : []

    const liabilityIds = [...new Set(normalizeLiabilityEntries.map((entry) => entry.liability_id))]
    const expenseIds = [...new Set(normalizeExpenseEntries.map((entry) => entry.expense_id))]

    let finalizedLiabilityDeductions = []
    if (liabilityIds.length > 0) {
      const { data: liabilitiesData, error: liabilitiesFetchError } = await supabase
        .from('liabilities')
        .select('id, description, remaining_amount, status')
        .in('id', liabilityIds)

      if (liabilitiesFetchError) {
        console.error('Liabilities fetch error:', liabilitiesFetchError)
        return NextResponse.json({ error: 'Failed to validate liabilities.' }, { status: 500 })
      }

      const liabilitiesMap = new Map((liabilitiesData || []).map((row) => [row.id, row]))
      finalizedLiabilityDeductions = normalizeLiabilityEntries
        .map((entry) => {
          const liability = liabilitiesMap.get(entry.liability_id)
          if (!liability || liability.status === 'cleared') return null

          const remaining = Number(liability.remaining_amount) || 0
          if (remaining <= 0) return null

          const requested = entry.amount == null ? remaining : entry.amount
          const amount = Math.min(requested, remaining)
          if (amount <= 0) return null

          return {
            liability_id: liability.id,
            description: liability.description,
            amount,
            remaining_before: remaining,
          }
        })
        .filter(Boolean)
    }

    let finalizedExpenseDeductions = []
    if (expenseIds.length > 0) {
      const { data: expensesData, error: expensesFetchError } = await supabase
        .from('expenses')
        .select('id, description, amount, status')
        .in('id', expenseIds)

      if (expensesFetchError) {
        console.error('Expenses fetch error:', expensesFetchError)
        return NextResponse.json({ error: 'Failed to validate expenses.' }, { status: 500 })
      }

      const expensesMap = new Map((expensesData || []).map((row) => [row.id, row]))
      finalizedExpenseDeductions = normalizeExpenseEntries
        .map((entry) => {
          const expense = expensesMap.get(entry.expense_id)
          if (!expense || expense.status !== 'pending') return null

          const totalAmount = Number(expense.amount) || 0
          if (totalAmount <= 0) return null

          const requested = entry.amount == null ? totalAmount : entry.amount
          const amount = Math.min(requested, totalAmount)
          if (amount <= 0) return null

          return {
            expense_id: expense.id,
            description: expense.description,
            amount,
          }
        })
        .filter(Boolean)
    }

    const totalLiabilitiesDeducted = finalizedLiabilityDeductions.reduce((sum, row) => sum + row.amount, 0)
    const totalExpensesDeducted = finalizedExpenseDeductions.reduce((sum, row) => sum + row.amount, 0)

    const agentCommission = (commissionPct / 100) * Math.max(grossProfit, 0)
    const availableProfitBeforePetty = Math.max(grossProfit - agentCommission, 0)
    const committedFromProfit = totalLiabilitiesDeducted + totalExpensesDeducted + pettyCashNum

    if (committedFromProfit > availableProfitBeforePetty) {
      return NextResponse.json(
        {
          error: `Selected deductions plus petty cash (${committedFromProfit.toFixed(2)}) exceed available profit (${availableProfitBeforePetty.toFixed(2)}).`,
        },
        { status: 400 }
      )
    }

    const netProfit = grossProfit - totalLiabilitiesDeducted - totalExpensesDeducted - agentCommission - pettyCashNum

    // 5. Insert sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        inventory_item_id,
        item_category: itemCategory,
        item_description: itemDescription,
        sale_price: salePriceNum,
        cost_price: costPrice,
        gross_profit: grossProfit,
        liabilities_deducted: totalLiabilitiesDeducted,
        expenses_deducted: totalExpensesDeducted,
        agent_commission: agentCommission,
        petty_cash_contribution: pettyCashNum,
        net_profit: netProfit,
        sold_by,
        agent_commission_pct: commissionPct,
        sale_date: new Date().toISOString(),
        profit_distributed: false,
        profit_cleared: false,
        notes: notes || null,
      })
      .select()
      .single()

    if (saleError) {
      console.error('Sale insert error:', saleError)
      return NextResponse.json({ error: 'Failed to record sale.' }, { status: 500 })
    }

    // 6. Update inventory item status to 'sold'
    const { error: inventoryUpdateError } = await supabase
      .from('inventory')
      .update({ status: 'sold', updated_at: new Date().toISOString() })
      .eq('id', inventory_item_id)

    if (inventoryUpdateError) {
      console.error('Inventory update error:', inventoryUpdateError)
      return NextResponse.json(
        { error: 'Sale recorded but failed to update inventory status.' },
        { status: 500 }
      )
    }

    // 7. Fetch current enterprise_capital (singleton row)
    const { data: capital, error: capitalError } = await supabase
      .from('enterprise_capital')
      .select('*')
      .limit(1)
      .single()

    if (capitalError || !capital) {
      console.error('Enterprise capital fetch error:', capitalError)
      return NextResponse.json(
        { error: 'Failed to fetch enterprise capital.' },
        { status: 500 }
      )
    }

    // 8. Compute updated capital values
    let liquidAssets = Number(capital.liquid_assets) || 0
    let pettyCash = Number(capital.petty_cash) || 0

    // Reimburse cost portion to liquid assets.
    const costReimbursement = Math.min(salePriceNum, costPrice)
    liquidAssets += costReimbursement
    pettyCash += pettyCashNum

    // 9. Process each liability to deduct
    for (const liabilityEntry of finalizedLiabilityDeductions) {
      const { liability_id, amount: deductionAmount, remaining_before } = liabilityEntry

      const newRemaining = Math.max(remaining_before - deductionAmount, 0)
      const newStatus = newRemaining <= 0 ? 'cleared' : 'partial'
      const updatePayload = {
        remaining_amount: newRemaining,
        status: newStatus,
        settled_from: 'profit',
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'cleared') {
        updatePayload.cleared_at = new Date().toISOString()
      }

      await supabase
        .from('liabilities')
        .update(updatePayload)
        .eq('id', liability_id)
    }

    // 10. Process each expense to deduct
    for (const expenseEntry of finalizedExpenseDeductions) {
      const { expense_id, amount: deductionAmount } = expenseEntry

      // Update expense record
      await supabase
        .from('expenses')
        .update({
          status: 'deducted_from_profit',
          sale_id: sale.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expense_id)
    }

    // 11. Insert capital ledger entries
    await supabase.from('capital_ledger').insert({
      transaction_type: 'cost_reimbursement',
      amount: costReimbursement,
      balance_after: liquidAssets,
      petty_cash_after: pettyCash,
      reference_type: 'sale',
      reference_id: sale.id,
      description: `Cost reimbursement from sale: ${itemDescription}`,
      created_by: session.email || sold_by,
    })

    if (pettyCashNum > 0) {
      await supabase.from('capital_ledger').insert({
        transaction_type: 'adjustment',
        amount: pettyCashNum,
        balance_after: liquidAssets,
        petty_cash_after: pettyCash,
        reference_type: 'sale',
        reference_id: sale.id,
        description: `Petty cash reserved from sale profit ${sale.id}`,
        created_by: session.email || sold_by,
      })
    }

    // 12. Create profit distributions
    const { data: distributionRules, error: rulesError } = await supabase
      .from('profit_distribution_rules')
      .select('id, investor_id, profit_percentage, investors(id, name)')
      .eq('is_active', true)

    let profitDistributed = false

    if (!rulesError && distributionRules && distributionRules.length > 0 && netProfit > 0) {
      const distributions = distributionRules.map((rule) => ({
        sale_id: sale.id,
        investor_id: rule.investor_id,
        amount: netProfit * (Number(rule.profit_percentage) / 100),
        percentage_applied: Number(rule.profit_percentage),
        status: 'locked',
      }))

      const { error: distInsertError } = await supabase
        .from('profit_distributions')
        .insert(distributions)

      if (distInsertError) {
        console.error('Profit distribution insert error:', distInsertError)
      } else {
        profitDistributed = true

        // Mark sale as profit_distributed
        await supabase
          .from('sales')
          .update({ profit_distributed: true })
          .eq('id', sale.id)
      }
    }

    // 13. Final enterprise_capital update
    const { error: capitalUpdateError } = await supabase
      .from('enterprise_capital')
      .update({
        liquid_assets: liquidAssets,
        petty_cash: pettyCash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', capital.id)

    if (capitalUpdateError) {
      console.error('Enterprise capital update error:', capitalUpdateError)
      return NextResponse.json(
        { error: 'Sale recorded but failed to update enterprise capital.' },
        { status: 500 }
      )
    }

    // 14. Return success with sale details
    return NextResponse.json({
      success: true,
      sale: {
        id: sale.id,
        inventory_item_id,
        item_description: itemDescription,
        item_category: itemCategory,
        sale_price: salePriceNum,
        cost_price: costPrice,
        gross_profit: grossProfit,
        liabilities_deducted: totalLiabilitiesDeducted,
        expenses_deducted: totalExpensesDeducted,
        agent_commission: agentCommission,
        petty_cash_contribution: pettyCashNum,
        net_profit: netProfit,
        sold_by,
        profit_distributed: profitDistributed,
        profit_cleared: false,
        sale_date: sale.sale_date,
      },
      capital: {
        liquid_assets: liquidAssets,
        petty_cash: pettyCash,
      },
    })
  } catch (err) {
    console.error('Sell API error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
