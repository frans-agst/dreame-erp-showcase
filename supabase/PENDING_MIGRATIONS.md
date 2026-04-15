# Pending Database Migrations

This file tracks database schema changes made during development that need to be applied to the **PRODUCTION** database before deploying.

## How to Use
1. When development is complete and tested, run these SQL statements in your **PRODUCTION** Supabase SQL Editor
2. After applying, move the migration to the "Applied" section with the date
3. Then deploy your code to Vercel

---

## ⏳ PENDING (Apply to Production Before Deploy)

### Migration: Add created_by column to sales table
**Date Added:** 2026-01-27
**Description:** Tracks which staff member submitted the sale (different from PIC)

```sql
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales(created_by);
UPDATE public.sales SET created_by = staff_id WHERE created_by IS NULL;
```

---

### Migration: V2.0 Major Refactoring - Organization Hierarchy & Dynamic Pricing
**Date Added:** 2026-01-30
**Description:** Complete schema refactor for Account>Store hierarchy, dynamic pricing, fiscal calendar, dealer portal

**⚠️ WARNING: This is a MAJOR migration. Test thoroughly in DEV first!**

**Part 1: Create Accounts Table**
```sql
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_select" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "accounts_insert" ON public.accounts FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
```

**Part 2: Create Stores Table (replaces branches)**
```sql
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  region TEXT,
  monthly_target DECIMAL(15,2) DEFAULT 0 CHECK (monthly_target >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stores_account_id ON public.stores(account_id);
CREATE POLICY "stores_select" ON public.stores FOR SELECT TO authenticated USING (true);
```

**Part 3: Create Fiscal Calendar Table**
```sql
CREATE TABLE public.fiscal_calendar (
  date DATE PRIMARY KEY,
  day_name TEXT NOT NULL,
  fiscal_week INTEGER NOT NULL CHECK (fiscal_week BETWEEN 1 AND 53),
  fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  fiscal_year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4)
);
CREATE INDEX idx_fiscal_calendar_week ON public.fiscal_calendar(fiscal_year, fiscal_week);
CREATE INDEX idx_fiscal_calendar_month ON public.fiscal_calendar(fiscal_year, fiscal_month);
```

**Part 4: Update Products Table for Dynamic Pricing**
```sql
ALTER TABLE public.products RENAME COLUMN price TO price_retail;
ALTER TABLE public.products ADD COLUMN price_buy DECIMAL(15,2) DEFAULT 0 CHECK (price_buy >= 0);
ALTER TABLE public.products ADD COLUMN channel_pricing JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN sub_category TEXT;
UPDATE public.products SET price_buy = price_retail * 0.7 WHERE price_buy = 0;
```

**Part 5: Create Supporting Tables**
```sql
-- Credit Notes for Dealers
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at DATE
);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_credit_notes_dealer_id ON public.credit_notes(dealer_id);

-- Training Materials
CREATE TABLE public.training_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_select" ON public.training_materials FOR SELECT TO authenticated USING (true);
```

**Part 6: Update Profiles for Dealer Role**
```sql
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'manager', 'staff', 'dealer'));
```

---

---

### Migration: Data Migration Script (branches to stores, price columns)
**Date Added:** 2026-01-30
**Description:** Migrates existing data from v1 schema to v2 schema
**File:** `supabase/migrations/005_data_migration.sql`

**Run after applying the V2.0 schema migration above**

```sql
-- See full script in supabase/migrations/005_data_migration.sql
-- Key operations:
-- 1. Creates "Legacy Branches" account for existing branches
-- 2. Migrates branches to stores table
-- 3. Updates branch_id references to store_id in profiles, sales, inventory
-- 4. Migrates price to price_retail, sets default price_buy
-- 5. Initializes channel_pricing JSONB
-- 6. Verifies migration with verify_data_migration() function
```

---

### Migration: Fiscal Calendar Seed Data (2024-2026)
**Date Added:** 2026-01-30
**Description:** Populates fiscal calendar with Monday-Sunday week boundaries
**File:** `supabase/migrations/006_fiscal_calendar_seed.sql`

**Run after creating the fiscal_calendar table**

```sql
-- See full script in supabase/migrations/006_fiscal_calendar_seed.sql
-- Generates 1096 days of fiscal calendar data (2024-2026)
-- Week boundaries: Monday-Sunday
-- Includes verification and helper views
```

---

### Migration: Complete Branch to Store Migration (Remove all branch_id columns)
**Date Added:** 2026-01-30
**Description:** Renames all `branch_id` columns to `store_id` across all tables, removes legacy branch references
**File:** `supabase/migrations/007_branch_to_store_migration.sql`

**⚠️ IMPORTANT: Run this AFTER the V2.0 schema and data migrations above**

**Key Changes:**
1. Profiles: Drops `branch_id`, ensures `store_id` is used
2. Inventory: Renames `branch_id` to `store_id`, updates constraints
3. Sales: Renames `branch_id` to `store_id`, updates foreign key
4. Stock_opname: Renames `branch_id` to `store_id`, updates foreign key
5. Functions: Replaces `user_branch_id()` with `user_store_id()`
6. Functions: Updates `decrement_inventory()` to use `p_store_id` parameter
7. RLS Policies: Updates all policies to use `store_id` instead of `branch_id`
8. Indexes: Creates new indexes on `store_id` columns

```sql
-- See full script in supabase/migrations/007_branch_to_store_migration.sql
-- Run this migration to complete the V2 schema transition
```

---

## ✅ APPLIED (Already in Production)

<!-- Move migrations here after applying to production -->



### Migration: Multi-Store Staff Assignment - Database Schema
**Date Added:** 2026-02-08
**Description:** Creates staff_stores junction table and helper function for many-to-many staff-store relationships
**File:** `supabase/migrations/009_multi_store_staff_assignment.sql`

**Key Changes:**
1. Creates `staff_stores` junction table with CASCADE delete constraints
2. Creates indexes for performance (staff_id, store_id, primary store)
3. Creates `get_user_store_ids(user_id)` helper function for RLS policies
4. Migrates existing single-store assignments from profiles.store_id
5. Creates RLS policies for staff_stores table
6. Enables backward compatibility with profiles.store_id

```sql
-- See full script in supabase/migrations/009_multi_store_staff_assignment.sql
-- This migration is safe to run and maintains backward compatibility
```

---

### Migration: Multi-Store Staff Assignment - RLS Policy Updates
**Date Added:** 2026-02-08
**Description:** Updates RLS policies to use get_user_store_ids() for multi-store access
**File:** `supabase/migrations/010_update_rls_for_multi_store.sql`

**⚠️ IMPORTANT: Run this AFTER migration 009**

**Key Changes:**
1. Updates sales table RLS policies to use array-based store access
2. Updates inventory table RLS policies to use array-based store access
3. Updates stock_opname table RLS policies to use array-based store access
4. Updates stock_opname_items table RLS policies to use array-based store access
5. Maintains admin/manager/dealer bypass for all stores

**Pattern Used:**
```sql
-- Old (single store):
store_id = public.get_user_store_id()

-- New (multi-store):
store_id = ANY(public.get_user_store_ids(auth.uid()))
```

```sql
-- See full script in supabase/migrations/010_update_rls_for_multi_store.sql
-- This migration enables staff to access data from all assigned stores
```

---

