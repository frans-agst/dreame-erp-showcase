/**
 * Role-Based Access Control Utilities
 * Extracted from middleware for testability
 * Requirements: 1.3, 1.4, 1.5
 */

export type UserRole = 'admin' | 'manager' | 'staff';

// Define route access rules
const adminOnlyRoutes = ['/master-data/staff', '/audit-log'];
const managerAndAdminRoutes = [
  '/master-data',
  '/purchase-orders',
  '/sales',
  '/inventory',
  '/dashboard',
  '/staff/day-off',
];

// Staff-specific allowed routes
const staffAllowedRoutes = [
  '/dashboard',
  '/sales/input',
  '/inventory/opname',
  '/staff/day-off',
  '/training',
];

/**
 * Check if a user with a given role can access a specific route
 * 
 * Property 1: Role-Based Data Access
 * - Staff users can only access their designated routes
 * - Manager users can access all routes except admin-only routes
 * - Admin users can access all routes
 * 
 * @param pathname - The route path to check
 * @param role - The user's role (admin, manager, staff, or null)
 * @returns boolean indicating if access is allowed
 */
export function canAccessRoute(pathname: string, role: UserRole | null): boolean {
  // No role means no access to protected routes
  if (!role) return false;

  // Admin can access everything
  if (role === 'admin') return true;

  // Check admin-only routes
  if (adminOnlyRoutes.some(route => pathname.startsWith(route))) {
    return false;
  }

  // Manager can access manager routes
  if (role === 'manager') return true;

  // Staff can only access specific routes
  return staffAllowedRoutes.some(route => pathname.startsWith(route));
}

/**
 * Get all routes accessible by a given role
 * Useful for testing and UI rendering
 */
export function getAccessibleRoutes(role: UserRole | null): string[] {
  if (!role) return [];
  
  if (role === 'admin') {
    return [...adminOnlyRoutes, ...managerAndAdminRoutes, ...staffAllowedRoutes];
  }
  
  if (role === 'manager') {
    return [...managerAndAdminRoutes, ...staffAllowedRoutes];
  }
  
  // Staff
  return [...staffAllowedRoutes];
}

/**
 * Check if a route is admin-only
 */
export function isAdminOnlyRoute(pathname: string): boolean {
  return adminOnlyRoutes.some(route => pathname.startsWith(route));
}

/**
 * Check if a route is accessible by managers
 */
export function isManagerRoute(pathname: string): boolean {
  return managerAndAdminRoutes.some(route => pathname.startsWith(route)) ||
         staffAllowedRoutes.some(route => pathname.startsWith(route));
}

/**
 * Check if a route is accessible by staff
 */
export function isStaffRoute(pathname: string): boolean {
  return staffAllowedRoutes.some(route => pathname.startsWith(route));
}

// Export route definitions for testing
export const routeDefinitions = {
  adminOnlyRoutes,
  managerAndAdminRoutes,
  staffAllowedRoutes,
};
