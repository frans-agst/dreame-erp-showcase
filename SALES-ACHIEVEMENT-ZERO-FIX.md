# Sales Achievement Showing Zero - Complete Fix

## Problem Summary
- **Local Environment**: Shows correct sales data (e.g., Rp 53,616,000 for TSM Cibubur)
- **Production Environment**: Shows Rp 0 for all stores
- **Latest Code**: Already deployed to production

## Root Cause
The issue is caused by **Row Level Security (RLS)** policies on the `sales` table. The RLS policy filters sales data based on user role:
- **Admin/Manager/Dealer**: Can see ALL sales
- **Staff**: Can only see sales from their assigned stores
- **No role or incorrect role**: Sees NO sales (Rp 0)

## Quick Fix (5 minutes)

### Step 1: Check Your Role in Production
1. Go to your Supabase Dashboard (production project)
2. Open **SQL Editor**
3. Run this query:

```sql
SELECT 
  id,
  email,
  role
FROM profiles
WHERE id = auth.uid();
```

4. Check the `role` column - it should be `'admin'`, `'manager'`, or `'dealer'`

### Step 2: Fix Your Role
If your role is `NULL`, `'staff'`, or anything else, run:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-actual-email@example.com';
```

Replace `'your-actual-email@example.com'` with your actual email address.

### Step 3: Refresh Your Session
1. **Log out** of your application
2. **Log back in** (this is critical - it refreshes your session token)
3. Navigate to **Sales Achievement** page
4. Select **March 2026** (or the month with sales data)
5. **Verify** sales amounts are now showing correctly

## If Quick Fix Doesn't Work

### Option A: Run Full Diagnostic
Run the diagnostic script to identify the exact issue:

1. Open `scripts/diagnose-sales-achievement.sql`
2. Copy all the SQL queries
3. Run them in Supabase SQL Editor (production)
4. Review the results to identify the problem

### Option B: Apply Comprehensive Fix
Run the comprehensive fix script:

1. Open `scripts/fix-sales-achievement-rls.sql`
2. Copy all the SQL
3. Run it in Supabase SQL Editor (production)
4. This will:
   - Create a bypass function for sales achievement
   - Improve the role checking logic
   - Update RLS policies to be more robust

### Option C: Check Migration Status
Ensure all migrations are applied:

1. Go to Supabase Dashboard → SQL Editor
2. Check if these migrations exist in your database:
   - `009_multi_store_staff_assignment.sql`
   - `010_update_rls_for_multi_store.sql`
3. If missing, run them from the `supabase/migrations/` folder

## Verification Checklist

After applying the fix, verify:

- [ ] Your user role is set to 'admin' in profiles table
- [ ] You logged out and logged back in
- [ ] Sales Achievement page loads without errors
- [ ] Sales amounts are displayed (not Rp 0)
- [ ] All stores show their correct sales data
- [ ] Filters (Account, Store) work correctly

## Why This Happened

The difference between local and production:

| Aspect | Local | Production |
|--------|-------|------------|
| User Role | Likely 'admin' | Might be NULL or 'staff' |
| Database | Test data with proper setup | Real data, role not set |
| Migrations | All applied | Some might be missing |
| Session | Fresh with correct role | Cached with old/wrong role |

## Prevention

To avoid this in the future:

1. **Always set user roles** when creating new users
2. **Test with production data** before considering deployment complete
3. **Verify RLS policies** work correctly for all roles
4. **Document admin credentials** and their roles
5. **Run diagnostic queries** after deployment

## Technical Details

### The RLS Policy
```sql
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager', 'dealer') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );
```

This policy:
- Checks user role via `get_user_role()` function
- If admin/manager/dealer → sees ALL sales
- If staff → sees only assigned store sales
- If no role → sees NOTHING (Rp 0)

### Why Logout/Login is Required
- Session tokens (JWT) cache user metadata including role
- Updating the database doesn't update the cached token
- Logging out and back in generates a new token with updated role
- Without this, the old token (with old role) is still used

## Files Created for This Fix

1. **scripts/diagnose-sales-achievement.sql** - Diagnostic queries
2. **scripts/fix-sales-achievement-rls.sql** - Comprehensive fix
3. **scripts/quick-fix-user-role.sql** - Quick role update
4. **scripts/SALES-ACHIEVEMENT-FIX-GUIDE.md** - Detailed guide
5. **SALES-ACHIEVEMENT-ZERO-FIX.md** - This file

## Need Help?

If the issue persists:

1. Check browser console (F12) for JavaScript errors
2. Check Supabase logs for database errors
3. Verify you're using the correct Supabase project
4. Ensure environment variables in Vercel are correct
5. Run all diagnostic queries and review results

## Summary

**Most likely fix**: Your user role is not set to 'admin' in production. Run the quick fix SQL to update your role, then log out and back in.

**Time to fix**: 5 minutes
**Difficulty**: Easy
**Risk**: Low (only updates user role)
