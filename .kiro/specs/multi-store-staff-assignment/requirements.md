# Requirements Document

## Introduction

This document specifies the requirements for implementing a multi-store staff assignment feature in the Dreame Retail ERP system. The feature enables staff members to be assigned to multiple stores simultaneously, replacing the current one-to-one relationship with a flexible many-to-many relationship. This allows staff who work across multiple locations to access and manage data for all their assigned stores without needing separate accounts.

## Glossary

- **Staff**: Users with the 'staff' role who work at retail stores
- **Store**: A physical retail location in the system
- **Junction_Table**: The `staff_stores` table that manages many-to-many relationships between staff and stores
- **Primary_Store**: The main store assigned to a staff member, used for backward compatibility
- **RLS**: Row Level Security - PostgreSQL security policies that control data access
- **Store_Context**: The currently active store that a staff member is viewing/working with
- **Admin**: Users with administrative privileges who can manage store assignments
- **Manager**: Users with manager role who have broader access across stores
- **Dealer**: Users with dealer role who have broader access across stores

## Requirements

### Requirement 1: Database Schema for Multi-Store Assignment

**User Story:** As a system architect, I want a proper database schema for multi-store assignments, so that the system can efficiently manage many-to-many relationships between staff and stores.

#### Acceptance Criteria

1. THE System SHALL create a `staff_stores` junction table with columns: id, staff_id, store_id, is_primary, assigned_at, created_at
2. THE System SHALL add a foreign key constraint from `staff_stores.staff_id` to `profiles.id` with CASCADE delete
3. THE System SHALL add a foreign key constraint from `staff_stores.store_id` to `stores.id` with CASCADE delete
4. THE System SHALL create a unique constraint on (staff_id, store_id) to prevent duplicate assignments
5. THE System SHALL create an index on staff_id for efficient lookup of staff assignments
6. THE System SHALL create an index on store_id for efficient lookup of store staff
7. THE System SHALL ensure each staff member has exactly one primary store by adding a unique partial index on (staff_id) WHERE is_primary = true

### Requirement 2: Row Level Security for Multi-Store Access

**User Story:** As a security engineer, I want comprehensive RLS policies for multi-store access, so that staff can only access data for their assigned stores.

#### Acceptance Criteria

1. THE System SHALL create RLS policies on `staff_stores` table allowing staff to view their own assignments
2. THE System SHALL create RLS policies on `staff_stores` table allowing admins to manage all assignments
3. WHEN a staff member queries data, THE System SHALL use a helper function that returns an array of their assigned store IDs
4. THE System SHALL update all existing RLS policies on sales, inventory, and related tables to check if the store_id is in the user's assigned stores array
5. THE System SHALL ensure admin and manager roles bypass store-specific RLS and see all stores
6. THE System SHALL prevent staff from accessing data for stores not in their assignment list

### Requirement 3: Data Migration and Backward Compatibility

**User Story:** As a system administrator, I want seamless migration of existing single-store assignments, so that current staff can continue working without disruption.

#### Acceptance Criteria

1. WHEN the migration runs, THE System SHALL copy all existing `profiles.store_id` values to the `staff_stores` junction table
2. WHEN migrating existing assignments, THE System SHALL set `is_primary` to true for the migrated store
3. THE System SHALL maintain the `profiles.store_id` field for backward compatibility during transition
4. WHEN a staff member has assignments in `staff_stores`, THE System SHALL use those assignments instead of `profiles.store_id`
5. THE System SHALL ensure zero data loss during migration
6. THE System SHALL provide a rollback mechanism if migration fails

### Requirement 4: Store Assignment Management

**User Story:** As an administrator, I want to manage staff store assignments, so that I can assign staff to multiple stores and update assignments as needed.

#### Acceptance Criteria

1. WHEN an admin assigns a store to staff, THE System SHALL create a record in `staff_stores` table
2. WHEN an admin removes a store assignment, THE System SHALL delete the corresponding record from `staff_stores`
3. IF a staff member has no primary store, WHEN assigning a store, THE System SHALL set it as primary
4. WHEN an admin changes the primary store, THE System SHALL update the `is_primary` flag accordingly
5. THE System SHALL prevent removal of the last store assignment for a staff member
6. THE System SHALL prevent non-admin users from modifying store assignments
7. WHEN store assignments change, THE System SHALL log the change in the audit log

### Requirement 5: Store Context Selection and Switching

**User Story:** As a staff member assigned to multiple stores, I want to select and switch between my assigned stores, so that I can view and manage data for different locations.

#### Acceptance Criteria

1. WHEN a multi-store staff member logs in, THE System SHALL display a store selector dropdown in the header
2. THE System SHALL show the currently active store name in the header
3. WHEN a staff member selects a different store, THE System SHALL update the store context without page reload
4. THE System SHALL persist the selected store context in the user session
5. WHEN a staff member has only one assigned store, THE System SHALL not display the store selector
6. THE System SHALL default to the primary store when no store context is set

### Requirement 6: Sales Data Access Control

**User Story:** As a staff member, I want to create and view sales only for my assigned stores, so that data isolation is maintained.

#### Acceptance Criteria

1. WHEN creating a sale, THE System SHALL validate that the selected store is in the staff member's assigned stores
2. WHEN viewing sales, THE System SHALL filter sales to only show those from the staff member's assigned stores
3. THE System SHALL populate the store selector in sales input form with only the staff member's assigned stores
4. WHEN a staff member attempts to create a sale for a non-assigned store, THE System SHALL reject the request with an error message
5. THE System SHALL allow filtering sales by specific assigned stores or viewing all assigned stores

### Requirement 7: Inventory Data Access Control

**User Story:** As a staff member, I want to view inventory for all my assigned stores, so that I can manage stock across multiple locations.

#### Acceptance Criteria

1. WHEN viewing inventory, THE System SHALL show inventory data from all assigned stores by default
2. THE System SHALL allow filtering inventory by specific assigned stores
3. THE System SHALL display store name alongside each inventory item
4. WHEN performing stock opname, THE System SHALL only allow operations on assigned stores
5. THE System SHALL prevent staff from viewing inventory for non-assigned stores

### Requirement 8: Authentication and Session Management

**User Story:** As a system architect, I want proper session management for multi-store staff, so that store context is maintained across requests.

#### Acceptance Criteria

1. WHEN a staff member authenticates, THE System SHALL load all their store assignments into the session
2. THE System SHALL include the primary store ID in JWT metadata for backward compatibility
3. WHEN store context changes, THE System SHALL update the session without requiring re-authentication
4. THE System SHALL validate store context on each request to ensure it's in the user's assigned stores
5. WHEN a staff member's assignments change, THE System SHALL refresh their session on next request

### Requirement 9: User Interface for Multi-Store Staff

**User Story:** As a staff member with multiple store assignments, I want clear visual indicators of my current store context, so that I always know which store's data I'm viewing.

#### Acceptance Criteria

1. THE System SHALL display the current active store name prominently in the header
2. THE System SHALL show a store icon or badge next to the store selector
3. WHEN viewing data tables, THE System SHALL include a store column showing which store each record belongs to
4. THE System SHALL use consistent styling for the store selector across all pages
5. THE System SHALL provide responsive design for the store selector on mobile devices

### Requirement 10: Admin Interface for Store Assignment Management

**User Story:** As an administrator, I want a dedicated interface to manage staff store assignments, so that I can easily assign and remove stores for staff members.

#### Acceptance Criteria

1. THE System SHALL provide a store assignment management page accessible only to admins
2. THE System SHALL display a list of all staff members with their current store assignments
3. WHEN viewing a staff member, THE System SHALL show all assigned stores with primary store indicated
4. THE System SHALL provide an interface to add new store assignments to staff
5. THE System SHALL provide an interface to remove store assignments from staff
6. THE System SHALL provide an interface to change which store is primary
7. THE System SHALL show confirmation dialogs before removing store assignments

### Requirement 11: Audit Logging for Store Assignments

**User Story:** As a compliance officer, I want all store assignment changes logged, so that I can track who made changes and when.

#### Acceptance Criteria

1. WHEN a store is assigned to staff, THE System SHALL create an audit log entry with staff_id, store_id, and admin_id
2. WHEN a store assignment is removed, THE System SHALL create an audit log entry with staff_id, store_id, and admin_id
3. WHEN the primary store changes, THE System SHALL create an audit log entry with old and new primary store IDs
4. THE System SHALL include timestamps for all store assignment audit entries
5. THE System SHALL allow admins to view store assignment history for any staff member

### Requirement 12: Performance Optimization

**User Story:** As a system architect, I want optimized queries for multi-store access, so that the system performs well with large numbers of stores and staff.

#### Acceptance Criteria

1. THE System SHALL use database indexes on `staff_stores` table for efficient lookups
2. WHEN querying user store assignments, THE System SHALL cache the results in the session
3. THE System SHALL use efficient array operations in RLS policies to check store access
4. THE System SHALL avoid N+1 query problems when loading store-related data
5. WHEN a page loads, THE System SHALL fetch store assignments in a single query

### Requirement 13: Error Handling and Edge Cases

**User Story:** As a developer, I want comprehensive error handling for edge cases, so that the system behaves predictably in unusual situations.

#### Acceptance Criteria

1. WHEN a staff member has no store assignments, THE System SHALL display an appropriate error message and prevent access to store-specific features
2. WHEN a store is deleted, THE System SHALL automatically remove all staff assignments to that store
3. WHEN a staff member is deleted, THE System SHALL automatically remove all their store assignments
4. WHEN attempting to remove the last store assignment, THE System SHALL prevent the operation and show an error
5. WHEN attempting to set a non-assigned store as primary, THE System SHALL reject the operation
6. WHEN a staff member's session contains an invalid store context, THE System SHALL reset to their primary store

### Requirement 14: Backward Compatibility During Transition

**User Story:** As a system administrator, I want the system to work with both old and new store assignment methods during transition, so that we can migrate gradually.

#### Acceptance Criteria

1. WHEN `staff_stores` table is empty for a user, THE System SHALL fall back to `profiles.store_id`
2. WHEN `staff_stores` table has data for a user, THE System SHALL ignore `profiles.store_id`
3. THE System SHALL continue to update `profiles.store_id` with the primary store for backward compatibility
4. THE System SHALL allow both assignment methods to coexist during migration period
5. WHEN querying store access, THE System SHALL check `staff_stores` first, then fall back to `profiles.store_id`
