# 04 — Database Schema

**Backend:** Supabase (PostgreSQL)  
**Schema Version:** 2.0 (post branch→store migration)  
**Last Updated:** March 2026  
**Security:** Row Level Security (RLS) enabled on all tables

---

## Entity Relationship Overview

```
accounts
  └── stores (one account → many stores)
        └── staff_stores (many stores ↔ many profiles)
        └── inventory (store × product stock)
        └── sales (legacy single-product transactions)
        └── transactions (new multi-product transactions)
              └── transaction_items
        └── purchase_orders
              └── purchase_order_items
        └── stock_opname
              └── stock_opname_items
        └── expenses

profiles (linked to auth.users)
  └── staff_stores
  └── day_off_requests
  └── sales / transactions (staff_id)

products
  └── inventory
  └── sales / transaction_items / purchase_order_items / stock_opname_items

fiscal_calendar (date → fiscal_week / fiscal_month / fiscal_year)
audit_log (all INSERT / UPDATE / DELETE events)
credit_notes (dealer credit)
staff_targets (monthly targets per staff)
```

---

## Table Definitions

### `accounts` — Top-Level Organizations

```sql
CREATE TABLE public.accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  channel_type TEXT NOT NULL CHECK (channel_type IN (
                 'Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon'
               )),
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** SELECT — all authenticated users | INSERT/UPDATE — admin/manager | DELETE — admin only

---

### `stores` — Physical Store Locations

```sql
CREATE TABLE public.stores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  name           TEXT NOT NULL,
  region         TEXT,
  monthly_target DECIMAL(15,2) DEFAULT 0 CHECK (monthly_target >= 0),
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_account_id ON stores(account_id);
CREATE INDEX idx_stores_is_active   ON stores(is_active);
```

**RLS:** SELECT — all authenticated users | INSERT/UPDATE — admin/manager | DELETE — admin only

---

### `profiles` — User Profiles

```sql
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'dealer')),
  store_id   UUID REFERENCES public.stores(id) ON DELETE SET NULL,  -- primary store (legacy)
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** SELECT — all authenticated users | UPDATE — self or admin/manager

---

### `staff_stores` — Multi-Store Staff Assignment

```sql
CREATE TABLE public.staff_stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id    UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, store_id)
);

CREATE INDEX idx_staff_stores_staff_id ON staff_stores(staff_id);
CREATE INDEX idx_staff_stores_store_id ON staff_stores(store_id);
```

**RLS:** SELECT — all authenticated users | INSERT/UPDATE/DELETE — admin only

---

### `products` — Product Catalog

```sql
CREATE TABLE public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  category        TEXT,
  sub_category    TEXT,
  price_retail    DECIMAL(15,2) NOT NULL CHECK (price_retail >= 0),   -- SRP, visible to staff
  price_buy       DECIMAL(15,2) NOT NULL CHECK (price_buy >= 0),      -- dealer cost
  channel_pricing JSONB DEFAULT '{}',                                  -- dynamic per-channel prices
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_sku       ON products(sku);
CREATE INDEX idx_products_category  ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);
```

**channel_pricing JSONB example:**
```json
{
  "modern_channel": 1500000,
  "hangon": 1350000
}
```

**RLS:** SELECT — all authenticated users (price fields filtered server-side by role) | INSERT/UPDATE — admin/manager | DELETE — admin only

---

### `inventory` — Store Stock Levels

```sql
CREATE TABLE public.inventory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  display_qty INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);

CREATE INDEX idx_inventory_store_id   ON inventory(store_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
```

**RLS:** Staff — own store only | Admin/Manager — all stores

---

### `sales` — Legacy Single-Product Transactions

```sql
CREATE TABLE public.sales (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  product_id       UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  staff_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sale_date        DATE NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price       DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  discount         DECIMAL(15,2) DEFAULT 0 CHECK (discount >= 0),
  total_price      DECIMAL(15,2) NOT NULL CHECK (total_price >= 0),
  customer_name    TEXT,
  customer_phone   TEXT,
  gift_details     JSONB DEFAULT '[]',    -- [{ "name": "...", "qty": 1 }]
  inventory_source TEXT,                  -- 'in_store' | 'warehouse'
  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_store_id   ON sales(store_id);
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_sales_staff_id   ON sales(staff_id);
CREATE INDEX idx_sales_sale_date  ON sales(sale_date);
CREATE INDEX idx_sales_created_by ON sales(created_by);
```

**RLS:** Staff — own store | Admin/Manager — all stores | DELETE — admin/manager only

---

### `transactions` — New Multi-Product Transactions

```sql
CREATE TABLE public.transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  staff_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  transaction_date      DATE NOT NULL,
  total_before_discount DECIMAL(15,2) NOT NULL CHECK (total_before_discount >= 0),
  total_discount        DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_after_discount  DECIMAL(15,2) NOT NULL CHECK (total_after_discount >= 0),
  inventory_source      TEXT NOT NULL CHECK (inventory_source IN ('in_store', 'warehouse')),
  customer_name         TEXT,
  customer_phone        TEXT,
  notes                 TEXT,
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Staff — own store | Admin/Manager — all stores | DELETE — admin/manager + staff own records

---

### `transaction_items` — Line Items Within a Transaction

```sql
CREATE TABLE public.transaction_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_price     DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  line_discount  DECIMAL(15,2) DEFAULT 0,
  line_total     DECIMAL(15,2) NOT NULL CHECK (line_total >= 0),
  gift_details   JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product_id     ON transaction_items(product_id);
```

---

### `purchase_orders` — Purchase Orders

```sql
CREATE TABLE public.purchase_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number        TEXT NOT NULL UNIQUE,
  dealer_name      TEXT,                                              -- legacy display name
  account_id       UUID REFERENCES public.accounts(id),
  store_id         UUID REFERENCES public.stores(id),
  price_source     TEXT,                                              -- 'retail' | 'dealer' | channel key
  po_date          DATE NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  total_before_tax DECIMAL(15,2) NOT NULL CHECK (total_before_tax >= 0),
  total_after_tax  DECIMAL(15,2) NOT NULL CHECK (total_after_tax >= 0),
  grand_total      DECIMAL(15,2) NOT NULL CHECK (grand_total >= 0),
  credit_note_id   UUID,
  credit_note_amount DECIMAL(15,2),
  created_by       UUID REFERENCES public.profiles(id),
  confirmed_by     UUID REFERENCES public.profiles(id),
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_po_store_id   ON purchase_orders(store_id);
CREATE INDEX idx_po_status     ON purchase_orders(status);
CREATE INDEX idx_po_order_date ON purchase_orders(po_date);
```

**PO Number format:** `PO-YYYYMMDD-XXXX`  
**Tax:** 11% VAT applied to `before_tax` price to get `after_tax`

---

### `purchase_order_items` — PO Line Items

```sql
CREATE TABLE public.purchase_order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id      UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  before_tax DECIMAL(15,2) NOT NULL CHECK (before_tax >= 0),
  after_tax  DECIMAL(15,2) NOT NULL CHECK (after_tax >= 0),
  line_total DECIMAL(15,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_po_items_po_id      ON purchase_order_items(po_id);
CREATE INDEX idx_po_items_product_id ON purchase_order_items(product_id);
```

---

### `stock_opname` — Physical Inventory Count Sessions

```sql
CREATE TABLE public.stock_opname (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  staff_id     UUID REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `stock_opname_items` — Per-Product Counts

```sql
CREATE TABLE public.stock_opname_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id     UUID NOT NULL REFERENCES public.stock_opname(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  previous_qty  INTEGER NOT NULL,
  counted_qty   INTEGER NOT NULL,
  discrepancy   INTEGER GENERATED ALWAYS AS (counted_qty - previous_qty) STORED,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `expenses` — Operational Expenses

```sql
CREATE TABLE public.expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL,
  fiscal_week  INTEGER NOT NULL,
  category     TEXT NOT NULL CHECK (category IN (
                 'POSM', 'ADS', 'Exhibition', 'Logistic Cost',
                 'Support Sellout', 'Brandstore Promotion', 'Branding Offline'
               )),
  amount       DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  evidence_url TEXT,
  remarks      TEXT,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_account_id ON expenses(account_id);
CREATE INDEX idx_expenses_date       ON expenses(expense_date);
CREATE INDEX idx_expenses_category   ON expenses(category);
```

---

### `day_off_requests` — Staff Leave Requests

```sql
CREATE TABLE public.day_off_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_day_off_staff_id ON day_off_requests(staff_id);
CREATE INDEX idx_day_off_status   ON day_off_requests(status);
```

---

### `fiscal_calendar` — Fiscal Week/Month Calendar

```sql
CREATE TABLE public.fiscal_calendar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL UNIQUE,
  fiscal_year  INTEGER NOT NULL,
  fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  fiscal_week  INTEGER NOT NULL CHECK (fiscal_week BETWEEN 1 AND 53),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fiscal_calendar_date       ON fiscal_calendar(date);
CREATE INDEX idx_fiscal_calendar_year_week  ON fiscal_calendar(fiscal_year, fiscal_week);
CREATE INDEX idx_fiscal_calendar_year_month ON fiscal_calendar(fiscal_year, fiscal_month);
```

Seeded with data from `supabase/seed-data/fiscal-calendar-2024-2026.csv`.

---

### `staff_targets` — Monthly Sales Targets

```sql
CREATE TABLE public.staff_targets (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year     INTEGER NOT NULL,
  month    INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  target   DECIMAL(15,2) NOT NULL DEFAULT 0,
  UNIQUE(staff_id, year, month)
);
```

---

### `credit_notes` — Dealer Credit Notes

```sql
CREATE TABLE public.credit_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id   UUID NOT NULL REFERENCES public.profiles(id),
  amount      DECIMAL(15,2) NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('available', 'used', 'expired')),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  used_in_po_id UUID,
  used_at     TIMESTAMPTZ
);
```

---

### `audit_log` — Full Change History

```sql
CREATE TABLE public.audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id),
  action     TEXT NOT NULL,       -- 'INSERT' | 'UPDATE' | 'DELETE'
  table_name TEXT NOT NULL,
  record_id  UUID,
  old_value  JSONB,
  new_value  JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id    ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

**RLS:** SELECT — admin only | INSERT — via triggers only (no direct access)

---

## Key Database Functions

### `get_user_store_ids(user_id UUID) → UUID[]`
Returns all store IDs a user is assigned to. Used in RLS policies and server actions to enforce store-level data isolation.

```sql
CREATE OR REPLACE FUNCTION get_user_store_ids(user_id UUID)
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(DISTINCT store_id)
  FROM staff_stores
  WHERE staff_id = user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

---

### `decrement_inventory(p_store_id, p_product_id, p_qty) → INTEGER`
Atomically decrements inventory with row-level locking. Raises an exception if stock is insufficient.

```sql
CREATE OR REPLACE FUNCTION decrement_inventory(
  p_store_id  UUID,
  p_product_id UUID,
  p_qty       INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_current_qty INTEGER;
  v_new_qty     INTEGER;
BEGIN
  SELECT quantity INTO v_current_qty
  FROM inventory
  WHERE store_id = p_store_id AND product_id = p_product_id
  FOR UPDATE;

  IF v_current_qty IS NULL THEN
    RAISE EXCEPTION 'No inventory record found';
  END IF;

  IF v_current_qty < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_qty, p_qty;
  END IF;

  v_new_qty := v_current_qty - p_qty;

  UPDATE inventory
  SET quantity = v_new_qty, updated_at = NOW()
  WHERE store_id = p_store_id AND product_id = p_product_id;

  RETURN v_new_qty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### `create_transaction_with_items(p_transaction_data, p_items_data) → UUID`
Atomically creates a transaction header + all line items in a single DB call. Called via Supabase RPC from `createTransaction` server action.

---

### `log_audit_event()` — Trigger Function
Automatically fires on INSERT/UPDATE/DELETE for all major tables and writes to `audit_log`.

```sql
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Audit triggers are active on:** `accounts`, `stores`, `staff_stores`, `profiles`, `products`, `inventory`, `sales`, `transactions`, `purchase_orders`, `day_off_requests`, `stock_opname`, `expenses`

---

## Views

### `unified_sales_export`
Combines legacy `sales` rows and new `transactions`/`transaction_items` rows into a single flat view. Used by dashboard analytics, weekly reports, and Excel exports.

```sql
-- Conceptual structure (see migration 024 for full definition)
CREATE VIEW unified_sales_export AS
  -- Legacy sales
  SELECT
    id, NULL AS transaction_id, sale_date,
    store_id, staff_id, product_id,
    quantity, unit_price, discount, total_price,
    customer_name, customer_phone, gift_details,
    inventory_source, 'legacy' AS source_type,
    -- joined fields
    stores.name AS store_name,
    accounts.name AS account_name,
    products.name AS product_name,
    products.sku, products.sub_category,
    profiles.full_name AS staff_name,
    fiscal_calendar.fiscal_week, fiscal_calendar.fiscal_year
  FROM sales
  JOIN stores ON ...
  JOIN accounts ON ...
  JOIN products ON ...
  JOIN profiles ON ...
  LEFT JOIN fiscal_calendar ON fiscal_calendar.date = sales.sale_date

  UNION ALL

  -- New transactions (one row per transaction_item)
  SELECT
    transaction_items.id, transactions.id AS transaction_id,
    transactions.transaction_date AS sale_date,
    ...
    'transaction' AS source_type
  FROM transactions
  JOIN transaction_items ON ...
  JOIN stores ON ...
  ...
```

---

## Migration History Summary

| Migration | Description |
|---|---|
| 001 | Initial schema |
| 002 | RLS policies |
| 003 | Audit triggers + sales `created_by` |
| 004 | V2 refactor (accounts/stores) + JWT metadata sync |
| 005 | Data migration + `decrement_inventory` function |
| 006 | Fiscal calendar seed data |
| 007 | Branch → Store rename migration |
| 009 | Multi-store staff assignment (`staff_stores` table) |
| 010 | RLS updates for multi-store |
| 011 | Fiscal calendar fix for 2026 |
| 013 | Credit notes on POs |
| 015 | Fix `total_price` calculation in sales |
| 017 | Standardize `sub_category` values |
| 019 | `get_user_store_ids` RPC function |
| 022–023 | `transactions` + `transaction_items` tables |
| 024 | `unified_sales_export` view |
| 025 | `create_transaction_with_items` RPC function |
| 029 | `staff_targets` table |
| 030 | Allow staff to delete their own transactions |
