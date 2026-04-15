# Multi-Store Staff Assignment - Deployment Guide

This guide provides step-by-step instructions for deploying the multi-store staff assignment feature to production.

## Overview

The multi-store staff assignment feature enables staff members to be assigned to multiple stores simultaneously. This deployment involves:
- Database schema changes (new junction table)
- Data migration from single-store to multi-store model
- RLS policy updates
- Application code updates
- Session management changes

**Estimated Deployment Time**: 15-30 minutes  
**Downtime Required**: Zero (backward compatible)  
**Rollback Time**: 5-10 minutes

## Pre-Deployment Checklist

Before starting deployment, ensure:

- [ ] All code changes are merged to main branch
- [ ] All tests pass locally (`npm run test`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Database backup is created
- [ ] You have admin access to Supabase dashboard
- [ ] You have reviewed the migration SQL scripts
- [ ] Stakeholders are notified of deployment window
- [ ] Rollback plan is understood by team

## Deployment Steps

### Phase 1: Database Schema Creation (5 minutes)

This phase creates the new `staff_stores` junction table and helper function without affecting existing functionality.

#### 1.1 Create Junction Table and Indexes

Run the following SQL in Supabase SQL Editor:

```sql
-- Create staff_stores junction table
CREATE TABLE IF NOT EXISTS staff_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_staff_store UNIQUE (staff_id, store_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_stores_staff_id ON staff_stores(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_stores_store_id ON staff_stores(store_id);

-- Ensure each staff has exactly one primary store
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_primary_store 
  ON staff_stores (staff_id) 
  WHERE is_primary = true;
```

**Verification**:
```sql
-- Verify table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'staff_stores';

-- Verify indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'staff_stores';
```

#### 1.2 Create Helper Function

```sql
-- Create helper function for getting user store IDs
CREATE OR REPLACE FUNCTION get_user_store_ids(user_id UUID)
RETURNS UUID[] AS $$
DECLARE
  user_role TEXT;
  store_ids UUID[];
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  
  -- Admin, manager, and dealer see all stores
  IF user_role IN ('admin', 'manager', 'dealer') THEN
    SELECT ARRAY_AGG(id) INTO store_ids FROM stores WHERE is_active = true;
    RETURN store_ids;
  END IF;
  
  -- Staff: get assigned stores from junction table
  SELECT ARRAY_AGG(store_id) INTO store_ids 
  FROM staff_stores 
  WHERE staff_id = user_id;
  
  -- Fallback to profiles.store_id for backward compatibility
  IF store_ids IS NULL OR array_length(store_ids, 1) IS NULL THEN
    SELECT ARRAY[store_id] INTO store_ids 
    FROM profiles 
    WHERE id = user_id AND store_id IS NOT NULL;
  END IF;
  
  RETURN COALESCE(store_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

**Verification**:
```sql
-- Test helper function with an admin user
SELECT get_user_store_ids('admin-user-id-here');

-- Test helper function with a staff user
SELECT get_user_store_ids('staff-user-id-here');
```

#### 1.3 Create RLS Policies for staff_stores

```sql
-- Enable RLS on staff_stores table
ALTER TABLE staff_stores ENABLE ROW LEVEL SECURITY;

-- Staff can view their own assignments
CREATE POLICY "staff_view_own_assignments" ON staff_stores
  FOR SELECT
  USING (staff_id = auth.uid());

-- Admins can manage all assignments
CREATE POLICY "admin_manage_assignments" ON staff_stores
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Verification**:
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'staff_stores';

-- Verify policies exist
SELECT policyname FROM pg_policies 
WHERE tablename = 'staff_stores';
```

### Phase 2: Data Migration (5 minutes)

This phase migrates existing single-store assignments to the new multi-store model.

#### 2.1 Migrate Existing Assignments

```sql
-- Migrate existing single-store assignments to junction table
INSERT INTO staff_stores (staff_id, store_id, is_primary, assigned_at)
SELECT 
  id as staff_id,
  store_id,
  true as is_primary,
  created_at as assigned_at
FROM profiles
WHERE role = 'staff' 
  AND store_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM staff_stores WHERE staff_id = profiles.id
  );
```

#### 2.2 Verify Migration

```sql
-- Count staff with store_id in profiles
SELECT COUNT(*) as staff_with_store_id
FROM profiles
WHERE role = 'staff' AND store_id IS NOT NULL;

-- Count staff with assignments in staff_stores
SELECT COUNT(DISTINCT staff_id) as staff_with_assignments
FROM staff_stores;

-- These counts should match
-- If they don't, investigate missing assignments

-- Check for staff without assignments
SELECT id, email, name, store_id
FROM profiles
WHERE role = 'staff' 
  AND store_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM staff_stores WHERE staff_id = profiles.id
  );
```

**Expected Result**: Both counts should match, and the last query should return 0 rows.

#### 2.3 Verify Primary Store Flags

```sql
-- Verify each staff has exactly one primary store
SELECT staff_id, COUNT(*) as primary_count
FROM staff_stores
WHERE is_primary = true
GROUP BY staff_id
HAVING COUNT(*) != 1;
```

**Expected Result**: This query should return 0 rows (no staff with multiple or zero primary stores).

### Phase 3: Update RLS Policies (5 minutes)

This phase updates existing RLS policies to use the new multi-store model.

#### 3.1 Update Sales Table Policies

```sql
-- Drop old single-store policies
DROP POLICY IF EXISTS "staff_view_own_store_sales" ON sales;
DROP POLICY IF EXISTS "staff_insert_own_store_sales" ON sales;
DROP POLICY IF EXISTS "staff_update_own_store_sales" ON sales;

-- Create new multi-store policies
CREATE POLICY "staff_view_assigned_store_sales" ON sales
  FOR SELECT
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

CREATE POLICY "staff_insert_assigned_store_sales" ON sales
  FOR INSERT
  WITH CHECK (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

CREATE POLICY "staff_update_assigned_store_sales" ON sales
  FOR UPDATE
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );
```

#### 3.2 Update Inventory Table Policies

```sql
-- Drop old single-store policies
DROP POLICY IF EXISTS "staff_view_own_store_inventory" ON inventory;

-- Create new multi-store policy
CREATE POLICY "staff_view_assigned_store_inventory" ON inventory
  FOR SELECT
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );
```

#### 3.3 Update Stock Opname Policies

```sql
-- Drop old policies
DROP POLICY IF EXISTS "staff_view_own_store_stock_opname" ON stock_opname;
DROP POLICY IF EXISTS "staff_insert_own_store_stock_opname" ON stock_opname;
DROP POLICY IF EXISTS "staff_update_own_store_stock_opname" ON stock_opname;

-- Create new multi-store policies
CREATE POLICY "staff_view_assigned_store_stock_opname" ON stock_opname
  FOR SELECT
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

CREATE POLICY "staff_insert_assigned_store_stock_opname" ON stock_opname
  FOR INSERT
  WITH CHECK (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

CREATE POLICY "staff_update_assigned_store_stock_opname" ON stock_opname
  FOR UPDATE
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );
```

#### 3.4 Update Expenses Table Policies

```sql
-- Drop old policies
DROP POLICY IF EXISTS "staff_view_own_store_expenses" ON expenses;
DROP POLICY IF EXISTS "staff_insert_own_store_expenses" ON expenses;

-- Create new multi-store policies
CREATE POLICY "staff_view_assigned_store_expenses" ON expenses
  FOR SELECT
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

CREATE POLICY "staff_insert_assigned_store_expenses" ON expenses
  FOR INSERT
  WITH CHECK (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );
```

**Verification**:
```sql
-- Verify new policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('sales', 'inventory', 'stock_opname', 'expenses')
ORDER BY tablename, policyname;
```

### Phase 4: Deploy Application Code (5-10 minutes)

#### 4.1 Deploy to Vercel

If using automatic deployments:
```bash
# Push to main branch
git push origin main

# Vercel will automatically deploy
```

If using manual deployment:
```bash
# Deploy to production
vercel --prod
```

#### 4.2 Verify Deployment

1. Check Vercel deployment logs for errors
2. Verify build completed successfully
3. Check that all environment variables are set

### Phase 5: Post-Deployment Verification (5 minutes)

#### 5.1 Test Multi-Store Functionality

**As Admin**:
1. Log in as admin user
2. Navigate to Master Data → Staff Assignments
3. Verify staff list loads correctly
4. Assign a second store to a test staff member
5. Verify assignment appears in the list
6. Change primary store for the staff member
7. Verify primary store indicator updates

**As Multi-Store Staff**:
1. Log in as staff member with multiple stores
2. Verify store selector appears in header
3. Verify current store is displayed
4. Switch to different store
5. Verify page reloads with new context
6. Create a sale in the new store context
7. Verify sale is created in correct store

**As Single-Store Staff**:
1. Log in as staff member with one store
2. Verify store selector does NOT appear
3. Verify normal functionality works

#### 5.2 Test Backward Compatibility

```sql
-- Verify profiles.store_id still contains primary store
SELECT p.id, p.email, p.store_id as profile_store, ss.store_id as primary_store
FROM profiles p
LEFT JOIN staff_stores ss ON p.id = ss.staff_id AND ss.is_primary = true
WHERE p.role = 'staff'
LIMIT 10;
```

**Expected Result**: `profile_store` and `primary_store` should match for all staff.

#### 5.3 Test RLS Policies

```sql
-- Test as staff user (replace with actual staff user ID)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "staff-user-id-here"}';

-- Should only see assigned stores
SELECT * FROM sales LIMIT 5;
SELECT * FROM inventory LIMIT 5;

-- Reset
RESET role;
```

#### 5.4 Monitor Error Logs

1. Check Vercel deployment logs for runtime errors
2. Check Supabase logs for database errors
3. Monitor for authentication issues
4. Check for RLS policy violations

## Rollback Procedures

If issues arise, follow these rollback steps:

### Rollback Level 1: Application Code Only (5 minutes)

If the issue is in the application code but database is fine:

```bash
# In Vercel dashboard:
# 1. Go to Deployments
# 2. Find previous working deployment
# 3. Click "..." → "Promote to Production"
```

### Rollback Level 2: RLS Policies (5 minutes)

If RLS policies are causing issues:

```sql
-- Revert sales policies
DROP POLICY IF EXISTS "staff_view_assigned_store_sales" ON sales;
DROP POLICY IF EXISTS "staff_insert_assigned_store_sales" ON sales;
DROP POLICY IF EXISTS "staff_update_assigned_store_sales" ON sales;

CREATE POLICY "staff_view_own_store_sales" ON sales
  FOR SELECT
  USING (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "staff_insert_own_store_sales" ON sales
  FOR INSERT
  WITH CHECK (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "staff_update_own_store_sales" ON sales
  FOR UPDATE
  USING (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
  );

-- Repeat for other tables (inventory, stock_opname, expenses)
```

### Rollback Level 3: Full Rollback (10 minutes)

If complete rollback is needed:

```sql
-- 1. Revert RLS policies (see Level 2)

-- 2. Drop new policies
DROP POLICY IF EXISTS "staff_view_own_assignments" ON staff_stores;
DROP POLICY IF EXISTS "admin_manage_assignments" ON staff_stores;

-- 3. Disable RLS on staff_stores
ALTER TABLE staff_stores DISABLE ROW LEVEL SECURITY;

-- 4. Drop helper function
DROP FUNCTION IF EXISTS get_user_store_ids(UUID);

-- 5. Keep staff_stores table for future retry
-- DO NOT DROP - data is valuable for next attempt

-- 6. Rollback application code (see Level 1)
```

**Note**: We keep the `staff_stores` table and data even in full rollback. This allows for easier retry without re-migration.

## Backward Compatibility Period

The system maintains backward compatibility for **30 days** after deployment:

- `profiles.store_id` continues to be updated with primary store
- Helper function falls back to `profiles.store_id` if no assignments exist
- Old code can still use `profiles.store_id` during transition

After 30 days:
- Review all code for `profiles.store_id` usage
- Update any remaining references to use `staff_stores`
- Consider deprecating `profiles.store_id` field (but keep for audit trail)

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Assignment Operations**:
   - Number of store assignments created per day
   - Number of primary store changes per day
   - Failed assignment operations

2. **Session Management**:
   - Store context switches per user per day
   - Invalid store context errors
   - Session refresh failures

3. **Data Access**:
   - RLS policy violations
   - Unauthorized access attempts
   - Query performance for multi-store users

4. **Database Performance**:
   - Query execution time for `get_user_store_ids`
   - Index usage on `staff_stores` table
   - JOIN performance with store data

### Recommended Alerts

Set up alerts for:
- More than 10 RLS policy violations per hour
- More than 5 failed assignment operations per hour
- Query execution time > 1 second for store assignments
- Any staff member with zero store assignments

## Troubleshooting

### Issue: Staff Cannot See Any Data

**Symptoms**: Staff user logs in but sees no sales, inventory, or other data.

**Diagnosis**:
```sql
-- Check if staff has any assignments
SELECT * FROM staff_stores WHERE staff_id = 'user-id-here';

-- Check what get_user_store_ids returns
SELECT get_user_store_ids('user-id-here');
```

**Solution**:
- If no assignments: Assign at least one store to the staff member
- If assignments exist but function returns empty: Check RLS policies on staff_stores

### Issue: Store Selector Not Appearing

**Symptoms**: Multi-store staff doesn't see store selector in header.

**Diagnosis**:
- Check browser console for JavaScript errors
- Verify user metadata contains `assigned_store_ids`
- Check if user has more than one store assignment

**Solution**:
- Clear browser cache and reload
- Log out and log back in to refresh session
- Verify middleware is loading store assignments

### Issue: "Cannot Remove Last Store Assignment" Error

**Symptoms**: Admin cannot remove a store assignment.

**Diagnosis**:
```sql
-- Check how many assignments the staff has
SELECT COUNT(*) FROM staff_stores WHERE staff_id = 'staff-id-here';
```

**Solution**:
- This is expected behavior - staff must have at least one store
- Assign a different store first, then remove the unwanted one

### Issue: Primary Store Not Syncing to profiles.store_id

**Symptoms**: `profiles.store_id` doesn't match primary store in `staff_stores`.

**Diagnosis**:
```sql
-- Check for mismatch
SELECT p.id, p.email, p.store_id as profile_store, ss.store_id as primary_store
FROM profiles p
LEFT JOIN staff_stores ss ON p.id = ss.staff_id AND ss.is_primary = true
WHERE p.role = 'staff' AND p.store_id != ss.store_id;
```

**Solution**:
```sql
-- Sync primary stores to profiles
UPDATE profiles p
SET store_id = ss.store_id
FROM staff_stores ss
WHERE p.id = ss.staff_id 
  AND ss.is_primary = true 
  AND p.store_id != ss.store_id;
```

## Support and Escalation

### Level 1: Application Issues
- Check Vercel deployment logs
- Review browser console errors
- Verify environment variables

### Level 2: Database Issues
- Check Supabase logs
- Review RLS policy violations
- Verify migration completed successfully

### Level 3: Critical Issues
- Execute rollback procedure
- Notify stakeholders
- Schedule post-mortem review

## Post-Deployment Tasks

Within 24 hours:
- [ ] Monitor error logs for anomalies
- [ ] Verify all staff can access their data
- [ ] Check performance metrics
- [ ] Gather user feedback

Within 1 week:
- [ ] Review audit logs for assignment changes
- [ ] Analyze store context switching patterns
- [ ] Optimize queries if performance issues found
- [ ] Update user documentation based on feedback

Within 30 days:
- [ ] Review backward compatibility usage
- [ ] Plan for `profiles.store_id` deprecation
- [ ] Conduct user training on multi-store features
- [ ] Document lessons learned

## Success Criteria

Deployment is considered successful when:
- ✅ All database migrations completed without errors
- ✅ All RLS policies updated and verified
- ✅ Application deployed and accessible
- ✅ Admin can manage store assignments
- ✅ Multi-store staff can switch between stores
- ✅ Single-store staff functionality unchanged
- ✅ No increase in error rates
- ✅ All tests passing in production
- ✅ User feedback is positive

---

**Deployment completed successfully! 🎉**

For questions or issues, refer to the [User Guide](./USER-GUIDE.md) or [API Documentation](./API-DOCUMENTATION.md).
