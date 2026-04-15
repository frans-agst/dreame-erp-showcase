# Migration 010: Update RLS Policies for Multi-Store Staff Assignment

## Overview

This migration updates Row Level Security (RLS) policies across multiple tables to support multi-store staff assignments. It replaces single-store access checks with the new `get_user_store_ids()` helper function that returns an array of store IDs a user can access.

## Changes

### 1. Sales Table RLS Policies
- **Updated**: `sales_select` - Staff can now view sales from all assigned stores
- **Updated**: `sales_insert` - Staff can create sales for any assigned store
- **Unchanged**: `sales_update` and `sales_delete` remain admin/manager only

### 2. Inventory Table RLS Policies
- **Updated**: `inventory_select` - Staff can view inventory from all assigned stores
- **Updated**: `inventory_insert` - Staff can create inventory for assigned stores
- **Updated**: `inventory_update` - Staff can update inventory for assigned stores
- **Unchanged**: `inventory_delete` remains admin only

### 3. Stock Opname Table RLS Policies
- **Updated**: `stock_opname_select` - Staff can view opname from all assigned stores
- **Updated**: `stock_opname_insert` - Staff can create opname for assigned stores
- **Unchanged**: `stock_opname_update` and `stock_opname_delete` remain admin/manager only

### 4. Stock Opname Items Table RLS Policies
- **Updated**: `stock_opname_items_select` - Access based on parent opname with multi-store support
- **Updated**: `stock_opname_items_insert` - Insert based on parent opname with multi-store support
- **Unchanged**: `stock_opname_items_update` and `stock_opname_items_delete` remain admin/manager only

## Key Pattern

All policies now use the pattern:
```sql
store_id = ANY(public.get_user_store_ids(auth.uid()))
```

This allows staff to access data from multiple stores while maintaining security isolation.

## Dependencies

- **Requires**: Migration 009 (creates `get_user_store_ids()` function and `staff_stores` table)
- **Affects**: All staff users with store assignments

## Testing

Property-based tests validate:
- Property 5: Staff view only own assignments
- Property 6: Admins view all assignments
- Property 7: Helper function returns assigned store IDs
- Property 8: RLS filters data by assigned stores
- Property 9: Admin and manager bypass store restrictions

All tests pass with 100 iterations each.

## Rollback

If issues arise, the previous single-store policies can be restored by:
1. Reverting to the policies in migration 002 or 004
2. Using `store_id = public.get_user_store_id()` instead of the array-based approach

## Deployment Notes

- **Zero Downtime**: This migration can be applied without downtime
- **Backward Compatible**: Works with both old (profiles.store_id) and new (staff_stores) assignment methods
- **Performance**: Uses indexed array operations for efficient filtering

## Verification

After deployment, verify:
1. Staff with multiple stores can see data from all assigned stores
2. Staff cannot see data from non-assigned stores
3. Admin and manager users can see all data
4. Query performance remains acceptable

