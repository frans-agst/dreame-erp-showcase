# Implementation Plan: Multi-Store Staff Assignment

## Overview

This implementation plan breaks down the multi-store staff assignment feature into discrete, incremental tasks. The approach prioritizes database schema and security (RLS policies) first, then backend logic, and finally UI components. Each task builds on previous work, with checkpoints to ensure stability before proceeding.

## Tasks

- [x] 1. Create database schema and migration
  - [x] 1.1 Create staff_stores junction table with constraints and indexes
    - Write migration SQL to create table with id, staff_id, store_id, is_primary, assigned_at, created_at columns
    - Add foreign key constraints with CASCADE delete
    - Add unique constraint on (staff_id, store_id)
    - Create unique partial index for single primary store per staff
    - Create performance indexes on staff_id and store_id
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_
  
  - [x] 1.2 Create get_user_store_ids helper function
    - Write SQL function that returns array of store IDs for a user
    - Handle admin/manager roles (return all stores)
    - Handle staff role (return assigned stores from staff_stores)
    - Add fallback to profiles.store_id for backward compatibility
    - Mark function as SECURITY DEFINER and STABLE
    - _Requirements: 2.3, 3.4, 14.5_
  
  - [x] 1.3 Migrate existing single-store assignments to junction table
    - Write migration SQL to copy profiles.store_id to staff_stores
    - Set is_primary = true for migrated assignments
    - Add verification query to ensure all staff are migrated
    - _Requirements: 3.1, 3.2_
  
  - [x] 1.4 Write property tests for database integrity
    - **Property 1: Staff deletion cascades to assignments**
    - **Property 2: Store deletion cascades to assignments**
    - **Property 3: Duplicate assignments are prevented**
    - **Property 4: Single primary store per staff**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.7**

- [x] 2. Create and update RLS policies
  - [x] 2.1 Create RLS policies for staff_stores table
    - Enable RLS on staff_stores table
    - Create policy allowing staff to view their own assignments
    - Create policy allowing admins to manage all assignments
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.2 Update RLS policies for sales table
    - Drop existing single-store policies
    - Create new policies using get_user_store_ids helper with ANY operator
    - Test that staff can only see sales from assigned stores
    - _Requirements: 2.4_
  
  - [x] 2.3 Update RLS policies for inventory table
    - Drop existing single-store policies
    - Create new policies using get_user_store_ids helper with ANY operator
    - Test that staff can only see inventory from assigned stores
    - _Requirements: 2.4_
  
  - [x] 2.4 Update RLS policies for other store-related tables
    - Update stock_opname, stock_opname_items, expenses, and other tables
    - Use consistent pattern with get_user_store_ids helper
    - _Requirements: 2.4_
  
  - [x] 2.5 Write property tests for access control
    - **Property 5: Staff view only own assignments**
    - **Property 6: Admins view all assignments**
    - **Property 7: Helper function returns assigned store IDs**
    - **Property 8: RLS filters data by assigned stores**
    - **Property 9: Admin and manager bypass store restrictions**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 3. Checkpoint - Verify database and RLS setup
  - Run all migrations in test environment
  - Verify RLS policies work correctly
  - Test with sample data for different roles
  - Ensure all tests pass, ask the user if questions arise

- [-] 4. Implement store assignment server actions
  - [x] 4.1 Create assignStoreToStaff action
    - Verify admin role authorization
    - Handle primary store flag (unset others if setting new primary)
    - Insert or update staff_stores record
    - Update profiles.store_id if primary for backward compatibility
    - Create audit log entry
    - _Requirements: 4.1, 4.3, 4.6, 4.7_
  
  - [x] 4.2 Create removeStoreFromStaff action
    - Verify admin role authorization
    - Check if removing last assignment (prevent if so)
    - Delete staff_stores record
    - If removing primary, automatically set another store as primary
    - Update profiles.store_id if primary changed
    - Create audit log entry
    - _Requirements: 4.2, 4.5, 4.6, 4.7_
  
  - [x] 4.3 Create getStaffAssignments action
    - Query staff_stores with store details
    - Order by is_primary desc, then assigned_at desc
    - Return formatted assignment data
    - _Requirements: 4.1_
  
  - [x] 4.4 Create setPrimaryStore action
    - Verify admin role authorization
    - Verify store is in staff's assignments
    - Update is_primary flags (unset old, set new)
    - Update profiles.store_id for backward compatibility
    - Create audit log entry with old and new primary
    - _Requirements: 4.4, 11.3, 14.3_
  
  - [x] 4.5 Write property tests for assignment management
    - **Property 13: Assignment creation**
    - **Property 14: Assignment removal**
    - **Property 15: First assignment becomes primary**
    - **Property 16: Primary store switching**
    - **Property 17: Last assignment cannot be removed**
    - **Property 18: Non-admin cannot modify assignments**
    - **Property 19: Assignment changes are audited**
    - **Property 35: Primary change audited**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 11.3**

- [x] 5. Update authentication and session management
  - [x] 5.1 Update middleware to load store assignments
    - Query staff_stores for authenticated user
    - Extract assigned store IDs and primary store
    - Store in JWT metadata (assigned_store_ids, primary_store_id, current_store_id)
    - Default current_store_id to primary_store_id
    - _Requirements: 8.1, 8.2, 5.6_
  
  - [x] 5.2 Create store context update function
    - Validate new store context is in user's assigned stores
    - Update JWT metadata with new current_store_id
    - Return success/error result
    - _Requirements: 5.3, 8.3, 8.4_
  
  - [x] 5.3 Add session refresh on assignment changes
    - After assignment modifications, trigger session refresh
    - Reload store assignments from database
    - Update JWT metadata
    - _Requirements: 8.5_
  
  - [x] 5.4 Write property tests for session management
    - **Property 21: Store context persists**
    - **Property 22: Default to primary store**
    - **Property 30: Authentication loads assignments**
    - **Property 31: JWT contains primary store**
    - **Property 32: Store context updates without re-auth**
    - **Property 33: Store context validation**
    - **Property 34: Session refreshes after assignment changes**
    - **Validates: Requirements 5.4, 5.6, 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 6. Checkpoint - Verify backend functionality
  - Test assignment creation and removal
  - Test session management and store context
  - Verify audit logging works
  - Ensure all tests pass, ask the user if questions arise

- [x] 7. Update sales actions for multi-store support
  - [x] 7.1 Add store access validation to createSale
    - Check if selected store is in user's assigned stores
    - Return clear error if unauthorized
    - Allow RLS to provide defense-in-depth
    - _Requirements: 6.1_
  
  - [x] 7.2 Update getSales to work with assigned stores
    - Query should automatically filter by RLS
    - Add optional store filter parameter
    - Return sales with store information
    - _Requirements: 6.2, 6.5_
  
  - [x] 7.3 Create getAssignedStores helper for forms
    - Query staff_stores for current user
    - Return store list for dropdowns
    - Order by name
    - _Requirements: 6.3_
  
  - [x] 7.4 Write property tests for sales access control
    - **Property 23: Sale creation validates store access**
    - **Property 24: Sales filtered by assigned stores**
    - **Property 25: Sales form shows only assigned stores**
    - **Property 26: Sales filtering by store**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.5**

- [x] 8. Update inventory actions for multi-store support
  - [x] 8.1 Update getInventory to show all assigned stores
    - Query should automatically filter by RLS
    - Include store name in results
    - Add optional store filter parameter
    - _Requirements: 7.1, 7.2_
  
  - [x] 8.2 Add store access validation to stock opname actions
    - Validate store access before creating/updating stock opname
    - Return error if unauthorized
    - _Requirements: 7.4_
  
  - [x] 8.3 Write property tests for inventory access control
    - **Property 27: Inventory shows all assigned stores**
    - **Property 28: Inventory filtering by store**
    - **Property 29: Stock opname validates store access**
    - **Validates: Requirements 7.1, 7.2, 7.4**

- [x] 9. Create store selector UI component
  - [x] 9.1 Create StoreSelector component
    - Load assigned stores from user metadata
    - Display current store name
    - Render SearchableSelect with store options
    - Handle store change (update session and reload)
    - Only render if user has multiple stores
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 9.2 Add StoreSelector to Header component
    - Import and render StoreSelector
    - Position appropriately in header layout
    - Ensure responsive design
    - _Requirements: 5.1, 9.1_
  
  - [x] 9.3 Write unit tests for StoreSelector component
    - Test rendering for multi-store staff
    - Test not rendering for single-store staff
    - Test store change handler
    - _Requirements: 5.1, 5.5_

- [x] 10. Update sales input form for multi-store
  - [x] 10.1 Update SalesInputPage to load assigned stores
    - Query assigned stores from user metadata
    - Pass stores to form component
    - _Requirements: 6.3_
  
  - [x] 10.2 Update SalesForm to use assigned stores
    - Populate store dropdown with assigned stores only
    - Default to current store context if available
    - _Requirements: 6.3_
  
  - [x] 10.3 Write unit tests for sales form
    - Test store dropdown contains only assigned stores
    - Test default store selection
    - _Requirements: 6.3_

- [x] 11. Update inventory views for multi-store
  - [x] 11.1 Update inventory page to show store column
    - Add store name column to inventory table
    - Update query to include store information
    - _Requirements: 7.3, 9.3_
  
  - [x] 11.2 Add store filter to inventory page
    - Create filter dropdown with assigned stores
    - Apply filter to inventory query
    - Allow "All Stores" option
    - _Requirements: 7.2_
  
  - [x] 11.3 Write unit tests for inventory views
    - Test store column displays correctly
    - Test store filter functionality
    - _Requirements: 7.2, 7.3_

- [x] 12. Create admin interface for store assignment management
  - [x] 12.1 Create store assignments management page
    - Create page at /master-data/staff-assignments
    - Restrict access to admin role only
    - Display list of all staff with their assignments
    - _Requirements: 10.1, 10.2_
  
  - [x] 12.2 Create StaffAssignmentList component
    - Display staff members in table/list
    - Show assigned stores for each staff
    - Indicate primary store with badge/icon
    - Add actions for managing assignments
    - _Requirements: 10.2, 10.3_
  
  - [x] 12.3 Create AssignStoreDialog component
    - Modal/dialog for assigning stores to staff
    - Store selector dropdown
    - Primary store checkbox
    - Call assignStoreToStaff action on submit
    - _Requirements: 10.4_
  
  - [x] 12.4 Create RemoveAssignmentDialog component
    - Confirmation dialog for removing assignments
    - Show warning if removing primary store
    - Call removeStoreFromStaff action on confirm
    - _Requirements: 10.5, 10.7_
  
  - [x] 12.5 Create SetPrimaryStoreDialog component
    - Dialog for changing primary store
    - Show current primary
    - Dropdown with assigned stores
    - Call setPrimaryStore action on submit
    - _Requirements: 10.6_
  
  - [x] 12.6 Write unit tests for admin interface
    - Test page access control (admin only)
    - Test assignment list rendering
    - Test dialog interactions
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 13. Checkpoint - Verify UI functionality
  - Test store selector in header
  - Test sales form with multiple stores
  - Test inventory views with store filtering
  - Test admin assignment management interface
  - Ensure all tests pass, ask the user if questions arise

- [x] 14. Add audit log viewing for store assignments
  - [x] 14.1 Update audit log page to show assignment events
    - Add filter for store assignment events
    - Display staff_id, store_id, action, admin_id
    - Show timestamps
    - _Requirements: 11.4, 11.5_
  
  - [x] 14.2 Create getStaffAssignmentHistory action
    - Query audit log for specific staff member
    - Filter by assignment-related actions
    - Return formatted history
    - _Requirements: 11.5_
  
  - [x] 14.3 Write property tests for audit logging
    - **Property 36: Audit entries have timestamps**
    - **Property 37: Admins view assignment history**
    - **Validates: Requirements 11.4, 11.5**

- [x] 15. Implement edge case handling
  - [x] 15.1 Add no-assignments error handling
    - Check for empty assignments on login
    - Display error message if no stores assigned
    - Prevent access to store-specific features
    - _Requirements: 13.1_
  
  - [x] 15.2 Add invalid store context recovery
    - Validate store context on each request
    - Reset to primary store if invalid
    - Log warning for debugging
    - _Requirements: 13.6_
  
  - [x] 15.3 Add validation for setting non-assigned store as primary
    - Check if store is in assignments before setting primary
    - Return clear error if not
    - _Requirements: 13.5_
  
  - [x] 15.4 Write property tests for edge cases
    - **Property 39: Invalid primary store rejected**
    - **Property 40: Invalid context resets to primary**
    - **Validates: Requirements 13.5, 13.6**

- [x] 16. Add backward compatibility tests
  - [x] 16.1 Write property tests for backward compatibility
    - **Property 10: Backward compatibility maintained**
    - **Property 11: New assignments take precedence**
    - **Property 12: Primary store syncs to profiles**
    - **Validates: Requirements 3.3, 3.4, 14.3**

- [x] 17. Performance optimization
  - [x] 17.1 Implement session caching for store assignments
    - Cache assigned store IDs in session
    - Avoid repeated database queries
    - Invalidate cache on assignment changes
    - _Requirements: 12.2_
  
  - [x] 17.2 Write property test for caching
    - **Property 38: Session caches assignments**
    - **Validates: Requirements 12.2**

- [x] 18. Final checkpoint and integration testing
  - [x] 18.1 Run full test suite
    - Execute all unit tests
    - Execute all property tests (100+ iterations each)
    - Verify all tests pass
  
  - [x] 18.2 Manual integration testing
    - Test complete assignment workflow as admin
    - Test multi-store access as staff
    - Test store switching and data access
    - Test migration with sample data
  
  - [x] 18.3 Performance testing
    - Test with 100+ stores and 1000+ staff
    - Verify query performance
    - Check session load times
  
  - [x] 18.4 Security testing
    - Verify RLS policies cannot be bypassed
    - Test authorization at all levels
    - Attempt unauthorized access scenarios

- [x] 19. Documentation and deployment preparation
  - [x] 19.1 Update deployment documentation
    - Document migration steps
    - Add rollback procedures
    - Note backward compatibility period
  
  - [x] 19.2 Create user guide for multi-store feature
    - Document store selector usage
    - Explain store context
    - Guide for admins on managing assignments
  
  - [x] 19.3 Update API documentation
    - Document new server actions
    - Document session structure changes
    - Document RLS policy changes

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Migration maintains zero downtime and backward compatibility
- All store assignment changes are audited for compliance
