'use server';

import { createClient } from '@/lib/supabase/server';
import { StockOpnameSubmissionSchema, StockOpnameItemInput } from '@/lib/validations/stock-opname';
import { StockOpname, Product } from '@/types';

export interface DisplayQuantityUpdate {
  product_id: string;
  display_qty: number;
}

// ============================================================================
// Types
// ============================================================================

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

export interface StockOpnameHistoryItemDetail {
  product_name: string;
  product_sku: string;
  previous_qty: number;
  counted_qty: number;
  discrepancy: number;
}

export interface StockOpnameHistoryItem {
  id: string;
  store_id: string;
  staff_id: string;
  submitted_at: string;
  staff?: { full_name: string };
  items_count: number;
  items?: StockOpnameHistoryItemDetail[];
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

async function getUserStoreId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  // For multi-store support: use current_store_id from user_metadata (set by store selector)
  // This respects the user's selected store context
  const currentStoreId = user.user_metadata?.current_store_id;
  if (currentStoreId) return currentStoreId;
  
  // Fallback to primary_store_id if no current context is set
  const primaryStoreId = user.user_metadata?.primary_store_id;
  if (primaryStoreId) return primaryStoreId;
  
  // Legacy fallback: Check app_metadata
  const metadataStoreId = user.app_metadata?.store_id;
  if (metadataStoreId) return metadataStoreId;
  
  // Final fallback: Check profile table directly
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id')
    .eq('id', user.id)
    .single();
  
  return profile?.store_id || null;
}


// ============================================================================
// Stock Opname Actions
// ============================================================================

/**
 * Submit stock opname with inventory overwrite
 * Requirements: 7.3, 7.4, 7.5
 */
export async function submitStockOpname(
  storeId: string,
  items: StockOpnameItemInput[]
): Promise<ActionResult<StockOpname>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to submit stock opname',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Validate store access for multi-store support (Requirement 7.4)
    const assignedStoreIds = user.user_metadata?.assigned_store_ids || [];
    const userRole = user.app_metadata?.role;
    
    // Staff must have access to the store
    if (userRole === 'staff' && !assignedStoreIds.includes(storeId)) {
      return {
        success: false,
        error: 'You do not have access to this store',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    // Validate input
    const validation = StockOpnameSubmissionSchema.safeParse({
      store_id: storeId,
      items,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const supabase = await createClient();

    // Get current inventory for the store
    const { data: currentInventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('product_id, quantity')
      .eq('store_id', storeId);

    if (inventoryError) {
      console.error('Error fetching current inventory:', inventoryError);
      return {
        success: false,
        error: 'Failed to fetch current inventory',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Build inventory lookup map
    const inventoryMap: Record<string, number> = {};
    (currentInventory || []).forEach((item) => {
      inventoryMap[item.product_id] = item.quantity;
    });

    // Create stock opname record
    const { data: opname, error: opnameError } = await supabase
      .from('stock_opname')
      .insert({
        store_id: storeId,
        staff_id: user.id,
      })
      .select()
      .single();

    if (opnameError || !opname) {
      console.error('Error creating stock opname:', opnameError);
      return {
        success: false,
        error: 'Failed to create stock opname record',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Create stock opname items with previous quantities
    const opnameItems = items.map((item) => ({
      opname_id: opname.id,
      product_id: item.product_id,
      previous_qty: inventoryMap[item.product_id] ?? 0,
      counted_qty: item.counted_qty,
    }));

    const { error: itemsError } = await supabase
      .from('stock_opname_items')
      .insert(opnameItems);

    if (itemsError) {
      console.error('Error creating stock opname items:', itemsError);
      await supabase.from('stock_opname').delete().eq('id', opname.id);
      return {
        success: false,
        error: 'Failed to create stock opname items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Update inventory with counted values (Requirement 7.4)
    for (const item of items) {
      const { error: updateError } = await supabase
        .from('inventory')
        .upsert({
          store_id: storeId,
          product_id: item.product_id,
          quantity: item.counted_qty,
        }, {
          onConflict: 'store_id,product_id',
          ignoreDuplicates: false,
        });

      if (updateError) {
        console.error('Error updating inventory:', updateError);
      }
    }

    // Fetch the complete opname with items
    const { data: completeOpname, error: fetchError } = await supabase
      .from('stock_opname')
      .select(`
        id,
        store_id,
        staff_id,
        submitted_at,
        stock_opname_items (
          id,
          product_id,
          previous_qty,
          counted_qty,
          discrepancy,
          product:products (id, sku, name, category, is_active)
        )
      `)
      .eq('id', opname.id)
      .single();

    if (fetchError || !completeOpname) {
      return {
        success: true,
        data: {
          id: opname.id,
          store_id: storeId,
          staff_id: opname.staff_id,
          submitted_at: opname.submitted_at,
          items: [],
        },
      };
    }

    const result: StockOpname = {
      id: completeOpname.id,
      store_id: completeOpname.store_id,
      staff_id: completeOpname.staff_id,
      submitted_at: completeOpname.submitted_at,
      items: (completeOpname.stock_opname_items || []).map((item) => ({
        id: item.id,
        opname_id: completeOpname.id,
        product_id: item.product_id,
        previous_qty: item.previous_qty,
        counted_qty: item.counted_qty,
        discrepancy: item.discrepancy,
        product: item.product ? (Array.isArray(item.product) ? item.product[0] : item.product) as unknown as Product : undefined,
      })),
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in submitStockOpname:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


/**
 * Get stock opname history for a store
 * Requirements: 7.5
 * OPTIMIZED: Server-side pagination, lazy load items
 */
export async function getStockOpnameHistory(
  storeId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<ActionResult<{ data: StockOpnameHistoryItem[]; total: number; hasMore: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view stock opname history',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();
    const offset = (page - 1) * pageSize;

    // First get count
    const { count } = await supabase
      .from('stock_opname')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId);

    // Fetch paginated history WITHOUT items (lazy load)
    const { data, error } = await supabase
      .from('stock_opname')
      .select(`
        id,
        store_id,
        staff_id,
        submitted_at,
        staff:profiles!stock_opname_staff_id_fkey (full_name)
      `)
      .eq('store_id', storeId)
      .order('submitted_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching stock opname history:', error);
      return {
        success: false,
        error: 'Failed to fetch stock opname history',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Get item counts for each opname
    const opnameIds = (data || []).map(d => d.id);
    const { data: itemCounts } = await supabase
      .from('stock_opname_items')
      .select('opname_id')
      .in('opname_id', opnameIds);

    // Count items per opname
    const countMap: Record<string, number> = {};
    (itemCounts || []).forEach(item => {
      countMap[item.opname_id] = (countMap[item.opname_id] || 0) + 1;
    });

    const history: StockOpnameHistoryItem[] = (data || []).map((item) => {
      const staffData = Array.isArray(item.staff) ? item.staff[0] : item.staff;
      
      return {
        id: item.id,
        store_id: item.store_id,
        staff_id: item.staff_id,
        submitted_at: item.submitted_at,
        staff: staffData ? { full_name: staffData.full_name } : undefined,
        items_count: countMap[item.id] || 0,
        items: undefined, // Lazy loaded
      };
    });

    return { 
      success: true, 
      data: {
        data: history,
        total: count || 0,
        hasMore: (count || 0) > offset + pageSize,
      }
    };
  } catch (error) {
    console.error('Unexpected error in getStockOpnameHistory:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get stock opname items for a specific opname (lazy load)
 */
export async function getStockOpnameItems(
  opnameId: string
): Promise<ActionResult<StockOpnameHistoryItemDetail[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('stock_opname_items')
      .select(`
        previous_qty,
        counted_qty,
        discrepancy,
        product:products (name, sku)
      `)
      .eq('opname_id', opnameId);

    if (error) {
      console.error('Error fetching stock opname items:', error);
      return {
        success: false,
        error: 'Failed to fetch items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const items: StockOpnameHistoryItemDetail[] = (data || []).map((item) => {
      const productData = Array.isArray(item.product) ? item.product[0] : item.product;
      return {
        product_name: productData?.name || 'Unknown Product',
        product_sku: productData?.sku || '-',
        previous_qty: item.previous_qty,
        counted_qty: item.counted_qty,
        discrepancy: item.discrepancy,
      };
    });

    return { success: true, data: items };
  } catch (error) {
    console.error('Unexpected error in getStockOpnameItems:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get products with current inventory for stock opname form
 * OPTIMIZED: Only returns products with inventory > 0 by default
 * Can include zero-stock products with includeZeroStock flag
 */
export async function getProductsForOpname(
  storeId: string,
  options?: { includeZeroStock?: boolean; searchQuery?: string }
): Promise<ActionResult<Array<{ product: Product; current_qty: number }>>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Validate store access for multi-store support (Requirement 7.4)
    const assignedStoreIds = user.user_metadata?.assigned_store_ids || [];
    const userRole = user.app_metadata?.role;
    
    // Staff must have access to the store
    if (userRole === 'staff' && !assignedStoreIds.includes(storeId)) {
      return {
        success: false,
        error: 'You do not have access to this store',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();
    const includeZeroStock = options?.includeZeroStock ?? false;
    const searchQuery = options?.searchQuery?.toLowerCase();

    // Fetch inventory for the store first (more efficient)
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('product_id, quantity, display_qty')
      .eq('store_id', storeId);

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return {
        success: false,
        error: 'Failed to fetch inventory',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Build inventory lookup map
    const inventoryMap: Record<string, { quantity: number; display_qty: number }> = {};
    const productIdsWithInventory: string[] = [];
    (inventory || []).forEach((item) => {
      inventoryMap[item.product_id] = { 
        quantity: item.quantity, 
        display_qty: item.display_qty || 0 
      };
      if (item.quantity > 0) {
        productIdsWithInventory.push(item.product_id);
      }
    });

    // Build product query
    let productQuery = supabase
      .from('products')
      .select('id, sku, name, category, sub_category, is_active')
      .eq('is_active', true)
      .order('name');

    // If not including zero stock, only fetch products with inventory
    if (!includeZeroStock && productIdsWithInventory.length > 0) {
      productQuery = productQuery.in('id', productIdsWithInventory);
    }

    const { data: products, error: productError } = await productQuery;

    if (productError) {
      console.error('Error fetching products:', productError);
      return {
        success: false,
        error: 'Failed to fetch products',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Combine products with inventory and apply search filter
    let result = (products || []).map((product) => ({
      product: { 
        ...product as unknown as Product, 
        display_qty: inventoryMap[product.id]?.display_qty || 0 
      },
      current_qty: inventoryMap[product.id]?.quantity || 0,
    }));

    // Apply search filter client-side (more flexible)
    if (searchQuery) {
      result = result.filter(item => 
        item.product.name.toLowerCase().includes(searchQuery) ||
        item.product.sku.toLowerCase().includes(searchQuery)
      );
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in getProductsForOpname:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get current user's store ID for stock opname
 */
export async function getCurrentUserBranchForOpname(): Promise<ActionResult<{ store_id: string | null; store_name: string | null }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const storeId = await getUserStoreId();
    
    if (!storeId) {
      return { success: true, data: { store_id: null, store_name: null } };
    }

    const supabase = await createClient();
    
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return { success: true, data: { store_id: storeId, store_name: null } };
    }

    return { 
      success: true, 
      data: { 
        store_id: storeId, 
        store_name: store.name
      } 
    };
  } catch (error) {
    console.error('Unexpected error in getCurrentUserBranchForOpname:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update display quantities for products in a store
 * Display quantities are for data collection only and don't affect stock calculations
 */
export async function updateDisplayQuantities(
  storeId: string,
  updates: DisplayQuantityUpdate[]
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to update display quantities',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Validate store access for multi-store support (Requirement 7.4)
    const assignedStoreIds = user.user_metadata?.assigned_store_ids || [];
    const userRole = user.app_metadata?.role;
    
    // Staff must have access to the store
    if (userRole === 'staff' && !assignedStoreIds.includes(storeId)) {
      return {
        success: false,
        error: 'You do not have access to this store',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    // Update display quantities for each product
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('inventory')
        .upsert({
          store_id: storeId,
          product_id: update.product_id,
          display_qty: update.display_qty,
        }, {
          onConflict: 'store_id,product_id',
          ignoreDuplicates: false,
        });

      if (updateError) {
        console.error('Error updating display quantity:', updateError);
        return {
          success: false,
          error: 'Failed to update display quantities',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in updateDisplayQuantities:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
