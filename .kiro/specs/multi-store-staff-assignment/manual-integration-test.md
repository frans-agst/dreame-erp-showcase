# Manual Integration Testing Guide

## Overview
This guide provides step-by-step instructions for manually testing the multi-store staff assignment feature end-to-end.

## Prerequisites
- Database with migrations applied (009 and 010)
- Test users created with different roles (admin, staff)
- Multiple stores created in the system
- Sample data for sales and inventory

## Test Scenarios

### Scenario 1: Admin Assignment Workflow

**Objective**: Test complete assignment workflow as admin

**Steps**:
1. **Login as Admin**
   - Navigate to login page
   - Enter admin credentials
   - Verify successful login

2. **Navigate to Staff Assignments Page**
   - Go to Master Data → Staff Assignments
   - Verify page loads with list of all staff
   - Verify each staff shows their current assignments

3. **Assign Store to Staff**
   - Click "Assign Store" button for a staff member
   - Select a store from dropdown
   - Check "Set as Primary" if desired
   - Click "Assign"
   - Verify success message
   - Verify assignment appears in staff's list
   - Verify primary badge if set as primary

4. **Change Primary Store**
   - Click "Set Primary" button for a different store
   - Select new primary store from dropdown
   - Click "Save"
   - Verify success message
   - Verify primary badge moves to new store
   - Verify old primary no longer has badge

5. **Remove Store Assignment**
   - Click "Remove" button for a non-primary store
   - Confirm removal in dialog
   - Verify success message
   - Verify assignment removed from list

6. **Attempt to Remove Last Assignment**
   - Try to remove the last remaining store for a staff
   - Verify error message: "Cannot remove last store assignment"
   - Verify assignment remains

7. **Check Audit Log**
   - Navigate to Audit Log page
   - Filter by staff assignment events
   - Verify all assignment changes are logged with:
     - Timestamp
     - Admin who made the change
     - Staff member affected
     - Store assigned/removed
     - Action type (assigned/removed/primary_changed)

**Expected Results**:
- ✓ All assignment operations complete successfully
- ✓ UI updates immediately after changes
- ✓ Primary store indicator works correctly
- ✓ Cannot remove last assignment
- ✓ All changes are audited

---

### Scenario 2: Multi-Store Staff Access

**Objective**: Test multi-store access as staff member

**Steps**:
1. **Setup** (as Admin)
   - Assign staff member to 3 different stores
   - Set one as primary
   - Create sample sales data in each store
   - Create sample inventory in each store

2. **Login as Multi-Store Staff**
   - Navigate to login page
   - Enter staff credentials
   - Verify successful login
   - Verify redirected to dashboard

3. **Verify Store Selector**
   - Check header for store selector dropdown
   - Verify current store shows primary store
   - Verify dropdown contains all 3 assigned stores
   - Verify stores are listed by name

4. **View Sales Data**
   - Navigate to Sales page
   - Verify sales from all 3 assigned stores are visible
   - Verify store column shows store name for each sale
   - Verify no sales from non-assigned stores appear

5. **Filter Sales by Store**
   - Use store filter dropdown
   - Select one specific store
   - Verify only sales from that store appear
   - Clear filter
   - Verify all assigned store sales appear again

6. **Create Sale in Assigned Store**
   - Navigate to Sales Input page
   - Verify store dropdown contains only assigned stores
   - Select one of the assigned stores
   - Fill in sale details
   - Submit form
   - Verify success message
   - Verify sale appears in sales list

7. **Attempt Sale in Non-Assigned Store** (requires manual DB manipulation)
   - Try to submit sale with non-assigned store_id
   - Verify error message: "You do not have access to this store"
   - Verify sale is not created

8. **View Inventory**
   - Navigate to Inventory page
   - Verify inventory from all 3 assigned stores is visible
   - Verify store column shows store name
   - Verify no inventory from non-assigned stores appears

9. **Filter Inventory by Store**
   - Use store filter dropdown
   - Select one specific store
   - Verify only inventory from that store appears
   - Select "All Stores"
   - Verify all assigned store inventory appears

**Expected Results**:
- ✓ Store selector appears and works correctly
- ✓ Staff can only see data from assigned stores
- ✓ Staff can create sales in assigned stores only
- ✓ Staff cannot access non-assigned store data
- ✓ Filtering by store works correctly

---

### Scenario 3: Store Context Switching

**Objective**: Test store switching and data access

**Steps**:
1. **Login as Multi-Store Staff**
   - Login with staff assigned to multiple stores
   - Verify primary store is selected by default

2. **Check Current Store Context**
   - Note the current store shown in header
   - Navigate to Sales Input page
   - Verify store dropdown defaults to current store

3. **Switch Store Context**
   - Click store selector in header
   - Select a different store
   - Verify page reloads
   - Verify new store is shown in header

4. **Verify Context Persists**
   - Navigate to different pages (Sales, Inventory, Dashboard)
   - Verify store selector still shows selected store
   - Verify data is filtered to current context where applicable

5. **Create Sale in New Context**
   - Navigate to Sales Input
   - Verify store dropdown defaults to new current store
   - Create a sale
   - Verify sale is created in the current store context

6. **Switch Back to Primary**
   - Select primary store from store selector
   - Verify context switches back
   - Verify data updates accordingly

7. **Logout and Login Again**
   - Logout
   - Login again
   - Verify store context resets to primary store

**Expected Results**:
- ✓ Store context switches correctly
- ✓ Context persists across page navigation
- ✓ Context resets to primary on new login
- ✓ Data access respects current context
- ✓ Forms default to current context

---

### Scenario 4: Migration and Backward Compatibility

**Objective**: Test migration with sample data

**Steps**:
1. **Setup Legacy Data** (requires DB access)
   - Create staff user with only `profiles.store_id` set
   - Ensure no records in `staff_stores` for this user
   - Create some sales/inventory for this store

2. **Login as Legacy Staff**
   - Login with legacy staff credentials
   - Verify successful login
   - Verify can access dashboard

3. **Verify Backward Compatibility**
   - Navigate to Sales page
   - Verify can see sales from their `profiles.store_id` store
   - Navigate to Inventory page
   - Verify can see inventory from their store
   - Verify no store selector appears (single store)

4. **Migrate Legacy Staff** (as Admin)
   - Login as admin
   - Navigate to Staff Assignments page
   - Find the legacy staff member
   - Assign them to their current store (from profiles.store_id)
   - Verify assignment is created with is_primary=true
   - Verify `profiles.store_id` remains unchanged

5. **Verify Migrated Staff**
   - Login as the migrated staff
   - Verify can still access same data
   - Verify no disruption in access
   - Assign additional store to this staff
   - Verify store selector now appears
   - Verify can access both stores

6. **Test Helper Function Fallback**
   - Verify `get_user_store_ids` returns correct stores
   - For legacy users: returns array with profiles.store_id
   - For migrated users: returns array from staff_stores
   - For multi-store users: returns all assigned stores

**Expected Results**:
- ✓ Legacy staff can still access their data
- ✓ Migration creates proper assignments
- ✓ No disruption during transition
- ✓ Helper function handles both cases
- ✓ profiles.store_id maintained for compatibility

---

### Scenario 5: Single-Store Staff Behavior

**Objective**: Verify single-store staff don't see unnecessary UI

**Steps**:
1. **Setup Single-Store Staff**
   - Create or use staff with only one store assignment
   - Ensure is_primary=true for that assignment

2. **Login as Single-Store Staff**
   - Login with single-store credentials
   - Verify successful login

3. **Verify No Store Selector**
   - Check header
   - Verify store selector does NOT appear
   - Verify clean header without dropdown

4. **Verify Data Access**
   - Navigate to Sales page
   - Verify can see sales from assigned store
   - Navigate to Inventory page
   - Verify can see inventory from assigned store

5. **Verify Forms**
   - Navigate to Sales Input
   - Verify store field is pre-filled or hidden
   - Create a sale
   - Verify sale is created in assigned store

6. **Assign Second Store** (as Admin)
   - Login as admin
   - Assign second store to this staff
   - Logout admin

7. **Verify Store Selector Appears**
   - Login as the staff again
   - Verify store selector NOW appears in header
   - Verify can switch between two stores

**Expected Results**:
- ✓ Single-store staff don't see store selector
- ✓ UI is clean and simple for single-store users
- ✓ Store selector appears when second store assigned
- ✓ Data access works correctly for single store

---

### Scenario 6: Role-Based Access Control

**Objective**: Verify different roles have appropriate access

**Steps**:
1. **Test Admin Access**
   - Login as admin
   - Navigate to Staff Assignments page
   - Verify can access page
   - Verify can see all staff and their assignments
   - Verify can modify assignments

2. **Test Manager Access**
   - Login as manager
   - Verify can access all stores' data
   - Navigate to Sales page
   - Verify can see sales from all stores
   - Navigate to Staff Assignments page
   - Verify CANNOT access (admin only)

3. **Test Staff Access**
   - Login as staff
   - Navigate to Staff Assignments page
   - Verify CANNOT access (redirected or error)
   - Verify can only see own assigned stores' data

4. **Test Dealer Access**
   - Login as dealer
   - Verify can access dealer-specific features
   - Verify appropriate store access based on role

**Expected Results**:
- ✓ Admin can manage all assignments
- ✓ Manager can see all data but not manage assignments
- ✓ Staff can only see assigned stores
- ✓ Dealer has appropriate access
- ✓ Authorization enforced at all levels

---

## Test Data Requirements

### Stores
- Minimum 5 stores with different names and codes
- Example: Store A, Store B, Store C, Store D, Store E

### Users
- 1 Admin user
- 1 Manager user
- 3 Staff users:
  - Staff 1: Assigned to 3 stores (A, B, C) - primary: A
  - Staff 2: Assigned to 1 store (D) - primary: D
  - Staff 3: Legacy user with only profiles.store_id set to E
- 1 Dealer user

### Sales Data
- 5-10 sales per store
- Distributed across different dates
- Various products and amounts

### Inventory Data
- 10-20 products per store
- Various stock levels
- Different product categories

## Success Criteria

All scenarios must pass with:
- ✓ No errors or exceptions
- ✓ Correct data isolation
- ✓ Proper UI behavior
- ✓ Audit logging working
- ✓ Session management correct
- ✓ Authorization enforced
- ✓ Backward compatibility maintained

## Notes

- Test in a non-production environment
- Use browser dev tools to check for console errors
- Verify network requests return expected data
- Check database directly to confirm data integrity
- Test on multiple browsers if possible
- Test responsive design on mobile devices
