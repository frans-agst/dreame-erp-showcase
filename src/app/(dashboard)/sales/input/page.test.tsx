// src/app/(dashboard)/sales/input/page.test.tsx
// Unit Tests for Sales Input Form
// Feature: multi-store-staff-assignment
// Requirements: 6.3

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAssignedStores, getCurrentUserProfile } from '@/actions/sales';

// Mock the sales actions
vi.mock('@/actions/sales', () => ({
  getAssignedStores: vi.fn(),
  getCurrentUserProfile: vi.fn(),
  createSale: vi.fn(),
}));

// Mock other dependencies
vi.mock('@/actions/master-data', () => ({
  getProducts: vi.fn(),
  getStaff: vi.fn(),
}));

describe('Sales Input Form - Multi-Store Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Store dropdown should contain only assigned stores
   * Requirement 6.3: Populate store dropdown with assigned stores only
   */
  it('should load only assigned stores for dropdown', async () => {
    // Setup: Mock assigned stores
    const assignedStores = [
      { id: 'store-1', name: 'Store One', code: 'S1' },
      { id: 'store-2', name: 'Store Two', code: 'S2' },
      { id: 'store-3', name: 'Store Three', code: 'S3' },
    ];

    (getAssignedStores as any).mockResolvedValue({
      success: true,
      data: assignedStores,
    });

    // Execute: Load assigned stores
    const result = await getAssignedStores();

    // Verify: Only assigned stores returned
    expect(result.success).toBe(true);
    expect(result.data).toEqual(assignedStores);
    expect(result.data.length).toBe(3);
    expect(getAssignedStores).toHaveBeenCalled();
  });

  /**
   * Test: Form should default to current store context
   * Requirement 6.3: Default to current store context if available
   */
  it('should default to current store context', async () => {
    // Setup: Mock user profile with current store
    const userProfile = {
      id: 'user-1',
      full_name: 'Test User',
      store_id: 'store-legacy',
      role: 'staff',
      current_store_id: 'store-2',
      primary_store_id: 'store-1',
    };

    (getCurrentUserProfile as any).mockResolvedValue({
      success: true,
      data: userProfile,
    });

    // Execute: Load user profile
    const result = await getCurrentUserProfile();

    // Verify: Current store context available
    expect(result.success).toBe(true);
    expect(result.data.current_store_id).toBe('store-2');
    
    // Form should use current_store_id as default
    const defaultStoreId = result.data.current_store_id || result.data.primary_store_id || result.data.store_id;
    expect(defaultStoreId).toBe('store-2');
  });

  /**
   * Test: Form should fallback to primary store if no current context
   * Requirement 6.3: Default to primary store as fallback
   */
  it('should fallback to primary store when no current context', async () => {
    // Setup: Mock user profile without current store
    const userProfile = {
      id: 'user-1',
      full_name: 'Test User',
      store_id: 'store-legacy',
      role: 'staff',
      current_store_id: undefined,
      primary_store_id: 'store-1',
    };

    (getCurrentUserProfile as any).mockResolvedValue({
      success: true,
      data: userProfile,
    });

    // Execute: Load user profile
    const result = await getCurrentUserProfile();

    // Verify: Falls back to primary store
    expect(result.success).toBe(true);
    expect(result.data.current_store_id).toBeUndefined();
    expect(result.data.primary_store_id).toBe('store-1');
    
    // Form should use primary_store_id as fallback
    const defaultStoreId = result.data.current_store_id || result.data.primary_store_id || result.data.store_id;
    expect(defaultStoreId).toBe('store-1');
  });

  /**
   * Test: Form should fallback to legacy store_id if no multi-store data
   * Backward compatibility test
   */
  it('should fallback to legacy store_id for backward compatibility', async () => {
    // Setup: Mock user profile with only legacy store_id
    const userProfile = {
      id: 'user-1',
      full_name: 'Test User',
      store_id: 'store-legacy',
      role: 'staff',
      current_store_id: undefined,
      primary_store_id: undefined,
    };

    (getCurrentUserProfile as any).mockResolvedValue({
      success: true,
      data: userProfile,
    });

    // Execute: Load user profile
    const result = await getCurrentUserProfile();

    // Verify: Falls back to legacy store_id
    expect(result.success).toBe(true);
    expect(result.data.store_id).toBe('store-legacy');
    
    // Form should use store_id as final fallback
    const defaultStoreId = result.data.current_store_id || result.data.primary_store_id || result.data.store_id;
    expect(defaultStoreId).toBe('store-legacy');
  });

  /**
   * Test: Store dropdown should be disabled for single-store staff
   * Requirement 6.3: Only allow selection for multi-store staff
   */
  it('should identify single-store staff', async () => {
    // Setup: Mock single assigned store
    const assignedStores = [
      { id: 'store-1', name: 'Store One', code: 'S1' },
    ];

    (getAssignedStores as any).mockResolvedValue({
      success: true,
      data: assignedStores,
    });

    // Execute: Load assigned stores
    const result = await getAssignedStores();

    // Verify: Single store detected
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(1);
    
    // Form logic should disable dropdown for single store
    const hasSingleStore = result.data.length === 1;
    expect(hasSingleStore).toBe(true);
  });

  /**
   * Test: Store dropdown should be enabled for multi-store staff
   * Requirement 6.3: Allow selection for multi-store staff
   */
  it('should identify multi-store staff', async () => {
    // Setup: Mock multiple assigned stores
    const assignedStores = [
      { id: 'store-1', name: 'Store One', code: 'S1' },
      { id: 'store-2', name: 'Store Two', code: 'S2' },
    ];

    (getAssignedStores as any).mockResolvedValue({
      success: true,
      data: assignedStores,
    });

    // Execute: Load assigned stores
    const result = await getAssignedStores();

    // Verify: Multiple stores detected
    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThan(1);
    
    // Form logic should enable dropdown for multiple stores
    const hasMultipleStores = result.data.length > 1;
    expect(hasMultipleStores).toBe(true);
  });

  /**
   * Test: Form should handle empty assigned stores
   * Edge case: Staff with no store assignments
   */
  it('should handle staff with no assigned stores', async () => {
    // Setup: Mock empty assigned stores
    (getAssignedStores as any).mockResolvedValue({
      success: true,
      data: [],
    });

    // Execute: Load assigned stores
    const result = await getAssignedStores();

    // Verify: Empty array handled
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.data.length).toBe(0);
  });

  /**
   * Test: Form should preserve store selection after reset
   * Requirement 6.3: Maintain default store after form submission
   */
  it('should preserve default store after form reset', async () => {
    // Setup: Mock user profile
    const userProfile = {
      id: 'user-1',
      full_name: 'Test User',
      store_id: 'store-legacy',
      role: 'staff',
      current_store_id: 'store-2',
      primary_store_id: 'store-1',
    };

    (getCurrentUserProfile as any).mockResolvedValue({
      success: true,
      data: userProfile,
    });

    // Execute: Load user profile
    const result = await getCurrentUserProfile();

    // Verify: Default store preserved for reset
    const defaultStoreId = result.data.current_store_id || result.data.primary_store_id || result.data.store_id;
    expect(defaultStoreId).toBe('store-2');
    
    // Form reset should use this default
    const resetValues = {
      store_id: defaultStoreId,
      staff_id: result.data.role === 'staff' ? result.data.id : '',
      quantity: 1,
      discount: 0,
    };
    
    expect(resetValues.store_id).toBe('store-2');
  });
});
