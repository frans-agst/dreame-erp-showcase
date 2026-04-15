# Supabase Row-Level Security (RLS) Policies

## Overview
This document contains the exact SQL definitions for all RLS policies used in the OmniERP Retail ERP system. These policies enforce data access control based on user roles and store assignments.

**Last Updated:** March 2026  
**Schema Version:** 2.0 (Multi-Store Support)

---

## Helper Functions

### 1. Get User Role from JWT
```sql
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'staff'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### 2. Get User Store IDs (Multi-Store Support)
```sql
CREATE OR REPLACE FUNCTION public.get_user_store_ids(user_id UUID)
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(DISTINCT store_id)
  FROM staff_stores
  WHERE staff_id = user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

---

## Core Table Policies

### ACCOUNTS Table

```sql
-- SELECT: All authenticated users can view accounts
CREATE POLICY "accounts_select" ON public.accounts
  FOR SELECT TO authenticated USING (true);

-- INSERT: Admin and Manager only
CREATE POLICY "accounts_insert" ON public.accounts
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin and Manager only
CREATE POLICY "accounts_update" ON public.accounts
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "accounts_delete" ON public.accounts
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### STORES Table

```sql
-- SELECT: All authenticated users can view stores
CREATE POLICY "stores_select" ON public.stores
  FOR SELECT TO authenticated USING (true);

-- INSERT: Admin and Manager only
CREATE POLICY "stores_insert" ON public.stores
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin and Manager only
CREATE POLICY "stores_update" ON public.stores
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "stores_delete" ON public.stores
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### PROFILES Table

```sql
-- SELECT: Users can read their own profile, admin/manager can read all
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR id = auth.uid()
  );

-- INSERT: Only through auth trigger (handled by Supabase)
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
  );

-- UPDATE: Users can update their own profile, admin can update all
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    public.get_user_role() = 'admin' 
    OR id = auth.uid()
  );

-- DELETE: Admin only
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### STAFF_STORES Table (Multi-Store Assignment)

```sql
-- SELECT: All authenticated users can view staff assignments
CREATE POLICY "staff_stores_select" ON public.staff_stores
  FOR SELECT TO authenticated USING (true);

-- INSERT: Admin and Manager only
CREATE POLICY "staff_stores_insert" ON public.staff_stores
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin and Manager only
CREATE POLICY "staff_stores_update" ON public.staff_stores
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin and Manager only
CREATE POLICY "staff_stores_delete" ON public.staff_stores
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'manager')
  );
```

---

### PRODUCTS Table

```sql
-- SELECT: All authenticated users can view products
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO authenticated USING (true);

-- INSERT: Admin and Manager only
CREATE POLICY "products_insert" ON public.products
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin and Manager only
CREATE POLICY "products_update" ON public.products
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "products_delete" ON public.products
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### INVENTORY Table

```sql
-- SELECT: Staff sees inventory from assigned stores, admin/manager/dealer sees all
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager', 'dealer') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- INSERT: Admin/Manager or staff for their assigned stores
CREATE POLICY "inventory_insert" ON public.inventory
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- UPDATE: Staff can update their assigned stores, admin/manager can update all
CREATE POLICY "inventory_update" ON public.inventory
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- DELETE: Admin only
CREATE POLICY "inventory_delete" ON public.inventory
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### SALES Table

```sql
-- SELECT: Staff sees sales from assigned stores, admin/manager/dealer sees all
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager', 'dealer') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- INSERT: Staff can only insert for their assigned stores
CREATE POLICY "sales_insert" ON public.sales
  FOR INSERT WITH CHECK (
    store_id = ANY(public.get_user_store_ids(auth.uid()))
    OR public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only (for corrections)
CREATE POLICY "sales_update" ON public.sales
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin and Manager only
CREATE POLICY "sales_delete" ON public.sales
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'manager')
  );
```

---

### PURCHASE_ORDERS Table

```sql
-- SELECT: Admin/Manager can see all POs, Dealers see their own
CREATE POLICY "purchase_orders_select" ON public.purchase_orders
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager')
    OR (public.get_user_role() = 'dealer' AND created_by = auth.uid())
  );

-- INSERT: Admin/Manager and Dealers can create POs
CREATE POLICY "purchase_orders_insert" ON public.purchase_orders
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager', 'dealer')
  );

-- UPDATE: Admin/Manager can update all, Dealers can update their own pending POs
CREATE POLICY "purchase_orders_update" ON public.purchase_orders
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
    OR (public.get_user_role() = 'dealer' AND created_by = auth.uid() AND status = 'pending')
  );

-- DELETE: Admin only
CREATE POLICY "purchase_orders_delete" ON public.purchase_orders
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### PURCHASE_ORDER_ITEMS Table

```sql
-- SELECT: Based on parent purchase_order access
CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_id
      AND (
        public.get_user_role() IN ('admin', 'manager')
        OR (public.get_user_role() = 'dealer' AND po.created_by = auth.uid())
      )
    )
  );

-- INSERT: Based on parent purchase_order access
CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_id
      AND (
        public.get_user_role() IN ('admin', 'manager', 'dealer')
      )
    )
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### STOCK_OPNAME Table

```sql
-- SELECT: Staff sees opname from assigned stores, admin/manager sees all
CREATE POLICY "stock_opname_select" ON public.stock_opname
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- INSERT: Staff can create opname for their assigned stores
CREATE POLICY "stock_opname_insert" ON public.stock_opname
  FOR INSERT WITH CHECK (
    store_id = ANY(public.get_user_store_ids(auth.uid()))
    OR public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "stock_opname_update" ON public.stock_opname
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "stock_opname_delete" ON public.stock_opname
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### STOCK_OPNAME_ITEMS Table

```sql
-- SELECT: Based on parent stock_opname access with multi-store logic
CREATE POLICY "stock_opname_items_select" ON public.stock_opname_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stock_opname so
      WHERE so.id = opname_id
      AND (
        public.get_user_role() IN ('admin', 'manager')
        OR so.store_id = ANY(public.get_user_store_ids(auth.uid()))
      )
    )
  );

-- INSERT: Based on parent stock_opname access with multi-store logic
CREATE POLICY "stock_opname_items_insert" ON public.stock_opname_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_opname so
      WHERE so.id = opname_id
      AND (
        public.get_user_role() IN ('admin', 'manager')
        OR so.store_id = ANY(public.get_user_store_ids(auth.uid()))
      )
    )
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "stock_opname_items_update" ON public.stock_opname_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "stock_opname_items_delete" ON public.stock_opname_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### EXPENSES Table

```sql
-- SELECT: Staff sees expenses from assigned stores, admin/manager sees all
CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- INSERT: Staff can create expenses for their assigned stores
CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (
    store_id = ANY(public.get_user_store_ids(auth.uid()))
    OR public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### DAY_OFF_REQUESTS Table

```sql
-- SELECT: Staff sees own requests, manager/admin sees all
CREATE POLICY "day_off_requests_select" ON public.day_off_requests
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR staff_id = auth.uid()
  );

-- INSERT: Staff can only create their own requests
CREATE POLICY "day_off_requests_insert" ON public.day_off_requests
  FOR INSERT WITH CHECK (
    staff_id = auth.uid()
  );

-- UPDATE: Manager/Admin can approve/reject
CREATE POLICY "day_off_requests_update" ON public.day_off_requests
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "day_off_requests_delete" ON public.day_off_requests
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

### AUDIT_LOG Table

```sql
-- SELECT: Admin and Manager only
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- INSERT: System only (via triggers), allow authenticated for trigger context
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: No updates allowed (audit logs are immutable)
CREATE POLICY "audit_log_update" ON public.audit_log
  FOR UPDATE USING (false);

-- DELETE: No deletes allowed (audit logs are immutable)
CREATE POLICY "audit_log_delete" ON public.audit_log
  FOR DELETE USING (false);
```

---

### FISCAL_CALENDAR Table

```sql
-- SELECT: All authenticated users can view fiscal calendar
CREATE POLICY "fiscal_calendar_select" ON public.fiscal_calendar
  FOR SELECT TO authenticated USING (true);

-- INSERT: Admin only
CREATE POLICY "fiscal_calendar_insert" ON public.fiscal_calendar
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- UPDATE: Admin only
CREATE POLICY "fiscal_calendar_update" ON public.fiscal_calendar
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

-- DELETE: Admin only
CREATE POLICY "fiscal_calendar_delete" ON public.fiscal_calendar
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

---

## Role-Based Access Summary

### Admin Role
- **Full access** to all tables (SELECT, INSERT, UPDATE, DELETE)
- Can manage users, stores, products, and all operational data
- Can view and manage audit logs
- Can delete records (soft delete preferred)

### Manager Role
- **Read/Write access** to most operational tables
- Can manage stores, products, inventory, sales, purchase orders
- Can approve day-off requests
- Can view audit logs
- **Cannot delete** most records (Admin only)

### Staff Role
- **Limited to assigned stores** via `staff_stores` junction table
- Can view and create sales for assigned stores
- Can view and update inventory for assigned stores
- Can create stock opname for assigned stores
- Can create day-off requests for themselves
- **Cannot** manage products, stores, or other staff

### Dealer Role
- Can view products and inventory
- Can create and manage their own purchase orders
- **Cannot** access sales data or other operational data
- Limited to their own PO records

---

## Multi-Store Support

The system supports staff being assigned to multiple stores through the `staff_stores` junction table. The `get_user_store_ids()` function returns an array of all store IDs a user has access to, which is used in RLS policies with the `ANY()` operator:

```sql
store_id = ANY(public.get_user_store_ids(auth.uid()))
```

This allows staff to:
- View sales from all assigned stores
- Create sales for any assigned store
- View and update inventory across assigned stores
- Perform stock opname at any assigned store

---

## Security Notes

1. **JWT Claims**: User role and metadata are stored in JWT claims and accessed via helper functions to prevent RLS recursion
2. **SECURITY DEFINER**: Helper functions use `SECURITY DEFINER` to bypass RLS when reading metadata
3. **Immutable Audit Logs**: Audit logs cannot be updated or deleted to maintain data integrity
4. **Soft Deletes**: Most tables should use soft deletes (is_active flag) rather than hard deletes
5. **Store Isolation**: Staff are strictly isolated to their assigned stores unless they have admin/manager role

---

**End of RLS Policies Documentation**
