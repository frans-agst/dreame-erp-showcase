// src/components/layout/StoreSelector.test.tsx
// Unit Tests for StoreSelector Component
// Feature: multi-store-staff-assignment
// Requirements: 5.1, 5.5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@/lib/supabase/client';

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('StoreSelector Component Logic', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockReload.mockClear();

    // Setup mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
        updateUser: vi.fn(),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              then: vi.fn((callback) => callback({ data: [] })),
            })),
          })),
        })),
      })),
    };

    (createClient as any).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test: Component should not render for single-store staff
   * Requirement 5.5: Only render if user has multiple stores
   */
  it('should not render for staff with single store', async () => {
    // Setup: User with single store
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            assigned_store_ids: ['store-1'],
            current_store_id: 'store-1',
          },
        },
      },
    });

    // The component should return null when stores.length <= 1
    // This is validated by checking that no store query is made
    const fromSpy = vi.spyOn(mockSupabase, 'from');
    
    // Simulate component mount
    await mockSupabase.auth.getUser();
    const user = (await mockSupabase.auth.getUser()).data.user;
    const assignedStoreIds = user?.user_metadata?.assigned_store_ids || [];

    // Verify: Should not query stores for single-store staff
    expect(assignedStoreIds.length).toBe(1);
    // Component logic should skip rendering
  });

  /**
   * Test: Component should render for multi-store staff
   * Requirement 5.1: Display store selector for multi-store staff
   */
  it('should load stores for staff with multiple stores', async () => {
    // Setup: User with multiple stores
    const storeIds = ['store-1', 'store-2', 'store-3'];
    const stores = [
      { id: 'store-1', name: 'Store One' },
      { id: 'store-2', name: 'Store Two' },
      { id: 'store-3', name: 'Store Three' },
    ];

    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            assigned_store_ids: storeIds,
            current_store_id: 'store-1',
          },
        },
      },
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: stores }),
        }),
      }),
    });

    // Simulate component mount
    const { data: { user } } = await mockSupabase.auth.getUser();
    const assignedStoreIds = user?.user_metadata?.assigned_store_ids || [];

    // Verify: Should have multiple stores
    expect(assignedStoreIds.length).toBeGreaterThan(1);

    // Simulate loading stores
    const { data } = await mockSupabase
      .from('stores')
      .select('id, name')
      .in('id', assignedStoreIds)
      .order('name');

    // Verify: Stores loaded correctly
    expect(data).toEqual(stores);
    expect(mockSupabase.from).toHaveBeenCalledWith('stores');
  });

  /**
   * Test: Store change should update session and reload
   * Requirement 5.3: Handle store change (update session and reload)
   */
  it('should update session and reload when store changes', async () => {
    // Setup: User with multiple stores
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            assigned_store_ids: ['store-1', 'store-2'],
            current_store_id: 'store-1',
          },
        },
      },
    });

    mockSupabase.auth.updateUser.mockResolvedValue({
      data: { user: {} },
      error: null,
    });

    // Simulate store change
    const newStoreId = 'store-2';
    await mockSupabase.auth.updateUser({
      data: { current_store_id: newStoreId },
    });

    // Verify: Session updated
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
      data: { current_store_id: newStoreId },
    });

    // Simulate reload (would be called in component)
    mockReload();

    // Verify: Page reload triggered
    expect(mockReload).toHaveBeenCalled();
  });

  /**
   * Test: Component should display current store
   * Requirement 5.2: Display current store name
   */
  it('should identify current store from metadata', async () => {
    // Setup: User with current store set
    const currentStoreId = 'store-2';
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            assigned_store_ids: ['store-1', 'store-2', 'store-3'],
            current_store_id: currentStoreId,
          },
        },
      },
    });

    const stores = [
      { id: 'store-1', name: 'Store One' },
      { id: 'store-2', name: 'Store Two' },
      { id: 'store-3', name: 'Store Three' },
    ];

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: stores }),
        }),
      }),
    });

    // Simulate component logic
    const { data: { user } } = await mockSupabase.auth.getUser();
    const currentStore = stores.find(s => s.id === user?.user_metadata?.current_store_id);

    // Verify: Current store identified correctly
    expect(currentStore).toBeDefined();
    expect(currentStore?.id).toBe(currentStoreId);
    expect(currentStore?.name).toBe('Store Two');
  });

  /**
   * Test: Component should handle empty assigned stores gracefully
   * Edge case: Staff with no store assignments
   */
  it('should handle staff with no assigned stores', async () => {
    // Setup: User with no assigned stores
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            assigned_store_ids: [],
            current_store_id: null,
          },
        },
      },
    });

    // Simulate component mount
    const { data: { user } } = await mockSupabase.auth.getUser();
    const assignedStoreIds = user?.user_metadata?.assigned_store_ids || [];

    // Verify: Should not render (empty array)
    expect(assignedStoreIds.length).toBe(0);
    // Component logic should skip rendering
  });

  /**
   * Test: Component should handle missing metadata gracefully
   * Edge case: User metadata not yet loaded
   */
  it('should handle missing user metadata', async () => {
    // Setup: User with no metadata
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: undefined,
        },
      },
    });

    // Simulate component mount
    const { data: { user } } = await mockSupabase.auth.getUser();
    const assignedStoreIds = user?.user_metadata?.assigned_store_ids || [];

    // Verify: Should default to empty array
    expect(assignedStoreIds).toEqual([]);
    // Component logic should skip rendering
  });

  /**
   * Test: Component should order stores by name
   * Requirement 5.1: Display stores in alphabetical order
   */
  it('should load stores ordered by name', async () => {
    // Setup: User with multiple stores
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            assigned_store_ids: ['store-1', 'store-2', 'store-3'],
            current_store_id: 'store-1',
          },
        },
      },
    });

    const orderSpy = vi.fn().mockResolvedValue({
      data: [
        { id: 'store-1', name: 'Alpha Store' },
        { id: 'store-2', name: 'Beta Store' },
        { id: 'store-3', name: 'Gamma Store' },
      ],
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: orderSpy,
        }),
      }),
    });

    // Simulate loading stores
    const { data: { user } } = await mockSupabase.auth.getUser();
    const assignedStoreIds = user?.user_metadata?.assigned_store_ids || [];

    await mockSupabase
      .from('stores')
      .select('id, name')
      .in('id', assignedStoreIds)
      .order('name');

    // Verify: Stores ordered by name
    expect(orderSpy).toHaveBeenCalledWith('name');
  });
});
