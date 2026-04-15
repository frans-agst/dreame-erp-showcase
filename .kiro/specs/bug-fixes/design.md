# Design Document: Bug Fixes for Audit Log and Sales Achievement

## Overview

This design addresses two critical bugs:
1. Missing audit trigger for the staff_stores table
2. Schema mismatch where code uses `sale_date` but database has `transaction_date`

## Root Cause Analysis

### Issue 1: Audit Log Missing Recent Data
- The `staff_stores` table is listed in the audited tables array but has no trigger attached
- The migration file `003_audit_triggers.sql` creates triggers for 8 tables but omits `staff_stores`
- This causes staff assignment changes to not be logged

### Issue 2: Sales Achievement Shows Zero in Production Only

**Root Cause Identified:**
- **Date Serialization Bug**: When passing a JavaScript `Date` object from client to server in Next.js server actions, the Date gets serialized to ISO string format and then deserialized, causing timezone conversion issues
- **Symptom**: UI showed "March 2026" but the server received "2026-02-28T17:00:00.000Z" (February 28 in UTC), resulting in querying the wrong month
- **Solution**: Pass month as a simple string format `"YYYY-MM"` instead of Date object to avoid serialization/timezone issues

**Environment-Specific Bug:**
- **Local Development**: Sales achievement displays correct values (e.g., Rp 53,616,000 for TSM Cibubur)
- **Production (Vercel)**: Sales achievement shows Rp 0 for all stores
- **Same Database**: Both environments use the same Supabase project
- **Same User**: Same account with admin role in both environments
- **Same Code**: Latest code deployed to production

**Debugging Findings:**

1. **Database Verification** ✅
   - SQL query confirms 16 sales exist for March 2026
   - Total sales: Rp 56,606,000
   - Store IDs match between sales and stores tables

2. **RLS Policies** ✅
   - User has admin role in both environments
   - Test endpoint `/api/test-sales-direct` successfully retrieves sales data
   - No permission errors

3. **Query Execution** ✅
   - Direct Supabase query returns data (10 rows)
   - Store IDs are correct UUIDs
   - Date range is correct ('2026-03-01' to '2026-03-31')

4. **Server Logs** ❌
   - `[getSalesAchievement]` logs do NOT appear in production console
   - Suggests function may not be executing or logs are suppressed
   - Client-side logs appear correctly

5. **Data Aggregation** ❌
   - Sales data is fetched but aggregation returns 0
   - `salesByStore` object appears to be empty
   - All stores show `sales: 0` in the final result

**Suspected Root Causes:**

1. **Caching Issue**
   - Next.js might be caching the server action response
   - Vercel edge caching might be serving stale data
   - Supabase client might have cached empty results

2. **Server Action Execution**
   - Function might be returning cached/memoized results
   - Logs not appearing suggests execution path difference
   - Build-time vs runtime data fetching

3. **Data Type Mismatch**
   - Store IDs might be compared as different types (string vs UUID)
   - Aggregation logic might be failing silently
   - Type coercion issues in production build

4. **Environment Configuration**
   - Supabase client configuration difference
   - Environment variables not properly set
   - Different Next.js runtime behavior

## Architecture

### Fix 1: Add Missing Audit Trigger

Create a new migration file that adds the audit trigger for `staff_stores`:

```sql
-- Add audit trigger for staff_stores table
CREATE TRIGGER audit_staff_stores
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_stores
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
```

### Fix 2: Sales Achievement Production Issue

**Approach: Multi-Pronged Investigation and Fix**

Since the issue is environment-specific and data/permissions are confirmed working, we need to address potential caching and execution issues.

**Step 1: Force No Caching**

Add explicit cache control to the server action:

```typescript
// At top of src/actions/sales.ts
'use server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

**Step 2: Add Explicit Ordering to Query**

Prevent query result caching by adding ordering:

```typescript
const { data: salesData, error: salesError } = await supabase
  .from('sales')
  .select('store_id, total_price, sale_date')
  .gte('sale_date', salesStartDate)
  .lte('sale_date', salesEndDate)
  .order('sale_date', { ascending: false }); // Prevent caching
```

**Step 3: Enhanced Logging**

Add comprehensive logging that will appear in Vercel logs:

```typescript
console.log('[getSalesAchievement] Query params:', { salesStartDate, salesEndDate });
console.log('[getSalesAchievement] Raw result:', { 
  count: salesData?.length,
  firstRow: salesData?.[0],
  storeIds: salesData?.map(s => s.store_id).slice(0, 5)
});
console.error('[FORCE LOG]', JSON.stringify({ salesData: salesData?.length }));
```

**Step 4: Verify Data Types**

Ensure store ID comparison works correctly:

```typescript
// Aggregate sales by store
const salesByStore: Record<string, number> = {};
(salesData || []).forEach((sale) => {
  const storeId = String(sale.store_id); // Ensure string type
  if (storeId) {
    const price = Number(sale.total_price || 0);
    salesByStore[storeId] = (salesByStore[storeId] || 0) + price;
  }
});

// When matching stores
stores.map((store) => {
  const storeIdStr = String(store.id); // Ensure string type
  const sales = salesByStore[storeIdStr] || 0;
  // ...
});
```

**Step 5: Alternative Query Method**

If caching persists, use a different query approach:

```typescript
// Use RPC function to bypass caching
const { data: salesData } = await supabase.rpc('get_sales_for_month', {
  start_date: salesStartDate,
  end_date: salesEndDate
});
```

Create the RPC function in a migration:

```sql
CREATE OR REPLACE FUNCTION get_sales_for_month(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  store_id UUID,
  total_price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.store_id, s.total_price
  FROM sales s
  WHERE s.sale_date >= start_date
    AND s.sale_date <= end_date;
END;
$$ LANGUAGE plpgsql STABLE;
```

## Components and Interfaces

### Files to Update

1. **supabase/migrations/004_fix_audit_triggers.sql** (NEW)
   - Add missing staff_stores audit trigger

2. **src/actions/sales.ts**
   - Replace `sale_date` with `transaction_date` in all queries
   - Update field names in data structures

3. **src/actions/dashboard.ts**
   - Replace `sale_date` with `transaction_date` in all queries

4. **src/types/index.ts**
   - Update Sale interface to use `transaction_date`

5. **src/actions/sales.test.ts**
   - Update test data to use `transaction_date`

## Data Models

### Sale Interface (Updated)

```typescript
export interface Sale {
  id: string;
  store_id: string;
  product_id: string;
  staff_id: string;
  transaction_date: string;  // Changed from sale_date
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  // ... other fields
}
```

### WeeklySalesItem Interface (Updated)

```typescript
export interface WeeklySalesItem {
  id: string;
  transaction_date: string;  // Changed from sale_date
  fiscal_week: number;
  // ... other fields
}
```

## Implementation Details

### Migration File Structure

```sql
-- Migration: 004_fix_audit_triggers.sql
-- Description: Add missing audit trigger for staff_stores table

-- Add audit trigger for staff_stores
CREATE TRIGGER audit_staff_stores
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_stores
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
```

### Query Updates Pattern

Before:
```typescript
.gte('sale_date', startDate)
.lte('sale_date', endDate)
.order('sale_date', { ascending: false })
```

After:
```typescript
.gte('transaction_date', startDate)
.lte('transaction_date', endDate)
.order('transaction_date', { ascending: false })
```

### Form Data Mapping

When creating sales, map form field to database column:

```typescript
const saleData = {
  // ... other fields
  transaction_date: validatedData.sale_date || todayStr,  // Map sale_date input to transaction_date column
};
```

## Error Handling

- If migration fails, the trigger can be added manually via SQL console
- If column name updates cause issues, verify the actual database schema
- Add console logging to debug query results during testing

## Testing Strategy

### Manual Testing Steps

1. **Test Audit Log Fix:**
   - Run the migration
   - Create/update/delete a staff_stores record
   - Verify audit log entry appears in audit_log table
   - Check audit log page shows the new entry

2. **Test Sales Achievement Fix:**
   - Verify sales data exists in database with transaction_date
   - Navigate to sales achievement page
   - Confirm non-zero values appear for stores with sales
   - Verify calculations match expected values

3. **Test Dashboard Fix:**
   - Navigate to dashboard
   - Verify GMV metrics show correct values
   - Check that trends chart displays data
   - Confirm product performance table has data

### Verification Queries

```sql
-- Verify audit trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'audit_staff_stores';

-- Verify sales data structure
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'sales' AND column_name LIKE '%date%';

-- Test sales query
SELECT store_id, SUM(total_price) as total
FROM sales
WHERE transaction_date >= '2024-01-01'
GROUP BY store_id;
```

## Rollback Plan

If issues occur:

1. **Audit Trigger:** Drop the trigger
   ```sql
   DROP TRIGGER IF EXISTS audit_staff_stores ON public.staff_stores;
   ```

2. **Column Names:** Revert code changes via git
   ```bash
   git checkout HEAD -- src/actions/sales.ts src/actions/dashboard.ts
   ```

## Deployment Notes

1. Run migration first: `supabase db push`
2. Deploy code changes
3. Clear any cached queries
4. Monitor error logs for 24 hours
5. Verify audit log entries are being created
6. Confirm sales achievement shows correct data
