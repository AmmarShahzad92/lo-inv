-- ============================================================
-- LAPTOPS OFFICIALS — SUPABASE DATABASE SETUP (v2 — Simple Auth)
-- Run this entire script in your Supabase SQL Editor
-- ============================================================
--
-- This version does NOT use Supabase Auth (auth.users).
-- Authentication is handled at the application level with
-- bcrypt password hashing and JWT session cookies.
-- ============================================================


-- ---------------------------------------------------------------
-- 1. USERS TABLE
--    Replaces allowed_emails + profiles + auth.users.
--    password_hash = NULL means "pre-approved but not registered".
-- ---------------------------------------------------------------
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


-- ---------------------------------------------------------------
-- 2. LAPTOPS INVENTORY TABLE
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.laptops (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  company         TEXT           NOT NULL,
  model           TEXT           NOT NULL,
  processor       TEXT           NOT NULL,
  ram             TEXT           NOT NULL,
  storage         TEXT           NOT NULL,
  cost_price      NUMERIC(12, 2) NOT NULL CHECK (cost_price > 0),
  min_sale_price  NUMERIC(12, 2) NOT NULL CHECK (min_sale_price > 0),
  invested_by     TEXT           NOT NULL,
  created_by      TEXT           NOT NULL,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ
);


-- ---------------------------------------------------------------
-- 3. DISABLE ROW LEVEL SECURITY
--    Auth is handled at the application level (middleware + API).
--    RLS is not needed since Supabase Auth is not used.
-- ---------------------------------------------------------------
ALTER TABLE public.users   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.laptops DISABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------
-- 4. COLUMN-LEVEL GRANTS FOR USERS TABLE
--    Prevent the anon key (used in the browser) from reading
--    password_hash. The service_role key (server-side only)
--    retains full access.
-- ---------------------------------------------------------------

-- Revoke default broad access from anon on users
REVOKE ALL ON public.users FROM anon;

-- Grant safe column reads
GRANT SELECT (id, email, display_name, is_admin, added_by, created_at)
  ON public.users TO anon;

-- Grant insert (for Settings page: adding new pre-approved emails)
GRANT INSERT (email, added_by) ON public.users TO anon;

-- Grant delete (for Settings page: revoking access)
GRANT DELETE ON public.users TO anon;

-- Laptops: anon gets full access (routes are protected by middleware)
GRANT ALL ON public.laptops TO anon;


-- ---------------------------------------------------------------
-- 5. ENABLE REALTIME PUBLICATIONS
-- ---------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.laptops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;


-- ---------------------------------------------------------------
-- 6. DATA MIGRATION (run only if upgrading from v1)
--    Copies allowed_emails data into users table, then drops
--    the old tables, triggers, and functions.
--    Skip this section on a fresh install.
-- ---------------------------------------------------------------

-- Uncomment the block below if migrating from v1:

/*
-- Copy allowed_emails into users
INSERT INTO public.users (email, added_by, created_at)
SELECT email, added_by, created_at FROM public.allowed_emails
ON CONFLICT (email) DO NOTHING;

-- Copy display names from profiles
UPDATE public.users u
SET display_name = p.display_name
FROM public.profiles p
WHERE u.email = p.email AND p.display_name IS NOT NULL;

-- Mark admin
UPDATE public.users SET is_admin = true WHERE email = 'aabdullahmian@gmail.com';

-- Drop old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop old RPC
DROP FUNCTION IF EXISTS public.is_email_allowed(TEXT);

-- Drop old tables
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.allowed_emails;
*/


-- ---------------------------------------------------------------
-- DONE — Summary:
--   users   → email, password hash, display name, admin flag
--   laptops → inventory, any registered user can CRUD
--   No RLS  → auth enforced at application level (middleware + API)
--   Anon key cannot read password_hash (column-level grants)
--   Realtime enabled on users + laptops
-- ---------------------------------------------------------------


-- ---------------------------------------------------------------
-- 7. LAPTOPS TABLE — NEW COLUMNS (v3 additions)
--    Run only if upgrading from v2. Safe to re-run (IF NOT EXISTS logic).
-- ---------------------------------------------------------------
ALTER TABLE public.laptops
  ADD COLUMN IF NOT EXISTS screen_size    TEXT,
  ADD COLUMN IF NOT EXISTS graphics_card  TEXT,
  ADD COLUMN IF NOT EXISTS quantity       INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantity_sold  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment        TEXT;


-- ---------------------------------------------------------------
-- 8. SALES TABLE
--    Records each sale transaction.
--    partner_splits = JSON array: [{email, display_name, amount}]
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  laptop_id       UUID           REFERENCES public.laptops(id) ON DELETE SET NULL,
  company         TEXT           NOT NULL,
  model           TEXT           NOT NULL,
  quantity_sold   INTEGER        NOT NULL DEFAULT 1,
  cost_price      NUMERIC(12, 2) NOT NULL,
  sale_price      NUMERIC(12, 2) NOT NULL,
  profit          NUMERIC(12, 2) NOT NULL,
  sold_by         TEXT           NOT NULL,
  sold_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  partner_splits  JSONB,
  notes           TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sales TO anon;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;


-- ---------------------------------------------------------------
-- 9. VENDOR OFFERS TABLE
--    Completely isolated section for tracking market prices
--    from vendors. Not connected to inventory or sales.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_offers (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor        TEXT           NOT NULL DEFAULT 'Tahir',
  company       TEXT           NOT NULL,
  model         TEXT           NOT NULL,
  processor     TEXT,
  screen_size   TEXT,
  ram           TEXT,
  storage       TEXT,
  graphics_card TEXT,
  condition     TEXT,
  cost_price    NUMERIC(12, 2),
  comment       TEXT,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendor_offers DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.vendor_offers TO anon;


-- ---------------------------------------------------------------
-- 10. TECHNICAL SPECS COLUMN
--     Stores auto-filled or manually entered processor specs as
--     JSONB: architecture, cores, threads, clocks, cache, TDP, RAM type.
-- ---------------------------------------------------------------
ALTER TABLE public.laptops ADD COLUMN IF NOT EXISTS specs JSONB;


-- ---------------------------------------------------------------
-- 11. VENDOR OFFERS REALTIME  (fixes: offers require page reload)
--     vendor_offers table was created but never added to the
--     Supabase Realtime publication — this line fixes it.
-- ---------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_offers;


-- ---------------------------------------------------------------
-- 12. ROW LEVEL SECURITY
--     Enables RLS on all tables and adds permissive policies for
--     the anon role. Real authentication is enforced at the
--     application layer (middleware + API routes). These policies
--     allow the browser anon key to continue working while RLS
--     infrastructure is active for future tightening.
-- ---------------------------------------------------------------
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laptops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_users"   ON public.users         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_laptops" ON public.laptops       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_sales"   ON public.sales         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_offers"  ON public.vendor_offers FOR ALL TO anon USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------
-- 13. INITIAL INVENTORY DATA  (from CSV export, all brands)
--
--     invested_by = created_by = primary admin email.
--     Sold items have quantity_sold = 1.
--     Prices in PKR.
--     GPU values corrected to accurate Intel/AMD/NVIDIA names.
--     HP 250G4 and EliteBook 1040G8: cost_price = 1 because the
--     original CSV had 0 or blank (DB CHECK requires > 0).
-- ---------------------------------------------------------------

-- ── Dell ─────────────────────────────────────────────────────────
INSERT INTO public.laptops
  (company, model, processor, ram, storage, screen_size, graphics_card,
   quantity, cost_price, min_sale_price, invested_by, created_by,
   created_at, quantity_sold, comment)
VALUES
  ('Dell','Latitude 7310','i7-10610U','16GB','256GB SSD','13.3"','Intel UHD Graphics 620',1,58000,72000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Dell','Latitude 7400','i5-8365U','16GB','256GB SSD','14"','Intel UHD Graphics 620',1,43000,45000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Dell','Latitude 7300','i5-8265U','16GB','256GB SSD','13.3"','Intel UHD Graphics 620',1,40000,48000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Dell','Latitude 5570','i5-6200U','8GB','256GB SSD','15.6"','Intel HD Graphics 520',1,35000,38500,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Dell','Latitude 5520','i7-1185G7','8GB','256GB SSD','14"','Intel Iris Xe Graphics',1,60000,65000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Dell','Latitude 7320','i5-1135G7','8GB','256GB SSD','13.3"','Intel Iris Xe Graphics',1,50000,55000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Battery down (55%)'),
  ('Dell','Latitude 7400 x360','i7-8665U','16GB','256GB SSD','14"','Intel UHD Graphics 620',1,55000,47000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Minor scratches on lid'),
  ('Dell','Inspiron 15 3000','i7-8550U','16GB','256GB SSD','15.6"','Intel UHD Graphics 620',1,52000,47000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Large bottom bezel'),
  ('Dell','Latitude 7410','i7-10610U','8GB','256GB SSD','14"','Intel UHD Graphics 620',1,52000,57000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'No backlit keyboard'),
  ('Dell','Latitude 7410','i5-10310U','8GB','256GB SSD','14"','Intel UHD Graphics 620',1,52000,57000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Dell','Latitude 7420','i5-1135G7','8GB','256GB SSD','14"','Intel Iris Xe Graphics',1,52000,57000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Card slot broken'),
  ('Dell','Latitude 7420','i7-1185G7','16GB','512GB SSD','14"','Intel Iris Xe Graphics',1,75000,80000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Dell','Latitude 5330','i7-1265U','16GB','256GB SSD','14"','Intel UHD Graphics',1,70000,75000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Back cover scratches');

-- ── HP ───────────────────────────────────────────────────────────
INSERT INTO public.laptops
  (company, model, processor, ram, storage, screen_size, graphics_card,
   quantity, cost_price, min_sale_price, invested_by, created_by,
   created_at, quantity_sold, comment)
VALUES
  ('HP','ProBook 440 G8','i5-1135G7','8GB','256GB SSD','14"','Intel Iris Xe Graphics',1,55000,81000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),1,'Missing key'),
  ('HP','HP 250 G7','i5-1035G1','8GB','256GB SSD','15.6"','Intel UHD Graphics 620',1,60000,81200,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('HP','EliteBook 1040 G4','i7-7500U','8GB','256GB SSD','14"','Intel UHD Graphics 620',1,60000,80500,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Missing key'),
  ('HP','EliteBook 1030 G4 x360','i5-8265U','8GB','256GB SSD','13.3"','Intel UHD Graphics 620',1,62000,75500,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'LCD line on screen'),
  ('HP','EliteBook 840 G4R','i5-8250U','8GB','256GB SSD','14"','Intel UHD Graphics 620',1,54000,61500,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('HP','Spectre x360','i5-6200U','8GB','256GB SSD','13.3"','Intel HD Graphics 520',1,40000,63400,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Battery replaced'),
  ('HP','HP 250 G4','i5-6200U','8GB','256GB SSD','15.6"','Intel HD Graphics 520',1,1,41800,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Platform crack + battery replaced (cost unknown)'),
  ('HP','EliteBook 850 G7','i7-10710U','8GB','256GB SSD','15.6"','NVIDIA GeForce MX250 2GB',1,82000,87000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Minor dent on back'),
  ('HP','EliteBook 1040 G8','i7-1185G7','32GB','512GB SSD','14"','Intel Iris Xe Graphics',1,1,130000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'10/10 condition (cost not recorded — see Updated SP)');

-- ── Lenovo ───────────────────────────────────────────────────────
INSERT INTO public.laptops
  (company, model, processor, ram, storage, screen_size, graphics_card,
   quantity, cost_price, min_sale_price, invested_by, created_by,
   created_at, quantity_sold, comment)
VALUES
  ('Lenovo','ThinkPad X1 Carbon','i5-8250U','8GB','512GB SSD','14"','Intel UHD Graphics 620',1,60000,70900,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Lenovo','ThinkPad T480','i5-8350U','8GB','256GB SSD','14"','Intel UHD Graphics 620',1,41000,51900,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Lenovo','ThinkPad T450','i5-5200U','4GB','128GB SSD','14"','Intel HD Graphics 5500',1,25000,31600,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Lenovo','IdeaPad V14','i7-1065G7','8GB','256GB SSD','14"','Intel Iris Plus 950',1,50000,55000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Old model'),
  ('Lenovo','ThinkPad X1 Carbon','i7-7500U','16GB','256GB SSD','14"','Intel UHD Graphics 620',1,48000,53000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'RAM slow · battery at 33%'),
  ('Lenovo','ThinkPad L13 Yoga x360','i5-1145G7','16GB','256GB SSD','14"','Intel Iris Xe Graphics',1,55000,60000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'With stylus'),
  ('Lenovo','ThinkPad L13 Yoga x360','i5-1045G7','16GB','256GB SSD','14"','Intel Iris Plus 950',1,50000,55000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'With stylus');

-- ── Apple ────────────────────────────────────────────────────────
INSERT INTO public.laptops
  (company, model, processor, ram, storage, screen_size, graphics_card,
   quantity, cost_price, min_sale_price, invested_by, created_by,
   created_at, quantity_sold, comment)
VALUES
  ('Apple','MacBook Air (2019)','Intel Core i5 (10th Gen)','8GB','128GB SSD','13.3"','Intel Iris Plus 617',1,75000,80000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL);

-- ── Others ───────────────────────────────────────────────────────
INSERT INTO public.laptops
  (company, model, processor, ram, storage, screen_size, graphics_card,
   quantity, cost_price, min_sale_price, invested_by, created_by,
   created_at, quantity_sold, comment)
VALUES
  ('Toshiba','Portege X20W-E','i7-8650U','16GB','256GB SSD','12.5"','Intel UHD Graphics 620',1,32000,37000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),1,NULL),
  ('Acer','TravelMate B117','Intel Pentium N4200','4GB','128GB SSD','11.6"','Intel HD Graphics 505',1,12800,17800,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,NULL),
  ('Asus','Pro P550CA','i7-3537U','8GB','128GB SSD','17.3"','Intel HD Graphics 4000',1,35000,35000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),0,'Caddy cover loose'),
  ('Fujitsu','Lifebook AH531','i3-2330U','8GB','512GB HDD','15.6"','Intel HD Graphics',1,11000,11000,'aabdullahmian@gmail.com','aabdullahmian@gmail.com',NOW(),1,NULL);


-- ---------------------------------------------------------------
-- 14. CLEAN SLATE  (⚠ WARNING: deletes ALL laptop & offer data)
--     Run this in Supabase SQL Editor ONLY when you want to reset.
--     After running, re-add your laptops manually via the app.
-- ---------------------------------------------------------------
-- TRUNCATE public.laptops    RESTART IDENTITY CASCADE;
-- TRUNCATE public.vendor_offers RESTART IDENTITY CASCADE;


-- ---------------------------------------------------------------
-- 15. NEW COLUMNS
--     status:            lifecycle tracking ('active'|'sold'|'archived')
--     investment_splits: per-partner investment amounts as JSONB
--                        [{email, display_name, amount}]
-- ---------------------------------------------------------------
ALTER TABLE public.laptops
  ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS investment_splits JSONB;


-- ---------------------------------------------------------------
-- 16. VENDOR OFFERS — Initial data (vendor = Tahir)
--     All 34 entries from Dell / HP / Lenovo / MacBook / Others CSVs.
--     condition: NULL (not in original CSV — edit in app).
--     cost_price = NULL where CSV had 0 or blank.
-- ---------------------------------------------------------------

-- ── Dell ─────────────────────────────────────────────────────────
  INSERT INTO public.vendor_offers
    (vendor, company, model, processor, screen_size, ram, storage,
    graphics_card, condition, cost_price, comment)
  VALUES
    ('Tahir','Dell','Latitude 7310','i7-10610U @1.80GHz','13.3"','16GB','256GB SSD','Intel UHD 620',NULL,58000,NULL),
    ('Tahir','Dell','Latitude 7400','i5-8365U @1.60GHz','14"','16GB','256GB SSD','Intel UHD 620',NULL,43000,'FL-BL-Touch'),
    ('Tahir','Dell','Latitude 7300','i5-8265U @1.60GHz','13.3"','16GB','256GB SSD','Intel UHD 620',NULL,40000,'FL'),
    ('Tahir','Dell','Latitude 5570','i5-6200U @2.30GHz','15.6"','8GB','256GB SSD','Intel HD',NULL,35000,NULL),
    ('Tahir','Dell','Latitude 5520','i7-1185G7','14"','8GB','256GB SSD','Intel Iris Xe',NULL,60000,'BL'),
    ('Tahir','Dell','Latitude 7320','i5-1135G7','13.3"','8GB','256GB SSD','Intel Iris Xe',NULL,50000,'Battery down — FP-BL'),
    ('Tahir','Dell','Latitude 7400 x360','i7-8665U @1.90GHz','14"','16GB','256GB SSD','Intel UHD 620',NULL,55000,'Minor scratches · BL full-metal'),
    ('Tahir','Dell','Inspiron 15 3000','i7-8550U @1.80GHz','15.6"','16GB','256GB SSD','Intel UHD 620',NULL,52000,'Large bottom bezel · FL-BL'),
    ('Tahir','Dell','Latitude 7410','i7-10610U @1.80GHz','14"','8GB','256GB SSD','Intel UHD 620',NULL,52000,'No backlit'),
    ('Tahir','Dell','Latitude 7410','i5-10310U @1.70GHz','14"','8GB','256GB SSD','Intel UHD 620',NULL,52000,NULL),
    ('Tahir','Dell','Latitude 7420','i5-1135G7 @2.60GHz','14"','8GB','256GB SSD','Intel Iris Xe',NULL,52000,'Card slot broken · FP-BL'),
    ('Tahir','Dell','Latitude 7420','i7-1185G7 @3.00GHz','14"','16GB','512GB SSD','Intel Iris Xe',NULL,75000,'BL'),
    ('Tahir','Dell','Latitude 5330','i7-1265U @3.20GHz','14"','16GB','256GB SSD','Intel UHD',NULL,70000,'Back cover scratches · BL');

  -- ── HP ───────────────────────────────────────────────────────────
  INSERT INTO public.vendor_offers
    (vendor, company, model, processor, screen_size, ram, storage,
    graphics_card, condition, cost_price, comment)
  VALUES
    ('Tahir','HP','ProBook 440 G8','i5-1135G7 @2.40GHz','14"','8GB','256GB SSD','Intel Iris Xe',NULL,55000,'Missing key · FP-BL'),
    ('Tahir','HP','HP 250 G7','i5-1035G1 @1.00GHz','15.6"','8GB','256GB SSD','Intel UHD 620',NULL,60000,NULL),
    ('Tahir','HP','EliteBook 1040 G4','i7-7500U @2.70GHz','14"','8GB','256GB SSD','Intel UHD 620',NULL,60000,'Missing key · FL-FP-BL'),
    ('Tahir','HP','EliteBook 1030 G4 x360','i5-8265U @1.60GHz','13.3"','8GB','256GB SSD','Intel UHD 620',NULL,62000,'LCD line'),
    ('Tahir','HP','EliteBook 840 G4R','i5-8250U @1.60GHz','14"','8GB','256GB SSD','Intel UHD 620',NULL,54000,'FP-BL'),
    ('Tahir','HP','Spectre x360','i5-6200U @2.30GHz','13.3"','8GB','256GB SSD','Intel HD 520',NULL,40000,'Battery replaced'),
    ('Tahir','HP','HP 250 G4','i5-6200U @2.30GHz','15.6"','8GB','256GB SSD','Intel HD 520',NULL,NULL,'Platform crack + battery replaced (cost unknown)'),
    ('Tahir','HP','EliteBook 850 G7','i7-10710U (6c/12t)','15.6"','8GB','256GB SSD','NVIDIA MX250 2GB',NULL,82000,'Minor dent on back · FL-FP-BL'),
    ('Tahir','HP','EliteBook 1040 G8','i7-1185G7 @3.00GHz','14"','32GB','512GB SSD','Intel Iris Xe',NULL,NULL,'10/10 condition · FL-FP-BL-PrivScr');

  -- ── Lenovo ───────────────────────────────────────────────────────
  INSERT INTO public.vendor_offers
    (vendor, company, model, processor, screen_size, ram, storage,
    graphics_card, condition, cost_price, comment)
  VALUES
    ('Tahir','Lenovo','ThinkPad X1 Carbon','i5-8250U @1.60GHz','14"','8GB','512GB SSD','Intel UHD 620',NULL,60000,'BL-FP'),
    ('Tahir','Lenovo','ThinkPad T480','i5-8350U @1.70GHz','14"','8GB','256GB SSD','Intel UHD 620',NULL,41000,'FP · add-HDD slot'),
    ('Tahir','Lenovo','ThinkPad T450','i5-5200U @2.20GHz','14"','4GB','128GB SSD','Intel HD 5500',NULL,25000,NULL),
    ('Tahir','Lenovo','IdeaPad V14','i7-1065G7','14"','8GB','256GB SSD','Intel Iris Plus',NULL,50000,'Old model · BL'),
    ('Tahir','Lenovo','ThinkPad X1 Carbon','i7-7500U','14"','16GB','256GB SSD','Intel UHD 620',NULL,48000,'RAM slow · battery 33% · FP-BL'),
    ('Tahir','Lenovo','ThinkPad L13 Yoga x360','i5-1145G7','14"','16GB','256GB SSD','Intel Iris Xe',NULL,55000,'With stylus · BL'),
    ('Tahir','Lenovo','ThinkPad L13 Yoga x360','i5-1045G7','14"','16GB','256GB SSD','Intel Iris Plus',NULL,50000,'With stylus · BL');

  -- ── Apple ────────────────────────────────────────────────────────
  INSERT INTO public.vendor_offers
    (vendor, company, model, processor, screen_size, ram, storage,
    graphics_card, condition, cost_price, comment)
  VALUES
    ('Tahir','Apple','MacBook Air (2019)','Intel Core i5 (10th Gen)','13.3"','8GB','128GB SSD','Intel Iris Plus 617',NULL,75000,NULL);

  -- ── Others ───────────────────────────────────────────────────────
  INSERT INTO public.vendor_offers
    (vendor, company, model, processor, screen_size, ram, storage,
    graphics_card, condition, cost_price, comment)
  VALUES
    ('Tahir','Toshiba','Portege X20W-E','i7-8650U @1.90GHz','12.5"','16GB','256GB SSD','Intel UHD 620',NULL,32000,'FL-FP-BL'),
    ('Tahir','Acer','TravelMate B117','Intel Pentium (N-series)','11.6"','4GB','128GB SSD','Intel HD',NULL,12800,NULL),
    ('Tahir','Asus','Pro P550CA','i7-3537U @2.50GHz','17.3"','8GB','128GB SSD','Intel HD 4000',NULL,35000,'Caddy cover loose'),
    ('Tahir','Fujitsu','Lifebook AH531','i3-2330U @2.20GHz','15.6"','8GB','512GB HDD','Intel HD',NULL,11000,NULL);


-- ============================================================
-- KNOWLEDGE BASE EXTENSION (v3)
-- Run this section to add Knowledge Base tables + battery_health
-- ============================================================


-- ---------------------------------------------------------------
-- A. ADD battery_health COLUMN TO LAPTOPS
-- ---------------------------------------------------------------
ALTER TABLE public.laptops ADD COLUMN IF NOT EXISTS battery_health TEXT DEFAULT NULL;


-- ---------------------------------------------------------------
-- B. PROCESSORS TABLE
-- ---------------------------------------------------------------
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

ALTER TABLE public.processors DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.processors TO anon;
ALTER PUBLICATION supabase_realtime ADD TABLE public.processors;


-- ---------------------------------------------------------------
-- C. LAPTOP MODELS TABLE
-- ---------------------------------------------------------------
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
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ,
  UNIQUE (company, model_name)
);

ALTER TABLE public.laptop_models DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.laptop_models TO anon;
ALTER PUBLICATION supabase_realtime ADD TABLE public.laptop_models;


-- ---------------------------------------------------------------
-- D. PROCESSOR SEED DATA (51 CPUs from Intel 6–12th Gen + AMD 4k/5k/6k)
-- ---------------------------------------------------------------
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


-- ---------------------------------------------------------------
-- E. LAPTOP MODELS SEED DATA (~30 models with charger/battery info)
-- ---------------------------------------------------------------
INSERT INTO public.laptop_models
  (company, model_name, release_year, charger_connector, charger_wattage_w,
   charger_notes, battery_wh, notes)
VALUES

  -- ── Dell Latitude ────────────────────────────────────────────────────────
  ('Dell','Latitude 5570',  2016, 'barrel_74mm',      90,  '7.4mm barrel with blue centre pin', 92.0, NULL),
  ('Dell','Latitude 5580',  2017, 'barrel_74mm',      90,  '7.4mm barrel with blue centre pin', 92.0, NULL),
  ('Dell','Latitude 5290',  2018, 'barrel_74mm',      65,  '7.4mm barrel or USB-C charging',    42.0, NULL),
  ('Dell','Latitude 5300',  2019, 'barrel_74mm',      65,  '7.4mm barrel or USB-C charging',    60.0, NULL),
  ('Dell','Latitude 7300',  2019, 'usb_c_and_barrel', 65,  'USB-C (preferred) or 4.5mm barrel', 60.0, NULL),
  ('Dell','Latitude 7400',  2019, 'usb_c_and_barrel', 65,  'USB-C (preferred) or 4.5mm barrel', 60.0, NULL),
  ('Dell','Latitude 7310',  2020, 'usb_c',            65,  'USB-C / Thunderbolt 3',             42.0, NULL),
  ('Dell','Latitude 7410',  2020, 'usb_c_and_barrel', 65,  'USB-C or 4.5mm barrel',             68.0, NULL),
  ('Dell','Latitude 5310',  2020, 'barrel_45mm',      65,  '4.5mm (yellow-tip) barrel',         42.0, NULL),
  ('Dell','Latitude 5410',  2020, 'barrel_45mm',      65,  '4.5mm (yellow-tip) barrel',         68.0, NULL),
  ('Dell','Latitude 7320',  2021, 'usb_c',            65,  'USB-C / Thunderbolt 4',             40.0, NULL),
  ('Dell','Latitude 7420',  2021, 'usb_c_and_barrel', 65,  'USB-C or 4.5mm barrel',             68.0, NULL),
  ('Dell','Latitude 5520',  2021, 'barrel_45mm',      65,  '4.5mm (yellow-tip) barrel',         56.0, NULL),
  ('Dell','Latitude 5330',  2022, 'usb_c',            65,  'USB-C / Thunderbolt 4',             54.0, NULL),
  ('Dell','Latitude 5430',  2022, 'barrel_45mm',      65,  '4.5mm (yellow-tip) barrel',         54.0, NULL),
  ('Dell','Latitude 7330',  2022, 'usb_c',            65,  'USB-C / Thunderbolt 4',             54.0, NULL),

  -- ── HP EliteBook / ProBook ───────────────────────────────────────────────
  ('HP','EliteBook 840 G4', 2017, 'barrel_45mm',      65,  '4.5mm barrel (HP Smart AC)',        50.0, NULL),
  ('HP','EliteBook 840 G5', 2018, 'barrel_45mm',      65,  '4.5mm barrel or USB-C',             50.0, 'Some configs USB-C only'),
  ('HP','EliteBook 840 G6', 2019, 'barrel_45mm',      65,  '4.5mm barrel or USB-C',             50.0, NULL),
  ('HP','EliteBook 840 G7', 2020, 'barrel_45mm',      65,  '4.5mm barrel or USB-C',             53.0, NULL),
  ('HP','EliteBook 840 G8', 2021, 'barrel_45mm',      65,  '4.5mm barrel or USB-C (USB-C preferred)', 53.0, NULL),
  ('HP','EliteBook 850 G7', 2020, 'usb_c_and_barrel', 65,  '4.5mm barrel or USB-C',             56.0, NULL),
  ('HP','EliteBook 1040 G4',2018, 'usb_c',            65,  'USB-C / Thunderbolt 3',             56.0, NULL),
  ('HP','EliteBook 1040 G8',2021, 'usb_c',            65,  'USB-C / Thunderbolt 4',             54.0, NULL),
  ('HP','ProBook 440 G7',   2020, 'barrel_45mm',      45,  '4.5mm barrel (45W HP Smart AC)',     45.0, NULL),
  ('HP','ProBook 440 G8',   2021, 'barrel_45mm',      45,  '4.5mm barrel (45W HP Smart AC)',     45.0, NULL),

  -- ── Lenovo ThinkPad / IdeaPad ────────────────────────────────────────────
  ('Lenovo','ThinkPad T450',           2015, 'slim_tip',          45,  'Slim Tip rectangular connector', 47.0, NULL),
  ('Lenovo','ThinkPad T460',           2016, 'slim_tip',          45,  'Slim Tip rectangular connector', 48.0, NULL),
  ('Lenovo','ThinkPad T470',           2017, 'slim_tip_and_usbc', 65,  'Slim Tip + optional USB-C charging', 48.0, NULL),
  ('Lenovo','ThinkPad T480',           2018, 'slim_tip_and_usbc', 65,  'Slim Tip + USB-C (Thunderbolt 3)', 48.0, NULL),
  ('Lenovo','ThinkPad T490',           2019, 'slim_tip_and_usbc', 65,  'Slim Tip + USB-C (Thunderbolt 3)', 50.0, NULL),
  ('Lenovo','ThinkPad X1 Carbon 2018', 2018, 'slim_tip_and_usbc', 65,  'Slim Tip + USB-C charging',         57.0, NULL),
  ('Lenovo','ThinkPad X1 Carbon 2021', 2021, 'usb_c',             65,  'USB-C / Thunderbolt 4 only',         57.0, NULL),
  ('Lenovo','ThinkPad L13 Yoga',       2020, 'usb_c',             65,  'USB-C / Thunderbolt 3',             46.0, NULL),
  ('Lenovo','IdeaPad V14',             2020, 'barrel_45mm',       45,  '4.5mm barrel (round tip)',          35.0, NULL)

ON CONFLICT (company, model_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 2 EXTENSION
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Add cpus column to laptop_models ──────────────────────────────────────
ALTER TABLE public.laptop_models ADD COLUMN IF NOT EXISTS cpus TEXT[] DEFAULT NULL;

-- ── Deleted items audit log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deleted_items (
  id           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type  TEXT         NOT NULL,  -- 'laptop', 'sale', 'offer'
  entity_id    UUID,
  model_name   TEXT,
  price        NUMERIC,
  deleted_by   TEXT         NOT NULL,
  deleted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  entity_data  JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE public.deleted_items DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.deleted_items TO anon;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deleted_items;

-- ── Finance transaction ledger ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id               UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type             TEXT         NOT NULL,
  -- 'investment' | 'credit_received' | 'credit_repaid' | 'expense' | 'withdrawal' | 'cash_transfer'
  amount           NUMERIC(12,2) NOT NULL,
  partner_email    TEXT,        -- who this transaction belongs to
  counterparty     TEXT,        -- other party (email or 'vendor:Tahir')
  laptop_id        UUID,        -- optional link to a laptop
  description      TEXT,
  transaction_date DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_by       TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);
ALTER TABLE public.finance_transactions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.finance_transactions TO anon;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_transactions;


-- ---------------------------------------------------------------
-- PHASE 2 — F. LAPTOP MODELS: cpus COLUMN SEED DATA
--     Updates existing laptop_models rows with known CPU lists.
--     Safe to re-run (upserts only known rows).
-- ---------------------------------------------------------------

-- ── Dell Latitude ─────────────────────────────────────────────
UPDATE public.laptop_models SET cpus = ARRAY['i5-6200U','i5-6300U','i7-6600U','i7-6820HQ']          WHERE company='Dell' AND model_name='Latitude 5570';
UPDATE public.laptop_models SET cpus = ARRAY['i5-8265U','i5-8365U','i7-8665U']                       WHERE company='Dell' AND model_name='Latitude 7300';
UPDATE public.laptop_models SET cpus = ARRAY['i5-8365U','i7-8665U']                                  WHERE company='Dell' AND model_name='Latitude 7400';
UPDATE public.laptop_models SET cpus = ARRAY['i5-10310U','i7-10610U']                                WHERE company='Dell' AND model_name='Latitude 7310';
UPDATE public.laptop_models SET cpus = ARRAY['i5-10210U','i5-10310U','i7-10510U','i7-10610U']        WHERE company='Dell' AND model_name='Latitude 5410';
UPDATE public.laptop_models SET cpus = ARRAY['i5-10210U','i5-10310U','i7-10610U']                    WHERE company='Dell' AND model_name='Latitude 5310';
UPDATE public.laptop_models SET cpus = ARRAY['i5-10310U','i7-10610U']                                WHERE company='Dell' AND model_name='Latitude 7410';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1145G7','i7-1165G7','i7-1185G7']                    WHERE company='Dell' AND model_name='Latitude 7320';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1145G7','i7-1165G7','i7-1185G7']                    WHERE company='Dell' AND model_name='Latitude 7420';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7']        WHERE company='Dell' AND model_name='Latitude 5520';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1235U','i5-1245U','i7-1255U','i7-1265U']            WHERE company='Dell' AND model_name='Latitude 5330';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1235U','i5-1245U','i7-1255U','i7-1265U']            WHERE company='Dell' AND model_name='Latitude 5430';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1245U','i7-1265U']                                  WHERE company='Dell' AND model_name='Latitude 7330';

-- ── HP EliteBook / ProBook ────────────────────────────────────
UPDATE public.laptop_models SET cpus = ARRAY['i5-7200U','i5-7300U','i7-7500U','i7-7600U']            WHERE company='HP'   AND model_name='EliteBook 840 G4';
UPDATE public.laptop_models SET cpus = ARRAY['i5-8250U','i5-8350U','i7-8550U','i7-8650U']            WHERE company='HP'   AND model_name='EliteBook 840 G5';
UPDATE public.laptop_models SET cpus = ARRAY['i5-8265U','i5-8365U','i7-8565U','i7-8665U']            WHERE company='HP'   AND model_name='EliteBook 840 G6';
UPDATE public.laptop_models SET cpus = ARRAY['i5-10210U','i5-10310U','i7-10510U','i7-10610U']        WHERE company='HP'   AND model_name='EliteBook 840 G7';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7']        WHERE company='HP'   AND model_name='EliteBook 840 G8';
UPDATE public.laptop_models SET cpus = ARRAY['i5-10210U','i5-10310U','i7-10510U','i7-10610U','i7-10710U'] WHERE company='HP' AND model_name='EliteBook 850 G7';
UPDATE public.laptop_models SET cpus = ARRAY['i5-8250U','i7-8550U','i7-8650U']                       WHERE company='HP'   AND model_name='EliteBook 1040 G4';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7']        WHERE company='HP'   AND model_name='EliteBook 1040 G8';
UPDATE public.laptop_models SET cpus = ARRAY['i5-10210U','i7-10510U']                                WHERE company='HP'   AND model_name='ProBook 440 G7';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1135G7','i7-1165G7']                                WHERE company='HP'   AND model_name='ProBook 440 G8';

-- ── Lenovo ThinkPad / IdeaPad ─────────────────────────────────
UPDATE public.laptop_models SET cpus = ARRAY['i5-7200U','i5-7300U','i7-7500U','i7-7600U']            WHERE company='Lenovo' AND model_name='ThinkPad T470';
UPDATE public.laptop_models SET cpus = ARRAY['i5-8250U','i5-8350U','i7-8550U','i7-8650U']            WHERE company='Lenovo' AND model_name='ThinkPad T480';
UPDATE public.laptop_models SET cpus = ARRAY['i5-8265U','i5-8365U','i7-8565U','i7-8665U']            WHERE company='Lenovo' AND model_name='ThinkPad T490';
UPDATE public.laptop_models SET cpus = ARRAY['i5-8250U','i5-8350U','i7-8550U','i7-8650U']            WHERE company='Lenovo' AND model_name='ThinkPad X1 Carbon 2018';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1135G7','i5-1145G7','i7-1165G7','i7-1185G7']        WHERE company='Lenovo' AND model_name='ThinkPad X1 Carbon 2021';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1035G1','i5-1135G7','i5-1145G7','i7-1165G7']        WHERE company='Lenovo' AND model_name='ThinkPad L13 Yoga';
UPDATE public.laptop_models SET cpus = ARRAY['i5-1035G1','i5-1035G7','i7-1065G7']                    WHERE company='Lenovo' AND model_name='IdeaPad V14';


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 3 EXTENSION — Credit / Vendor Financing on Laptops
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------
-- 17. LAPTOPS — credit columns
--     credit_amount: how much of the cost price was financed on
--                    credit from a vendor or 3rd party (PKR)
--     credit_source: name of vendor or party providing credit
--     Both nullable — only set when the laptop was bought on credit.
-- ---------------------------------------------------------------
ALTER TABLE public.laptops
  ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credit_source TEXT           DEFAULT NULL;

-- ---------------------------------------------------------------
-- 18. FINANCE TRANSACTIONS — profit types
--     Add profit_reinvestment and profit_withdrawal as valid types
--     (no schema change needed — type column is TEXT).
--     This comment documents the full set of valid type values:
--       investment          capital invested by partner
--       credit_received     credit received from vendor
--       credit_repaid       credit repaid to vendor
--       expense             operational expense (fuel, etc.)
--       withdrawal          partner cash withdrawal
--       cash_transfer       cash moved between partners
--       profit_reinvestment partner reinvests their profit share
--       profit_withdrawal   partner withdraws their profit share
-- ---------------------------------------------------------------
-- No DDL needed — type is free-form TEXT already.


-- ---------------------------------------------------------------
-- 19. RLS FOR REMAINING TABLES (Phase 3)
--     Enables Row Level Security on tables that were previously
--     left without it: deleted_items, finance_transactions,
--     processors, laptop_models.
--     Adds permissive anon policies consistent with sections 12
--     above — app-level auth (middleware + JWT) is the real gate.
-- ---------------------------------------------------------------
ALTER TABLE public.deleted_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laptop_models        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_deleted_items"    ON public.deleted_items        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_finance_tx"       ON public.finance_transactions  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_processors"       ON public.processors            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_laptop_models"    ON public.laptop_models         FOR ALL TO anon USING (true) WITH CHECK (true);