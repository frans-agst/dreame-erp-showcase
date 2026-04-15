# Dreame Retail ERP - Complete Database Schema

## Overview
This document provides the complete database schema for the Dreame Retail ERP system, including all tables, relationships, and key JSONB structures.

**Last Updated:** March 2026  
**Schema Version:** 2.0 (Post-Migration from Branches to Stores)

---

## Core Tables

### 1. `accounts` - Parent Organizations
Represents the top-level organizational entities (e.g., Brandstore, Modern Channel partners).

```sql
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- One-to-Many with `stores` (an account can have multiple stores)

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE: Admin and Manager only
- DELETE: Admin only

---

### 2. `stores` - Physical Store Locations
Represents individual store locations under an account.

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
```

**Relationships:**
- Many-to-One with `accounts`
- One-to-Many with `sales`, `inventory`, `stock_opname`
- Many-to-Many with `profiles` through `staff_stores`

**Indexes:**
- `idx_stores_account_id` on `account_id`
- `idx_stores_is_active` on `is_active`

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE: Admin and Manager only
- DELETE: Admin only

---

### 3. `profiles` - User Profiles
Extended user information linked to Supabase Auth.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'dealer')),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- One-to-One with `auth.users`
- Many-to-One with `stores` (primary store)
- Many-to-Many with `stores` through `staff_stores` (multi-store assignment)

**RLS Policies:**
- SELECT: All authenticated users
- UPDATE: Self or Admin/Manager

---

### 4. `staff_stores` - Multi-Store Staff Assignment
Junction table for staff assigned to multiple stores.

```sql
CREATE TABLE public.staff_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, store_id)
);
```

**Relationships:**
- Many-to-One with `profiles`
- Many-to-One with `stores`

**Indexes:**
- `idx_staff_stores_staff_id` on `staff_id`
- `idx_staff_stores_store_id` on `store_id`

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Admin and Manager only

---

### 5. `products` - Product Catalog
Master product catalog with SKU, pricing, and categorization.

```sql
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  price_before_tax DECIMAL(15,2) NOT NULL CHECK (price_before_tax >= 0),
  price_after_tax DECIMAL(15,2) NOT NULL CHECK (price_after_tax >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- One-to-Many with `sales`, `inventory`, `purchase_order_items`

**Indexes:**
- `idx_products_sku` on `sku`
- `idx_products_category` on `category`
- `idx_products_is_active` on `is_active`

**RLS Policies:**
- SELECT: All authenticated users
- INSERT/UPDATE: Admin and Manager only
- DELETE: Admin only

---

### 6. `inventory` - Store Inventory Levels
Tracks product quantities at each store.

```sql
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);
```

**Relationships:**
- Many-to-One with `stores`
- Many-to-One with `products`

**Indexes:**
- `idx_inventory_store_id` on `store_id`
- `idx_inventory_product_id` on `product_id`

**RLS Policies:**
- SELECT: Staff can view own store inventory, Admin/Manager can view all
- INSERT/UPDATE: Staff can modify own store, Admin/Manager can modify all

---

### 7. `sales` - Sales Transactions
Records individual sales transactions with customer and gift details.

```sql
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sale_date DATE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  discount DECIMAL(15,2) DEFAULT 0 CHECK (discount >= 0),
  total_price DECIMAL(15,2) NOT NULL CHECK (total_price >= 0),
  customer_name TEXT,
  customer_phone TEXT,
  gift_details JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**JSONB Structure - `gift_details`:**
```json
[
  {
    "name": "Gift Product Name",
    "qty": 1
  }
]
```

**Relationships:**
- Many-to-One with `stores`
- Many-to-One with `products`
- Many-to-One with `profiles` (staff_id and created_by)

**Indexes:**
- `idx_sales_store_id` on `store_id`
- `idx_sales_product_id` on `product_id`
- `idx_sales_staff_id` on `staff_id`
- `idx_sales_sale_date` on `sale_date`
- `idx_sales_created_by` on `created_by`

**RLS Policies:**
- SELECT: Staff can view own store sales, Admin/Manager can view all
- INSERT: Staff can create for own store, Admin/Manager can create for all
- DELETE: Admin and Manager only

---

### 8. `purchase_orders` - Purchase Orders
Tracks purchase orders from suppliers.

```sql
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL,
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'received', 'cancelled')),
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount >= 0),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- Many-to-One with `stores`
- One-to-Many with `purchase_order_items`

**Indexes:**
- `idx_po_store_id` on `store_id`
- `idx_po_status` on `status`
- `idx_po_order_date` on `order_date`

**RLS Policies:**
- SELECT: Staff can view own store POs, Admin/Manager can view all
- INSERT/UPDATE: Admin and Manager only
- DELETE: Admin only

---

### 9. `purchase_order_items` - PO Line Items
Individual items within a purchase order.

```sql
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(15,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- Many-to-One with `purchase_orders`
- Many-to-One with `products`

**Indexes:**
- `idx_po_items_po_id` on `po_id`
- `idx_po_items_product_id` on `product_id`

---

### 10. `stock_opname` - Stock Taking Sessions
Physical inventory count sessions.

```sql
CREATE TABLE public.stock_opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  opname_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- Many-to-One with `stores`
- One-to-Many with `stock_opname_items`

**Indexes:**
- `idx_stock_opname_store_id` on `store_id`
- `idx_stock_opname_date` on `opname_date`

---

### 11. `stock_opname_items` - Stock Count Details
Individual product counts within a stock taking session.

```sql
CREATE TABLE public.stock_opname_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID NOT NULL REFERENCES public.stock_opname(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  system_quantity INTEGER NOT NULL,
  actual_quantity INTEGER NOT NULL,
  variance INTEGER GENERATED ALWAYS AS (actual_quantity - system_quantity) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- Many-to-One with `stock_opname`
- Many-to-One with `products`

**Indexes:**
- `idx_stock_opname_items_opname_id` on `opname_id`
- `idx_stock_opname_items_product_id` on `product_id`

---

### 12. `expenses` - Business Expenses
Tracks operational expenses by store.

```sql
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- Many-to-One with `stores`

**Indexes:**
- `idx_expenses_store_id` on `store_id`
- `idx_expenses_date` on `expense_date`
- `idx_expenses_category` on `category`

---

### 13. `day_off_requests` - Staff Leave Requests
Manages staff time-off requests.

```sql
CREATE TABLE public.day_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- Many-to-One with `profiles` (staff_id and approved_by)

**Indexes:**
- `idx_day_off_staff_id` on `staff_id`
- `idx_day_off_status` on `status`

---

### 14. `fiscal_calendar` - Fiscal Week Calendar
Defines fiscal weeks for reporting.

```sql
CREATE TABLE public.fiscal_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  fiscal_year INTEGER NOT NULL,
  fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  fiscal_week INTEGER NOT NULL CHECK (fiscal_week BETWEEN 1 AND 53),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `idx_fiscal_calendar_date` on `date`
- `idx_fiscal_calendar_year_week` on `(fiscal_year, fiscal_week)`
- `idx_fiscal_calendar_year_month` on `(fiscal_year, fiscal_month)`

---

### 15. `audit_log` - System Audit Trail
Tracks all data changes for compliance and debugging.

```sql
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `idx_audit_log_user_id` on `user_id`
- `idx_audit_log_table_name` on `table_name`
- `idx_audit_log_created_at` on `created_at`

**RLS Policies:**
- SELECT: Admin only
- INSERT: Automatic via triggers (no direct access)

---

## Key Functions

### 1. `get_user_store_ids(user_id UUID)` - Multi-Store Access
Returns array of store IDs a user has access to.

```sql
CREATE OR REPLACE FUNCTION get_user_store_ids(user_id UUID)
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(DISTINCT store_id)
  FROM staff_stores
  WHERE staff_id = user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### 2. `decrement_inventory(store_id UUID, product_id UUID, qty INTEGER)` - Inventory Management
Atomically decrements inventory with stock validation.

```sql
CREATE OR REPLACE FUNCTION decrement_inventory(
  p_store_id UUID,
  p_product_id UUID,
  p_qty INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_current_qty INTEGER;
  v_new_qty INTEGER;
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

### 3. `log_audit_event()` - Audit Trigger Function
Automatically logs INSERT/UPDATE/DELETE operations.

```sql
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  v_old_value JSONB;
  v_new_value JSONB;
  v_record_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old_value := to_jsonb(OLD);
    v_new_value := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_old_value := to_jsonb(OLD);
    v_new_value := to_jsonb(NEW);
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old_value := NULL;
    v_new_value := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (
    user_id, action, table_name, record_id, old_value, new_value, created_at
  ) VALUES (
    auth.uid(), TG_OP, TG_TABLE_NAME, v_record_id, v_old_value, v_new_value, NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Audit Triggers

All major tables have audit triggers enabled:
- `accounts`
- `stores`
- `staff_stores`
- `profiles`
- `products`
- `inventory`
- `sales`
- `purchase_orders`
- `day_off_requests`
- `stock_opname`
- `expenses`

---

## Migration History

### Key Migrations:
1. **001_initial_schema.sql** - Initial database structure
2. **002_rls_policies.sql** - Row Level Security policies
3. **003_audit_triggers.sql** - Audit logging system
4. **004_v2_refactor.sql** - V2 schema with accounts/stores
5. **007_branch_to_store_migration.sql** - Renamed branches → stores
6. **009_multi_store_staff_assignment.sql** - Multi-store support
7. **018_fix_audit_triggers.sql** - Fixed staff_stores audit trigger
8. **019_add_sales_rpc_function.sql** - RPC function for sales queries
9. **020_fix_all_audit_triggers.sql** - Comprehensive audit trigger fix

---

## Notes

- All timestamps use `TIMESTAMPTZ` for timezone awareness
- All monetary values use `DECIMAL(15,2)` for precision
- UUIDs are used for all primary keys
- RLS is enabled on all tables for security
- Audit logging captures all data changes
- Multi-store staff assignment supported via `staff_stores` junction table

---

**End of Schema Documentation**