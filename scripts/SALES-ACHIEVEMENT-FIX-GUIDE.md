# Sales Achievement Fix Guide

## Problem
The sales achievement page shows **Rp 0** for all stores in the deployed (production) environment, but works correctly in local development.

## Root Cause
The issue is caused by Row Level Security (RLS) policies on the `sales` table. The `getSalesAchievement` function queries sales data which is subject to RLS filtering. If the user's role or store assignments aren't properly configured in production, the RLS policy filters out all sales data, resulting in zero sales being displayed.

## Diagnosis Steps

### Step 1: Run Diagnostic Script
Run `scripts/diagnose-sales-achievement.sql` in your Supabase SQL Editor (production environment) to identify the exact issue.

Key things to check:
1. **User Role**: Is your admin user actually set as 'admin' in the profiles table?
2. **Store Assignments**: Are stores properly assigned to users?
3. **Sales Data**: Does sales data exist for the selected month?
4. **RLS Policies**: Are the RLS policies correctly configured?

### Step 2: Check User Role
```sql
SELECT 
  auth.uid() as user_id,
  auth.email() as email,
  p.role as profile_role
FROM profiles p
WHERE p.id = auth.uid();
```

**Expected Result**: Your role should be 'admin', 'manager', or 'dealer' to see all sales.

**If role is NULL or 'staff'**: You need to update your user role.

### Step 3: Check Sales Data
```sql
SELECT 
  store_id,
  COUNT(*) as sale_count,
  SUM(total_price) as total_sales
FROM sales
WHERE sale_date >= '2026-03-01'
  AND sale_date <= '2026-03-31'
GROUP BY store_id;
```

**Expected Result**: Should show sales data grouped by store.

**If no results**: Either no sales exist, or RLS is blocking access.

## Solutions

### Solution 1: Fix User Role (Most Common)

If your user role is not set correctly in production:

```sql
-- Update your user role to admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

After updating, **log out and log back in** for the change to take effect.

### Solution 2: Apply RLS Policy Fix

Run `scripts/fix-sales-achievement-rls.sql` in your Supabase SQL Editor. This script:

1. Creates a bypass function `get_sales_achievement_data()` that can read all sales
2. Improves the `get_user_role()` function to check multiple sources
3. Updates the RLS policy to be more robust

### Solution 3: Verify Store Assignments

If you're a staff user, ensure you have store assignments:

```sql
-- Check your store assignments
SELECT 
  ss.store_id,
  s.name as store_name,
  ss.is_primary
FROM staff_stores ss
JOIN stores s ON ss.store_id = s.id
WHERE ss.staff_id = auth.uid();
```

If no results, you need to assign stores to your user.

### Solution 4: Check Migration Status

Ensure all migrations have been applied to production:

1. Go to Supabase Dashboard → SQL Editor
2. Check if these migrations exist:
   - `009_multi_store_staff_assignment.sql`
   - `010_update_rls_for_multi_store.sql`

If missing, run them in order.

## Verification

After applying the fix:

1. **Log out and log back in** to refresh your session
2. Navigate to the Sales Achievement page
3. Select March 2026 (or the month with sales data)
4. Verify that sales amounts are displayed correctly

## Prevention

To prevent this issue in the future:

1. **Always test with production data** before deploying
2. **Verify user roles** after deployment
3. **Run diagnostic queries** if data appears missing
4. **Check RLS policies** when adding new features that query data

## Common Mistakes

1. **Forgetting to log out after role change**: Session tokens cache the role
2. **Not applying all migrations**: Missing migrations can cause RLS issues
3. **Using wrong environment**: Make sure you're testing in production, not local
4. **Assuming local = production**: Local might have different data or configurations

## Technical Details

### How RLS Works

The `sales_select` policy on the `sales` table:

```sql
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager', 'dealer') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );
```

This policy:
- Allows admin/manager/dealer to see ALL sales
- Allows staff to see only sales from their assigned stores
- Blocks access if role is not set or stores not assigned

### Why Local Works But Production Doesn't

Common reasons:
1. **Different user roles**: Local admin vs production staff
2. **Different data**: Local has test data, production has real data
3. **Migration mismatch**: Local has newer migrations than production
4. **Environment variables**: Different Supabase projects

## Need More Help?

If the issue persists after trying all solutions:

1. Run the full diagnostic script and share the results
2. Check browser console for JavaScript errors
3. Check Supabase logs for database errors
4. Verify environment variables in Vercel are correct
5. Ensure you're using the correct Supabase project (not a test project)

## Related Files

- `src/actions/sales.ts` - Contains `getSalesAchievement()` function
- `supabase/migrations/010_update_rls_for_multi_store.sql` - RLS policies
- `supabase/migrations/009d_complete_fix.sql` - `get_user_store_ids()` function
- `src/app/(dashboard)/sales/page.tsx` - Sales Achievement page component
