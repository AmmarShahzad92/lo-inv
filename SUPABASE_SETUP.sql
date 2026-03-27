-- ============================================================
-- LAPTOPS OFFICIALS — SUPABASE DATABASE SETUP (v3 — Full ERP)
-- Run this entire script in your Supabase SQL Editor
-- ============================================================
--
-- Authentication: app-level (bcrypt + JWT session cookies).
-- Currency: PKR (Pakistani Rupees) throughout.
--
-- TABLE MAP:
--   1.  users                    — app-level auth & access control
--   2.  investors                — capital contributors & their stakes
--   3.  profit_distribution_rules— per-investor profit split percentages
--   4.  inventory                — all stock items (laptops, RAM, SSD, chargers, etc.)
--   5.  purchases                — purchase orders (one purchase → many inventory items)
--   6.  liabilities              — debts / pending payments
--   7.  expenses                 — purchase-related or general operating expenses
--   8.  sales                    — every sale transaction with full P&L breakdown
--   9.  enterprise_capital       — singleton row: liquid cash + petty cash
--  10.  capital_ledger           — immutable ledger of every capital movement
--  11.  profit_distributions     — per-sale, per-investor profit allocation
--  12.  withdrawal_requests      — investor withdrawal workflow with admin approval
--  13.  vendor_offers            — market price intel from vendors
--  14.  processors               — knowledge base: CPU specs
--  15.  laptop_models            — knowledge base: laptop model specs
--  16.  deleted_items            — soft-delete audit trail
-- ============================================================


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  1. USERS                                                ║
-- ║  App-level auth. password_hash = NULL → pre-approved     ║
-- ║  but not yet registered.                                 ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT           UNIQUE NOT NULL,
  password_hash TEXT,
  display_name  TEXT,
  is_admin      BOOLEAN        NOT NULL DEFAULT false,
  added_by      TEXT           NOT NULL DEFAULT 'system',
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Seed the primary admin
INSERT INTO public.users (email, is_admin, added_by)
VALUES ('aabdullahmian@gmail.com', true, 'system')
ON CONFLICT (email) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  2. INVESTORS                                             ║
-- ║  Capital contributors. investment_amount = total capital  ║
-- ║  invested over time. profit_balance = earned but not yet  ║
-- ║  withdrawn profit (virtual claim on liquid assets).       ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.investors (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT           NOT NULL,
  email               TEXT           UNIQUE,
  phone               TEXT,
  investment_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,     -- total capital contributed (PKR)
  profit_balance      NUMERIC(15,2) NOT NULL DEFAULT 0,     -- earned profit not yet withdrawn (PKR)
  is_active           BOOLEAN        NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);



-- ╔═══════════════════════════════════════════════════════════╗
-- ║  3. PROFIT DISTRIBUTION RULES                            ║
-- ║  Defines what percentage of net profit each investor     ║
-- ║  receives. Admin can alter these at any time before a    ║
-- ║  sale is recorded.                                       ║
-- ║  NOTE: A sales_agent row lets a salesperson earn a       ║
-- ║  commission % on specific sales they close.              ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE OR REPLACE IF NOT EXISTS public.profit_distribution_rules (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id         UUID           NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  profit_percentage   NUMERIC(5,2)   NOT NULL CHECK (profit_percentage >= 0 AND profit_percentage <= 100),
  is_active           BOOLEAN        NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);

-- Ensure one active rule per investor (latest wins)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_rule_per_investor
  ON public.profit_distribution_rules (investor_id)
  WHERE is_active = true;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  4. PURCHASES                                            ║
-- ║  Each purchase order. One purchase can add multiple       ║
-- ║  inventory items. Any unpaid balance auto-creates a       ║
-- ║  liability (handled at app layer).                       ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.purchases (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name       TEXT,
  total_amount        NUMERIC(15,2) NOT NULL,                 -- total cost of this purchase (PKR)
  amount_paid         NUMERIC(15,2) NOT NULL DEFAULT 0,       -- how much was paid upfront
  payment_status      TEXT           NOT NULL DEFAULT 'paid'
                      CHECK (payment_status IN ('paid','partial','pending')),
  notes               TEXT,
  purchase_date       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by          TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  5. INVENTORY                                            ║
-- ║  Unified stock table — laptops, RAM sticks, SSDs,        ║
-- ║  chargers, accessories, etc. Laptop-specific columns     ║
-- ║  are nullable; other items use item_name + specs JSONB.  ║
-- ║                                                          ║
-- ║  status flow: in_stock → sold / returned / damaged       ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.inventory (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ── Classification ──
  category            TEXT           NOT NULL DEFAULT 'laptop'
                      CHECK (category IN ('laptop','ram','ssd','charger','accessory','other')),
  item_name           TEXT,                                     -- non-laptop: "Kingston DDR4 8GB", "Dell 65W Charger"

  -- ── Shared financials ──
  cost_price          NUMERIC(15,2) NOT NULL,                   -- what we paid (PKR)
  min_sale_price      NUMERIC(15,2),                            -- advisory floor price (PKR)
  status              TEXT           NOT NULL DEFAULT 'in_stock'
                      CHECK (status IN ('in_stock','sold','returned','damaged','reserved')),

  -- ── Laptop-specific fields ──
  company             TEXT,                                     -- brand: Dell, HP, Lenovo …
  model               TEXT,                                     -- model name: Latitude 5430
  screen_size         TEXT,                                     -- e.g. "14.0"
  processor           TEXT,                                     -- e.g. "i7-1265U"
  ram_size            TEXT,                                     -- e.g. "16GB"
  ram_speed           TEXT,                                     -- e.g. "DDR4 3200MHz"
  ssd_name            TEXT,                                     -- e.g. "Samsung PM981a"
  ssd_size            TEXT,                                     -- e.g. "512GB"
  ssd_category        TEXT,                                     -- "NVMe", "SATA", "eMMC"
  graphics_card       TEXT,
  battery_health      TEXT,

  -- ── Flexible specs ──
  specifications      JSONB          DEFAULT '{}',              -- any extra key-value pairs

  -- ── Lineage ──
  purchase_id         UUID           REFERENCES public.purchases(id) ON DELETE SET NULL,
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  6. LIABILITIES                                          ║
-- ║  Debts / pending payments. Can be linked to a purchase   ║
-- ║  or stand-alone. Settled from profit or petty cash.      ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.liabilities (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  description         TEXT           NOT NULL,
  total_amount        NUMERIC(15,2) NOT NULL,                   -- original debt (PKR)
  remaining_amount    NUMERIC(15,2) NOT NULL,                   -- outstanding balance
  status              TEXT           NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','partial','cleared')),
  purchase_id         UUID           REFERENCES public.purchases(id) ON DELETE SET NULL,
  settled_from        TEXT           DEFAULT NULL
                      CHECK (settled_from IS NULL OR settled_from IN ('profit','petty_cash')),
  due_date            DATE,
  cleared_at          TIMESTAMPTZ,
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  7. EXPENSES                                             ║
-- ║  Operating costs. Can be linked to a specific purchase   ║
-- ║  (transport, fuel for pickup, etc.) or stand-alone.      ║
-- ║  Deducted from sale profit or petty cash.                ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.expenses (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  description         TEXT           NOT NULL,
  amount              NUMERIC(15,2) NOT NULL,                   -- PKR
  category            TEXT           DEFAULT 'general'
                      CHECK (category IN ('transport','fuel','repair','packaging','general','misc')),
  purchase_id         UUID           REFERENCES public.purchases(id) ON DELETE SET NULL,
  sale_id             UUID,                                     -- set when deducted from a sale's profit
  status              TEXT           NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','deducted_from_profit','deducted_from_petty_cash')),
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  8. SALES                                                ║
-- ║  Every sale with a complete P&L waterfall:               ║
-- ║                                                          ║
-- ║  sale_price                                              ║
-- ║  − cost_price (→ reimbursed to Enterprise Capital)       ║
-- ║  = gross_profit                                          ║
-- ║  − liabilities_deducted                                  ║
-- ║  − expenses_deducted                                     ║
-- ║  − agent_commission                                      ║
-- ║  − petty_cash_contribution (default 3000 PKR)            ║
-- ║  = net_profit (distributed to investors per rules)       ║
-- ║                                                          ║
-- ║  No restriction on sale_price — min_sale_price is        ║
-- ║  advisory only. Negative profit is allowed (loss).       ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.sales (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id       UUID           NOT NULL REFERENCES public.inventory(id),
  -- ── Snapshot at time of sale ──
  item_category           TEXT,                                  -- snapshot of inventory.category
  item_description        TEXT,                                  -- "Dell Latitude 5430" or "DDR4 8GB"
  -- ── Financials ──
  sale_price              NUMERIC(15,2) NOT NULL,
  cost_price              NUMERIC(15,2) NOT NULL,                -- snapshot from inventory
  gross_profit            NUMERIC(15,2) NOT NULL,                -- sale_price − cost_price
  liabilities_deducted    NUMERIC(15,2) NOT NULL DEFAULT 0,
  expenses_deducted       NUMERIC(15,2) NOT NULL DEFAULT 0,
  agent_commission        NUMERIC(15,2) NOT NULL DEFAULT 0,
  petty_cash_contribution NUMERIC(15,2) NOT NULL DEFAULT 3000,   -- default 3k PKR
  net_profit              NUMERIC(15,2) NOT NULL,                -- final distributable profit
  -- ── Who & when ──
  sold_by                 TEXT           NOT NULL,                -- name of salesperson
  agent_commission_pct    NUMERIC(5,2)   DEFAULT 0,              -- % given to sales agent
  sale_date               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  -- ── Profit lifecycle ──
  profit_distributed      BOOLEAN        NOT NULL DEFAULT false, -- true after splits are locked
  profit_cleared          BOOLEAN        NOT NULL DEFAULT false, -- true after released to investors
  settlement_status       TEXT           NOT NULL DEFAULT 'unsettled'
                      CHECK (settlement_status IN ('unsettled','settled')),
  notes                   TEXT,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    DEFAULT NOW()
);

-- Sales settlement status (create/alter-safe)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS settlement_status TEXT;

UPDATE public.sales
SET settlement_status = CASE
  WHEN profit_cleared = true THEN 'settled'
  ELSE 'unsettled'
END
WHERE settlement_status IS NULL;

ALTER TABLE public.sales
  ALTER COLUMN settlement_status SET DEFAULT 'unsettled';

ALTER TABLE public.sales
  ALTER COLUMN settlement_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_settlement_status_check'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_settlement_status_check
      CHECK (settlement_status IN ('unsettled','settled'));
  END IF;
END $$;

-- Back-reference: expenses.sale_id → sales.id
ALTER TABLE public.expenses
  ADD CONSTRAINT fk_expenses_sale
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  9. ENTERPRISE CAPITAL (singleton)                       ║
-- ║  The nerve centre of the business's cash position.       ║
-- ║                                                          ║
-- ║  liquid_assets = available cash on hand                  ║
-- ║  petty_cash    = reserved operational float              ║
-- ║  solid_assets  = sum of inventory.cost_price WHERE       ║
-- ║                  status = 'in_stock' (computed, not      ║
-- ║                  stored — query inventory directly)      ║
-- ║                                                          ║
-- ║  total_net_assets = liquid_assets + petty_cash           ║
-- ║                   + solid_assets (inventory at cost)     ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.enterprise_capital (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  liquid_assets       NUMERIC(15,2) NOT NULL DEFAULT 0,        -- cash on hand (PKR)
  petty_cash          NUMERIC(15,2) NOT NULL DEFAULT 0,        -- operational reserve (PKR)
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);

-- Seed the singleton row
INSERT INTO public.enterprise_capital (liquid_assets, petty_cash)
VALUES (0, 0)
ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  10. CAPITAL LEDGER                                      ║
-- ║  Immutable audit log of every movement in/out of         ║
-- ║  Enterprise Capital. positive = inflow, negative = out.  ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.capital_ledger (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type    TEXT           NOT NULL
                      CHECK (transaction_type IN (
                        'investment',              -- investor puts in capital
                        'purchase',                -- buying stock (outflow)
                        'sale_revenue',             -- full sale price comes in
                        'cost_reimbursement',       -- cost portion returned to EC on sale
                        'liability_payment',        -- paying off a debt
                        'expense_payment',          -- paying an expense from EC
                        'petty_cash_deposit',       -- moving cash → petty cash reserve
                        'petty_cash_withdrawal',    -- pulling from petty cash → liquid
                        'investor_withdrawal',      -- investor pulls out cash
                        'loss_coverage',            -- petty cash covering a loss
                        'adjustment'                -- manual admin correction
                      )),
  amount              NUMERIC(15,2) NOT NULL,                  -- +inflow / –outflow
  balance_after       NUMERIC(15,2),                           -- liquid_assets after this txn
  petty_cash_after    NUMERIC(15,2),                           -- petty_cash after this txn
  -- ── References ──
  reference_type      TEXT,                                    -- 'investor','purchase','sale','expense','liability','withdrawal'
  reference_id        UUID,                                    -- FK to the relevant table row
  description         TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  11. PROFIT DISTRIBUTIONS                                ║
-- ║  Per-sale, per-investor profit allocation.                ║
-- ║  Created when a sale is recorded. Status:                ║
-- ║    locked    → profit earned but not yet released         ║
-- ║    released  → admin cleared it, added to investor's     ║
-- ║                profit_balance                             ║
-- ║    withdrawn → investor has withdrawn this amount         ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.profit_distributions (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id             UUID           NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  investor_id         UUID           NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  amount              NUMERIC(15,2) NOT NULL,                  -- PKR allocated
  percentage_applied  NUMERIC(5,2)   NOT NULL,                  -- the % used at time of sale
  status              TEXT           NOT NULL DEFAULT 'locked'
                      CHECK (status IN ('locked','released','withdrawn')),
  released_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  12. WITHDRAWAL REQUESTS                                 ║
-- ║  Investor requests to withdraw cash. Workflow:           ║
-- ║    pending → approved → completed                        ║
-- ║                      → rejected                          ║
-- ║                                                          ║
-- ║  Validations (app layer):                                ║
-- ║  • Cannot withdraw more than profit_balance              ║
-- ║  • Cannot withdraw more than liquid_assets in EC         ║
-- ║  • Admin (aabdullahmian@gmail.com) must approve          ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id         UUID           NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  amount              NUMERIC(15,2) NOT NULL,                  -- requested PKR
  source              TEXT           NOT NULL DEFAULT 'profit'
                      CHECK (source IN ('profit','investment')),
  status              TEXT           NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','completed')),
  approved_by         TEXT,                                    -- admin email
  approved_at         TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  rejection_reason    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  13. VENDOR OFFERS (carried forward)                     ║
-- ║  Market price intelligence from vendors.                 ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.vendor_offers (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor              TEXT           NOT NULL,
  company             TEXT           NOT NULL,
  model               TEXT           NOT NULL,
  processor           TEXT,
  screen_size         TEXT,
  ram                 TEXT,
  storage             TEXT,
  graphics_card       TEXT,
  condition           TEXT,
  cost_price          NUMERIC(12,2),
  comment             TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  14. PROCESSORS — Knowledge Base (carried forward)       ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.processors (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  model             TEXT           NOT NULL UNIQUE,
  brand             TEXT           NOT NULL,
  generation        TEXT,
  architecture      TEXT,
  process_node      TEXT,
  process_node_nm   INTEGER,
  release_year      INTEGER,
  cores             INTEGER,
  threads           INTEGER,
  base_clock_ghz    NUMERIC(4,2),
  boost_clock_ghz   NUMERIC(4,2),
  cache_mb          INTEGER,
  tdp_w             INTEGER,
  integrated_gpu    TEXT,
  ram_types         TEXT[],
  ram_speed_min_mhz INTEGER,
  ram_speed_max_mhz INTEGER,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  15. LAPTOP MODELS — Knowledge Base (carried forward)    ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.laptop_models (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  company           TEXT           NOT NULL,
  model_name        TEXT           NOT NULL,
  release_year      INTEGER,
  charger_connector TEXT,
  charger_wattage_w INTEGER,
  charger_notes     TEXT,
  battery_wh        NUMERIC(5,1),
  notes             TEXT,
  cpus              TEXT[]         DEFAULT NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ,
  UNIQUE (company, model_name)
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  16. DELETED ITEMS — Audit Trail (carried forward)       ║
-- ╚═══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.deleted_items (
  id           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type  TEXT         NOT NULL,   -- 'inventory', 'sale', 'offer', 'expense', 'liability'
  entity_id    UUID,
  model_name   TEXT,
  price        NUMERIC,
  deleted_by   TEXT         NOT NULL,
  deleted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  entity_data  JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_inventory_category       ON public.inventory (category);
CREATE INDEX IF NOT EXISTS idx_inventory_status         ON public.inventory (status);
CREATE INDEX IF NOT EXISTS idx_inventory_purchase       ON public.inventory (purchase_id);
CREATE INDEX IF NOT EXISTS idx_sales_item               ON public.sales (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_date               ON public.sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_settlement_status  ON public.sales (settlement_status);
CREATE INDEX IF NOT EXISTS idx_liabilities_status       ON public.liabilities (status);
CREATE INDEX IF NOT EXISTS idx_liabilities_purchase     ON public.liabilities (purchase_id);
CREATE INDEX IF NOT EXISTS idx_expenses_purchase        ON public.expenses (purchase_id);
CREATE INDEX IF NOT EXISTS idx_expenses_sale            ON public.expenses (sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status          ON public.expenses (status);
CREATE INDEX IF NOT EXISTS idx_capital_ledger_type      ON public.capital_ledger (transaction_type);
CREATE INDEX IF NOT EXISTS idx_capital_ledger_ref       ON public.capital_ledger (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_profit_dist_sale         ON public.profit_distributions (sale_id);
CREATE INDEX IF NOT EXISTS idx_profit_dist_investor     ON public.profit_distributions (investor_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_investor      ON public.withdrawal_requests (investor_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status        ON public.withdrawal_requests (status);


-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- App-level auth via middleware + JWT is the real gate.
-- RLS is enabled with permissive anon policies so the
-- Supabase JS client (using anon key) can operate freely.
-- ═══════════════════════════════════════════════════════════════

-- Disable then re-enable to be idempotent
ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_distribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liabilities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_capital      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_ledger          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_distributions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_offers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laptop_models           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_items           ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon role (app-level auth handles real access control)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users','investors','profit_distribution_rules','purchases',
      'inventory','liabilities','expenses','sales',
      'enterprise_capital','capital_ledger','profit_distributions',
      'withdrawal_requests','vendor_offers','processors',
      'laptop_models','deleted_items'
    ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "anon_full_%s" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "anon_full_%s" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- GRANTS — anon role needs full CRUD for Supabase JS client
-- ═══════════════════════════════════════════════════════════════
GRANT ALL ON public.users                    TO anon;
GRANT ALL ON public.investors                TO anon;
GRANT ALL ON public.profit_distribution_rules TO anon;
GRANT ALL ON public.purchases                TO anon;
GRANT ALL ON public.inventory                TO anon;
GRANT ALL ON public.liabilities              TO anon;
GRANT ALL ON public.expenses                 TO anon;
GRANT ALL ON public.sales                    TO anon;
GRANT ALL ON public.enterprise_capital       TO anon;
GRANT ALL ON public.capital_ledger           TO anon;
GRANT ALL ON public.profit_distributions     TO anon;
GRANT ALL ON public.withdrawal_requests      TO anon;
GRANT ALL ON public.vendor_offers            TO anon;
GRANT ALL ON public.processors               TO anon;
GRANT ALL ON public.laptop_models            TO anon;
GRANT ALL ON public.deleted_items            TO anon;


-- ═══════════════════════════════════════════════════════════════
-- REALTIME — subscribe to changes from the client
-- ═══════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profit_distribution_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.liabilities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enterprise_capital;
ALTER PUBLICATION supabase_realtime ADD TABLE public.capital_ledger;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profit_distributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.processors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.laptop_models;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deleted_items;


-- ═══════════════════════════════════════════════════════════════
-- HELPER VIEWS — computed values the app can read directly
-- ═══════════════════════════════════════════════════════════════

-- Solid assets = total cost of all in-stock inventory
CREATE OR REPLACE VIEW public.v_solid_assets AS
SELECT
  COALESCE(SUM(cost_price), 0) AS solid_assets,
  COUNT(*)                     AS item_count
FROM public.inventory
WHERE status = 'in_stock';

-- Enterprise net worth = liquid + petty cash + solid (inventory at cost)
CREATE OR REPLACE VIEW public.v_enterprise_net_worth AS
SELECT
  ec.liquid_assets,
  ec.petty_cash,
  sa.solid_assets,
  (ec.liquid_assets + ec.petty_cash + sa.solid_assets) AS total_net_assets,
  sa.item_count AS inventory_count
FROM public.enterprise_capital ec
CROSS JOIN public.v_solid_assets sa
LIMIT 1;

-- Per-investor summary
CREATE OR REPLACE VIEW public.v_investor_summary AS
SELECT
  i.id,
  i.name,
  i.email,
  i.investment_amount,
  i.profit_balance,
  (i.investment_amount + i.profit_balance)                      AS net_worth,
  COALESCE(pdr.profit_percentage, 0)                            AS current_profit_pct,
  COALESCE(SUM(pd.amount) FILTER (WHERE pd.status = 'locked'), 0)   AS locked_profit,
  COALESCE(SUM(pd.amount) FILTER (WHERE pd.status = 'released'), 0) AS released_profit,
  COALESCE(SUM(wr.amount) FILTER (WHERE wr.status = 'completed'), 0) AS total_withdrawn
FROM public.investors i
LEFT JOIN public.profit_distribution_rules pdr
  ON pdr.investor_id = i.id AND pdr.is_active = true
LEFT JOIN public.profit_distributions pd
  ON pd.investor_id = i.id
LEFT JOIN public.withdrawal_requests wr
  ON wr.investor_id = i.id
GROUP BY i.id, i.name, i.email, i.investment_amount, i.profit_balance,
         pdr.profit_percentage;

-- Outstanding liabilities
CREATE OR REPLACE VIEW public.v_outstanding_liabilities AS
SELECT
  l.*,
  p.supplier_name AS purchase_supplier
FROM public.liabilities l
LEFT JOIN public.purchases p ON p.id = l.purchase_id
WHERE l.status != 'cleared';

-- Pending expenses
CREATE OR REPLACE VIEW public.v_pending_expenses AS
SELECT
  e.*,
  p.supplier_name AS purchase_supplier
FROM public.expenses e
LEFT JOIN public.purchases p ON p.id = e.purchase_id
WHERE e.status = 'pending';

-- Unsettled sales profit snapshot
CREATE OR REPLACE VIEW public.v_unsettled_sales AS
SELECT
  s.id,
  s.item_description,
  s.sale_date,
  s.net_profit,
  s.settlement_status,
  s.profit_cleared
FROM public.sales s
WHERE s.settlement_status = 'unsettled'
  AND COALESCE(s.net_profit, 0) > 0;

GRANT SELECT ON public.v_solid_assets              TO anon;
GRANT SELECT ON public.v_enterprise_net_worth      TO anon;
GRANT SELECT ON public.v_investor_summary          TO anon;
GRANT SELECT ON public.v_outstanding_liabilities   TO anon;
GRANT SELECT ON public.v_pending_expenses          TO anon;
GRANT SELECT ON public.v_unsettled_sales           TO anon;


-- ═══════════════════════════════════════════════════════════════
-- KNOWLEDGE BASE SEED DATA — Processors (51 CPUs)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.processors
  (model, brand, generation, architecture, process_node, process_node_nm,
   release_year, cores, threads, base_clock_ghz, boost_clock_ghz,
   cache_mb, tdp_w, integrated_gpu, ram_types, ram_speed_min_mhz, ram_speed_max_mhz)
VALUES

  -- ── Intel 6th Gen Skylake (14nm, 2015) ──────────────────────────────────
  ('i3-6100U', 'Intel', '6th Gen', 'Skylake', '14nm', 14, 2015, 2, 4,
   2.30, NULL, 3, 15, 'Intel HD Graphics 520',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i5-6200U', 'Intel', '6th Gen', 'Skylake', '14nm', 14, 2015, 2, 4,
   2.30, 2.80, 3, 15, 'Intel HD Graphics 520',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i5-6300U', 'Intel', '6th Gen', 'Skylake', '14nm', 14, 2015, 2, 4,
   2.40, 3.00, 3, 15, 'Intel HD Graphics 520',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i7-6500U', 'Intel', '6th Gen', 'Skylake', '14nm', 14, 2015, 2, 4,
   2.50, 3.10, 4, 15, 'Intel HD Graphics 520',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i7-6600U', 'Intel', '6th Gen', 'Skylake', '14nm', 14, 2015, 2, 4,
   2.60, 3.40, 4, 15, 'Intel HD Graphics 520',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i7-6820HQ', 'Intel', '6th Gen', 'Skylake', '14nm', 14, 2015, 4, 8,
   2.70, 3.60, 8, 45, 'Intel HD Graphics 530',
   ARRAY['DDR4-2133'], 1600, 2133),

  -- ── Intel 7th Gen Kaby Lake (14nm+, 2016) ───────────────────────────────
  ('i3-7100U', 'Intel', '7th Gen', 'Kaby Lake', '14nm+', 14, 2016, 2, 4,
   2.40, NULL, 3, 15, 'Intel HD Graphics 620',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i5-7200U', 'Intel', '7th Gen', 'Kaby Lake', '14nm+', 14, 2016, 2, 4,
   2.50, 3.10, 3, 15, 'Intel HD Graphics 620',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i5-7300U', 'Intel', '7th Gen', 'Kaby Lake', '14nm+', 14, 2016, 2, 4,
   2.60, 3.50, 3, 15, 'Intel HD Graphics 620',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i7-7500U', 'Intel', '7th Gen', 'Kaby Lake', '14nm+', 14, 2016, 2, 4,
   2.70, 3.50, 4, 15, 'Intel HD Graphics 620',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  ('i7-7600U', 'Intel', '7th Gen', 'Kaby Lake', '14nm+', 14, 2016, 2, 4,
   2.80, 3.90, 4, 15, 'Intel HD Graphics 620',
   ARRAY['DDR4-2133','LPDDR3-1866'], 1600, 2133),

  -- ── Intel 8th Gen Kaby Lake Refresh (14nm++, 2017) ──────────────────────
  ('i5-8250U', 'Intel', '8th Gen', 'Kaby Lake Refresh', '14nm++', 14, 2017, 4, 8,
   1.60, 3.40, 6, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  ('i5-8350U', 'Intel', '8th Gen', 'Kaby Lake Refresh', '14nm++', 14, 2017, 4, 8,
   1.70, 3.60, 6, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  ('i7-8550U', 'Intel', '8th Gen', 'Kaby Lake Refresh', '14nm++', 14, 2017, 4, 8,
   1.80, 4.00, 8, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  ('i7-8650U', 'Intel', '8th Gen', 'Kaby Lake Refresh', '14nm++', 14, 2017, 4, 8,
   1.90, 4.20, 8, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  -- ── Intel 8th Gen Whiskey Lake (14nm+++, 2018) ───────────────────────────
  ('i3-8145U', 'Intel', '8th Gen', 'Whiskey Lake', '14nm+++', 14, 2018, 2, 4,
   2.10, 3.90, 4, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  ('i5-8265U', 'Intel', '8th Gen', 'Whiskey Lake', '14nm+++', 14, 2018, 4, 8,
   1.60, 3.90, 6, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  ('i5-8365U', 'Intel', '8th Gen', 'Whiskey Lake', '14nm+++', 14, 2018, 4, 8,
   1.60, 4.10, 6, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  ('i7-8565U', 'Intel', '8th Gen', 'Whiskey Lake', '14nm+++', 14, 2018, 4, 8,
   1.80, 4.60, 8, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  ('i7-8665U', 'Intel', '8th Gen', 'Whiskey Lake', '14nm+++', 14, 2018, 4, 8,
   1.90, 4.80, 8, 15, 'Intel UHD Graphics 620',
   ARRAY['DDR4-2400','LPDDR3-2133'], 2133, 2400),

  -- ── Intel 10th Gen Comet Lake-U (14nm, 2019) ────────────────────────────
  ('i5-10210U', 'Intel', '10th Gen', 'Comet Lake', '14nm', 14, 2019, 4, 8,
   1.60, 4.20, 6, 15, 'Intel UHD Graphics',
   ARRAY['DDR4-2666','LPDDR3-2133'], 2133, 2666),

  ('i5-10310U', 'Intel', '10th Gen', 'Comet Lake', '14nm', 14, 2019, 4, 8,
   1.70, 4.40, 6, 15, 'Intel UHD Graphics',
   ARRAY['DDR4-2666','LPDDR3-2133'], 2133, 2666),

  ('i7-10510U', 'Intel', '10th Gen', 'Comet Lake', '14nm', 14, 2019, 4, 8,
   1.80, 4.90, 8, 15, 'Intel UHD Graphics',
   ARRAY['DDR4-2666','LPDDR3-2133'], 2133, 2666),

  ('i7-10610U', 'Intel', '10th Gen', 'Comet Lake', '14nm', 14, 2019, 4, 8,
   1.80, 4.90, 8, 15, 'Intel UHD Graphics',
   ARRAY['DDR4-2666','LPDDR3-2133'], 2133, 2666),

  ('i7-10710U', 'Intel', '10th Gen', 'Comet Lake', '14nm', 14, 2019, 6, 12,
   1.10, 4.70, 12, 15, 'Intel UHD Graphics',
   ARRAY['DDR4-2666','LPDDR3-2133'], 2133, 2666),

  ('i7-10810U', 'Intel', '10th Gen', 'Comet Lake', '14nm', 14, 2019, 6, 12,
   1.10, 4.90, 12, 15, 'Intel UHD Graphics',
   ARRAY['DDR4-2666','LPDDR3-2133'], 2133, 2666),

  -- ── Intel 10th Gen Ice Lake-U (10nm, 2019) ──────────────────────────────
  ('i5-1035G1', 'Intel', '10th Gen', 'Ice Lake', '10nm', 10, 2019, 4, 8,
   1.00, 3.60, 6, 15, 'Intel UHD Graphics',
   ARRAY['LPDDR4x-3733'], 3200, 3733),

  ('i5-1035G4', 'Intel', '10th Gen', 'Ice Lake', '10nm', 10, 2019, 4, 8,
   1.10, 3.70, 6, 15, 'Intel Iris Plus Graphics',
   ARRAY['LPDDR4x-3733'], 3200, 3733),

  ('i5-1035G7', 'Intel', '10th Gen', 'Ice Lake', '10nm', 10, 2019, 4, 8,
   1.20, 3.70, 6, 15, 'Intel Iris Plus Graphics',
   ARRAY['LPDDR4x-3733'], 3200, 3733),

  ('i7-1065G7', 'Intel', '10th Gen', 'Ice Lake', '10nm', 10, 2019, 4, 8,
   1.30, 3.90, 8, 15, 'Intel Iris Plus Graphics',
   ARRAY['LPDDR4x-3733'], 3200, 3733),

  -- ── Intel 11th Gen Tiger Lake-U (10nm SuperFin, 2020) ───────────────────
  ('i5-1135G7', 'Intel', '11th Gen', 'Tiger Lake', '10nm SuperFin', 10, 2020, 4, 8,
   2.40, 4.20, 8, 15, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','LPDDR4x-4267'], 3200, 4267),

  ('i5-1145G7', 'Intel', '11th Gen', 'Tiger Lake', '10nm SuperFin', 10, 2020, 4, 8,
   2.60, 4.40, 8, 15, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','LPDDR4x-4267'], 3200, 4267),

  ('i7-1165G7', 'Intel', '11th Gen', 'Tiger Lake', '10nm SuperFin', 10, 2020, 4, 8,
   2.80, 4.70, 12, 15, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','LPDDR4x-4267'], 3200, 4267),

  ('i7-1185G7', 'Intel', '11th Gen', 'Tiger Lake', '10nm SuperFin', 10, 2020, 4, 8,
   3.00, 4.80, 12, 28, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','LPDDR4x-4267'], 3200, 4267),

  -- ── Intel 12th Gen Alder Lake-U (Intel 7 / 10nm ESF, 2022) ─────────────
  ('i5-1235U', 'Intel', '12th Gen', 'Alder Lake', 'Intel 7 (10nm ESF)', 10, 2022, 10, 12,
   1.30, 4.40, 12, 15, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'], 3200, 5200),

  ('i5-1245U', 'Intel', '12th Gen', 'Alder Lake', 'Intel 7 (10nm ESF)', 10, 2022, 10, 12,
   1.60, 4.40, 12, 15, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'], 3200, 5200),

  ('i7-1255U', 'Intel', '12th Gen', 'Alder Lake', 'Intel 7 (10nm ESF)', 10, 2022, 10, 12,
   1.70, 4.70, 12, 15, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'], 3200, 5200),

  ('i7-1265U', 'Intel', '12th Gen', 'Alder Lake', 'Intel 7 (10nm ESF)', 10, 2022, 10, 12,
   1.80, 4.80, 12, 15, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'], 3200, 5200),

  -- ── Intel 12th Gen Alder Lake-P (Intel 7, 2022) ─────────────────────────
  ('i5-1240P', 'Intel', '12th Gen', 'Alder Lake', 'Intel 7 (10nm ESF)', 10, 2022, 12, 16,
   1.70, 4.40, 12, 28, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'], 3200, 5200),

  ('i7-1260P', 'Intel', '12th Gen', 'Alder Lake', 'Intel 7 (10nm ESF)', 10, 2022, 12, 16,
   2.10, 4.70, 18, 28, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'], 3200, 5200),

  ('i7-1270P', 'Intel', '12th Gen', 'Alder Lake', 'Intel 7 (10nm ESF)', 10, 2022, 12, 16,
   2.20, 4.80, 18, 28, 'Intel Iris Xe Graphics',
   ARRAY['DDR4-3200','DDR5-4800','LPDDR4x-4267','LPDDR5-5200'], 3200, 5200),

  -- ── AMD Ryzen 4000 Renoir (TSMC 7nm, 2020) ──────────────────────────────
  ('Ryzen 5 4500U', 'AMD', 'Ryzen 4000', 'Zen 2 (Renoir)', 'TSMC 7nm', 7, 2020, 6, 6,
   2.38, 4.00, 8, 15, 'AMD Radeon Graphics (Vega 6)',
   ARRAY['DDR4-3200','LPDDR4x-4266'], 3200, 4266),

  ('Ryzen 5 4600U', 'AMD', 'Ryzen 4000', 'Zen 2 (Renoir)', 'TSMC 7nm', 7, 2020, 6, 12,
   2.10, 4.00, 8, 15, 'AMD Radeon Graphics (Vega 6)',
   ARRAY['DDR4-3200','LPDDR4x-4266'], 3200, 4266),

  ('Ryzen 7 4700U', 'AMD', 'Ryzen 4000', 'Zen 2 (Renoir)', 'TSMC 7nm', 7, 2020, 8, 8,
   2.00, 4.10, 8, 15, 'AMD Radeon Graphics (Vega 7)',
   ARRAY['DDR4-3200','LPDDR4x-4266'], 3200, 4266),

  ('Ryzen 7 4800U', 'AMD', 'Ryzen 4000', 'Zen 2 (Renoir)', 'TSMC 7nm', 7, 2020, 8, 16,
   1.80, 4.20, 8, 15, 'AMD Radeon Graphics (Vega 8)',
   ARRAY['DDR4-3200','LPDDR4x-4266'], 3200, 4266),

  -- ── AMD Ryzen 5000 Lucienne (TSMC 7nm Zen 2 die, 2021) ──────────────────
  ('Ryzen 5 5500U', 'AMD', 'Ryzen 5000', 'Zen 2 (Lucienne)', 'TSMC 7nm', 7, 2021, 6, 12,
   2.10, 4.00, 8, 15, 'AMD Radeon Graphics (Vega 7)',
   ARRAY['DDR4-3200','LPDDR4x-4266'], 3200, 4266),

  ('Ryzen 7 5700U', 'AMD', 'Ryzen 5000', 'Zen 2 (Lucienne)', 'TSMC 7nm', 7, 2021, 8, 16,
   1.80, 4.30, 8, 15, 'AMD Radeon Graphics (Vega 8)',
   ARRAY['DDR4-3200','LPDDR4x-4266'], 3200, 4266),

  -- ── AMD Ryzen 5000 Cezanne (TSMC 7nm Zen 3, 2021) ───────────────────────
  ('Ryzen 5 5600U', 'AMD', 'Ryzen 5000', 'Zen 3 (Cezanne)', 'TSMC 7nm', 7, 2021, 6, 12,
   2.30, 4.20, 16, 15, 'AMD Radeon Graphics (Vega 7)',
   ARRAY['DDR4-3200','LPDDR4x-4266'], 3200, 4266),

  ('Ryzen 7 5800U', 'AMD', 'Ryzen 5000', 'Zen 3 (Cezanne)', 'TSMC 7nm', 7, 2021, 8, 16,
   1.90, 4.40, 16, 15, 'AMD Radeon Graphics (Vega 8)',
   ARRAY['DDR4-3200','LPDDR4x-4266'], 3200, 4266),

  -- ── AMD Ryzen 6000 Rembrandt (TSMC 6nm Zen 3+, RDNA 2, 2022) ───────────
  ('Ryzen 5 6600U', 'AMD', 'Ryzen 6000', 'Zen 3+ (Rembrandt)', 'TSMC 6nm', 6, 2022, 6, 12,
   2.90, 4.50, 16, 15, 'AMD Radeon 660M',
   ARRAY['DDR5-4800','LPDDR5-6400'], 4800, 6400),

  ('Ryzen 7 6800U', 'AMD', 'Ryzen 6000', 'Zen 3+ (Rembrandt)', 'TSMC 6nm', 6, 2022, 8, 16,
   2.70, 4.70, 16, 15, 'AMD Radeon 680M',
   ARRAY['DDR5-4800','LPDDR5-6400'], 4800, 6400)

ON CONFLICT (model) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- KNOWLEDGE BASE SEED DATA — Laptop Models (~30 models)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.laptop_models
  (company, model_name, release_year, charger_connector, charger_wattage_w,
   charger_notes, battery_wh, notes, cpus)
VALUES

  -- ── Dell Latitude ────────────────────────────────────────────────────────
  ('Dell','Latitude 5570',  2016, 'barrel_74mm',      90,  '7.4mm barrel with blue centre pin', 92.0, NULL,
   ARRAY['i5-6200U','i5-6300U','i7-6600U','i7-6820HQ']),
  ('Dell','Latitude 5580',  2017, 'barrel_74mm',      90,  '7.4mm barrel with blue centre pin', 92.0, NULL, NULL),
  ('Dell','Latitude 5290',  2018, 'barrel_74mm',      65,  '7.4mm barrel or USB-C charging',    42.0, NULL, NULL),
  ('Dell','Latitude 5300',  2019, 'barrel_74mm',      65,  '7.4mm barrel or USB-C charging',    60.0, NULL, NULL),
  ('Dell','Latitude 7300',  2019, 'usb_c_and_barrel', 65,  'USB-C (preferred) or 4.5mm barrel', 60.0, NULL,
   ARRAY['i5-8265U','i5-8365U','i7-8665U']),
  ('Dell','Latitude 7400',  2019, 'usb_c_and_barrel', 65,  'USB-C (preferred) or 4.5mm barrel', 60.0, NULL,
   ARRAY['i5-8365U','i7-8665U']),
  ('Dell','Latitude 7310',  2020, 'usb_c',            65,  'USB-C / Thunderbolt 3',             42.0, NULL,
   ARRAY['i5-10310U','i7-10610U']),
  ('Dell','Latitude 7410',  2020, 'usb_c_and_barrel', 65,  'USB-C or 4.5mm barrel',             68.0, NULL,
   ARRAY['i5-10310U','i7-10610U']),
  ('Dell','Latitude 5310',  2020, 'barrel_45mm',      65,  '4.5mm (yellow-tip) barrel',         42.0, NULL,
   ARRAY['i5-10210U','i5-10310U','i7-10610U']),
  ('Dell','Latitude 5410',  2020, 'barrel_45mm',      65,  '4.5mm (yellow-tip) barrel',         68.0, NULL,
   ARRAY['i5-10210U','i5-10310U','i7-10510U','i7-10610U']),
  ('Dell','Latitude 7320',  2021, 'usb_c',            65,  'USB-C / Thunderbolt 4',             40.0, NULL,
   ARRAY['i5-1145G7','i7-1165G7','i7-1185G7']),
  ('Dell','Latitude 7420',  2021, 'usb_c_and_barrel', 65,  'USB-C or 4.5mm barrel',             68.0, NULL,
   ARRAY['i5-1145G7','i7-1165G7','i7-1185G7']),
  ('Dell','Latitude 5520',  2021, 'barrel_45mm',      65,  '4.5mm (yellow-tip) barrel',         56.0, NULL,
   ARRAY['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7']),
  ('Dell','Latitude 5330',  2022, 'usb_c',            65,  'USB-C / Thunderbolt 4',             54.0, NULL,
   ARRAY['i5-1235U','i5-1245U','i7-1255U','i7-1265U']),
  ('Dell','Latitude 5430',  2022, 'barrel_45mm',      65,  '4.5mm (yellow-tip) barrel',         54.0, NULL,
   ARRAY['i5-1235U','i5-1245U','i7-1255U','i7-1265U']),
  ('Dell','Latitude 7330',  2022, 'usb_c',            65,  'USB-C / Thunderbolt 4',             54.0, NULL,
   ARRAY['i5-1245U','i7-1265U']),

  -- ── HP EliteBook / ProBook ───────────────────────────────────────────────
  ('HP','EliteBook 840 G4', 2017, 'barrel_45mm',      65,  '4.5mm barrel (HP Smart AC)',        50.0, NULL,
   ARRAY['i5-7200U','i5-7300U','i7-7500U','i7-7600U']),
  ('HP','EliteBook 840 G5', 2018, 'barrel_45mm',      65,  '4.5mm barrel or USB-C',             50.0, 'Some configs USB-C only',
   ARRAY['i5-8250U','i5-8350U','i7-8550U','i7-8650U']),
  ('HP','EliteBook 840 G6', 2019, 'barrel_45mm',      65,  '4.5mm barrel or USB-C',             50.0, NULL,
   ARRAY['i5-8265U','i5-8365U','i7-8565U','i7-8665U']),
  ('HP','EliteBook 840 G7', 2020, 'barrel_45mm',      65,  '4.5mm barrel or USB-C',             53.0, NULL,
   ARRAY['i5-10210U','i5-10310U','i7-10510U','i7-10610U']),
  ('HP','EliteBook 840 G8', 2021, 'barrel_45mm',      65,  '4.5mm barrel or USB-C (USB-C preferred)', 53.0, NULL,
   ARRAY['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7']),
  ('HP','EliteBook 850 G7', 2020, 'usb_c_and_barrel', 65,  '4.5mm barrel or USB-C',             56.0, NULL,
   ARRAY['i5-10210U','i5-10310U','i7-10510U','i7-10610U','i7-10710U']),
  ('HP','EliteBook 1040 G4',2018, 'usb_c',            65,  'USB-C / Thunderbolt 3',             56.0, NULL,
   ARRAY['i5-8250U','i7-8550U','i7-8650U']),
  ('HP','EliteBook 1040 G8',2021, 'usb_c',            65,  'USB-C / Thunderbolt 4',             54.0, NULL,
   ARRAY['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7']),
  ('HP','ProBook 440 G7',   2020, 'barrel_45mm',      45,  '4.5mm barrel (45W HP Smart AC)',     45.0, NULL,
   ARRAY['i5-10210U','i7-10510U']),
  ('HP','ProBook 440 G8',   2021, 'barrel_45mm',      45,  '4.5mm barrel (45W HP Smart AC)',     45.0, NULL,
   ARRAY['i5-1135G7','i7-1165G7']),

  -- ── Lenovo ThinkPad / IdeaPad ────────────────────────────────────────────
  ('Lenovo','ThinkPad T450',           2015, 'slim_tip',          45,  'Slim Tip rectangular connector', 47.0, NULL, NULL),
  ('Lenovo','ThinkPad T460',           2016, 'slim_tip',          45,  'Slim Tip rectangular connector', 48.0, NULL, NULL),
  ('Lenovo','ThinkPad T470',           2017, 'slim_tip_and_usbc', 65,  'Slim Tip + optional USB-C charging', 48.0, NULL,
   ARRAY['i5-7200U','i5-7300U','i7-7500U','i7-7600U']),
  ('Lenovo','ThinkPad T480',           2018, 'slim_tip_and_usbc', 65,  'Slim Tip + USB-C (Thunderbolt 3)', 48.0, NULL,
   ARRAY['i5-8250U','i5-8350U','i7-8550U','i7-8650U']),
  ('Lenovo','ThinkPad T490',           2019, 'slim_tip_and_usbc', 65,  'Slim Tip + USB-C (Thunderbolt 3)', 50.0, NULL,
   ARRAY['i5-8265U','i5-8365U','i7-8565U','i7-8665U']),
  ('Lenovo','ThinkPad X1 Carbon 2018', 2018, 'slim_tip_and_usbc', 65,  'Slim Tip + USB-C charging',         57.0, NULL,
   ARRAY['i5-8250U','i5-8350U','i7-8550U','i7-8650U']),
  ('Lenovo','ThinkPad X1 Carbon 2021', 2021, 'usb_c',             65,  'USB-C / Thunderbolt 4 only',         57.0, NULL,
   ARRAY['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7']),
  ('Lenovo','ThinkPad L13 Yoga',       2020, 'usb_c',             65,  'USB-C / Thunderbolt 3',             46.0, NULL,
   ARRAY['i5-1035G1','i5-1135G7','i5-1145G7','i7-1165G7']),
  ('Lenovo','IdeaPad V14',             2020, 'barrel_45mm',       45,  '4.5mm barrel (round tip)',          35.0, NULL,
   ARRAY['i5-1035G1','i5-1035G7','i7-1065G7'])

ON CONFLICT (company, model_name) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- END OF SETUP
-- ═══════════════════════════════════════════════════════════════
--
-- BUSINESS LOGIC REFERENCE (implement at app layer):
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  INVESTMENT FLOW                                           │
-- │  1. Add investor + investment_amount                       │
-- │  2. Set profit_distribution_rules (% per investor)         │
-- │  3. EC.liquid_assets += investment_amount                  │
-- │  4. Log to capital_ledger (type: 'investment')             │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  PURCHASE FLOW                                             │
-- │  1. Create purchase record                                 │
-- │  2. EC.liquid_assets -= amount_paid                        │
-- │  3. If partial/pending → create liability for remainder    │
-- │  4. Add items to inventory (purchase_id = this purchase)   │
-- │  5. Log to capital_ledger (type: 'purchase')               │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  SALE FLOW (P&L Waterfall)                                 │
-- │  1. Receive sale_price for an inventory item               │
-- │  2. EC.liquid_assets += sale_price                         │
-- │  3. Mark inventory item status = 'sold'                    │
-- │  4. gross_profit = sale_price − cost_price                 │
-- │  5. Optionally deduct liabilities tied to this purchase    │
-- │  6. Deduct expenses tied to this purchase                  │
-- │  7. Deduct agent commission (if applicable)                │
-- │  8. Deduct petty_cash_contribution (default 3000 PKR)      │
-- │     → EC.petty_cash += petty_cash_contribution             │
-- │     → EC.liquid_assets -= petty_cash_contribution          │
-- │  9. net_profit = what remains                              │
-- │ 10. Distribute net_profit per profit_distribution_rules    │
-- │     → create profit_distributions rows (status: 'locked')  │
-- │ 11. settlement_status defaults to 'unsettled'              │
-- │ 12. Log to capital_ledger (type: 'sale_revenue')           │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  LOSS SCENARIO (sale_price < cost_price)                   │
-- │  • net_profit is negative                                  │
-- │  • Option A: absorb from petty_cash (loss_coverage)        │
-- │  • Option B: carry forward, offset against next sale       │
-- │  • Admin decides at time of sale entry                     │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  EXPENSE FLOW                                              │
-- │  • Record expense (optionally link to purchase_id)         │
-- │  • Status stays 'pending' until settled                    │
-- │  • Option A: deduct from next sale's profit                │
-- │  • Option B: deduct from petty_cash immediately            │
-- │  • Option C: leave on hold                                 │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  LIABILITY FLOW                                            │
-- │  • Created on partial/pending purchase payment             │
-- │  • Can be settled from profit (during sale) or petty_cash  │
-- │  • Update remaining_amount, change status when cleared     │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  WITHDRAWAL FLOW                                           │
-- │  1. Investor sees: profit_balance (withdrawable earned)    │
-- │     and net_worth (investment + profit_balance)            │
-- │  2. Cannot request > profit_balance (from profit)          │
-- │  3. Cannot request > EC.liquid_assets (cash available)     │
-- │  4. Request created (status: 'pending')                    │
-- │  5. Admin approves → status: 'approved'                    │
-- │  6. On completion:                                         │
-- │     • investor.profit_balance -= amount                    │
-- │     • EC.liquid_assets -= amount                           │
-- │     • Log to capital_ledger (type: 'investor_withdrawal')  │
-- │     • status: 'completed'                                  │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  PROFIT RELEASE FLOW                                       │
-- │  1. Admin signals "clear profits" for a sale               │
-- │  2. All locked profit_distributions → 'released'           │
-- │  3. Each investor.profit_balance += their share            │
-- │  4. sale.profit_cleared = true                             │
-- │  5. sale.settlement_status = 'settled'                     │
-- └─────────────────────────────────────────────────────────────┘

-- Truncate all tables except knowledge base tables
-- Knowledge base tables: processors, laptop_models, vendor_offers

TRUNCATE TABLE public.profit_distributions CASCADE;
TRUNCATE TABLE public.withdrawal_requests CASCADE;
TRUNCATE TABLE public.capital_ledger CASCADE;
TRUNCATE TABLE public.profit_distribution_rules CASCADE;
TRUNCATE TABLE public.sales CASCADE;
TRUNCATE TABLE public.expenses CASCADE;
TRUNCATE TABLE public.liabilities CASCADE;
TRUNCATE TABLE public.inventory CASCADE;
TRUNCATE TABLE public.purchases CASCADE;
TRUNCATE TABLE public.enterprise_capital CASCADE;
TRUNCATE TABLE public.investors CASCADE;
TRUNCATE TABLE public.deleted_items CASCADE;



INSERT INTO public.enterprise_capital (liquid_assets, petty_cash)
VALUES (0, 0)
ON CONFLICT DO NOTHING;

-- =============================================================================

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS but allow all operations (testing purposes)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on users" ON users
  FOR ALL USING (true) WITH CHECK (true);


-- ─── 2. LAPTOPS TABLE ───────────────────────────────

CREATE TABLE IF NOT EXISTS laptops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.vendor_offers(id) ON DELETE SET NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  cpu TEXT NOT NULL,
  ram TEXT NOT NULL,
  storage TEXT NOT NULL,
  gpu TEXT NOT NULL,
  screen TEXT NOT NULL,
  condition TEXT DEFAULT 'New',
  price INTEGER NOT NULL,
  qty INTEGER DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  highlights TEXT[] DEFAULT '{}',
  specs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_laptops_brand ON laptops(brand);
CREATE INDEX IF NOT EXISTS idx_laptops_price ON laptops(price);
CREATE INDEX IF NOT EXISTS idx_laptops_offer_id ON laptops(offer_id);

CREATE TRIGGER laptops_updated_at
  BEFORE UPDATE ON laptops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE laptops ENABLE ROW LEVEL SECURITY;

-- Public read access, authenticated write
CREATE POLICY "Public read access on laptops" ON laptops
  FOR SELECT USING (true);

CREATE POLICY "Allow all write on laptops" ON laptops
  FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Offer → Laptop Auto-Sync (run this on existing databases)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add offer_id column to laptops for linking (if not exists)
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.vendor_offers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_laptops_offer_id ON laptops(offer_id);
