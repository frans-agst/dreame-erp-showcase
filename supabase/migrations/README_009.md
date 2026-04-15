# Migration 009: Multi-Store Staff Assignment

## Overview

This migration implements the multi-store staff assignment feature, enabling staff members to be assigned to multiple stores simultaneously. It replaces the current one-to-one relationship between staff and stores with a flexible many-to-many relationship.

## What This Migration Does

### 1. Creates `staff_stores` Junction Table
- Establishes many-to-many relationship between staff and stores
- Includes columns: id, staff_id, store_id, is_primary, assigned_at, created_at
- Enforces CASCADE delete for referential integrity
- Prevents duplicate assignments with unique constraint
- Ensures exactly one primary store per staff member

### 2. Creates Performance Indexes
- `idx_staff_stores_staff_id`: Fast lookup of stores for a staff member
- `idx_staff_stores_store_id`: Fast lookup of staff for a store
- `idx_staff_primary_store`: Unique partial index ensuring single primary store

### 3. Creates `get_user_store_ids()` Helper Function
- Returns array of store IDs accessible to a user
- Handles role-based access (admin/manager/dealer see all stores)
- Handles staff role (returns assigned stores from junction table)
- Provides fallback to `profiles.store_id` for backward compatibility
- Marked as SECURITY DEFINER and STABLE for optimal performance

### 4. Migrates Existing Data
- Copies all existing `profiles.store_id` values to `staff_stores` table
- Sets `is_primary = true` for migrated assignments
- Includes verification to ensure all staff are migrated successfully
- Zero data loss - maintains backward compatibility

### 5. Creates RLS Policies
- Staff can view their own assignments
- Admins can manage all assignments
- Enforces data isolation at database level

## Backward Compatibility

This migration maintains full backward compatibility:
- `profiles.store_id` field remains intact
- Helper function falls back to `profiles.store_id` if no assignments exist
- Existing code continues to work during transition period
- New assignments automatically sync to `profiles.store_id` for primary store

## Running the Migration

```bash
# Apply migration
psql -d your_database -f supabase/migrations/009_multi_store_staff_assignment.sql

# Or using Supabase CLI
supabase db push
```

## Verification

After running the migration, verify:

1. **Table created**: `SELECT * FROM staff_stores LIMIT 5;`
2. **Data migrated**: `SELECT COUNT(*) FROM staff_stores;`
3. **Indexes created**: `\d staff_stores` (in psql)
4. **Function works**: `SELECT get_user_store_ids('some-user-id');`
5. **RLS enabled**: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'staff_stores';`

## Rollback Plan

If issues arise, you can rollback by:

1. Dropping the new table and function:
```sql
DROP TABLE IF EXISTS public.staff_stores CASCADE;
DROP FUNCTION IF EXISTS public.get_user_store_ids(UUID);
```

2. The `profiles.store_id` field remains intact, so existing functionality continues to work.

## Next Steps

After this migration:
1. Update RLS policies on sales, inventory, and other tables to use `get_user_store_ids()`
2. Implement server actions for assignment management
3. Update UI to show store selector for multi-store staff
4. Create admin interface for managing assignments

## Testing

Property-based tests are included in `src/lib/multi-store-staff-assignment.test.ts`:
- Property 1: Staff deletion cascades to assignments
- Property 2: Store deletion cascades to assignments
- Property 3: Duplicate assignments are prevented
- Property 4: Single primary store per staff

Run tests with:
```bash
npm test -- src/lib/multi-store-staff-assignment.test.ts
```

## Requirements Validated

This migration validates the following requirements:
- 1.1: Junction table with proper columns
- 1.2: Foreign key with CASCADE delete for staff
- 1.3: Foreign key with CASCADE delete for stores
- 1.4: Unique constraint prevents duplicates
- 1.7: Exactly one primary store per staff
- 2.3: Helper function returns store IDs
- 3.1: Existing assignments migrated
- 3.2: Primary flag set for migrated data
- 3.4: Backward compatibility maintained
- 14.5: Fallback to profiles.store_id
