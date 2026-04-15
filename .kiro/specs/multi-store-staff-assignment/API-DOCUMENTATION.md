# Multi-Store Staff Assignment - API Documentation

This document provides comprehensive API documentation for the multi-store staff assignment feature, including database schema, server actions, RLS policies, and session management.

## Table of Contents

1. [Database Schema](#database-schema)
2. [Server Actions](#server-actions)
3. [RLS Policies](#rls-policies)
4. [Session Management](#session-management)
5. [Helper Functions](#helper-functions)
6. [TypeScript Interfaces](#typescript-interfaces)
7. [Error Codes](#error-codes)
8. [Migration Guide](#migration-guide)

---

## Database Schema

### staff_stores Table

Junction table managing many-to-many relationships between staff and stores.

**Table Name**: `staff_stores`

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier for the assignment |
| `staff_id` | UUID | NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE | Foreign key to profiles table |
| `store_id` | UUID | NOT NULL, REFERENCES stores(id) ON DELETE CASCADE | Foreign key to stores table |
| `is_primary` | BOOLEAN | NOT NULL, DEFAULT false | Whether this is the staff member's primary store |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When the assignment was created |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation timestamp |

**Constraints**:

```sql
-- Unique constraint: prevent duplicate assignments
CONSTRAINT unique_staff_store UNIQUE (staff_id, store_id)
```

**Indexes**:

```sql
-- Performance index for looking up staff assignments
CREATE INDEX idx_staff_stores_staff_id ON staff_stores(staff_id);

-- Performance index for looking up store staff
CREATE INDEX idx_staff_stores_store_id ON staff_stores(store_id);

-- Unique partial index: ensure single primary store per staff
CREATE UNIQUE INDEX idx_staff_primary_store 
  ON staff_stores (staff_id) 
  WHERE is_primary = true;
```

**Relationships**:

```
staff_stores.staff_id → profiles.id (CASCADE DELETE)
staff_stores.store_id → stores.id (CASCADE DELETE)
```

**Example Query**:

```sql
-- Get all store assignments for a staff member
SELECT 
  ss.id,
  ss.store_id,
  ss.is_primary,
  ss.assigned_at,
  s.name as store_name,
  s.code as store_code
FROM staff_stores ss
JOIN stores s ON ss.store_id = s.id
WHERE ss.staff_id = 'user-id-here'
ORDER BY ss.is_primary DESC, ss.assigned_at DESC;
```

---

## Server Actions

All server actions are located in `src/actions/store-assignments.ts`.

### assignStoreToStaff

Assigns a store to a staff member.

**Function Signature**:

```typescript
async function assignStoreToStaff(
  staffId: string,
  storeId: string,
  isPrimary?: boolean
): Promise<ActionResult>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `staffId` | string | Yes | UUID of the staff member |
| `storeId` | string | Yes | UUID of the store to assign |
| `isPrimary` | boolean | No | Whether to set as primary store (default: false) |

**Returns**:

```typescript
interface ActionResult {
  success: boolean;
  error?: string;
  data?: StaffStoreAssignment;
}
```

**Authorization**: Admin only

**Behavior**:

1. Verifies caller has admin role
2. If `isPrimary` is true, unsets other primary flags for the staff member
3. Creates or updates the assignment in `staff_stores` table
4. If primary, updates `profiles.store_id` for backward compatibility
5. Creates audit log entry
6. Returns success or error result

**Example Usage**:

```typescript
import { assignStoreToStaff } from '@/actions/store-assignments';

// Assign a store (not primary)
const result = await assignStoreToStaff(
  'staff-uuid-here',
  'store-uuid-here',
  false
);

if (result.success) {
  console.log('Store assigned successfully');
} else {
  console.error('Error:', result.error);
}

// Assign a store as primary
const result2 = await assignStoreToStaff(
  'staff-uuid-here',
  'store-uuid-here',
  true
);
```

**Error Cases**:

- `Unauthorized`: Caller is not an admin
- `Duplicate assignment`: Staff already assigned to this store
- `Invalid staff_id`: Staff member doesn't exist
- `Invalid store_id`: Store doesn't exist

**Audit Log Entry**:

```json
{
  "action": "store_assigned",
  "entity_type": "staff_store",
  "entity_id": "staff-uuid",
  "details": {
    "store_id": "store-uuid",
    "is_primary": false
  },
  "admin_id": "admin-uuid"
}
```

---

### removeStoreFromStaff

Removes a store assignment from a staff member.

**Function Signature**:

```typescript
async function removeStoreFromStaff(
  staffId: string,
  storeId: string
): Promise<ActionResult>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `staffId` | string | Yes | UUID of the staff member |
| `storeId` | string | Yes | UUID of the store to remove |

**Returns**: `ActionResult` (same as assignStoreToStaff)

**Authorization**: Admin only

**Behavior**:

1. Verifies caller has admin role
2. Checks if this is the last assignment (prevents removal if so)
3. Deletes the assignment from `staff_stores` table
4. If removing primary store, automatically sets another store as primary
5. Updates `profiles.store_id` if primary changed
6. Creates audit log entry
7. Returns success or error result

**Example Usage**:

```typescript
import { removeStoreFromStaff } from '@/actions/store-assignments';

const result = await removeStoreFromStaff(
  'staff-uuid-here',
  'store-uuid-here'
);

if (result.success) {
  console.log('Store removed successfully');
} else {
  console.error('Error:', result.error);
}
```

**Error Cases**:

- `Unauthorized`: Caller is not an admin
- `Cannot remove last assignment`: Staff must have at least one store
- `Assignment not found`: Staff not assigned to this store
- `Invalid staff_id`: Staff member doesn't exist

**Audit Log Entry**:

```json
{
  "action": "store_removed",
  "entity_type": "staff_store",
  "entity_id": "staff-uuid",
  "details": {
    "store_id": "store-uuid"
  },
  "admin_id": "admin-uuid"
}
```

---

### setPrimaryStore

Changes which store is primary for a staff member.

**Function Signature**:

```typescript
async function setPrimaryStore(
  staffId: string,
  storeId: string
): Promise<ActionResult>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `staffId` | string | Yes | UUID of the staff member |
| `storeId` | string | Yes | UUID of the store to set as primary |

**Returns**: `ActionResult`

**Authorization**: Admin only

**Behavior**:

1. Verifies caller has admin role
2. Verifies store is in staff's assignments
3. Unsets old primary flag
4. Sets new primary flag
5. Updates `profiles.store_id` for backward compatibility
6. Creates audit log entry with old and new primary store IDs
7. Returns success or error result

**Example Usage**:

```typescript
import { setPrimaryStore } from '@/actions/store-assignments';

const result = await setPrimaryStore(
  'staff-uuid-here',
  'new-primary-store-uuid'
);

if (result.success) {
  console.log('Primary store updated');
} else {
  console.error('Error:', result.error);
}
```

**Error Cases**:

- `Unauthorized`: Caller is not an admin
- `Store not in assignments`: Cannot set non-assigned store as primary
- `Invalid staff_id`: Staff member doesn't exist
- `Invalid store_id`: Store doesn't exist

**Audit Log Entry**:

```json
{
  "action": "primary_store_changed",
  "entity_type": "staff_store",
  "entity_id": "staff-uuid",
  "details": {
    "old_primary_store_id": "old-store-uuid",
    "new_primary_store_id": "new-store-uuid"
  },
  "admin_id": "admin-uuid"
}
```

---

### getStaffAssignments

Retrieves all store assignments for a staff member.

**Function Signature**:

```typescript
async function getStaffAssignments(
  staffId: string
): Promise<StaffStoreAssignment[]>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `staffId` | string | Yes | UUID of the staff member |

**Returns**:

```typescript
interface StaffStoreAssignment {
  id: string;
  staff_id: string;
  store_id: string;
  is_primary: boolean;
  assigned_at: string;
  created_at: string;
  stores: {
    id: string;
    name: string;
    code: string;
  };
}
```

**Authorization**: Admin or the staff member themselves

**Behavior**:

1. Queries `staff_stores` table with store details
2. Orders by `is_primary DESC`, then `assigned_at DESC`
3. Returns formatted assignment data

**Example Usage**:

```typescript
import { getStaffAssignments } from '@/actions/store-assignments';

const assignments = await getStaffAssignments('staff-uuid-here');

assignments.forEach(assignment => {
  console.log(`Store: ${assignment.stores.name}`);
  console.log(`Primary: ${assignment.is_primary}`);
  console.log(`Assigned: ${assignment.assigned_at}`);
});
```

---

### getStaffAssignmentHistory

Retrieves audit log history for a staff member's store assignments.

**Function Signature**:

```typescript
async function getStaffAssignmentHistory(
  staffId: string
): Promise<AuditLogEntry[]>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `staffId` | string | Yes | UUID of the staff member |

**Returns**:

```typescript
interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  created_at: string;
  user_id: string;
}
```

**Authorization**: Admin only

**Example Usage**:

```typescript
import { getStaffAssignmentHistory } from '@/actions/store-assignments';

const history = await getStaffAssignmentHistory('staff-uuid-here');

history.forEach(entry => {
  console.log(`${entry.created_at}: ${entry.action}`);
  console.log(`Details:`, entry.details);
});
```

---

## RLS Policies

Row Level Security policies control data access at the database level.

### staff_stores Table Policies

#### staff_view_own_assignments

Allows staff to view their own store assignments.

```sql
CREATE POLICY "staff_view_own_assignments" ON staff_stores
  FOR SELECT
  USING (staff_id = auth.uid());
```

**Effect**: Staff can query their own assignments but not others'.

---

#### admin_manage_assignments

Allows admins to manage all store assignments.

```sql
CREATE POLICY "admin_manage_assignments" ON staff_stores
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Effect**: Admins can SELECT, INSERT, UPDATE, DELETE any assignment.

---

### Updated Multi-Store Policies

#### Sales Table

```sql
-- View sales from assigned stores
CREATE POLICY "staff_view_assigned_store_sales" ON sales
  FOR SELECT
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

-- Create sales in assigned stores
CREATE POLICY "staff_insert_assigned_store_sales" ON sales
  FOR INSERT
  WITH CHECK (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

-- Update sales in assigned stores
CREATE POLICY "staff_update_assigned_store_sales" ON sales
  FOR UPDATE
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );
```

---

#### Inventory Table

```sql
-- View inventory from assigned stores
CREATE POLICY "staff_view_assigned_store_inventory" ON inventory
  FOR SELECT
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );
```

---

#### Stock Opname Table

```sql
-- View stock opname from assigned stores
CREATE POLICY "staff_view_assigned_store_stock_opname" ON stock_opname
  FOR SELECT
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

-- Create stock opname in assigned stores
CREATE POLICY "staff_insert_assigned_store_stock_opname" ON stock_opname
  FOR INSERT
  WITH CHECK (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

-- Update stock opname in assigned stores
CREATE POLICY "staff_update_assigned_store_stock_opname" ON stock_opname
  FOR UPDATE
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );
```

---

#### Expenses Table

```sql
-- View expenses from assigned stores
CREATE POLICY "staff_view_assigned_store_expenses" ON expenses
  FOR SELECT
  USING (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );

-- Create expenses in assigned stores
CREATE POLICY "staff_insert_assigned_store_expenses" ON expenses
  FOR INSERT
  WITH CHECK (
    store_id = ANY(get_user_store_ids(auth.uid()))
  );
```

---

## Session Management

### Session Data Structure

User session metadata stored in JWT:

```typescript
interface UserMetadata {
  // User identification
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff' | 'dealer';
  
  // Multi-store data
  assigned_store_ids: string[];  // All stores user can access
  primary_store_id: string;      // Primary store (default)
  current_store_id: string;      // Currently selected store context
  
  // Legacy field (maintained for backward compatibility)
  store_id: string;              // Same as primary_store_id
}
```

### Middleware Enhancement

The authentication middleware (`src/lib/supabase/middleware.ts`) loads store assignments on authentication:

```typescript
export async function updateSession(request: NextRequest) {
  const supabase = createServerClient(/* ... */);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Load user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single();
    
    // Load store assignments
    const { data: assignments } = await supabase
      .from('staff_stores')
      .select('store_id, is_primary')
      .eq('staff_id', user.id);
    
    const assignedStoreIds = assignments?.map(a => a.store_id) || [];
    const primaryStore = assignments?.find(a => a.is_primary)?.store_id 
      || profile?.store_id;
    
    // Update session metadata
    await supabase.auth.updateUser({
      data: {
        assigned_store_ids: assignedStoreIds,
        primary_store_id: primaryStore,
        current_store_id: primaryStore, // Default to primary
        store_id: primaryStore, // Backward compatibility
      }
    });
  }
  
  return response;
}
```

### Store Context Update

To update the current store context without re-authentication:

```typescript
import { createClient } from '@/lib/supabase/client';

async function updateStoreContext(newStoreId: string): Promise<boolean> {
  const supabase = createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  // Validate new store is in assigned stores
  const assignedStoreIds = user.user_metadata?.assigned_store_ids || [];
  
  if (!assignedStoreIds.includes(newStoreId)) {
    console.error('Store not in assigned stores');
    return false;
  }
  
  // Update session
  const { error } = await supabase.auth.updateUser({
    data: {
      current_store_id: newStoreId
    }
  });
  
  return !error;
}
```

### Session Refresh

After assignment changes, the session should be refreshed:

```typescript
import { createClient } from '@/lib/supabase/client';

async function refreshSession(): Promise<void> {
  const supabase = createClient();
  
  // Refresh the session
  const { data: { session } } = await supabase.auth.refreshSession();
  
  if (session) {
    // Session refreshed with updated metadata
    console.log('Session refreshed');
  }
}
```

---

## Helper Functions

### get_user_store_ids

PostgreSQL function that returns an array of store IDs a user can access.

**Function Signature**:

```sql
get_user_store_ids(user_id UUID) RETURNS UUID[]
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | UUID | The user's UUID |

**Returns**: Array of store UUIDs

**Behavior**:

1. Gets user's role from `profiles` table
2. If role is `admin`, `manager`, or `dealer`: returns all non-deleted stores
3. If role is `staff`: returns assigned stores from `staff_stores` table
4. Falls back to `profiles.store_id` if no assignments exist (backward compatibility)
5. Returns empty array if no stores found

**Example Usage**:

```sql
-- Get stores for a user
SELECT get_user_store_ids('user-uuid-here');
-- Returns: {store-uuid-1, store-uuid-2, store-uuid-3}

-- Use in WHERE clause
SELECT * FROM sales 
WHERE store_id = ANY(get_user_store_ids(auth.uid()));

-- Use in RLS policy
CREATE POLICY "example_policy" ON some_table
  FOR SELECT
  USING (store_id = ANY(get_user_store_ids(auth.uid())));
```

**Performance**: Function is marked as `STABLE` for query optimization. Results are cached within a transaction.

---

## TypeScript Interfaces

### StaffStoreAssignment

```typescript
interface StaffStoreAssignment {
  id: string;
  staff_id: string;
  store_id: string;
  is_primary: boolean;
  assigned_at: string;  // ISO 8601 timestamp
  created_at: string;   // ISO 8601 timestamp
  stores?: {
    id: string;
    name: string;
    code: string;
  };
}
```

### ActionResult

```typescript
interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
}
```

### UserSession

```typescript
interface UserSession {
  userId: string;
  role: 'admin' | 'manager' | 'staff' | 'dealer';
  assignedStoreIds: string[];
  primaryStoreId: string;
  currentStoreId: string;
  email: string;
  name: string;
}
```

### AuditLogEntry

```typescript
interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  created_at: string;
  user_id: string;
}
```

---

## Error Codes

### Assignment Errors

| Error Code | Message | Description |
|------------|---------|-------------|
| `UNAUTHORIZED` | "Unauthorized" | Caller is not an admin |
| `DUPLICATE_ASSIGNMENT` | "This staff member is already assigned to this store" | Attempting to create duplicate assignment |
| `LAST_ASSIGNMENT` | "Cannot remove the last store assignment. Staff must have at least one store." | Attempting to remove only assignment |
| `INVALID_PRIMARY` | "Cannot set a non-assigned store as primary" | Store not in staff's assignments |
| `STAFF_NOT_FOUND` | "Staff member not found" | Invalid staff_id |
| `STORE_NOT_FOUND` | "Store not found" | Invalid store_id |

### Access Control Errors

| Error Code | Message | Description |
|------------|---------|-------------|
| `UNAUTHORIZED_STORE` | "You do not have access to this store" | Staff attempting to access non-assigned store |
| `NO_ASSIGNMENTS` | "You have no store assignments. Please contact your administrator." | Staff has no store assignments |
| `INVALID_CONTEXT` | "Invalid store context" | Session contains invalid store_id |

### Database Errors

| Error Code | Message | Description |
|------------|---------|-------------|
| `CONSTRAINT_VIOLATION` | "Database constraint violation" | Unique constraint or foreign key violation |
| `RLS_VIOLATION` | "Row level security policy violation" | Attempting unauthorized data access |

---

## Migration Guide

### For Developers

#### Updating Code to Use Multi-Store

**Before** (single store):

```typescript
// Getting user's store
const { data: profile } = await supabase
  .from('profiles')
  .select('store_id')
  .eq('id', userId)
  .single();

const storeId = profile.store_id;
```

**After** (multi-store):

```typescript
// Getting user's stores
const { data: { user } } = await supabase.auth.getUser();
const assignedStoreIds = user?.user_metadata?.assigned_store_ids || [];
const currentStoreId = user?.user_metadata?.current_store_id;
```

---

**Before** (filtering by single store):

```typescript
const { data: sales } = await supabase
  .from('sales')
  .select('*')
  .eq('store_id', userStoreId);
```

**After** (filtering by assigned stores - RLS handles this automatically):

```typescript
// RLS automatically filters by assigned stores
const { data: sales } = await supabase
  .from('sales')
  .select('*');

// Or filter by specific store
const { data: sales } = await supabase
  .from('sales')
  .select('*')
  .eq('store_id', selectedStoreId);
```

---

**Before** (creating record in user's store):

```typescript
const { data: sale } = await supabase
  .from('sales')
  .insert({
    ...saleData,
    store_id: userStoreId
  });
```

**After** (creating record with validation):

```typescript
// Validate store access first
const { data: { user } } = await supabase.auth.getUser();
const assignedStoreIds = user?.user_metadata?.assigned_store_ids || [];

if (!assignedStoreIds.includes(selectedStoreId)) {
  throw new Error('You do not have access to this store');
}

// Create record
const { data: sale } = await supabase
  .from('sales')
  .insert({
    ...saleData,
    store_id: selectedStoreId
  });
```

### Database Migration Steps

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete migration procedures.

**Summary**:

1. Create `staff_stores` table and indexes
2. Create `get_user_store_ids` helper function
3. Migrate existing assignments from `profiles.store_id`
4. Update RLS policies to use helper function
5. Deploy application code updates
6. Verify functionality
7. Monitor for issues

---

## Best Practices

### For API Consumers

1. **Always validate store access** before creating records
2. **Use RLS policies** as defense-in-depth (don't rely solely on application logic)
3. **Cache session data** to avoid repeated queries
4. **Handle errors gracefully** with user-friendly messages
5. **Log audit events** for all assignment changes

### For Database Queries

1. **Use indexes** - queries on `staff_id` and `store_id` are optimized
2. **Leverage RLS** - let the database filter data automatically
3. **Use helper function** - `get_user_store_ids` is optimized and cached
4. **Avoid N+1 queries** - join with stores table when needed
5. **Monitor performance** - check query execution plans

### For Session Management

1. **Refresh sessions** after assignment changes
2. **Validate store context** on each request
3. **Default to primary store** when context is invalid
4. **Cache assignments** in session to reduce database queries
5. **Handle edge cases** - no assignments, deleted stores, etc.

---

## Support and Resources

### Related Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Deployment procedures and rollback
- [User Guide](./USER-GUIDE.md) - End-user documentation
- [Requirements Document](./requirements.md) - Feature requirements
- [Design Document](./design.md) - Technical design and architecture

### External Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Array Functions](https://www.postgresql.org/docs/current/functions-array.html)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)

---

**API Documentation Version**: 1.0  
**Last Updated**: 2024-02-09  
**Feature**: Multi-Store Staff Assignment
