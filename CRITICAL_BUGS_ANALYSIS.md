# Critical Bugs Analysis - OmniERP Retail ERP

**Purpose:** Documentation of the most critical and complex bugs encountered throughout the project lifecycle.  
**Date:** March 2026  
**Status:** Historical analysis for learning and reference

---

## Bug #1: Multi-Store RLS Infinite Recursion (MOST CRITICAL)

### Severity: 🔴 CRITICAL
**Migrations:** 009, 009b, 009c, 009d, 009e, 009f, 010

### The Problem

When implementing multi-store staff assignment, the RLS policies created an **infinite recursion loop** that caused:
- Database queries to hang indefinitely
- Staff unable to insert sales records
- Complete system lockup for staff users
- Admin/Manager roles worked fine (masking the issue)

### Root Cause

**The Deadly Pattern:**
```sql
-- BROKEN: This causes infinite recursion
CREATE POLICY "sales_insert" ON sales
  FOR INSERT WITH CHECK (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

-- Inside get_user_store_ids function:
CREATE FUNCTION get_user_store_ids(user_id UUID) AS $$
  -- This queries staff_stores table
  SELECT ARRAY_AGG(store_id) FROM staff_stores WHERE staff_id = user_id;
$$;

-- staff_stores also has RLS that calls get_user_store_ids!
CREATE POLICY "staff_stores_select" ON staff_stores
  FOR SELECT USING (
    staff_id = auth.uid() OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'manager'))
  );
```

**The Recursion Chain:**
1. User tries to INSERT into `sales`
2. RLS policy calls `get_user_store_ids()`
3. Function queries `staff_stores` table
4. `staff_stores` RLS policy needs to check permissions
5. RLS policy queries `profiles` table
6. `profiles` RLS might call `get_user_store_ids()` again
7. **INFINITE LOOP** 🔄

### Why It Was Hard to Fix

1. **Worked for Admin/Manager**: They bypass the recursion with role checks
2. **Silent failure**: No error message, just hanging queries
3. **Multiple layers**: RLS on 3+ tables interacting
4. **SECURITY DEFINER confusion**: Function runs with elevated privileges but still triggers RLS
5. **Supabase-specific**: Local PostgreSQL might behave differently

### The Solution

**Key Insight:** Use `SECURITY DEFINER` + direct table access without RLS checks inside the function

```sql
-- FIXED VERSION
CREATE OR REPLACE FUNCTION get_user_store_ids(user_id UUID)
RETURNS UUID[] AS $$
DECLARE
  user_role TEXT;
  store_ids UUID[];
BEGIN
  -- Direct query without triggering RLS (SECURITY DEFINER bypasses RLS)
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  
  IF user_role IN ('admin', 'manager', 'dealer') THEN
    SELECT ARRAY_AGG(id) INTO store_ids FROM public.stores WHERE is_active = true;
    RETURN store_ids;
  END IF;
  
  -- Direct query to staff_stores (no RLS recursion)
  SELECT ARRAY_AGG(store_id) INTO store_ids 
  FROM public.staff_stores 
  WHERE staff_id = user_id;
  
  RETURN COALESCE(store_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

**Critical Changes:**
- Function marked as `SECURITY DEFINER` (runs as owner, bypasses RLS)
- Direct table queries inside function
- No nested function calls
- Role check happens FIRST before any complex queries

### Lessons Learned

1. **Never nest RLS policies** that call the same helper functions
2. **SECURITY DEFINER functions** should be simple and direct
3. **Test with non-admin users** - admin roles mask RLS issues
4. **Use diagnostic migrations** (009c, 009e) to debug RLS
5. **Simplify child table policies** (007c) - let parent table handle security

---

## Bug #2: Stock Opname Items RLS Nested SELECT Issue

### Severity: 🟠 HIGH
**Migrations:** 007b, 007c

### The Problem

Child table (`stock_opname_items`) RLS policy tried to check parent table (`stock_opname`) permissions, causing:
- Nested SELECT queries failing in Supabase
- "Could not verify policy" errors
- Items couldn't be inserted even when parent existed

### Root Cause

```sql
-- BROKEN: Nested RLS check
CREATE POLICY "stock_opname_items_insert" ON stock_opname_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM stock_opname so 
      WHERE so.id = opname_id 
      AND so.store_id = user_store_id()  -- This triggers RLS on stock_opname!
    )
  );
```

**The Issue:**
- Policy on `stock_opname_items` queries `stock_opname`
- `stock_opname` has its own RLS policies
- Supabase doesn't handle nested RLS checks well
- Creates a "RLS within RLS" situation

### The Solution

**Simplify:** Trust the parent table's RLS, don't re-check in child

```sql
-- FIXED: Simple existence check
CREATE POLICY "Users can create stock opname items" ON stock_opname_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM stock_opname WHERE id = opname_id)
  );
```

**Why This Works:**
- Parent table (`stock_opname`) already has RLS filtering by store
- User can only see/access their own stock opname records
- Child table just checks "does parent exist?" (which is already filtered)
- No nested RLS evaluation needed

### Lessons Learned

1. **Keep child table RLS simple** - let parent handle security
2. **Avoid nested EXISTS with RLS** - Supabase limitation
3. **Trust the parent's RLS** - don't duplicate security logic
4. **Test with actual user sessions** - not just SQL console

---

## Bug #3: Wrong Column Name in Function (deleted_at vs is_active)

### Severity: 🟡 MEDIUM
**Migration:** 009b

### The Problem

Function referenced non-existent column causing runtime errors:

```sql
-- BROKEN: stores table doesn't have deleted_at
SELECT ARRAY_AGG(id) FROM stores WHERE deleted_at IS NULL;
```

**Actual schema:**
```sql
-- stores table uses is_active, not deleted_at
CREATE TABLE stores (
  id UUID,
  is_active BOOLEAN DEFAULT true,  -- ✅ This exists
  -- deleted_at doesn't exist!      -- ❌ This doesn't
);
```

### Why It Happened

- **Schema inconsistency**: Different tables use different soft-delete patterns
- **Copy-paste error**: Copied from another function that used `deleted_at`
- **No type checking**: SQL functions don't have compile-time checks
- **Worked in dev**: Dev database might have had different schema

### The Solution

```sql
-- FIXED: Use correct column
SELECT ARRAY_AGG(id) FROM stores WHERE is_active = true;
```

### Lessons Learned

1. **Standardize soft-delete pattern** across all tables
2. **Document schema conventions** clearly
3. **Test functions after schema changes**
4. **Use migrations to verify column existence**

---


## Bug #4: Duplicate RLS Policies After Migration

### Severity: 🟡 MEDIUM
**Migration:** 009f

### The Problem

After multiple fix attempts (009, 009b, 009c, 009d, 009e), the database had:
- Multiple policies with same name
- Conflicting policy definitions
- Unclear which policy was actually active
- Performance degradation from redundant checks

### Root Cause

Each "fix" migration added new policies without properly cleaning up old ones:

```sql
-- Migration 009
CREATE POLICY "sales_insert" ON sales ...;

-- Migration 009b (trying to fix)
CREATE POLICY "sales_insert" ON sales ...;  -- Duplicate!

-- Migration 009d (another fix)
CREATE POLICY "sales_insert" ON sales ...;  -- Another duplicate!
```

PostgreSQL allows multiple policies with the same name on different operations, causing confusion.

### The Solution

**Migration 009f: Cleanup**
```sql
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "sales_select" ON sales;
-- ... drop all variants

-- Then create clean, correct policies
CREATE POLICY "sales_insert" ON sales FOR INSERT ...;
CREATE POLICY "sales_select" ON sales FOR SELECT ...;
```

### Lessons Learned

1. **Always DROP before CREATE** in fix migrations
2. **Use IF EXISTS** to make migrations idempotent
3. **Clean up after failed migrations** before trying again
4. **Document which migration is the "final" one**
5. **Consider a "reset" migration** that drops everything and rebuilds

---

## Bug #5: Audit Triggers Missing After Schema Refactor

### Severity: 🟠 HIGH
**Migrations:** 018, 020

### The Problem

After migrating from `branches` to `stores` (migration 007):
- Old audit trigger still referenced `branches` table
- New `stores` table had NO audit trigger
- `staff_stores` junction table had NO audit trigger
- Data changes were not being logged
- Compliance/audit trail broken

### Root Cause

**Schema evolution without trigger updates:**

```sql
-- Migration 003: Created audit triggers
CREATE TRIGGER audit_branches ON branches ...;

-- Migration 007: Renamed table
ALTER TABLE branches RENAME TO stores;

-- ❌ Trigger still named "audit_branches"
-- ❌ No trigger for new staff_stores table
```

### Why It Was Missed

1. **Triggers don't auto-rename** with tables
2. **No error thrown** - system just stops logging
3. **Silent failure** - no indication audit is broken
4. **New tables forgotten** - staff_stores added without trigger
5. **Testing focused on functionality** - not audit logging

### The Solution

**Migration 020: Comprehensive audit trigger fix**
```sql
-- Drop old trigger
DROP TRIGGER IF EXISTS audit_branches ON branches;

-- Add trigger for stores
CREATE TRIGGER audit_stores ON stores
  AFTER INSERT OR UPDATE OR DELETE
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Add trigger for staff_stores
CREATE TRIGGER audit_staff_stores ON staff_stores
  AFTER INSERT OR UPDATE OR DELETE
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Recreate all other triggers with conditional checks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    DROP TRIGGER IF EXISTS audit_sales ON sales;
    CREATE TRIGGER audit_sales ON sales ...;
  END IF;
END $$;
```

### Lessons Learned

1. **Audit triggers are critical** - don't forget them
2. **Schema changes need trigger updates** - document this
3. **Test audit logging** after migrations
4. **Use conditional checks** for tables that might not exist
5. **Create a "verify triggers" query** to run after migrations

---

## Bug #6: Date Serialization in Server Actions (Current Session)

### Severity: 🟠 HIGH
**Migration:** None (code fix)

### The Problem

Sales achievement showed correct data locally but zero in production:
- Local: "March 2026" → correct sales data
- Production: "March 2026" → zero sales
- Same database, same user, same code

### Root Cause

**JavaScript Date serialization in Next.js Server Actions:**

```typescript
// CLIENT CODE
const monthDate = new Date(2026, 2, 1);  // March 1, 2026 (local time)
const result = await getSalesAchievement(monthDate);

// SERIALIZATION (automatic by Next.js)
// Date object → ISO string → "2026-02-28T17:00:00.000Z" (UTC)
// March 1 in UTC+7 becomes February 28 in UTC!

// SERVER CODE
export async function getSalesAchievement(month: Date) {
  const year = month.getFullYear();  // 2026
  const monthIndex = month.getMonth();  // 1 (February!)
  // Queries February instead of March!
}
```

**The Timezone Trap:**
- Client creates Date in local timezone (UTC+7)
- Next.js serializes to ISO string (UTC)
- Server deserializes back to Date
- Month shifts by one due to timezone conversion

### The Solution

**Pass strings, not Date objects:**

```typescript
// CLIENT CODE
const monthStr = "2026-03";  // Simple string
const result = await getSalesAchievement(monthStr);

// SERVER CODE
export async function getSalesAchievement(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number);
  const monthIndex = month - 1;  // Correct conversion
  // Now queries March correctly!
}
```

### Why It Was Hard to Debug

1. **Worked locally** - same timezone as server in dev
2. **Production different timezone** - Vercel servers in different region
3. **No error message** - just wrong data
4. **Logs showed wrong month** - but UI showed correct month
5. **Date serialization is invisible** - happens automatically

### Lessons Learned

1. **Never pass Date objects** to Server Actions
2. **Use ISO date strings** (YYYY-MM-DD) for dates
3. **Use simple strings** (YYYY-MM) for month selection
4. **Test in different timezones** - use UTC in dev
5. **Add input validation** to catch format issues early

---

## Summary: The Most Critical Bug

**Winner: Multi-Store RLS Infinite Recursion (Bug #1)**

### Why It's The Worst:

1. **Complete system lockup** - not just wrong data, but total failure
2. **Silent failure** - no error messages, just hanging
3. **Affected all staff users** - majority of user base
4. **Hard to diagnose** - worked for admins, masking the issue
5. **Multiple fix attempts** - took 6 migrations (009, 009b-f) to fully resolve
6. **Deep architectural issue** - required understanding of:
   - PostgreSQL RLS internals
   - Function execution context
   - SECURITY DEFINER behavior
   - Supabase-specific limitations
   - Recursion detection

### The Fix Complexity:

- Required understanding of PostgreSQL internals
- Needed diagnostic migrations to debug
- Multiple iterations to get right
- Affected multiple tables and policies
- Required careful testing with different user roles

### Prevention Checklist:

✅ **Before implementing RLS:**
- [ ] Draw a diagram of all RLS policy dependencies
- [ ] Identify any circular references
- [ ] Mark functions as SECURITY DEFINER if they query multiple tables
- [ ] Keep helper functions simple and direct
- [ ] Test with non-admin users FIRST

✅ **During development:**
- [ ] Test each RLS policy in isolation
- [ ] Use diagnostic queries to verify function behavior
- [ ] Check query execution time (hanging = recursion)
- [ ] Test with actual user sessions, not SQL console

✅ **Before deployment:**
- [ ] Test all user roles (admin, manager, staff, dealer)
- [ ] Verify no hanging queries
- [ ] Check audit logs are working
- [ ] Run diagnostic migrations to verify setup

---

## Key Takeaways

### 1. RLS is Powerful but Dangerous
- Can create infinite loops
- Silent failures are common
- Test thoroughly with all user roles

### 2. Schema Evolution Needs Careful Planning
- Update triggers when renaming tables
- Update functions when changing columns
- Clean up old policies before creating new ones

### 3. Date/Time Handling is Tricky
- Timezone conversions happen invisibly
- Server Actions serialize/deserialize automatically
- Use strings for dates, not Date objects

### 4. Diagnostic Tools Are Essential
- Create diagnostic migrations (009c, 009e)
- Add verification queries
- Log extensively during debugging

### 5. Iterative Fixes Are Normal
- Complex bugs need multiple attempts
- Document each attempt and why it failed
- Clean up after yourself (009f)

---

**End of Critical Bugs Analysis**
