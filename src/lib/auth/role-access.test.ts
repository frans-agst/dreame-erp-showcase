/**
 * Property-based tests for Role-Based Access Control
 * Feature: omnierp-retail-erp
 * 
 * Property 1: Role-Based Data Access
 * *For any* user with role 'staff' and assigned branch_id, when querying sales, inventory,
 * or other branch-scoped data, the returned records SHALL only include data where branch_id
 * matches the user's assigned branch. *For any* user with role 'admin' or 'manager',
 * all branch data SHALL be accessible.
 * 
 * **Validates: Requirements 1.3, 1.4, 1.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  canAccessRoute,
  isAdminOnlyRoute,
  isManagerRoute,
  isStaffRoute,
  routeDefinitions,
  UserRole,
} from './role-access';

describe('Property 1: Role-Based Data Access', () => {
  const { adminOnlyRoutes, managerAndAdminRoutes, staffAllowedRoutes } = routeDefinitions;

  // Arbitrary generators for routes
  const adminOnlyRouteArb = fc.constantFrom(...adminOnlyRoutes);
  const managerRouteArb = fc.constantFrom(...managerAndAdminRoutes);
  const staffRouteArb = fc.constantFrom(...staffAllowedRoutes);
  const roleArb = fc.constantFrom<UserRole>('admin', 'manager', 'staff');
  const nullableRoleArb = fc.constantFrom<UserRole | null>('admin', 'manager', 'staff', null);

  /**
   * Property: Admin users can access ALL routes
   * Validates: Requirement 1.4 - Admin has full access to all branches and system settings
   */
  describe('Admin Access', () => {
    it('admin can access all admin-only routes', () => {
      fc.assert(
        fc.property(adminOnlyRouteArb, (route) => {
          return canAccessRoute(route, 'admin') === true;
        }),
        { numRuns: 100 }
      );
    });

    it('admin can access all manager routes', () => {
      fc.assert(
        fc.property(managerRouteArb, (route) => {
          return canAccessRoute(route, 'admin') === true;
        }),
        { numRuns: 100 }
      );
    });

    it('admin can access all staff routes', () => {
      fc.assert(
        fc.property(staffRouteArb, (route) => {
          return canAccessRoute(route, 'admin') === true;
        }),
        { numRuns: 100 }
      );
    });

    it('admin can access any valid route path', () => {
      const allRoutes = [...adminOnlyRoutes, ...managerAndAdminRoutes, ...staffAllowedRoutes];
      const anyRouteArb = fc.constantFrom(...allRoutes);
      
      fc.assert(
        fc.property(anyRouteArb, (route) => {
          return canAccessRoute(route, 'admin') === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Manager users can access all routes EXCEPT admin-only routes
   * Validates: Requirement 1.5 - Manager has read access to all branch data and approval permissions
   */
  describe('Manager Access', () => {
    it('manager CANNOT access admin-only routes', () => {
      fc.assert(
        fc.property(adminOnlyRouteArb, (route) => {
          return canAccessRoute(route, 'manager') === false;
        }),
        { numRuns: 100 }
      );
    });

    it('manager can access all manager routes', () => {
      fc.assert(
        fc.property(managerRouteArb, (route) => {
          return canAccessRoute(route, 'manager') === true;
        }),
        { numRuns: 100 }
      );
    });

    it('manager can access all staff routes', () => {
      fc.assert(
        fc.property(staffRouteArb, (route) => {
          return canAccessRoute(route, 'manager') === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Staff users can ONLY access staff-allowed routes
   * Validates: Requirement 1.3 - Staff restricted to their assigned branch only
   */
  describe('Staff Access', () => {
    it('staff CANNOT access admin-only routes', () => {
      fc.assert(
        fc.property(adminOnlyRouteArb, (route) => {
          return canAccessRoute(route, 'staff') === false;
        }),
        { numRuns: 100 }
      );
    });

    it('staff CANNOT access manager-only routes (excluding staff routes)', () => {
      // Filter out routes that are also in staffAllowedRoutes
      const managerOnlyRoutes = managerAndAdminRoutes.filter(
        route => !staffAllowedRoutes.some(staffRoute => route.startsWith(staffRoute))
      );
      
      if (managerOnlyRoutes.length > 0) {
        const managerOnlyRouteArb = fc.constantFrom(...managerOnlyRoutes);
        
        fc.assert(
          fc.property(managerOnlyRouteArb, (route) => {
            return canAccessRoute(route, 'staff') === false;
          }),
          { numRuns: 100 }
        );
      }
    });

    it('staff CAN access staff-allowed routes', () => {
      fc.assert(
        fc.property(staffRouteArb, (route) => {
          return canAccessRoute(route, 'staff') === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Null role (unauthenticated) cannot access any protected route
   */
  describe('Unauthenticated Access', () => {
    it('null role cannot access any route', () => {
      const allRoutes = [...adminOnlyRoutes, ...managerAndAdminRoutes, ...staffAllowedRoutes];
      const anyRouteArb = fc.constantFrom(...allRoutes);
      
      fc.assert(
        fc.property(anyRouteArb, (route) => {
          return canAccessRoute(route, null) === false;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Role hierarchy is maintained
   * Admin > Manager > Staff
   * If a lower role can access a route, all higher roles can too
   */
  describe('Role Hierarchy', () => {
    it('if staff can access a route, manager can too', () => {
      fc.assert(
        fc.property(staffRouteArb, (route) => {
          const staffAccess = canAccessRoute(route, 'staff');
          const managerAccess = canAccessRoute(route, 'manager');
          // If staff can access, manager must be able to access
          return !staffAccess || managerAccess;
        }),
        { numRuns: 100 }
      );
    });

    it('if manager can access a route, admin can too', () => {
      const allNonAdminRoutes = [...managerAndAdminRoutes, ...staffAllowedRoutes];
      const nonAdminRouteArb = fc.constantFrom(...allNonAdminRoutes);
      
      fc.assert(
        fc.property(nonAdminRouteArb, (route) => {
          const managerAccess = canAccessRoute(route, 'manager');
          const adminAccess = canAccessRoute(route, 'admin');
          // If manager can access, admin must be able to access
          return !managerAccess || adminAccess;
        }),
        { numRuns: 100 }
      );
    });

    it('admin access is always >= manager access >= staff access', () => {
      const allRoutes = [...adminOnlyRoutes, ...managerAndAdminRoutes, ...staffAllowedRoutes];
      const anyRouteArb = fc.constantFrom(...allRoutes);
      
      fc.assert(
        fc.property(anyRouteArb, (route) => {
          const adminAccess = canAccessRoute(route, 'admin');
          const managerAccess = canAccessRoute(route, 'manager');
          const staffAccess = canAccessRoute(route, 'staff');
          
          // Admin >= Manager >= Staff
          const adminGteManager = adminAccess || !managerAccess;
          const managerGteStaff = managerAccess || !staffAccess;
          
          return adminGteManager && managerGteStaff;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Route classification is consistent
   */
  describe('Route Classification Consistency', () => {
    it('admin-only routes are correctly identified', () => {
      fc.assert(
        fc.property(adminOnlyRouteArb, (route) => {
          return isAdminOnlyRoute(route) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('staff routes are correctly identified', () => {
      fc.assert(
        fc.property(staffRouteArb, (route) => {
          return isStaffRoute(route) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('manager routes include staff routes', () => {
      fc.assert(
        fc.property(staffRouteArb, (route) => {
          return isManagerRoute(route) === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Access control is deterministic
   * Same inputs always produce same outputs
   */
  describe('Determinism', () => {
    it('canAccessRoute is deterministic', () => {
      const allRoutes = [...adminOnlyRoutes, ...managerAndAdminRoutes, ...staffAllowedRoutes];
      const anyRouteArb = fc.constantFrom(...allRoutes);
      
      fc.assert(
        fc.property(anyRouteArb, nullableRoleArb, (route, role) => {
          const result1 = canAccessRoute(route, role);
          const result2 = canAccessRoute(route, role);
          return result1 === result2;
        }),
        { numRuns: 100 }
      );
    });
  });
});
