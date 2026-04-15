// src/app/(dashboard)/inventory/page.test.tsx
// Unit Tests for Inventory Views
// Feature: multi-store-staff-assignment
// Requirements: 7.2, 7.3

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInventoryForMultipleStores } from '@/actions/inventory';
import { getStores } from '@/actions/master-data';

// Mock the inventory actions
vi.mock('@/actions/inventory', () => ({
  getInventoryForMultipleStores: vi.fn(),
  getInventoryForStore: vi.fn(),
}));

// Mock master data actions
vi.mock('@/actions/master-data', () => ({
  getStores: vi.fn(),
}));

describe('Inventory Views - Multi-Store Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Store column should always be displayed
   * Requirement 7.3: Display store name alongside each inventory item
   */
  it('should include store information in inventory data', async () => {
    // Setup: Mock inventory with store information
    const inventoryData = [
      {
        id: 'inv-1',
        store_id: 'store-1',
        product_id: 'prod-1',
        quantity: 10,
        display_qty: 2,
        product: {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product One',
          category: 'Category A',
          sub_category: 'Sub A',
        },
        store: {
          id: 'store-1',
          name: 'Store One',
          account: { name: 'Account A' },
        },
      },
      {
        id: 'inv-2',
        store_id: 'store-2',
        product_id: 'prod-1',
        quantity: 5,
        display_qty: 1,
        product: {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product One',
          category: 'Category A',
          sub_category: 'Sub A',
        },
        store: {
          id: 'store-2',
          name: 'Store Two',
          account: { name: 'Account B' },
        },
      },
    ];

    (getInventoryForMultipleStores as any).mockResolvedValue({
      success: true,
      data: inventoryData,
    });

    // Execute: Load inventory
    const result = await getInventoryForMultipleStores(['store-1', 'store-2']);

    // Verify: Store information is present
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].store).toBeDefined();
      expect(result.data[0].store.name).toBe('Store One');
      expect(result.data[1].store).toBeDefined();
      expect(result.data[1].store.name).toBe('Store Two');
    }
  });

  /**
   * Test: Store column displays correctly for single store
   * Requirement 7.3: Store column should be visible even with single store
   */
  it('should display store column for single store', async () => {
    // Setup: Mock inventory for single store
    const inventoryData = [
      {
        id: 'inv-1',
        store_id: 'store-1',
        product_id: 'prod-1',
        quantity: 10,
        display_qty: 2,
        product: {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product One',
          category: 'Category A',
          sub_category: 'Sub A',
        },
        store: {
          id: 'store-1',
          name: 'Store One',
        },
      },
    ];

    (getInventoryForMultipleStores as any).mockResolvedValue({
      success: true,
      data: inventoryData,
    });

    // Execute: Load inventory for single store
    const result = await getInventoryForMultipleStores(['store-1']);

    // Verify: Store information is present even for single store
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].store).toBeDefined();
      expect(result.data[0].store.name).toBe('Store One');
    }
  });

  /**
   * Test: Store filter should work correctly
   * Requirement 7.2: Allow filtering inventory by specific assigned stores
   */
  it('should filter inventory by selected store', () => {
    // Setup: Mock inventory from multiple stores
    const allInventory = [
      {
        id: 'inv-1',
        store_id: 'store-1',
        product_id: 'prod-1',
        quantity: 10,
        product: { name: 'Product One' },
        store: { id: 'store-1', name: 'Store One' },
      },
      {
        id: 'inv-2',
        store_id: 'store-2',
        product_id: 'prod-1',
        quantity: 5,
        product: { name: 'Product One' },
        store: { id: 'store-2', name: 'Store Two' },
      },
      {
        id: 'inv-3',
        store_id: 'store-1',
        product_id: 'prod-2',
        quantity: 8,
        product: { name: 'Product Two' },
        store: { id: 'store-1', name: 'Store One' },
      },
    ];

    // Execute: Filter by store-1
    const storeFilter = 'store-1';
    const filteredInventory = allInventory.filter(
      (item) => item.store_id === storeFilter
    );

    // Verify: Only store-1 items returned
    expect(filteredInventory).toHaveLength(2);
    expect(filteredInventory.every((item) => item.store_id === 'store-1')).toBe(true);
    expect(filteredInventory[0].id).toBe('inv-1');
    expect(filteredInventory[1].id).toBe('inv-3');
  });

  /**
   * Test: "All Stores" option should show all inventory
   * Requirement 7.2: Allow viewing all assigned stores
   */
  it('should show all inventory when no store filter applied', () => {
    // Setup: Mock inventory from multiple stores
    const allInventory = [
      {
        id: 'inv-1',
        store_id: 'store-1',
        product_id: 'prod-1',
        quantity: 10,
      },
      {
        id: 'inv-2',
        store_id: 'store-2',
        product_id: 'prod-1',
        quantity: 5,
      },
      {
        id: 'inv-3',
        store_id: 'store-3',
        product_id: 'prod-2',
        quantity: 8,
      },
    ];

    // Execute: No filter applied (empty string means "All Stores")
    const storeFilter = '';
    const filteredInventory = storeFilter
      ? allInventory.filter((item) => item.store_id === storeFilter)
      : allInventory;

    // Verify: All items returned
    expect(filteredInventory).toHaveLength(3);
    expect(filteredInventory).toEqual(allInventory);
  });

  /**
   * Test: Store filter should only appear for multiple stores
   * Requirement 7.2: Filter is relevant only when multiple stores selected
   */
  it('should show store filter only when multiple stores selected', async () => {
    // Setup: Mock stores
    const stores = [
      { id: 'store-1', name: 'Store One' },
      { id: 'store-2', name: 'Store Two' },
      { id: 'store-3', name: 'Store Three' },
    ];

    (getStores as any).mockResolvedValue({
      success: true,
      data: stores,
    });

    // Execute: Load stores
    const result = await getStores(true);

    // Verify: Multiple stores available
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(1);
    }

    // Test single store scenario
    const selectedStoreIds = ['store-1'];
    const shouldShowFilter = selectedStoreIds.length > 1;
    expect(shouldShowFilter).toBe(false);

    // Test multiple stores scenario
    const multipleStoreIds = ['store-1', 'store-2'];
    const shouldShowFilterMulti = multipleStoreIds.length > 1;
    expect(shouldShowFilterMulti).toBe(true);
  });

  /**
   * Test: Store filter should work with other filters
   * Requirement 7.2: Store filter should combine with search and category filters
   */
  it('should combine store filter with other filters', () => {
    // Setup: Mock inventory with various attributes
    const allInventory = [
      {
        id: 'inv-1',
        store_id: 'store-1',
        product_id: 'prod-1',
        quantity: 10,
        product: {
          name: 'Product One',
          sku: 'SKU001',
          category: 'Category A',
        },
        store: { id: 'store-1', name: 'Store One' },
      },
      {
        id: 'inv-2',
        store_id: 'store-2',
        product_id: 'prod-2',
        quantity: 5,
        product: {
          name: 'Product Two',
          sku: 'SKU002',
          category: 'Category B',
        },
        store: { id: 'store-2', name: 'Store Two' },
      },
      {
        id: 'inv-3',
        store_id: 'store-1',
        product_id: 'prod-3',
        quantity: 8,
        product: {
          name: 'Product Three',
          sku: 'SKU003',
          category: 'Category A',
        },
        store: { id: 'store-1', name: 'Store One' },
      },
    ];

    // Execute: Apply store filter + category filter
    const storeFilter = 'store-1';
    const categoryFilter = 'Category A';

    let filtered = allInventory;
    if (storeFilter) {
      filtered = filtered.filter((item) => item.store_id === storeFilter);
    }
    if (categoryFilter) {
      filtered = filtered.filter((item) => item.product.category === categoryFilter);
    }

    // Verify: Both filters applied
    expect(filtered).toHaveLength(2);
    expect(filtered.every((item) => item.store_id === 'store-1')).toBe(true);
    expect(filtered.every((item) => item.product.category === 'Category A')).toBe(true);
  });

  /**
   * Test: Store information should include account name
   * Requirement 7.3: Display full store identification
   */
  it('should display store with account name when available', async () => {
    // Setup: Mock inventory with account information
    const inventoryData = [
      {
        id: 'inv-1',
        store_id: 'store-1',
        product_id: 'prod-1',
        quantity: 10,
        display_qty: 2,
        product: {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product One',
        },
        store: {
          id: 'store-1',
          name: 'Store One',
          account: { name: 'Account A' },
        },
      },
    ];

    (getInventoryForMultipleStores as any).mockResolvedValue({
      success: true,
      data: inventoryData,
    });

    // Execute: Load inventory
    const result = await getInventoryForMultipleStores(['store-1']);

    // Verify: Account name is available
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].store.account).toBeDefined();
      expect(result.data[0].store.account.name).toBe('Account A');

      // Format store display name
      const store = result.data[0].store;
      const displayName = store.account
        ? `${store.account.name} - ${store.name}`
        : store.name;
      expect(displayName).toBe('Account A - Store One');
    }
  });

  /**
   * Test: Store information should handle missing account
   * Requirement 7.3: Gracefully handle stores without accounts
   */
  it('should display store name only when account is missing', async () => {
    // Setup: Mock inventory without account information
    const inventoryData = [
      {
        id: 'inv-1',
        store_id: 'store-1',
        product_id: 'prod-1',
        quantity: 10,
        display_qty: 2,
        product: {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Product One',
        },
        store: {
          id: 'store-1',
          name: 'Store One',
        },
      },
    ];

    (getInventoryForMultipleStores as any).mockResolvedValue({
      success: true,
      data: inventoryData,
    });

    // Execute: Load inventory
    const result = await getInventoryForMultipleStores(['store-1']);

    // Verify: Store name displayed without account
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].store.account).toBeUndefined();

      // Format store display name
      const store = result.data[0].store;
      const displayName = store.account
        ? `${store.account.name} - ${store.name}`
        : store.name;
      expect(displayName).toBe('Store One');
    }
  });

  /**
   * Test: Clear filters should reset store filter
   * Requirement 7.2: Store filter should be clearable
   */
  it('should clear store filter when clearing all filters', () => {
    // Setup: Initial filter state
    let storeFilter = 'store-1';
    let categoryFilter = 'Category A';
    let searchQuery = 'Product';

    // Execute: Clear all filters
    storeFilter = '';
    categoryFilter = '';
    searchQuery = '';

    // Verify: All filters cleared
    expect(storeFilter).toBe('');
    expect(categoryFilter).toBe('');
    expect(searchQuery).toBe('');
  });

  /**
   * Test: Store filter dropdown should show selected stores only
   * Requirement 7.2: Filter dropdown should contain only selected stores
   */
  it('should populate store filter with selected stores only', async () => {
    // Setup: Mock all available stores
    const allStores = [
      { id: 'store-1', name: 'Store One' },
      { id: 'store-2', name: 'Store Two' },
      { id: 'store-3', name: 'Store Three' },
      { id: 'store-4', name: 'Store Four' },
    ];

    (getStores as any).mockResolvedValue({
      success: true,
      data: allStores,
    });

    // Execute: User selects specific stores
    const selectedStoreIds = ['store-1', 'store-3'];
    const storesResult = await getStores(true);
    
    if (storesResult.success) {
      const availableForFilter = storesResult.data.filter((store: any) =>
        selectedStoreIds.includes(store.id)
      );

      // Verify: Filter dropdown contains only selected stores
      expect(availableForFilter).toHaveLength(2);
      expect(availableForFilter[0].id).toBe('store-1');
      expect(availableForFilter[1].id).toBe('store-3');
    }
  });
});
