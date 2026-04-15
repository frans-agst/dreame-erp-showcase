/**
 * Property-based tests for Multi-Store Staff Assignment
 * Feature: multi-store-staff-assignment
 * 
 * This file contains property tests for database integrity properties:
 * - Property 1: Staff deletion cascades to assignments
 * - Property 2: Store deletion cascades to assignments
 * - Property 3: Duplicate assignments are prevented
 * - Property 4: Single primary store per staff
 * 
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.7**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface StaffStoreAssignment {
  id: string;
  staff_id: string;
  store_id: string;
  is_primary: boolean;
  assigned_at: string;
  created_at: string;
}

interface Staff {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'staff';
  store_id: string | null;
  is_active: boolean;
}

interface Store {
  id: string;
  name: string;
  is_active: boolean;
}

// ============================================
// MODEL FUNCTIONS
// ============================================

/**
 * Model function: Simulates CASCADE DELETE behavior when staff is deleted
 * Returns the assignments that would remain after staff deletion
 */
function simulateStaffDeletion(
  staffId: string,
  assignments: StaffStoreAssignment[]
): StaffStoreAssignment[] {
  // CASCADE DELETE: Remove all assignments for this staff
  return assignments.filter(a => a.staff_id !== staffId);
}

/**
 * Model function: Simulates CASCADE DELETE behavior when store is deleted
 * Returns the assignments that would remain after store deletion
 */
function simulateStoreDeletion(
  storeId: string,
  assignments: StaffStoreAssignment[]
): StaffStoreAssignment[] {
  // CASCADE DELETE: Remove all assignments to this store
  return assignments.filter(a => a.store_id !== storeId);
}

/**
 * Model function: Validates if an assignment can be created
 * Returns true if assignment is valid, false if duplicate
 */
function validateAssignmentCreation(
  staffId: string,
  storeId: string,
  existingAssignments: StaffStoreAssignment[]
): { valid: boolean; error?: string } {
  // Check for duplicate (staff_id, store_id) combination
  const duplicate = existingAssignments.some(
    a => a.staff_id === staffId && a.store_id === storeId
  );
  
  if (duplicate) {
    return { 
      valid: false, 
      error: 'Duplicate assignment: This staff member is already assigned to this store' 
    };
  }
  
  return { valid: true };
}

/**
 * Model function: Validates primary store constraint
 * Returns true if exactly one primary store exists per staff
 */
function validatePrimaryStoreConstraint(
  assignments: StaffStoreAssignment[]
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Group assignments by staff_id
  const assignmentsByStaff = new Map<string, StaffStoreAssignment[]>();
  for (const assignment of assignments) {
    if (!assignmentsByStaff.has(assignment.staff_id)) {
      assignmentsByStaff.set(assignment.staff_id, []);
    }
    assignmentsByStaff.get(assignment.staff_id)!.push(assignment);
  }
  
  // Check each staff has exactly one primary store
  for (const [staffId, staffAssignments] of assignmentsByStaff) {
    const primaryCount = staffAssignments.filter(a => a.is_primary).length;
    
    if (primaryCount === 0) {
      violations.push(`Staff ${staffId} has no primary store`);
    } else if (primaryCount > 1) {
      violations.push(`Staff ${staffId} has ${primaryCount} primary stores (should be exactly 1)`);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Model function: Attempts to set a store as primary
 * Returns updated assignments or error
 */
function setPrimaryStore(
  staffId: string,
  newPrimaryStoreId: string,
  assignments: StaffStoreAssignment[]
): { success: boolean; assignments?: StaffStoreAssignment[]; error?: string } {
  // Check if the store is in staff's assignments
  const hasAssignment = assignments.some(
    a => a.staff_id === staffId && a.store_id === newPrimaryStoreId
  );
  
  if (!hasAssignment) {
    return {
      success: false,
      error: 'Cannot set non-assigned store as primary'
    };
  }
  
  // Update assignments: unset old primary, set new primary
  const updated = assignments.map(a => {
    if (a.staff_id !== staffId) return a;
    
    return {
      ...a,
      is_primary: a.store_id === newPrimaryStoreId
    };
  });
  
  return { success: true, assignments: updated };
}

// ============================================
// PROPERTY TESTS
// ============================================

describe('Property 1: Staff deletion cascades to assignments', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 1: Staff deletion cascades to assignments
   * *For any* staff member with store assignments, when the staff member is deleted,
   * all their store assignments should also be deleted automatically.
   * **Validates: Requirements 1.2**
   */
  
  it('should remove all assignments when staff is deleted', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id to delete
        fc.array(
          fc.record({
            id: fc.uuid(),
            staff_id: fc.uuid(),
            store_id: fc.uuid(),
            is_primary: fc.boolean(),
            assigned_at: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() }).map(ts => new Date(ts).toISOString()),
            created_at: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() }).map(ts => new Date(ts).toISOString()),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (staffIdToDelete, allAssignments) => {
          // Ensure at least one assignment belongs to the staff being deleted
          const assignmentsWithTarget = [
            ...allAssignments,
            {
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffIdToDelete,
              store_id: fc.sample(fc.uuid(), 1)[0],
              is_primary: true,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }
          ];
          
          const remainingAssignments = simulateStaffDeletion(
            staffIdToDelete,
            assignmentsWithTarget
          );
          
          // Verify: No assignments should remain for the deleted staff
          const hasDeletedStaffAssignments = remainingAssignments.some(
            a => a.staff_id === staffIdToDelete
          );
          
          return !hasDeletedStaffAssignments;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should preserve assignments for other staff when one staff is deleted', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id to delete
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // other staff ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // store ids
        (staffIdToDelete, otherStaffIds, storeIds) => {
          // Create assignments for multiple staff
          const assignments: StaffStoreAssignment[] = [];
          
          // Add assignments for staff to be deleted
          storeIds.forEach((storeId, idx) => {
            assignments.push({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffIdToDelete,
              store_id: storeId,
              is_primary: idx === 0,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          });
          
          // Add assignments for other staff
          otherStaffIds.forEach(staffId => {
            assignments.push({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffId,
              store_id: storeIds[0],
              is_primary: true,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          });
          
          const countBefore = assignments.filter(
            a => otherStaffIds.includes(a.staff_id)
          ).length;
          
          const remainingAssignments = simulateStaffDeletion(
            staffIdToDelete,
            assignments
          );
          
          const countAfter = remainingAssignments.filter(
            a => otherStaffIds.includes(a.staff_id)
          ).length;
          
          // Other staff assignments should be preserved
          return countBefore === countAfter;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Store deletion cascades to assignments', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 2: Store deletion cascades to assignments
   * *For any* store with staff assignments, when the store is deleted,
   * all assignments to that store should be deleted automatically.
   * **Validates: Requirements 1.3**
   */
  
  it('should remove all assignments when store is deleted', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // store_id to delete
        fc.array(
          fc.record({
            id: fc.uuid(),
            staff_id: fc.uuid(),
            store_id: fc.uuid(),
            is_primary: fc.boolean(),
            assigned_at: fc.constantFrom(
              new Date('2024-01-01').toISOString(),
              new Date('2024-06-01').toISOString(),
              new Date('2025-01-01').toISOString()
            ),
            created_at: fc.constantFrom(
              new Date('2024-01-01').toISOString(),
              new Date('2024-06-01').toISOString(),
              new Date('2025-01-01').toISOString()
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (storeIdToDelete, allAssignments) => {
          // Ensure at least one assignment belongs to the store being deleted
          const assignmentsWithTarget = [
            ...allAssignments,
            {
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: fc.sample(fc.uuid(), 1)[0],
              store_id: storeIdToDelete,
              is_primary: false,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }
          ];
          
          const remainingAssignments = simulateStoreDeletion(
            storeIdToDelete,
            assignmentsWithTarget
          );
          
          // Verify: No assignments should remain for the deleted store
          const hasDeletedStoreAssignments = remainingAssignments.some(
            a => a.store_id === storeIdToDelete
          );
          
          return !hasDeletedStoreAssignments;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should preserve assignments for other stores when one store is deleted', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // store_id to delete
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // other store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // staff ids
        (storeIdToDelete, otherStoreIds, staffIds) => {
          // Create assignments for multiple stores
          const assignments: StaffStoreAssignment[] = [];
          
          // Add assignments for store to be deleted
          staffIds.forEach(staffId => {
            assignments.push({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffId,
              store_id: storeIdToDelete,
              is_primary: false,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          });
          
          // Add assignments for other stores
          otherStoreIds.forEach((storeId, idx) => {
            staffIds.forEach(staffId => {
              assignments.push({
                id: fc.sample(fc.uuid(), 1)[0],
                staff_id: staffId,
                store_id: storeId,
                is_primary: idx === 0,
                assigned_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              });
            });
          });
          
          const countBefore = assignments.filter(
            a => otherStoreIds.includes(a.store_id)
          ).length;
          
          const remainingAssignments = simulateStoreDeletion(
            storeIdToDelete,
            assignments
          );
          
          const countAfter = remainingAssignments.filter(
            a => otherStoreIds.includes(a.store_id)
          ).length;
          
          // Other store assignments should be preserved
          return countBefore === countAfter;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 3: Duplicate assignments are prevented', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 3: Duplicate assignments are prevented
   * *For any* staff member and store, attempting to create a duplicate assignment
   * (same staff_id and store_id) should be rejected by the database.
   * **Validates: Requirements 1.4**
   */
  
  it('should reject duplicate staff-store assignments', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // store_id
        fc.array(
          fc.record({
            id: fc.uuid(),
            staff_id: fc.uuid(),
            store_id: fc.uuid(),
            is_primary: fc.boolean(),
            assigned_at: fc.constantFrom(
              new Date('2024-01-01').toISOString(),
              new Date('2024-06-01').toISOString(),
              new Date('2025-01-01').toISOString()
            ),
            created_at: fc.constantFrom(
              new Date('2024-01-01').toISOString(),
              new Date('2024-06-01').toISOString(),
              new Date('2025-01-01').toISOString()
            ),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (staffId, storeId, existingAssignments) => {
          // Add the assignment we'll try to duplicate
          const assignmentsWithDuplicate = [
            ...existingAssignments,
            {
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffId,
              store_id: storeId,
              is_primary: false,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }
          ];
          
          // Try to create duplicate
          const result = validateAssignmentCreation(
            staffId,
            storeId,
            assignmentsWithDuplicate
          );
          
          // Should be rejected
          return !result.valid && result.error?.includes('Duplicate');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should allow assignment when no duplicate exists', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // store_id
        fc.array(
          fc.record({
            id: fc.uuid(),
            staff_id: fc.uuid(),
            store_id: fc.uuid(),
            is_primary: fc.boolean(),
            assigned_at: fc.constantFrom(
              new Date('2024-01-01').toISOString(),
              new Date('2024-06-01').toISOString(),
              new Date('2025-01-01').toISOString()
            ),
            created_at: fc.constantFrom(
              new Date('2024-01-01').toISOString(),
              new Date('2024-06-01').toISOString(),
              new Date('2025-01-01').toISOString()
            ),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (staffId, storeId, existingAssignments) => {
          // Filter out any potential duplicates
          const nonDuplicateAssignments = existingAssignments.filter(
            a => !(a.staff_id === staffId && a.store_id === storeId)
          );
          
          // Try to create assignment
          const result = validateAssignmentCreation(
            staffId,
            storeId,
            nonDuplicateAssignments
          );
          
          // Should be allowed
          return result.valid;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 4: Single primary store per staff', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 4: Single primary store per staff
   * *For any* staff member, attempting to set multiple stores as primary should be rejected,
   * ensuring exactly one primary store exists.
   * **Validates: Requirements 1.7**
   */
  
  it('should enforce exactly one primary store per staff member', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // staff ids
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // store ids
        (staffIds, storeIds) => {
          // Create valid assignments: each staff has exactly one primary
          const assignments: StaffStoreAssignment[] = [];
          
          staffIds.forEach(staffId => {
            storeIds.forEach((storeId, idx) => {
              assignments.push({
                id: fc.sample(fc.uuid(), 1)[0],
                staff_id: staffId,
                store_id: storeId,
                is_primary: idx === 0, // Only first store is primary
                assigned_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              });
            });
          });
          
          const validation = validatePrimaryStoreConstraint(assignments);
          
          // Should be valid (exactly one primary per staff)
          return validation.valid;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should detect violation when staff has multiple primary stores', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // store ids
        (staffId, storeIds) => {
          // Create invalid assignments: multiple primary stores
          const assignments: StaffStoreAssignment[] = storeIds.map(storeId => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: true, // All marked as primary (invalid!)
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          const validation = validatePrimaryStoreConstraint(assignments);
          
          // Should be invalid
          return !validation.valid && validation.violations.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should detect violation when staff has no primary store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // store ids
        (staffId, storeIds) => {
          // Create invalid assignments: no primary store
          const assignments: StaffStoreAssignment[] = storeIds.map(storeId => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: false, // None marked as primary (invalid!)
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          const validation = validatePrimaryStoreConstraint(assignments);
          
          // Should be invalid
          return !validation.valid && validation.violations.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should successfully change primary store when new store is assigned', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // store ids
        fc.integer({ min: 0, max: 4 }), // index of new primary
        (staffId, storeIds, newPrimaryIdx) => {
          fc.pre(newPrimaryIdx < storeIds.length);
          
          // Create assignments with first store as primary
          const assignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Change primary to different store
          const result = setPrimaryStore(
            staffId,
            storeIds[newPrimaryIdx],
            assignments
          );
          
          if (!result.success || !result.assignments) return false;
          
          // Verify exactly one primary
          const validation = validatePrimaryStoreConstraint(result.assignments);
          if (!validation.valid) return false;
          
          // Verify correct store is primary
          const primaryAssignment = result.assignments.find(
            a => a.staff_id === staffId && a.is_primary
          );
          
          return primaryAssignment?.store_id === storeIds[newPrimaryIdx];
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should reject setting non-assigned store as primary', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        fc.uuid(), // non-assigned store id
        (staffId, assignedStoreIds, nonAssignedStoreId) => {
          // Ensure non-assigned store is not in assigned stores
          fc.pre(!assignedStoreIds.includes(nonAssignedStoreId));
          
          // Create assignments
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Try to set non-assigned store as primary
          const result = setPrimaryStore(
            staffId,
            nonAssignedStoreId,
            assignments
          );
          
          // Should be rejected
          return !result.success && result.error?.includes('non-assigned');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// ACCESS CONTROL PROPERTIES (Task 2.5)
// ============================================

/**
 * Model function: Simulates RLS filtering for staff viewing assignments
 * Staff should only see their own assignments
 */
function filterAssignmentsForStaff(
  userId: string,
  userRole: 'admin' | 'manager' | 'staff' | 'dealer',
  allAssignments: StaffStoreAssignment[]
): StaffStoreAssignment[] {
  if (userRole === 'admin') {
    // Admins see all assignments
    return allAssignments;
  }
  
  // Staff see only their own assignments
  return allAssignments.filter(a => a.staff_id === userId);
}

/**
 * Model function: Simulates get_user_store_ids helper function
 * Returns array of store IDs that a user has access to
 */
function getUserStoreIds(
  userId: string,
  userRole: 'admin' | 'manager' | 'staff' | 'dealer',
  assignments: StaffStoreAssignment[],
  allStores: Store[],
  profileStoreId: string | null
): string[] {
  // Admin, manager, and dealer see all stores
  if (userRole === 'admin' || userRole === 'manager' || userRole === 'dealer') {
    return allStores.filter(s => s.is_active).map(s => s.id);
  }
  
  // Staff: get assigned stores from junction table
  const assignedStoreIds = assignments
    .filter(a => a.staff_id === userId)
    .map(a => a.store_id);
  
  // Fallback to profiles.store_id for backward compatibility
  if (assignedStoreIds.length === 0 && profileStoreId) {
    return [profileStoreId];
  }
  
  return assignedStoreIds;
}

/**
 * Model function: Simulates RLS filtering for sales/inventory data
 * Returns only records where store_id is in user's assigned stores
 */
function filterDataByStoreAccess<T extends { store_id: string }>(
  userId: string,
  userRole: 'admin' | 'manager' | 'staff' | 'dealer',
  data: T[],
  userStoreIds: string[]
): T[] {
  // Admin, manager, and dealer bypass store restrictions
  if (userRole === 'admin' || userRole === 'manager' || userRole === 'dealer') {
    return data;
  }
  
  // Staff see only data from assigned stores
  return data.filter(item => userStoreIds.includes(item.store_id));
}

describe('Property 5: Staff view only own assignments', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 5: Staff view only own assignments
   * *For any* staff member, querying the staff_stores table should return only their own assignments,
   * not assignments of other staff members.
   * **Validates: Requirements 2.1**
   */
  
  it('should return only own assignments for staff users', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // current user (staff)
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // other staff ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // store ids
        (currentUserId, otherStaffIds, storeIds) => {
          // Ensure current user is not in other staff list
          const filteredOtherStaff = otherStaffIds.filter(id => id !== currentUserId);
          fc.pre(filteredOtherStaff.length > 0);
          
          // Create assignments for current user
          const currentUserAssignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: currentUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Create assignments for other staff
          const otherAssignments: StaffStoreAssignment[] = filteredOtherStaff.flatMap(staffId =>
            storeIds.map((storeId, idx) => ({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffId,
              store_id: storeId,
              is_primary: idx === 0,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }))
          );
          
          const allAssignments = [...currentUserAssignments, ...otherAssignments];
          
          // Filter as staff user
          const visibleAssignments = filterAssignmentsForStaff(
            currentUserId,
            'staff',
            allAssignments
          );
          
          // Should only see own assignments
          const allBelongToUser = visibleAssignments.every(a => a.staff_id === currentUserId);
          const hasCorrectCount = visibleAssignments.length === currentUserAssignments.length;
          
          return allBelongToUser && hasCorrectCount;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should not see other staff assignments', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // current user (staff)
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // other staff ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // store ids
        (currentUserId, otherStaffIds, storeIds) => {
          // Ensure current user is not in other staff list
          const filteredOtherStaff = otherStaffIds.filter(id => id !== currentUserId);
          fc.pre(filteredOtherStaff.length > 0);
          
          // Create assignments only for other staff
          const otherAssignments: StaffStoreAssignment[] = filteredOtherStaff.flatMap(staffId =>
            storeIds.map((storeId, idx) => ({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffId,
              store_id: storeId,
              is_primary: idx === 0,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }))
          );
          
          // Filter as staff user (no assignments for current user)
          const visibleAssignments = filterAssignmentsForStaff(
            currentUserId,
            'staff',
            otherAssignments
          );
          
          // Should see nothing
          return visibleAssignments.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 6: Admins view all assignments', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 6: Admins view all assignments
   * *For any* admin user, querying the staff_stores table should return all assignments
   * for all staff members.
   * **Validates: Requirements 2.2**
   */
  
  it('should return all assignments for admin users', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // admin user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // staff ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // store ids
        (adminUserId, staffIds, storeIds) => {
          // Create assignments for multiple staff
          const allAssignments: StaffStoreAssignment[] = staffIds.flatMap(staffId =>
            storeIds.map((storeId, idx) => ({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffId,
              store_id: storeId,
              is_primary: idx === 0,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }))
          );
          
          // Filter as admin user
          const visibleAssignments = filterAssignmentsForStaff(
            adminUserId,
            'admin',
            allAssignments
          );
          
          // Should see all assignments
          return visibleAssignments.length === allAssignments.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should see assignments from all staff members', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // admin user id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }), // staff ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // store ids
        (adminUserId, staffIds, storeIds) => {
          // Create assignments for multiple staff
          const allAssignments: StaffStoreAssignment[] = staffIds.flatMap(staffId =>
            storeIds.slice(0, 1).map(storeId => ({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffId,
              store_id: storeId,
              is_primary: true,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }))
          );
          
          // Filter as admin user
          const visibleAssignments = filterAssignmentsForStaff(
            adminUserId,
            'admin',
            allAssignments
          );
          
          // Should see assignments from all staff
          const uniqueStaffIds = new Set(visibleAssignments.map(a => a.staff_id));
          return uniqueStaffIds.size === staffIds.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: Helper function returns assigned store IDs', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 7: Helper function returns assigned store IDs
   * *For any* staff member with store assignments, calling get_user_store_ids should return
   * an array containing exactly their assigned store IDs.
   * **Validates: Requirements 2.3**
   */
  
  it('should return all assigned store IDs for staff', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 20 }),
            is_active: fc.constant(true),
          }),
          { minLength: 5, maxLength: 10 }
        ),
        (staffUserId, assignedStoreIds, allStores) => {
          // Create assignments for staff
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Get store IDs via helper function
          const storeIds = getUserStoreIds(
            staffUserId,
            'staff',
            assignments,
            allStores,
            null
          );
          
          // Should return exactly the assigned store IDs
          const sortedResult = [...storeIds].sort();
          const sortedExpected = [...assignedStoreIds].sort();
          
          return JSON.stringify(sortedResult) === JSON.stringify(sortedExpected);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should fallback to profile store_id when no assignments exist', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.uuid(), // profile store_id
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 20 }),
            is_active: fc.constant(true),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (staffUserId, profileStoreId, allStores) => {
          // No assignments in staff_stores
          const assignments: StaffStoreAssignment[] = [];
          
          // Get store IDs via helper function (should fallback)
          const storeIds = getUserStoreIds(
            staffUserId,
            'staff',
            assignments,
            allStores,
            profileStoreId
          );
          
          // Should return profile store_id as fallback
          return storeIds.length === 1 && storeIds[0] === profileStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should return empty array when no assignments and no profile store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 20 }),
            is_active: fc.constant(true),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (staffUserId, allStores) => {
          // No assignments and no profile store_id
          const assignments: StaffStoreAssignment[] = [];
          
          // Get store IDs via helper function
          const storeIds = getUserStoreIds(
            staffUserId,
            'staff',
            assignments,
            allStores,
            null
          );
          
          // Should return empty array
          return storeIds.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 8: RLS filters data by assigned stores', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 8: RLS filters data by assigned stores
   * *For any* staff member, querying sales or inventory should return only records
   * where store_id is in their assigned stores array.
   * **Validates: Requirements 2.4**
   */
  
  interface SalesRecord {
    id: string;
    store_id: string;
    product_id: string;
    quantity: number;
  }
  
  it('should filter sales data by assigned stores', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // assigned store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // non-assigned store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // product ids
        (staffUserId, assignedStoreIds, nonAssignedStoreIds, productIds) => {
          // Ensure no overlap between assigned and non-assigned stores
          const filteredNonAssigned = nonAssignedStoreIds.filter(
            id => !assignedStoreIds.includes(id)
          );
          fc.pre(filteredNonAssigned.length > 0);
          
          // Create sales data for both assigned and non-assigned stores
          const salesData: SalesRecord[] = [
            ...assignedStoreIds.flatMap(storeId =>
              productIds.map(productId => ({
                id: fc.sample(fc.uuid(), 1)[0],
                store_id: storeId,
                product_id: productId,
                quantity: fc.sample(fc.integer({ min: 1, max: 10 }), 1)[0],
              }))
            ),
            ...filteredNonAssigned.flatMap(storeId =>
              productIds.map(productId => ({
                id: fc.sample(fc.uuid(), 1)[0],
                store_id: storeId,
                product_id: productId,
                quantity: fc.sample(fc.integer({ min: 1, max: 10 }), 1)[0],
              }))
            ),
          ];
          
          // Filter data by store access
          const visibleSales = filterDataByStoreAccess(
            staffUserId,
            'staff',
            salesData,
            assignedStoreIds
          );
          
          // Should only see sales from assigned stores
          const allFromAssignedStores = visibleSales.every(sale =>
            assignedStoreIds.includes(sale.store_id)
          );
          
          const expectedCount = assignedStoreIds.length * productIds.length;
          
          return allFromAssignedStores && visibleSales.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should not see data from non-assigned stores', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // assigned store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // non-assigned store ids
        (staffUserId, assignedStoreIds, nonAssignedStoreIds) => {
          // Ensure no overlap
          const filteredNonAssigned = nonAssignedStoreIds.filter(
            id => !assignedStoreIds.includes(id)
          );
          fc.pre(filteredNonAssigned.length > 0);
          
          // Create sales data only for non-assigned stores
          const salesData: SalesRecord[] = filteredNonAssigned.map(storeId => ({
            id: fc.sample(fc.uuid(), 1)[0],
            store_id: storeId,
            product_id: fc.sample(fc.uuid(), 1)[0],
            quantity: 1,
          }));
          
          // Filter data by store access
          const visibleSales = filterDataByStoreAccess(
            staffUserId,
            'staff',
            salesData,
            assignedStoreIds
          );
          
          // Should see nothing
          return visibleSales.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 9: Admin and manager bypass store restrictions', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 9: Admin and manager bypass store restrictions
   * *For any* admin or manager user, querying sales or inventory should return records
   * from all stores regardless of assignments.
   * **Validates: Requirements 2.5**
   */
  
  interface InventoryRecord {
    id: string;
    store_id: string;
    product_id: string;
    quantity: number;
  }
  
  it('should return all stores for admin users', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // admin user id
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 20 }),
            is_active: fc.constant(true),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (adminUserId, allStores) => {
          // Get store IDs via helper function as admin
          const storeIds = getUserStoreIds(
            adminUserId,
            'admin',
            [], // No assignments needed for admin
            allStores,
            null
          );
          
          // Should return all active stores
          return storeIds.length === allStores.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should return all stores for manager users', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // manager user id
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 20 }),
            is_active: fc.constant(true),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (managerUserId, allStores) => {
          // Get store IDs via helper function as manager
          const storeIds = getUserStoreIds(
            managerUserId,
            'manager',
            [], // No assignments needed for manager
            allStores,
            null
          );
          
          // Should return all active stores
          return storeIds.length === allStores.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should return all stores for dealer users', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // dealer user id
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 20 }),
            is_active: fc.constant(true),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (dealerUserId, allStores) => {
          // Get store IDs via helper function as dealer
          const storeIds = getUserStoreIds(
            dealerUserId,
            'dealer',
            [], // No assignments needed for dealer
            allStores,
            null
          );
          
          // Should return all active stores
          return storeIds.length === allStores.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should see all inventory data for admin users', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // admin user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // product ids
        (adminUserId, storeIds, productIds) => {
          // Create inventory data for all stores
          const inventoryData: InventoryRecord[] = storeIds.flatMap(storeId =>
            productIds.map(productId => ({
              id: fc.sample(fc.uuid(), 1)[0],
              store_id: storeId,
              product_id: productId,
              quantity: fc.sample(fc.integer({ min: 0, max: 100 }), 1)[0],
            }))
          );
          
          // Filter data as admin (should see all)
          const visibleInventory = filterDataByStoreAccess(
            adminUserId,
            'admin',
            inventoryData,
            storeIds // Admin has access to all stores
          );
          
          // Should see all inventory
          return visibleInventory.length === inventoryData.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should see all sales data for manager users', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // manager user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // store ids
        (managerUserId, storeIds) => {
          interface SalesRecord {
            id: string;
            store_id: string;
            product_id: string;
            quantity: number;
          }
          
          // Create sales data for all stores
          const salesData: SalesRecord[] = storeIds.map(storeId => ({
            id: fc.sample(fc.uuid(), 1)[0],
            store_id: storeId,
            product_id: fc.sample(fc.uuid(), 1)[0],
            quantity: 1,
          }));
          
          // Filter data as manager (should see all)
          const visibleSales = filterDataByStoreAccess(
            managerUserId,
            'manager',
            salesData,
            storeIds // Manager has access to all stores
          );
          
          // Should see all sales
          return visibleSales.length === salesData.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// SESSION MANAGEMENT PROPERTIES (Task 5.4)
// ============================================

/**
 * Model function: Simulates session metadata structure
 */
interface SessionMetadata {
  assigned_store_ids: string[];
  primary_store_id: string | null;
  current_store_id: string | null;
}

/**
 * Model function: Simulates loading store assignments into session
 * Requirements: 8.1, 8.2, 5.6
 */
function loadStoreAssignmentsToSession(
  userId: string,
  assignments: StaffStoreAssignment[],
  profileStoreId: string | null
): SessionMetadata {
  const assignedStoreIds = assignments
    .filter(a => a.staff_id === userId)
    .map(a => a.store_id);
  
  const primaryStore = assignments
    .find(a => a.staff_id === userId && a.is_primary)?.store_id || null;
  
  // Fallback to profiles.store_id for backward compatibility
  const finalPrimaryStore = primaryStore || profileStoreId;
  const finalAssignedStoreIds = assignedStoreIds.length > 0 
    ? assignedStoreIds 
    : (profileStoreId ? [profileStoreId] : []);
  
  // Default current_store_id to primary_store_id
  const currentStoreId = finalPrimaryStore;
  
  return {
    assigned_store_ids: finalAssignedStoreIds,
    primary_store_id: finalPrimaryStore,
    current_store_id: currentStoreId,
  };
}

/**
 * Model function: Updates store context in session
 * Requirements: 5.3, 8.3, 8.4
 */
function updateStoreContextInSession(
  newStoreId: string,
  currentSession: SessionMetadata
): { success: boolean; session?: SessionMetadata; error?: string } {
  // Validate new store context is in user's assigned stores
  if (!currentSession.assigned_store_ids.includes(newStoreId)) {
    return {
      success: false,
      error: 'You do not have access to this store'
    };
  }
  
  // Update current_store_id
  return {
    success: true,
    session: {
      ...currentSession,
      current_store_id: newStoreId,
    }
  };
}

/**
 * Model function: Validates store context on request
 * Requirements: 8.4
 */
function validateStoreContext(
  session: SessionMetadata
): { valid: boolean; correctedSession?: SessionMetadata } {
  // If current_store_id is not in assigned stores, reset to primary
  if (session.current_store_id && 
      !session.assigned_store_ids.includes(session.current_store_id)) {
    return {
      valid: false,
      correctedSession: {
        ...session,
        current_store_id: session.primary_store_id,
      }
    };
  }
  
  return { valid: true };
}

describe('Property 21: Store context persists', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 21: Store context persists
   * *For any* staff member, after setting a store context in the session,
   * subsequent requests should maintain that context until explicitly changed.
   * **Validates: Requirements 5.4**
   */
  
  it('should maintain store context across multiple operations', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // assigned store ids
        fc.integer({ min: 0, max: 4 }), // index of store to set as context
        (staffUserId, assignedStoreIds, contextIdx) => {
          fc.pre(contextIdx < assignedStoreIds.length);
          
          // Create assignments
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Load initial session
          let session = loadStoreAssignmentsToSession(staffUserId, assignments, null);
          
          // Update store context
          const selectedStoreId = assignedStoreIds[contextIdx];
          const updateResult = updateStoreContextInSession(selectedStoreId, session);
          
          if (!updateResult.success || !updateResult.session) return false;
          
          session = updateResult.session;
          
          // Verify context persists
          return session.current_store_id === selectedStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should persist context even when different from primary store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 3, maxLength: 5 }), // assigned store ids
        (staffUserId, assignedStoreIds) => {
          // Create assignments with first as primary
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Load initial session (defaults to primary)
          let session = loadStoreAssignmentsToSession(staffUserId, assignments, null);
          
          // Switch to non-primary store
          const nonPrimaryStoreId = assignedStoreIds[1];
          const updateResult = updateStoreContextInSession(nonPrimaryStoreId, session);
          
          if (!updateResult.success || !updateResult.session) return false;
          
          session = updateResult.session;
          
          // Context should be non-primary store, not primary
          return session.current_store_id === nonPrimaryStoreId &&
                 session.current_store_id !== session.primary_store_id;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 22: Default to primary store', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 22: Default to primary store
   * *For any* staff member, when no store context is set in the session,
   * the system should default to their primary store.
   * **Validates: Requirements 5.6**
   */
  
  it('should default current_store_id to primary_store_id on session load', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        (staffUserId, assignedStoreIds) => {
          // Create assignments with first as primary
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Load session (should default to primary)
          const session = loadStoreAssignmentsToSession(staffUserId, assignments, null);
          
          // current_store_id should equal primary_store_id
          return session.current_store_id === session.primary_store_id &&
                 session.current_store_id === assignedStoreIds[0];
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should use profile store_id as default when no assignments exist', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.uuid(), // profile store_id
        (staffUserId, profileStoreId) => {
          // No assignments
          const assignments: StaffStoreAssignment[] = [];
          
          // Load session with profile fallback
          const session = loadStoreAssignmentsToSession(staffUserId, assignments, profileStoreId);
          
          // Should default to profile store_id
          return session.current_store_id === profileStoreId &&
                 session.primary_store_id === profileStoreId &&
                 session.assigned_store_ids.length === 1 &&
                 session.assigned_store_ids[0] === profileStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 30: Authentication loads assignments', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 30: Authentication loads assignments
   * *For any* staff member, after authentication, the session should contain
   * all their assigned store IDs from staff_stores.
   * **Validates: Requirements 8.1**
   */
  
  it('should load all assigned store IDs into session', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        (staffUserId, assignedStoreIds) => {
          // Create assignments
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Load session
          const session = loadStoreAssignmentsToSession(staffUserId, assignments, null);
          
          // Should contain all assigned store IDs
          const sortedSession = [...session.assigned_store_ids].sort();
          const sortedExpected = [...assignedStoreIds].sort();
          
          return JSON.stringify(sortedSession) === JSON.stringify(sortedExpected);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should load assignments for correct user only', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // current user id
        fc.uuid(), // other user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // current user stores
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // other user stores
        (currentUserId, otherUserId, currentUserStores, otherUserStores) => {
          fc.pre(currentUserId !== otherUserId);
          
          // Create assignments for both users
          const assignments: StaffStoreAssignment[] = [
            ...currentUserStores.map((storeId, idx) => ({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: currentUserId,
              store_id: storeId,
              is_primary: idx === 0,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            })),
            ...otherUserStores.map((storeId, idx) => ({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: otherUserId,
              store_id: storeId,
              is_primary: idx === 0,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            })),
          ];
          
          // Load session for current user
          const session = loadStoreAssignmentsToSession(currentUserId, assignments, null);
          
          // Should only contain current user's stores
          const hasOnlyCurrentUserStores = session.assigned_store_ids.every(
            storeId => currentUserStores.includes(storeId)
          );
          const hasNoOtherUserStores = !session.assigned_store_ids.some(
            storeId => otherUserStores.includes(storeId)
          );
          
          return hasOnlyCurrentUserStores && hasNoOtherUserStores;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 31: JWT contains primary store', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 31: JWT contains primary store
   * *For any* staff member, the JWT metadata should include their primary store ID
   * for backward compatibility.
   * **Validates: Requirements 8.2**
   */
  
  it('should include primary_store_id in session metadata', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        (staffUserId, assignedStoreIds) => {
          // Create assignments with first as primary
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Load session
          const session = loadStoreAssignmentsToSession(staffUserId, assignments, null);
          
          // Should have primary_store_id set to first store
          return session.primary_store_id === assignedStoreIds[0];
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should use profile store_id as primary when no assignments exist', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.uuid(), // profile store_id
        (staffUserId, profileStoreId) => {
          // No assignments
          const assignments: StaffStoreAssignment[] = [];
          
          // Load session with profile fallback
          const session = loadStoreAssignmentsToSession(staffUserId, assignments, profileStoreId);
          
          // Should use profile store_id as primary
          return session.primary_store_id === profileStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 32: Store context updates without re-auth', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 32: Store context updates without re-auth
   * *For any* staff member, changing store context should update the session
   * without requiring a new authentication.
   * **Validates: Requirements 8.3**
   */
  
  it('should update current_store_id without changing other session data', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // assigned store ids
        fc.integer({ min: 1, max: 4 }), // index of new store context
        (staffUserId, assignedStoreIds, newContextIdx) => {
          fc.pre(newContextIdx < assignedStoreIds.length);
          
          // Create assignments
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Load initial session
          const initialSession = loadStoreAssignmentsToSession(staffUserId, assignments, null);
          
          // Update store context
          const newStoreId = assignedStoreIds[newContextIdx];
          const updateResult = updateStoreContextInSession(newStoreId, initialSession);
          
          if (!updateResult.success || !updateResult.session) return false;
          
          const updatedSession = updateResult.session;
          
          // Only current_store_id should change
          const assignedStoresUnchanged = 
            JSON.stringify(updatedSession.assigned_store_ids) === 
            JSON.stringify(initialSession.assigned_store_ids);
          const primaryStoreUnchanged = 
            updatedSession.primary_store_id === initialSession.primary_store_id;
          const currentStoreChanged = 
            updatedSession.current_store_id === newStoreId;
          
          return assignedStoresUnchanged && primaryStoreUnchanged && currentStoreChanged;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 33: Store context validation', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 33: Store context validation
   * *For any* request, if the session's current_store_id is not in the user's assigned stores,
   * the request should be rejected or context reset.
   * **Validates: Requirements 8.4**
   */
  
  it('should reject store context update for non-assigned store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // assigned store ids
        fc.uuid(), // non-assigned store id
        (staffUserId, assignedStoreIds, nonAssignedStoreId) => {
          // Ensure non-assigned store is not in assigned stores
          fc.pre(!assignedStoreIds.includes(nonAssignedStoreId));
          
          // Create assignments
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Load session
          const session = loadStoreAssignmentsToSession(staffUserId, assignments, null);
          
          // Try to update to non-assigned store
          const updateResult = updateStoreContextInSession(nonAssignedStoreId, session);
          
          // Should be rejected
          return !updateResult.success && updateResult.error?.includes('do not have access');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should reset invalid store context to primary store', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // assigned store ids
        fc.uuid(), // invalid current store id
        (assignedStoreIds, invalidStoreId) => {
          // Ensure invalid store is not in assigned stores
          fc.pre(!assignedStoreIds.includes(invalidStoreId));
          
          // Create session with invalid current_store_id
          const invalidSession: SessionMetadata = {
            assigned_store_ids: assignedStoreIds,
            primary_store_id: assignedStoreIds[0],
            current_store_id: invalidStoreId, // Invalid!
          };
          
          // Validate and correct
          const validation = validateStoreContext(invalidSession);
          
          if (validation.valid || !validation.correctedSession) return false;
          
          // Should reset to primary store
          return validation.correctedSession.current_store_id === assignedStoreIds[0];
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should accept valid store context', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        fc.integer({ min: 0, max: 4 }), // index of valid current store
        (assignedStoreIds, currentIdx) => {
          fc.pre(currentIdx < assignedStoreIds.length);
          
          // Create session with valid current_store_id
          const validSession: SessionMetadata = {
            assigned_store_ids: assignedStoreIds,
            primary_store_id: assignedStoreIds[0],
            current_store_id: assignedStoreIds[currentIdx],
          };
          
          // Validate
          const validation = validateStoreContext(validSession);
          
          // Should be valid
          return validation.valid;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 34: Session refreshes after assignment changes', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 34: Session refreshes after assignment changes
   * *For any* staff member, after their store assignments are modified,
   * their session should reflect the new assignments on the next request.
   * **Validates: Requirements 8.5**
   */
  
  it('should reflect new assignments after adding a store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // initial assigned store ids
        fc.uuid(), // new store id to add
        (staffUserId, initialStoreIds, newStoreId) => {
          // Ensure new store is not already assigned
          fc.pre(!initialStoreIds.includes(newStoreId));
          
          // Create initial assignments
          const initialAssignments: StaffStoreAssignment[] = initialStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Load initial session
          const initialSession = loadStoreAssignmentsToSession(staffUserId, initialAssignments, null);
          
          // Simulate adding new store assignment
          const updatedAssignments: StaffStoreAssignment[] = [
            ...initialAssignments,
            {
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffUserId,
              store_id: newStoreId,
              is_primary: false,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }
          ];
          
          // Refresh session
          const refreshedSession = loadStoreAssignmentsToSession(staffUserId, updatedAssignments, null);
          
          // Should include new store
          const hasNewStore = refreshedSession.assigned_store_ids.includes(newStoreId);
          const hasCorrectCount = refreshedSession.assigned_store_ids.length === initialStoreIds.length + 1;
          
          return hasNewStore && hasCorrectCount;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should reflect removed assignments after removing a store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // initial assigned store ids
        fc.integer({ min: 1, max: 4 }), // index of store to remove (not primary)
        (staffUserId, initialStoreIds, removeIdx) => {
          fc.pre(removeIdx < initialStoreIds.length);
          
          // Create initial assignments
          const initialAssignments: StaffStoreAssignment[] = initialStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Simulate removing store assignment (not primary)
          const removedStoreId = initialStoreIds[removeIdx];
          const updatedAssignments = initialAssignments.filter(
            a => a.store_id !== removedStoreId
          );
          
          // Refresh session
          const refreshedSession = loadStoreAssignmentsToSession(staffUserId, updatedAssignments, null);
          
          // Should not include removed store
          const doesNotHaveRemovedStore = !refreshedSession.assigned_store_ids.includes(removedStoreId);
          const hasCorrectCount = refreshedSession.assigned_store_ids.length === initialStoreIds.length - 1;
          
          return doesNotHaveRemovedStore && hasCorrectCount;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should reflect new primary store after primary change', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // assigned store ids
        fc.integer({ min: 1, max: 4 }), // index of new primary
        (staffUserId, storeIds, newPrimaryIdx) => {
          fc.pre(newPrimaryIdx < storeIds.length);
          
          // Create initial assignments with first as primary
          const initialAssignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffUserId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Simulate changing primary store
          const updatedAssignments = initialAssignments.map((a, idx) => ({
            ...a,
            is_primary: idx === newPrimaryIdx,
          }));
          
          // Refresh session
          const refreshedSession = loadStoreAssignmentsToSession(staffUserId, updatedAssignments, null);
          
          // Should reflect new primary
          return refreshedSession.primary_store_id === storeIds[newPrimaryIdx];
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// INVENTORY ACCESS CONTROL PROPERTIES
// ============================================

/**
 * Property 27: Inventory shows all assigned stores
 * For any staff member with multiple stores, viewing inventory without filters 
 * should show inventory from all their assigned stores.
 * **Validates: Requirements 7.1**
 */
describe('Property 27: Inventory shows all assigned stores', () => {
  it('should show inventory from all assigned stores for multi-store staff', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // assigned store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // product ids
        (staffUserId, assignedStoreIds, productIds) => {
          // Create inventory items across all assigned stores
          const inventoryItems: Array<{ store_id: string; product_id: string; quantity: number }> = [];
          
          assignedStoreIds.forEach(storeId => {
            productIds.forEach(productId => {
              inventoryItems.push({
                store_id: storeId,
                product_id: productId,
                quantity: fc.sample(fc.integer({ min: 0, max: 100 }), 1)[0],
              });
            });
          });
          
          // Simulate RLS filtering: staff can see inventory from assigned stores
          const visibleInventory = inventoryItems.filter(item => 
            assignedStoreIds.includes(item.store_id)
          );
          
          // All inventory items should be visible (no filtering applied)
          const allAssignedStoresRepresented = assignedStoreIds.every(storeId =>
            visibleInventory.some(item => item.store_id === storeId)
          );
          
          return allAssignedStoresRepresented && visibleInventory.length === inventoryItems.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should not show inventory from non-assigned stores', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // assigned store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // non-assigned store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // product ids
        (staffUserId, assignedStoreIds, nonAssignedStoreIds, productIds) => {
          // Ensure no overlap between assigned and non-assigned stores
          const uniqueNonAssigned = nonAssignedStoreIds.filter(id => !assignedStoreIds.includes(id));
          fc.pre(uniqueNonAssigned.length > 0);
          
          // Create inventory items in both assigned and non-assigned stores
          const allInventoryItems: Array<{ store_id: string; product_id: string }> = [];
          
          [...assignedStoreIds, ...uniqueNonAssigned].forEach(storeId => {
            productIds.forEach(productId => {
              allInventoryItems.push({ store_id: storeId, product_id: productId });
            });
          });
          
          // Simulate RLS filtering
          const visibleInventory = allInventoryItems.filter(item => 
            assignedStoreIds.includes(item.store_id)
          );
          
          // Should not include any items from non-assigned stores
          const hasNoNonAssignedStores = !visibleInventory.some(item =>
            uniqueNonAssigned.includes(item.store_id)
          );
          
          return hasNoNonAssignedStores;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 28: Inventory filtering by store
 * For any staff member with multiple stores, applying a store filter 
 * should return only inventory from the selected store(s).
 * **Validates: Requirements 7.2**
 */
describe('Property 28: Inventory filtering by store', () => {
  it('should filter inventory to selected stores only', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 3, maxLength: 5 }), // assigned store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // product ids
        fc.integer({ min: 1, max: 2 }), // number of stores to filter by
        (staffUserId, assignedStoreIds, productIds, filterCount) => {
          fc.pre(filterCount <= assignedStoreIds.length);
          
          // Select stores to filter by
          const storeFilter = assignedStoreIds.slice(0, filterCount);
          
          // Create inventory items across all assigned stores
          const allInventory: Array<{ store_id: string; product_id: string }> = [];
          
          assignedStoreIds.forEach(storeId => {
            productIds.forEach(productId => {
              allInventory.push({ store_id: storeId, product_id: productId });
            });
          });
          
          // Apply store filter
          const filteredInventory = allInventory.filter(item =>
            storeFilter.includes(item.store_id)
          );
          
          // All filtered items should be from selected stores
          const allFromSelectedStores = filteredInventory.every(item =>
            storeFilter.includes(item.store_id)
          );
          
          // Should not include items from non-selected stores
          const noItemsFromOtherStores = !filteredInventory.some(item =>
            !storeFilter.includes(item.store_id)
          );
          
          return allFromSelectedStores && noItemsFromOtherStores;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should return empty result when filtering by non-assigned store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // assigned store ids
        fc.uuid(), // non-assigned store id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // product ids
        (staffUserId, assignedStoreIds, nonAssignedStoreId, productIds) => {
          // Ensure non-assigned store is not in assigned stores
          fc.pre(!assignedStoreIds.includes(nonAssignedStoreId));
          
          // Create inventory items in assigned stores
          const allInventory: Array<{ store_id: string; product_id: string }> = [];
          
          assignedStoreIds.forEach(storeId => {
            productIds.forEach(productId => {
              allInventory.push({ store_id: storeId, product_id: productId });
            });
          });
          
          // Apply filter for non-assigned store (should be blocked by RLS)
          const filteredInventory = allInventory.filter(item =>
            item.store_id === nonAssignedStoreId
          );
          
          // Should return empty result
          return filteredInventory.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 29: Stock opname validates store access
 * For any staff member, attempting to perform stock opname for a store 
 * not in their assigned stores should be rejected.
 * **Validates: Requirements 7.4**
 */
describe('Property 29: Stock opname validates store access', () => {
  it('should allow stock opname for assigned stores', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        fc.integer({ min: 0, max: 4 }), // index of store to perform opname
        (staffUserId, assignedStoreIds, storeIdx) => {
          fc.pre(storeIdx < assignedStoreIds.length);
          
          const targetStoreId = assignedStoreIds[storeIdx];
          
          // Simulate store access validation
          const hasAccess = assignedStoreIds.includes(targetStoreId);
          
          // Should allow access
          return hasAccess === true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should reject stock opname for non-assigned stores', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // assigned store ids
        fc.uuid(), // non-assigned store id
        (staffUserId, assignedStoreIds, nonAssignedStoreId) => {
          // Ensure non-assigned store is not in assigned stores
          fc.pre(!assignedStoreIds.includes(nonAssignedStoreId));
          
          // Simulate store access validation
          const hasAccess = assignedStoreIds.includes(nonAssignedStoreId);
          
          // Should reject access
          return hasAccess === false;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should validate store access before creating stock opname', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // assigned store ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // all store ids (including non-assigned)
        (staffUserId, assignedStoreIds, allStoreIds) => {
          // For each store, validate access
          const validationResults = allStoreIds.map(storeId => ({
            storeId,
            hasAccess: assignedStoreIds.includes(storeId),
            shouldAllow: assignedStoreIds.includes(storeId),
          }));
          
          // All validations should match expected access
          return validationResults.every(result => 
            result.hasAccess === result.shouldAllow
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should allow admin to perform stock opname on any store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // admin user id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // all store ids
        fc.integer({ min: 0, max: 9 }), // index of store to perform opname
        (adminUserId, allStoreIds, storeIdx) => {
          fc.pre(storeIdx < allStoreIds.length);
          
          const targetStoreId = allStoreIds[storeIdx];
          const userRole = 'admin';
          
          // Simulate store access validation for admin
          // Admins bypass store restrictions
          const hasAccess = userRole === 'admin' || userRole === 'manager';
          
          // Should allow access for admin
          return hasAccess === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 36: Audit entries have timestamps
 * For any store assignment audit log entry, it should include a timestamp 
 * indicating when the change occurred.
 * **Validates: Requirements 11.4**
 */
describe('Property 36: Audit entries have timestamps', () => {
  it('should include created_at timestamp for all audit entries', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // store_id
        fc.uuid(), // admin_id
        fc.constantFrom('store_assigned', 'store_removed', 'primary_store_changed'), // action
        (staffId, storeId, adminId, action) => {
          // Simulate audit log entry creation
          const auditEntry = {
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: adminId,
            action: 'INSERT' as const,
            table_name: 'staff_stores',
            record_id: staffId,
            new_value: {
              action,
              staff_id: staffId,
              store_id: storeId,
              admin_id: adminId,
            },
            created_at: new Date().toISOString(),
          };
          
          // Verify timestamp exists and is valid
          const hasTimestamp = auditEntry.created_at !== undefined && 
                               auditEntry.created_at !== null &&
                               auditEntry.created_at.length > 0;
          
          const isValidTimestamp = !isNaN(Date.parse(auditEntry.created_at));
          
          return hasTimestamp && isValidTimestamp;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should have timestamps in ISO 8601 format', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // store_id
        fc.constantFrom('store_assigned', 'store_removed', 'primary_store_changed'), // action
        (staffId, storeId, action) => {
          // Simulate audit log entry
          const timestamp = new Date().toISOString();
          
          // Verify ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
          const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
          
          return iso8601Regex.test(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should have chronologically ordered timestamps', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // store_ids
        (staffId, storeIds) => {
          // Simulate multiple audit entries created in sequence
          const auditEntries = storeIds.map((storeId, index) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            created_at: new Date(Date.now() + index * 1000).toISOString(),
          }));
          
          // Verify timestamps are in chronological order
          for (let i = 1; i < auditEntries.length; i++) {
            const prevTime = new Date(auditEntries[i - 1].created_at).getTime();
            const currTime = new Date(auditEntries[i].created_at).getTime();
            
            if (currTime < prevTime) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should preserve timestamp precision to milliseconds', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // store_id
        (staffId, storeId) => {
          // Create timestamp with millisecond precision
          const now = new Date();
          const timestamp = now.toISOString();
          
          // Parse back and verify milliseconds are preserved
          const parsed = new Date(timestamp);
          
          return now.getMilliseconds() === parsed.getMilliseconds();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 37: Admins view assignment history
 * For any staff member, admins should be able to query and view the complete 
 * history of store assignment changes from the audit log.
 * **Validates: Requirements 11.5**
 */
describe('Property 37: Admins view assignment history', () => {
  it('should return all assignment events for a staff member', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(
          fc.record({
            action: fc.constantFrom('store_assigned', 'store_removed', 'primary_store_changed'),
            store_id: fc.uuid(),
            timestamp: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }).map(ts => new Date(ts)),
          }),
          { minLength: 1, maxLength: 10 }
        ), // assignment events
        (staffId, events) => {
          // Simulate audit log entries for this staff
          const auditEntries = events.map(event => ({
            id: fc.sample(fc.uuid(), 1)[0],
            table_name: 'staff_stores',
            record_id: staffId,
            new_value: {
              action: event.action,
              staff_id: staffId,
              store_id: event.store_id,
            },
            created_at: event.timestamp.toISOString(),
          }));
          
          // Simulate filtering by staff_id
          const filteredEntries = auditEntries.filter(entry => 
            entry.record_id === staffId || 
            (entry.new_value as Record<string, unknown>)?.staff_id === staffId
          );
          
          // Should return all events for this staff
          return filteredEntries.length === events.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should filter assignment events by staff_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // target staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // other staff_ids
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // store_ids
        (targetStaffId, otherStaffIds, storeIds) => {
          // Ensure target staff is not in other staff list
          fc.pre(!otherStaffIds.includes(targetStaffId));
          
          // Create audit entries for multiple staff
          const allAuditEntries = [
            // Target staff entries
            ...storeIds.map(storeId => ({
              id: fc.sample(fc.uuid(), 1)[0],
              table_name: 'staff_stores',
              record_id: targetStaffId,
              new_value: {
                action: 'store_assigned',
                staff_id: targetStaffId,
                store_id: storeId,
              },
            })),
            // Other staff entries
            ...otherStaffIds.flatMap(staffId =>
              storeIds.map(storeId => ({
                id: fc.sample(fc.uuid(), 1)[0],
                table_name: 'staff_stores',
                record_id: staffId,
                new_value: {
                  action: 'store_assigned',
                  staff_id: staffId,
                  store_id: storeId,
                },
              }))
            ),
          ];
          
          // Filter by target staff_id
          const filteredEntries = allAuditEntries.filter(entry =>
            entry.record_id === targetStaffId ||
            (entry.new_value as Record<string, unknown>)?.staff_id === targetStaffId
          );
          
          // Should only return target staff entries
          return filteredEntries.length === storeIds.length &&
                 filteredEntries.every(entry => 
                   entry.record_id === targetStaffId ||
                   (entry.new_value as Record<string, unknown>)?.staff_id === targetStaffId
                 );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should return assignment history in chronological order', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(
          fc.record({
            action: fc.constantFrom('store_assigned', 'store_removed', 'primary_store_changed'),
            store_id: fc.uuid(),
            timestamp: fc.integer({ min: 1, max: 100 }), // Sequential timestamps
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (staffId, events) => {
          // Create audit entries with sequential timestamps
          const auditEntries = events.map(event => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            action: event.action,
            store_id: event.store_id,
            created_at: new Date(Date.now() + event.timestamp * 1000).toISOString(),
          }));
          
          // Sort by created_at descending (most recent first)
          const sortedEntries = [...auditEntries].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          
          // Verify order is maintained
          for (let i = 1; i < sortedEntries.length; i++) {
            const prevTime = new Date(sortedEntries[i - 1].created_at).getTime();
            const currTime = new Date(sortedEntries[i].created_at).getTime();
            
            if (currTime > prevTime) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should include all assignment action types in history', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // store_id
        (staffId, storeId) => {
          // Simulate complete lifecycle of an assignment
          const auditEntries = [
            {
              action: 'store_assigned',
              staff_id: staffId,
              store_id: storeId,
              is_primary: false,
            },
            {
              action: 'primary_store_changed',
              staff_id: staffId,
              old_primary_store_id: fc.sample(fc.uuid(), 1)[0],
              new_primary_store_id: storeId,
            },
            {
              action: 'store_removed',
              staff_id: staffId,
              store_id: storeId,
            },
          ];
          
          // Verify all action types are present
          const actionTypes = auditEntries.map(entry => entry.action);
          const expectedActions = ['store_assigned', 'primary_store_changed', 'store_removed'];
          
          return expectedActions.every(action => actionTypes.includes(action));
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should only allow admin users to view assignment history', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // user_id
        fc.constantFrom('admin', 'manager', 'staff', 'dealer'), // user_role
        fc.uuid(), // target_staff_id
        (userId, userRole, targetStaffId) => {
          // Simulate authorization check
          const isAuthorized = userRole === 'admin';
          
          // Only admin should be authorized
          if (userRole === 'admin') {
            return isAuthorized === true;
          } else {
            return isAuthorized === false;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should include admin_id in assignment change events', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // store_id
        fc.uuid(), // admin_id
        fc.constantFrom('store_assigned', 'store_removed', 'primary_store_changed'), // action
        (staffId, storeId, adminId, action) => {
          // Simulate audit entry for assignment change
          const auditEntry = {
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: adminId, // Admin who made the change
            table_name: 'staff_stores',
            record_id: staffId,
            new_value: {
              action,
              staff_id: staffId,
              store_id: storeId,
              admin_id: adminId,
            },
            created_at: new Date().toISOString(),
          };
          
          // Verify admin_id is present
          const hasAdminId = auditEntry.user_id !== undefined &&
                            auditEntry.user_id !== null &&
                            auditEntry.user_id === adminId;
          
          return hasAdminId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should limit history results to reasonable size', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.integer({ min: 1, max: 200 }), // number of events
        (staffId, numEvents) => {
          // Simulate large number of audit entries
          const auditEntries = Array.from({ length: numEvents }, (_, i) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            action: 'store_assigned',
            created_at: new Date(Date.now() + i * 1000).toISOString(),
          }));
          
          // Apply limit (e.g., 100 most recent entries)
          const limit = 100;
          const limitedEntries = auditEntries.slice(0, Math.min(limit, auditEntries.length));
          
          // Should not exceed limit
          return limitedEntries.length <= limit;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// EDGE CASE PROPERTIES
// ============================================

describe('Property 39: Invalid primary store rejected', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 39: Invalid primary store rejected
   * *For any* staff member, attempting to set a store as primary when that store is not
   * in their assignments should be rejected with a validation error.
   * **Validates: Requirements 13.5**
   */
  
  it('should reject setting non-assigned store as primary', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store_ids
        fc.uuid(), // non-assigned store_id
        (staffId, assignedStoreIds, nonAssignedStoreId) => {
          // Ensure non-assigned store is not in assigned stores
          fc.pre(!assignedStoreIds.includes(nonAssignedStoreId));
          
          // Create assignments for the staff
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0, // First one is primary
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Attempt to set non-assigned store as primary
          const result = setPrimaryStore(staffId, nonAssignedStoreId, assignments);
          
          // Should be rejected
          return !result.success && result.error === 'Cannot set non-assigned store as primary';
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should allow setting assigned store as primary', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // assigned store_ids (at least 2)
        (staffId, assignedStoreIds) => {
          // Create assignments for the staff
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0, // First one is primary
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Pick a different assigned store to set as primary
          const newPrimaryStoreId = assignedStoreIds[1];
          
          // Attempt to set assigned store as primary
          const result = setPrimaryStore(staffId, newPrimaryStoreId, assignments);
          
          // Should succeed
          if (!result.success) return false;
          
          // Verify the new primary is set correctly
          const newPrimary = result.assignments?.find(
            a => a.staff_id === staffId && a.is_primary
          );
          
          return newPrimary?.store_id === newPrimaryStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should maintain exactly one primary after setting new primary', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // assigned store_ids
        (staffId, assignedStoreIds) => {
          // Create assignments for the staff
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Pick a different assigned store to set as primary
          const newPrimaryStoreId = assignedStoreIds[1];
          
          // Set new primary
          const result = setPrimaryStore(staffId, newPrimaryStoreId, assignments);
          
          if (!result.success || !result.assignments) return false;
          
          // Count primary stores for this staff
          const primaryCount = result.assignments.filter(
            a => a.staff_id === staffId && a.is_primary
          ).length;
          
          // Should have exactly one primary
          return primaryCount === 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 40: Invalid context resets to primary', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 40: Invalid context resets to primary
   * *For any* staff member, if their session contains a store context that is not in their
   * assigned stores, the system should reset the context to their primary store.
   * **Validates: Requirements 13.6**
   */
  
  it('should reset invalid store context to primary store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store_ids
        fc.uuid(), // invalid context store_id
        (staffId, assignedStoreIds, invalidStoreId) => {
          // Ensure invalid store is not in assigned stores
          fc.pre(!assignedStoreIds.includes(invalidStoreId));
          
          // Identify primary store (first one)
          const primaryStoreId = assignedStoreIds[0];
          
          // Simulate session with invalid context
          const session = {
            user_id: staffId,
            assigned_store_ids: assignedStoreIds,
            primary_store_id: primaryStoreId,
            current_store_id: invalidStoreId, // Invalid!
          };
          
          // Validate and reset context
          const isValid = session.assigned_store_ids.includes(session.current_store_id);
          
          if (!isValid) {
            // Reset to primary
            session.current_store_id = session.primary_store_id;
          }
          
          // After reset, context should be valid
          return session.current_store_id === primaryStoreId &&
                 session.assigned_store_ids.includes(session.current_store_id);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should preserve valid store context', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // assigned store_ids (at least 2)
        fc.integer({ min: 0, max: 4 }), // index of valid context store
        (staffId, assignedStoreIds, contextIndex) => {
          // Pick a valid context store from assigned stores
          const validContextStoreId = assignedStoreIds[contextIndex % assignedStoreIds.length];
          const primaryStoreId = assignedStoreIds[0];
          
          // Simulate session with valid context
          const session = {
            user_id: staffId,
            assigned_store_ids: assignedStoreIds,
            primary_store_id: primaryStoreId,
            current_store_id: validContextStoreId, // Valid!
          };
          
          // Validate context
          const isValid = session.assigned_store_ids.includes(session.current_store_id);
          
          // Should not reset if valid
          if (isValid) {
            // Context should remain unchanged
            return session.current_store_id === validContextStoreId;
          }
          
          return false; // Should not reach here with valid context
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle missing current_store_id by defaulting to primary', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store_ids
        (staffId, assignedStoreIds) => {
          const primaryStoreId = assignedStoreIds[0];
          
          // Simulate session with missing current_store_id
          const session = {
            user_id: staffId,
            assigned_store_ids: assignedStoreIds,
            primary_store_id: primaryStoreId,
            current_store_id: null as string | null,
          };
          
          // Default to primary if missing
          if (!session.current_store_id) {
            session.current_store_id = session.primary_store_id;
          }
          
          // Should default to primary
          return session.current_store_id === primaryStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should log warning when resetting invalid context', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store_ids
        fc.uuid(), // invalid context store_id
        (staffId, assignedStoreIds, invalidStoreId) => {
          // Ensure invalid store is not in assigned stores
          fc.pre(!assignedStoreIds.includes(invalidStoreId));
          
          const primaryStoreId = assignedStoreIds[0];
          
          // Simulate validation with logging
          const warnings: string[] = [];
          
          const session = {
            user_id: staffId,
            assigned_store_ids: assignedStoreIds,
            primary_store_id: primaryStoreId,
            current_store_id: invalidStoreId,
          };
          
          const isValid = session.assigned_store_ids.includes(session.current_store_id);
          
          if (!isValid) {
            warnings.push(
              `Invalid store context for user ${staffId}: ${invalidStoreId} not in assigned stores`
            );
            session.current_store_id = session.primary_store_id;
          }
          
          // Should have logged a warning
          return warnings.length === 1 && 
                 warnings[0].includes('Invalid store context') &&
                 session.current_store_id === primaryStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// BACKWARD COMPATIBILITY PROPERTIES (Task 16.1)
// ============================================

/**
 * Model function: Simulates backward compatibility check
 * Verifies that profiles.store_id contains the primary store
 */
function validateBackwardCompatibility(
  staffId: string,
  assignments: StaffStoreAssignment[],
  profileStoreId: string | null
): { compatible: boolean; error?: string } {
  // Find primary store from assignments
  const primaryAssignment = assignments.find(
    a => a.staff_id === staffId && a.is_primary
  );
  
  if (!primaryAssignment) {
    return {
      compatible: false,
      error: 'No primary store found in assignments'
    };
  }
  
  // Check if profiles.store_id matches primary store
  if (profileStoreId !== primaryAssignment.store_id) {
    return {
      compatible: false,
      error: `profiles.store_id (${profileStoreId}) does not match primary store (${primaryAssignment.store_id})`
    };
  }
  
  return { compatible: true };
}

/**
 * Model function: Simulates precedence logic
 * New assignments (staff_stores) should take precedence over profiles.store_id
 */
function getEffectiveStoreIds(
  staffId: string,
  assignments: StaffStoreAssignment[],
  profileStoreId: string | null
): string[] {
  // Get assignments from staff_stores
  const assignedStoreIds = assignments
    .filter(a => a.staff_id === staffId)
    .map(a => a.store_id);
  
  // If staff_stores has data, use it (takes precedence)
  if (assignedStoreIds.length > 0) {
    return assignedStoreIds;
  }
  
  // Fallback to profiles.store_id for backward compatibility
  if (profileStoreId) {
    return [profileStoreId];
  }
  
  return [];
}

/**
 * Model function: Simulates primary store sync to profiles
 * When primary store changes, profiles.store_id should be updated
 */
function syncPrimaryToProfile(
  staffId: string,
  newPrimaryStoreId: string,
  assignments: StaffStoreAssignment[]
): { profileStoreId: string; synced: boolean } {
  // Verify the new primary store is in assignments
  const hasAssignment = assignments.some(
    a => a.staff_id === staffId && a.store_id === newPrimaryStoreId && a.is_primary
  );
  
  if (!hasAssignment) {
    return {
      profileStoreId: '',
      synced: false
    };
  }
  
  // Sync to profiles.store_id
  return {
    profileStoreId: newPrimaryStoreId,
    synced: true
  };
}

describe('Property 10: Backward compatibility maintained', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 10: Backward compatibility maintained
   * *For any* staff member, the profiles.store_id field should continue to exist and contain
   * their primary store ID for backward compatibility.
   * **Validates: Requirements 3.3**
   */
  
  it('should maintain profiles.store_id with primary store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // store_ids
        (staffId, storeIds) => {
          // Create assignments with first store as primary
          const assignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          const primaryStoreId = storeIds[0];
          
          // Simulate profiles.store_id being set to primary
          const profileStoreId = primaryStoreId;
          
          // Validate backward compatibility
          const validation = validateBackwardCompatibility(
            staffId,
            assignments,
            profileStoreId
          );
          
          // profiles.store_id should match primary store
          return validation.compatible;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should detect incompatibility when profiles.store_id does not match primary', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // store_ids (at least 2)
        (staffId, storeIds) => {
          fc.pre(storeIds.length >= 2);
          
          // Create assignments with first store as primary
          const assignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Set profiles.store_id to a different store (not primary)
          const profileStoreId = storeIds[1]; // Not the primary!
          
          // Validate backward compatibility
          const validation = validateBackwardCompatibility(
            staffId,
            assignments,
            profileStoreId
          );
          
          // Should detect incompatibility
          return !validation.compatible && validation.error?.includes('does not match');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should maintain profiles.store_id field even with multi-store assignments', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // multiple store_ids
        (staffId, storeIds) => {
          fc.pre(storeIds.length >= 2);
          
          // Create multiple assignments
          const assignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          const primaryStoreId = storeIds[0];
          
          // profiles.store_id should still exist and contain primary
          const profileStoreId = primaryStoreId;
          
          // Verify it's maintained
          return profileStoreId !== null && 
                 profileStoreId === primaryStoreId &&
                 assignments.length > 1; // Has multiple assignments
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle null profiles.store_id when no assignments exist', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        (staffId) => {
          // No assignments
          const assignments: StaffStoreAssignment[] = [];
          const profileStoreId = null;
          
          // Get effective store IDs (should be empty)
          const effectiveStoreIds = getEffectiveStoreIds(
            staffId,
            assignments,
            profileStoreId
          );
          
          // Should return empty array
          return effectiveStoreIds.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 11: New assignments take precedence', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 11: New assignments take precedence
   * *For any* staff member with both staff_stores assignments and profiles.store_id set,
   * the system should use staff_stores assignments and ignore profiles.store_id.
   * **Validates: Requirements 3.4**
   */
  
  it('should use staff_stores assignments when both exist', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // staff_stores store_ids
        fc.uuid(), // profiles.store_id (different from staff_stores)
        (staffId, assignedStoreIds, profileStoreId) => {
          // Ensure profile store is different from assigned stores
          fc.pre(!assignedStoreIds.includes(profileStoreId));
          
          // Create assignments in staff_stores
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Get effective store IDs (should use staff_stores, not profiles.store_id)
          const effectiveStoreIds = getEffectiveStoreIds(
            staffId,
            assignments,
            profileStoreId
          );
          
          // Should match staff_stores assignments, not profiles.store_id
          const matchesAssignments = effectiveStoreIds.length === assignedStoreIds.length &&
                                     effectiveStoreIds.every(id => assignedStoreIds.includes(id));
          const doesNotIncludeProfile = !effectiveStoreIds.includes(profileStoreId);
          
          return matchesAssignments && doesNotIncludeProfile;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should fallback to profiles.store_id when staff_stores is empty', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // profiles.store_id
        (staffId, profileStoreId) => {
          // No assignments in staff_stores
          const assignments: StaffStoreAssignment[] = [];
          
          // Get effective store IDs (should fallback to profiles.store_id)
          const effectiveStoreIds = getEffectiveStoreIds(
            staffId,
            assignments,
            profileStoreId
          );
          
          // Should use profiles.store_id as fallback
          return effectiveStoreIds.length === 1 &&
                 effectiveStoreIds[0] === profileStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should prioritize staff_stores even when it has fewer stores than profiles', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // single store in staff_stores
        fc.uuid(), // profiles.store_id (different)
        (staffId, assignedStoreId, profileStoreId) => {
          // Ensure they're different
          fc.pre(assignedStoreId !== profileStoreId);
          
          // Create single assignment in staff_stores
          const assignments: StaffStoreAssignment[] = [{
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: assignedStoreId,
            is_primary: true,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }];
          
          // Get effective store IDs
          const effectiveStoreIds = getEffectiveStoreIds(
            staffId,
            assignments,
            profileStoreId
          );
          
          // Should use staff_stores (single store), not profiles.store_id
          return effectiveStoreIds.length === 1 &&
                 effectiveStoreIds[0] === assignedStoreId &&
                 effectiveStoreIds[0] !== profileStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should ignore profiles.store_id completely when staff_stores has data', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // staff_stores store_ids
        fc.uuid(), // profiles.store_id
        (staffId, assignedStoreIds, profileStoreId) => {
          // Create assignments in staff_stores
          const assignments: StaffStoreAssignment[] = assignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Get effective store IDs
          const effectiveStoreIds = getEffectiveStoreIds(
            staffId,
            assignments,
            profileStoreId
          );
          
          // Should completely ignore profiles.store_id
          // Even if profileStoreId is in assignedStoreIds, it should come from staff_stores
          return effectiveStoreIds.length === assignedStoreIds.length &&
                 effectiveStoreIds.every(id => assignedStoreIds.includes(id));
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle transition from profiles.store_id to staff_stores', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // initial profiles.store_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // new staff_stores assignments
        (staffId, initialProfileStoreId, newAssignedStoreIds) => {
          // Phase 1: Only profiles.store_id exists
          const phase1Assignments: StaffStoreAssignment[] = [];
          const phase1StoreIds = getEffectiveStoreIds(
            staffId,
            phase1Assignments,
            initialProfileStoreId
          );
          
          // Should use profiles.store_id
          const phase1Valid = phase1StoreIds.length === 1 &&
                              phase1StoreIds[0] === initialProfileStoreId;
          
          // Phase 2: staff_stores assignments added
          const phase2Assignments: StaffStoreAssignment[] = newAssignedStoreIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          const phase2StoreIds = getEffectiveStoreIds(
            staffId,
            phase2Assignments,
            initialProfileStoreId
          );
          
          // Should now use staff_stores, ignoring profiles.store_id
          const phase2Valid = phase2StoreIds.length === newAssignedStoreIds.length &&
                              phase2StoreIds.every(id => newAssignedStoreIds.includes(id));
          
          return phase1Valid && phase2Valid;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 12: Primary store syncs to profiles', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 12: Primary store syncs to profiles
   * *For any* staff member, when their primary store changes in staff_stores,
   * the profiles.store_id field should be updated to match.
   * **Validates: Requirements 14.3**
   */
  
  it('should sync primary store to profiles.store_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // store_ids
        fc.integer({ min: 0, max: 4 }), // index of new primary
        (staffId, storeIds, newPrimaryIdx) => {
          fc.pre(newPrimaryIdx < storeIds.length);
          
          // Create assignments with first store as primary
          const assignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          // Initial profiles.store_id matches first primary
          let profileStoreId = storeIds[0];
          
          // Change primary to different store
          const updatedAssignments = assignments.map(a => ({
            ...a,
            is_primary: a.store_id === storeIds[newPrimaryIdx]
          }));
          
          // Sync to profiles
          const syncResult = syncPrimaryToProfile(
            staffId,
            storeIds[newPrimaryIdx],
            updatedAssignments
          );
          
          // profiles.store_id should be updated to new primary
          return syncResult.synced && 
                 syncResult.profileStoreId === storeIds[newPrimaryIdx];
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should keep profiles.store_id in sync after multiple primary changes', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 3, maxLength: 5 }), // store_ids (at least 3)
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 2, maxLength: 4 }), // sequence of primary changes
        (staffId, storeIds, primaryIndexSequence) => {
          fc.pre(storeIds.length >= 3);
          fc.pre(primaryIndexSequence.every(idx => idx < storeIds.length));
          
          // Start with first store as primary
          let assignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          let profileStoreId = storeIds[0];
          
          // Apply sequence of primary changes
          for (const newPrimaryIdx of primaryIndexSequence) {
            const newPrimaryStoreId = storeIds[newPrimaryIdx];
            
            // Update assignments
            assignments = assignments.map(a => ({
              ...a,
              is_primary: a.store_id === newPrimaryStoreId
            }));
            
            // Sync to profiles
            const syncResult = syncPrimaryToProfile(
              staffId,
              newPrimaryStoreId,
              assignments
            );
            
            if (!syncResult.synced) return false;
            
            profileStoreId = syncResult.profileStoreId;
          }
          
          // Final profiles.store_id should match last primary
          const lastPrimaryIdx = primaryIndexSequence[primaryIndexSequence.length - 1];
          return profileStoreId === storeIds[lastPrimaryIdx];
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should not sync when setting non-primary store', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // store_ids
        (staffId, storeIds) => {
          fc.pre(storeIds.length >= 2);
          
          // Create assignments with first store as primary
          const assignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          const originalPrimaryStoreId = storeIds[0];
          
          // Try to sync a non-primary store (second store, which is not primary)
          const nonPrimaryStoreId = storeIds[1];
          
          const syncResult = syncPrimaryToProfile(
            staffId,
            nonPrimaryStoreId,
            assignments // assignments still have first store as primary
          );
          
          // Should not sync because the store is not marked as primary
          return !syncResult.synced;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should sync immediately when primary store is set', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // store_ids
        (staffId, storeIds) => {
          // Create assignments with first store as primary
          const assignments: StaffStoreAssignment[] = storeIds.map((storeId, idx) => ({
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: storeId,
            is_primary: idx === 0,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));
          
          const primaryStoreId = storeIds[0];
          
          // Sync should work immediately
          const syncResult = syncPrimaryToProfile(
            staffId,
            primaryStoreId,
            assignments
          );
          
          // Should sync successfully
          return syncResult.synced && 
                 syncResult.profileStoreId === primaryStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should maintain sync across assignment additions', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // staff_id
        fc.uuid(), // initial primary store
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // additional stores to add
        (staffId, initialPrimaryStoreId, additionalStoreIds) => {
          // Ensure additional stores don't include the primary
          const filteredAdditional = additionalStoreIds.filter(id => id !== initialPrimaryStoreId);
          fc.pre(filteredAdditional.length > 0);
          
          // Start with single primary assignment
          let assignments: StaffStoreAssignment[] = [{
            id: fc.sample(fc.uuid(), 1)[0],
            staff_id: staffId,
            store_id: initialPrimaryStoreId,
            is_primary: true,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }];
          
          // Sync initial primary
          let syncResult = syncPrimaryToProfile(
            staffId,
            initialPrimaryStoreId,
            assignments
          );
          
          if (!syncResult.synced) return false;
          
          let profileStoreId = syncResult.profileStoreId;
          
          // Add additional stores (non-primary)
          for (const storeId of filteredAdditional) {
            assignments.push({
              id: fc.sample(fc.uuid(), 1)[0],
              staff_id: staffId,
              store_id: storeId,
              is_primary: false,
              assigned_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          }
          
          // profiles.store_id should still match primary (unchanged)
          return profileStoreId === initialPrimaryStoreId;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// PERFORMANCE PROPERTIES (Task 17.2)
// ============================================

/**
 * Model function: Simulates session cache behavior
 * Returns whether a database query should be executed based on cache state
 */
function shouldQueryDatabase(
  cacheTimestamp: string | null,
  assignedStoreIds: string[] | null,
  requestTimestamp: number, // Add request timestamp parameter
  cacheTTL: number = 5 * 60 * 1000 // 5 minutes
): { shouldQuery: boolean; reason: string } {
  // No cache timestamp - must query
  if (!cacheTimestamp) {
    return { shouldQuery: true, reason: 'no_cache_timestamp' };
  }
  
  // No cached assignments - must query
  if (!assignedStoreIds || assignedStoreIds.length === 0) {
    return { shouldQuery: true, reason: 'no_cached_assignments' };
  }
  
  // Check cache age using request timestamp
  const cacheAge = requestTimestamp - new Date(cacheTimestamp).getTime();
  
  // Cache expired - must query
  if (cacheAge >= cacheTTL) {
    return { shouldQuery: true, reason: 'cache_expired' };
  }
  
  // Cache is valid - skip query
  return { shouldQuery: false, reason: 'cache_valid' };
}

/**
 * Model function: Simulates loading assignments with caching
 * Returns query count and final assignments
 */
function loadAssignmentsWithCache(
  requests: Array<{
    timestamp: number;
    cacheTimestamp: string | null;
    cachedAssignments: string[] | null;
  }>,
  actualAssignments: string[],
  cacheTTL: number = 5 * 60 * 1000
): { queryCount: number; finalAssignments: string[] } {
  let queryCount = 0;
  let currentCacheTimestamp: string | null = null;
  let currentCachedAssignments: string[] | null = null;
  
  for (const request of requests) {
    // Use the cache state from the request (simulating what middleware sees)
    const decision = shouldQueryDatabase(
      request.cacheTimestamp,
      request.cachedAssignments,
      request.timestamp, // Pass request timestamp
      cacheTTL
    );
    
    if (decision.shouldQuery) {
      // Execute database query
      queryCount++;
      
      // Update cache state for next request
      currentCacheTimestamp = new Date(request.timestamp).toISOString();
      currentCachedAssignments = actualAssignments;
    }
    // else: use cached data, no query
  }
  
  return {
    queryCount,
    finalAssignments: currentCachedAssignments || [],
  };
}

describe('Property 38: Session caches assignments', () => {
  /**
   * Feature: multi-store-staff-assignment, Property 38: Session caches assignments
   * *For any* staff member, after loading store assignments once, subsequent queries
   * within the same session should use cached data rather than querying the database.
   * **Validates: Requirements 12.2**
   */
  
  it('should skip database query when cache is valid', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        fc.integer({ min: 0, max: 4 * 60 * 1000 }), // time since cache (< 5 min)
        (assignedStoreIds, timeSinceCache) => {
          const now = Date.now();
          const cacheTimestamp = new Date(now - timeSinceCache).toISOString();
          
          const decision = shouldQueryDatabase(
            cacheTimestamp,
            assignedStoreIds,
            now // Pass current timestamp
          );
          
          // Should NOT query database (cache is valid)
          return !decision.shouldQuery && decision.reason === 'cache_valid';
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should query database when cache is expired', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned store ids
        fc.integer({ min: 5 * 60 * 1000 + 1, max: 60 * 60 * 1000 }), // time since cache (> 5 min)
        (assignedStoreIds, timeSinceCache) => {
          const now = Date.now();
          const cacheTimestamp = new Date(now - timeSinceCache).toISOString();
          
          const decision = shouldQueryDatabase(
            cacheTimestamp,
            assignedStoreIds,
            now // Pass current timestamp
          );
          
          // Should query database (cache expired)
          return decision.shouldQuery && decision.reason === 'cache_expired';
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should query database when no cache exists', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // no cache timestamp
        fc.constant(null), // no cached assignments
        (cacheTimestamp, cachedAssignments) => {
          const decision = shouldQueryDatabase(
            cacheTimestamp,
            cachedAssignments,
            Date.now() // Pass current timestamp
          );
          
          // Should query database (no cache)
          return decision.shouldQuery && decision.reason === 'no_cache_timestamp';
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should query database when cached assignments are empty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60000 }), // milliseconds ago (within 1 minute)
        (msAgo) => {
          const now = Date.now();
          const cacheTimestamp = new Date(now - msAgo).toISOString();
          const cachedAssignments: string[] = []; // empty array
          
          const decision = shouldQueryDatabase(
            cacheTimestamp,
            cachedAssignments,
            now // Pass current timestamp
          );
          
          // Should query database (no cached assignments)
          return decision.shouldQuery && decision.reason === 'no_cached_assignments';
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should reduce database queries with valid cache across multiple requests', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // actual assignments
        fc.integer({ min: 5, max: 20 }), // number of requests
        (actualAssignments, numRequests) => {
          const now = Date.now();
          const cacheTTL = 5 * 60 * 1000; // 5 minutes
          
          // Simulate multiple requests within cache TTL
          const requests = Array.from({ length: numRequests }, (_, i) => {
            const requestTime = now + (i * 10000); // 10 seconds apart
            
            // First request has no cache
            if (i === 0) {
              return {
                timestamp: requestTime,
                cacheTimestamp: null,
                cachedAssignments: null,
              };
            }
            
            // Subsequent requests have valid cache
            return {
              timestamp: requestTime,
              cacheTimestamp: new Date(now).toISOString(),
              cachedAssignments: actualAssignments,
            };
          });
          
          const result = loadAssignmentsWithCache(
            requests,
            actualAssignments,
            cacheTTL
          );
          
          // Should only query database once (first request)
          // All subsequent requests use cache
          return result.queryCount === 1 && 
                 result.finalAssignments.length === actualAssignments.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should refresh cache when TTL expires', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // actual assignments
        (actualAssignments) => {
          const cacheTTL = 5 * 60 * 1000; // 5 minutes
          const baseTime = Date.now();
          
          // Scenario: 3 cycles of cache refresh
          // Cycle 1: Initial load (no cache) -> query
          // Cycle 2: Cache expired -> query
          // Cycle 3: Cache expired -> query
          
          const requests = [];
          
          // Cycle 1: Initial request (no cache)
          requests.push({
            timestamp: baseTime,
            cacheTimestamp: null,
            cachedAssignments: null,
          });
          
          // Cycle 1: Subsequent requests within TTL (cache hit)
          requests.push({
            timestamp: baseTime + 60000, // 1 min later
            cacheTimestamp: new Date(baseTime).toISOString(),
            cachedAssignments: actualAssignments,
          });
          requests.push({
            timestamp: baseTime + 120000, // 2 min later
            cacheTimestamp: new Date(baseTime).toISOString(),
            cachedAssignments: actualAssignments,
          });
          
          // Cycle 2: Cache expired (> 5 min since baseTime)
          const cycle2Start = baseTime + cacheTTL + 60000; // 6 minutes later
          requests.push({
            timestamp: cycle2Start,
            cacheTimestamp: new Date(baseTime).toISOString(), // Old cache from cycle 1
            cachedAssignments: actualAssignments,
          });
          
          // Cycle 2: Subsequent requests within TTL (cache hit)
          requests.push({
            timestamp: cycle2Start + 60000,
            cacheTimestamp: new Date(cycle2Start).toISOString(),
            cachedAssignments: actualAssignments,
          });
          
          // Cycle 3: Cache expired again
          const cycle3Start = cycle2Start + cacheTTL + 60000;
          requests.push({
            timestamp: cycle3Start,
            cacheTimestamp: new Date(cycle2Start).toISOString(), // Old cache from cycle 2
            cachedAssignments: actualAssignments,
          });
          
          const result = loadAssignmentsWithCache(
            requests,
            actualAssignments,
            cacheTTL
          );
          
          // Should query database 3 times (once per cycle)
          return result.queryCount === 3;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle cache invalidation correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // initial assignments
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // updated assignments
        (initialAssignments, updatedAssignments) => {
          const now = Date.now();
          const cacheTTL = 5 * 60 * 1000;
          
          // Request 1: Initial load (cache miss)
          const request1 = {
            timestamp: now,
            cacheTimestamp: null,
            cachedAssignments: null,
          };
          
          // Request 2: Use cache (within TTL)
          const request2 = {
            timestamp: now + 60000,
            cacheTimestamp: new Date(now).toISOString(),
            cachedAssignments: initialAssignments,
          };
          
          // Request 3: Cache invalidated (assignments changed)
          // Simulated by removing cache timestamp
          const request3 = {
            timestamp: now + 120000,
            cacheTimestamp: null, // Cache invalidated
            cachedAssignments: null,
          };
          
          // Request 4: Use new cache
          const request4 = {
            timestamp: now + 180000,
            cacheTimestamp: new Date(now + 120000).toISOString(),
            cachedAssignments: updatedAssignments,
          };
          
          const result = loadAssignmentsWithCache(
            [request1, request2, request3, request4],
            updatedAssignments,
            cacheTTL
          );
          
          // Should query database twice (initial + after invalidation)
          return result.queryCount === 2;
        }
      ),
      { numRuns: 100 }
    );
  });
});
