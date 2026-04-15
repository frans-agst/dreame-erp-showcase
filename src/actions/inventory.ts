'use server';

import { createClient } from '@/lib/supabase/server';
import { InventoryItem, Product, Store } from '@/types';

// ============================================================================
// Types
// ============================================================================

// Types (not exported - 'use server' files can only export async functions)
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Inventory matrix row representing a store with stock quantities per product
 */
export interface InventoryMatrixRow {
  store_id: string;
  store_name: string;
  account_name: string;
  quantities: Record<string, number>; // product_id -> quantity
}

/**
 * Product column info for the matrix
 */
export interface ProductColumn {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  totalStock: number;
}

/**
 * Complete inventory matrix data structure
 */
export interface InventoryMatrix {
  rows: InventoryMatrixRow[];
  columns: ProductColumn[];
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// ============================================================================
// Inventory Actions
// ============================================================================

/**
 * Get inventory matrix with stores as rows and products as columns
 * Requirements: 6.1, 7.1, 7.2
 * - Fetches all inventory with store and product joins
 * - Transforms to matrix format (stores as rows, products as columns)
 * - Filters out products with zero total stock across all stores
 * - Supports optional store filtering for multi-store staff
 */
export async function getInventoryMatrix(storeFilter?: string[]): Promise<ActionResult<InventoryMatrix>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view inventory',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    // Build store query with optional filter
    let storeQuery = supabase
      .from('stores')
      .select(`
        id, 
        name,
        account:accounts(name)
      `)
      .eq('is_active', true)
      .order('name');

    // Apply store filter if provided (for multi-store staff filtering)
    if (storeFilter && storeFilter.length > 0) {
      storeQuery = storeQuery.in('id', storeFilter);
    }

    // Try to fetch stores with account info (new schema)
    const { data: stores, error: storeError } = await storeQuery;

    // Fetch all active products
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, sku, name, category, sub_category')
      .eq('is_active', true)
      .order('name');

    if (productError) {
      console.error('Error fetching products:', productError);
      return {
        success: false,
        error: 'Failed to fetch products',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // If stores table exists and has data, use new schema
    if (!storeError && stores && stores.length > 0) {
      // Build inventory query with optional filter
      let inventoryQuery = supabase
        .from('inventory')
        .select('store_id, product_id, quantity');

      // Apply store filter if provided
      if (storeFilter && storeFilter.length > 0) {
        inventoryQuery = inventoryQuery.in('store_id', storeFilter);
      }

      // Fetch all inventory records using store_id
      const { data: inventory, error: inventoryError } = await inventoryQuery;

      if (inventoryError) {
        console.error('Error fetching inventory:', inventoryError);
        return {
          success: false,
          error: 'Failed to fetch inventory',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }

      // Build inventory lookup map: store_id -> product_id -> quantity
      const inventoryMap: Record<string, Record<string, number>> = {};
      (inventory || []).forEach((item) => {
        const storeId = item.store_id;
        if (storeId) {
          if (!inventoryMap[storeId]) {
            inventoryMap[storeId] = {};
          }
          inventoryMap[storeId][item.product_id] = item.quantity;
        }
      });

      // Calculate total stock per product across all stores
      const productTotalStock: Record<string, number> = {};
      (products || []).forEach((product) => {
        productTotalStock[product.id] = 0;
      });
      (inventory || []).forEach((item) => {
        if (productTotalStock[item.product_id] !== undefined) {
          productTotalStock[item.product_id] += item.quantity;
        }
      });

      // Filter out products with zero total stock (Requirement 6.1)
      const activeProducts = (products || []).filter(
        (product) => productTotalStock[product.id] > 0
      );

      // Build product columns
      const columns: ProductColumn[] = activeProducts.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category || null,
        sub_category: product.sub_category || null,
        totalStock: productTotalStock[product.id],
      }));

      // Build matrix rows
      const rows: InventoryMatrixRow[] = stores.map((store) => {
        const quantities: Record<string, number> = {};
        activeProducts.forEach((product) => {
          quantities[product.id] = inventoryMap[store.id]?.[product.id] ?? 0;
        });
        
        const account = store.account as unknown as { name: string } | null;
        
        return {
          store_id: store.id,
          store_name: store.name,
          account_name: account?.name || '',
          quantities,
        };
      });

      return {
        success: true,
        data: { rows, columns },
      };
    }

    // No stores found
    return {
      success: true,
      data: { rows: [], columns: [] },
    };
  } catch (error) {
    console.error('Unexpected error in getInventoryMatrix:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get raw inventory items for multiple stores
 * Used for multi-store inventory viewing
 */
export async function getInventoryForMultipleStores(
  storeIds: string[]
): Promise<ActionResult<any[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view inventory',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    if (storeIds.length === 0) {
      return { success: true, data: [] };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('inventory')
      .select(`
        id,
        store_id,
        product_id,
        quantity,
        display_qty,
        product:products(id, sku, name, price_retail, price_buy, category, sub_category, is_active),
        store:stores(id, name, account:accounts(name))
      `)
      .in('store_id', storeIds);

    if (error) {
      console.error('Error fetching inventory for multiple stores:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Transform the data to match InventoryItem interface with store information
    const items: any[] = (data || []).map((item) => ({
      id: item.id,
      store_id: item.store_id,
      product_id: item.product_id,
      quantity: item.quantity,
      display_qty: item.display_qty || 0,
      product: item.product as unknown as Product,
      store: item.store as unknown as { id: string; name: string; account?: { name: string } },
      updated_at: new Date().toISOString(),
    }));

    return { success: true, data: items };
  } catch (error) {
    console.error('Unexpected error in getInventoryForMultipleStores:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get raw inventory items for a specific store
 * Used for stock opname and other store-specific operations
 */
export async function getInventoryForStore(
  storeId: string
): Promise<ActionResult<InventoryItem[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view inventory',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('inventory')
      .select(`
        id,
        store_id,
        product_id,
        quantity,
        display_qty,
        product:products(id, sku, name, price_retail, price_buy, category, sub_category, is_active)
      `)
      .eq('store_id', storeId);

    if (error) {
      console.error('Error fetching inventory for store:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Transform the data to match InventoryItem interface
    const items: InventoryItem[] = (data || []).map((item) => ({
      id: item.id,
      store_id: item.store_id,
      product_id: item.product_id,
      quantity: item.quantity,
      display_qty: item.display_qty || 0,
      product: item.product as unknown as Product,
      updated_at: new Date().toISOString(),
    }));

    return { success: true, data: items };
  } catch (error) {
    console.error('Unexpected error in getInventoryForStore:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// Legacy alias for backward compatibility
export const getInventoryForBranch = getInventoryForStore;
