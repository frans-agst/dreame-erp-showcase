'use server';

import { createClient } from '@/lib/supabase/server';
import {
  PurchaseOrderSchema,
  PurchaseOrderInput,
  PurchaseOrderV2Schema,
  PurchaseOrderV2Input,
  POStatusUpdateSchema,
} from '@/lib/validations/purchase-order';
import { calculateAfterTax, calculateLineTotal } from '@/lib/calculations';
import { PurchaseOrder, POItem, POStatus } from '@/types';
import { FullProduct } from '@/lib/price-filter';

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
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_STATUS: 'INVALID_STATUS',
} as const;

export interface POFilters {
  status?: POStatus;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedPOResult {
  data: PurchaseOrder[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
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

async function getUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  return user.app_metadata?.role || null;
}

async function checkAdminOrManager(): Promise<ActionResult<void> | null> {
  const role = await getUserRole();
  
  if (!role || !['admin', 'manager'].includes(role)) {
    return {
      success: false,
      error: 'You do not have permission to perform this action',
      code: ErrorCodes.FORBIDDEN,
    };
  }
  
  return null;
}

/**
 * Generate a unique PO number
 * Format: PO-YYYYMMDD-XXXX (where XXXX is a sequential number)
 */
async function generatePONumber(): Promise<string> {
  const supabase = await createClient();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `PO-${dateStr}-`;
  
  // Get the latest PO number for today
  const { data } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .like('po_number', `${prefix}%`)
    .order('po_number', { ascending: false })
    .limit(1);
  
  let sequence = 1;
  if (data && data.length > 0) {
    const lastNumber = data[0].po_number;
    const lastSequence = parseInt(lastNumber.split('-')[2], 10);
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${sequence.toString().padStart(4, '0')}`;
}

// ============================================================================
// Purchase Order Actions
// ============================================================================

/**
 * Create a new purchase order
 * Requirements: 4.1, 4.2, 4.6, 4.7
 * SECURITY: PO creation does NOT modify inventory
 */
export async function createPurchaseOrder(
  data: PurchaseOrderInput
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to create a purchase order',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<PurchaseOrder>;

    // Validate input
    const validation = PurchaseOrderSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const validatedData = validation.data;
    const supabase = await createClient();

    // Calculate totals for each item and overall
    let totalBeforeTax = 0;
    let totalAfterTax = 0;
    let grandTotal = 0;

    const itemsWithCalculations = validatedData.items.map((item) => {
      const afterTax = calculateAfterTax(item.before_tax);
      const lineTotal = calculateLineTotal(afterTax, item.quantity);
      
      totalBeforeTax += item.before_tax * item.quantity;
      totalAfterTax += afterTax * item.quantity;
      grandTotal += lineTotal;

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        before_tax: item.before_tax,
        after_tax: afterTax,
        line_total: lineTotal,
      };
    });

    // Generate PO number
    const poNumber = await generatePONumber();

    // Insert purchase order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        dealer_name: validatedData.dealer_name,
        po_date: validatedData.po_date,
        status: 'draft',
        total_before_tax: totalBeforeTax,
        total_after_tax: totalAfterTax,
        grand_total: grandTotal,
        created_by: user.id,
      })
      .select()
      .single();

    if (poError) {
      console.error('Error creating purchase order:', poError);
      return {
        success: false,
        error: 'Failed to create purchase order',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Insert purchase order items
    const itemsToInsert = itemsWithCalculations.map((item) => ({
      po_id: po.id,
      ...item,
    }));

    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)
      .select('*, product:products(*)');

    if (itemsError) {
      console.error('Error creating purchase order items:', itemsError);
      // Rollback: delete the PO
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      return {
        success: false,
        error: 'Failed to create purchase order items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const result: PurchaseOrder = {
      ...po,
      items: items || [],
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in createPurchaseOrder:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Create a new purchase order with V2 schema (Account/Store + Dynamic Pricing)
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * SECURITY: PO creation does NOT modify inventory
 */
export async function createPurchaseOrderV2(
  data: PurchaseOrderV2Input
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to create a purchase order',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<PurchaseOrder>;

    // Validate input
    const validation = PurchaseOrderV2Schema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const validatedData = validation.data;
    const supabase = await createClient();

    // Verify account exists
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name, channel_type')
      .eq('id', validatedData.account_id)
      .single();

    if (accountError || !account) {
      return {
        success: false,
        error: 'Account not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // Verify store exists if provided
    let storeName: string | null = null;
    if (validatedData.store_id) {
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, name, account_id')
        .eq('id', validatedData.store_id)
        .single();

      if (storeError || !store) {
        return {
          success: false,
          error: 'Store not found',
          code: ErrorCodes.NOT_FOUND,
        };
      }

      // Verify store belongs to the selected account
      if (store.account_id !== validatedData.account_id) {
        return {
          success: false,
          error: 'Store does not belong to the selected account',
          code: ErrorCodes.VALIDATION_ERROR,
        };
      }

      storeName = store.name;
    }

    // Calculate totals for each item and overall
    let totalBeforeTax = 0;
    let totalAfterTax = 0;
    let grandTotal = 0;

    const itemsWithCalculations = validatedData.items.map((item) => {
      const afterTax = calculateAfterTax(item.before_tax);
      const lineTotal = calculateLineTotal(afterTax, item.quantity);
      
      totalBeforeTax += item.before_tax * item.quantity;
      totalAfterTax += afterTax * item.quantity;
      grandTotal += lineTotal;

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        before_tax: item.before_tax,
        after_tax: afterTax,
        line_total: lineTotal,
      };
    });

    // Generate PO number
    const poNumber = await generatePONumber();

    // Insert purchase order with V2 fields
    // dealer_name: if store selected → "ChannelType - StoreName", else "ChannelType - AccountName"
    const dealerName = storeName
      ? `${account.channel_type} - ${storeName}`
      : `${account.channel_type} - ${account.name}`;

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        dealer_name: dealerName,
        account_id: validatedData.account_id,
        store_id: validatedData.store_id || null,
        price_source: validatedData.price_source,
        po_date: validatedData.po_date,
        status: 'draft',
        total_before_tax: totalBeforeTax,
        total_after_tax: totalAfterTax,
        grand_total: grandTotal,
        created_by: user.id,
      })
      .select(`
        *,
        account:accounts(id, name, channel_type),
        store:stores(id, name, account_id)
      `)
      .single();

    if (poError) {
      console.error('Error creating purchase order:', poError);
      return {
        success: false,
        error: 'Failed to create purchase order',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Insert purchase order items
    const itemsToInsert = itemsWithCalculations.map((item) => ({
      po_id: po.id,
      ...item,
    }));

    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)
      .select('*, product:products(*)');

    if (itemsError) {
      console.error('Error creating purchase order items:', itemsError);
      // Rollback: delete the PO
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      return {
        success: false,
        error: 'Failed to create purchase order items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const result: PurchaseOrder = {
      ...po,
      items: items || [],
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in createPurchaseOrderV2:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get price for a product based on price source
 * Requirements: 7.4 - Channel price lookup
 */
export async function getProductPriceBySource(
  productId: string,
  priceSource: string
): Promise<ActionResult<number>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<number>;

    const supabase = await createClient();

    const { data: product, error } = await supabase
      .from('products')
      .select('price_retail, price_buy, channel_pricing')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return {
        success: false,
        error: 'Product not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    const fullProduct = product as FullProduct;
    let price: number;

    switch (priceSource) {
      case 'retail':
        price = fullProduct.price_retail;
        break;
      case 'dealer':
        price = fullProduct.price_buy;
        break;
      default:
        // Channel key lookup
        if (fullProduct.channel_pricing && fullProduct.channel_pricing[priceSource]) {
          price = fullProduct.channel_pricing[priceSource];
        } else {
          // Fallback to dealer price if channel key not found
          price = fullProduct.price_buy;
        }
    }

    return { success: true, data: price };
  } catch (error) {
    console.error('Unexpected error in getProductPriceBySource:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get purchase orders with pagination and filters
 * Requirements: 4.1
 */
export async function getPurchaseOrders(
  filters: POFilters = {}
): Promise<ActionResult<PaginatedPOResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view purchase orders',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<PaginatedPOResult>;

    const supabase = await createClient();
    const page = filters.page || 1;
    const pageSize = filters.page_size || 10;
    const offset = (page - 1) * pageSize;

    // Build query for count
    let countQuery = supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true });

    // Build query for data - include confirmed_by user
    let dataQuery = supabase
      .from('purchase_orders')
      .select('*, confirmed_by_user:profiles!confirmed_by(id, full_name, email)')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Apply filters
    if (filters.status) {
      countQuery = countQuery.eq('status', filters.status);
      dataQuery = dataQuery.eq('status', filters.status);
    }

    if (filters.start_date) {
      countQuery = countQuery.gte('po_date', filters.start_date);
      dataQuery = dataQuery.gte('po_date', filters.start_date);
    }

    if (filters.end_date) {
      countQuery = countQuery.lte('po_date', filters.end_date);
      dataQuery = dataQuery.lte('po_date', filters.end_date);
    }

    // Execute queries
    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    if (countResult.error) {
      console.error('Error counting purchase orders:', countResult.error);
      return {
        success: false,
        error: 'Failed to fetch purchase orders',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    if (dataResult.error) {
      console.error('Error fetching purchase orders:', dataResult.error);
      return {
        success: false,
        error: 'Failed to fetch purchase orders',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const total = countResult.count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Fetch items for each PO
    const posWithItems: PurchaseOrder[] = await Promise.all(
      (dataResult.data || []).map(async (po) => {
        const { data: items } = await supabase
          .from('purchase_order_items')
          .select('*, product:products(*)')
          .eq('po_id', po.id);

        return {
          ...po,
          items: items || [],
        };
      })
    );

    return {
      success: true,
      data: {
        data: posWithItems,
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
      },
    };
  } catch (error) {
    console.error('Unexpected error in getPurchaseOrders:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get a single purchase order by ID
 * Requirements: 4.1
 */
export async function getPurchaseOrderById(
  id: string
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view purchase orders',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<PurchaseOrder>;

    const supabase = await createClient();

    // Fetch PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (poError || !po) {
      return {
        success: false,
        error: 'Purchase order not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*, product:products(*)')
      .eq('po_id', id);

    if (itemsError) {
      console.error('Error fetching PO items:', itemsError);
      return {
        success: false,
        error: 'Failed to fetch purchase order items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const result: PurchaseOrder = {
      ...po,
      items: items || [],
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in getPurchaseOrderById:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update purchase order status
 * Requirements: 4.1
 */
export async function updatePOStatus(
  id: string,
  status: POStatus
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to update purchase orders',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<PurchaseOrder>;

    // Validate status
    const validation = POStatusUpdateSchema.safeParse({ status });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const supabase = await createClient();

    // Check if PO exists and get current status
    const { data: existing, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: 'Purchase order not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // Validate status transition
    const currentStatus = existing.status as POStatus;
    
    // Only draft POs can be confirmed or cancelled
    if (currentStatus !== 'draft' && status !== currentStatus) {
      return {
        success: false,
        error: `Cannot change status from ${currentStatus} to ${status}. Only draft POs can be modified.`,
        code: ErrorCodes.INVALID_STATUS,
      };
    }

    // Update status (and confirmed_by/confirmed_at if confirming)
    const updateData: { status: POStatus; confirmed_by?: string; confirmed_at?: string } = { status };
    if (status === 'confirmed') {
      updateData.confirmed_by = user.id;
      updateData.confirmed_at = new Date().toISOString();
    }
    
    const { data: po, error: updateError } = await supabase
      .from('purchase_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating PO status:', updateError);
      return {
        success: false,
        error: 'Failed to update purchase order status',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Fetch items
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('*, product:products(*)')
      .eq('po_id', id);

    const result: PurchaseOrder = {
      ...po,
      items: items || [],
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in updatePOStatus:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update a draft purchase order
 * Requirements: 4.1, 4.2
 */
export async function updatePurchaseOrder(
  id: string,
  data: PurchaseOrderInput
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to update purchase orders',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<PurchaseOrder>;

    // Validate input
    const validation = PurchaseOrderSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const validatedData = validation.data;
    const supabase = await createClient();

    // Check if PO exists and is draft
    const { data: existing, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: 'Purchase order not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    if (existing.status !== 'draft') {
      return {
        success: false,
        error: 'Only draft purchase orders can be edited',
        code: ErrorCodes.INVALID_STATUS,
      };
    }

    // Calculate totals for each item and overall
    let totalBeforeTax = 0;
    let totalAfterTax = 0;
    let grandTotal = 0;

    const itemsWithCalculations = validatedData.items.map((item) => {
      const afterTax = calculateAfterTax(item.before_tax);
      const lineTotal = calculateLineTotal(afterTax, item.quantity);
      
      totalBeforeTax += item.before_tax * item.quantity;
      totalAfterTax += afterTax * item.quantity;
      grandTotal += lineTotal;

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        before_tax: item.before_tax,
        after_tax: afterTax,
        line_total: lineTotal,
      };
    });

    // Update purchase order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .update({
        dealer_name: validatedData.dealer_name,
        po_date: validatedData.po_date,
        total_before_tax: totalBeforeTax,
        total_after_tax: totalAfterTax,
        grand_total: grandTotal,
      })
      .eq('id', id)
      .select()
      .single();

    if (poError) {
      console.error('Error updating purchase order:', poError);
      return {
        success: false,
        error: 'Failed to update purchase order',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Delete existing items
    const { error: deleteError } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('po_id', id);

    if (deleteError) {
      console.error('Error deleting PO items:', deleteError);
      return {
        success: false,
        error: 'Failed to update purchase order items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Insert new items
    const itemsToInsert = itemsWithCalculations.map((item) => ({
      po_id: id,
      ...item,
    }));

    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)
      .select('*, product:products(*)');

    if (itemsError) {
      console.error('Error creating purchase order items:', itemsError);
      return {
        success: false,
        error: 'Failed to create purchase order items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const result: PurchaseOrder = {
      ...po,
      items: items || [],
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in updatePurchaseOrder:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get purchase order data for PDF export
 * Requirements: 4.7
 */
export async function getPurchaseOrderForExport(
  id: string
): Promise<ActionResult<PurchaseOrder & { items: (POItem & { product: { sku: string; name: string } })[] }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to export purchase orders',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<PurchaseOrder & { items: (POItem & { product: { sku: string; name: string } })[] }>;

    const supabase = await createClient();

    // Fetch PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (poError || !po) {
      return {
        success: false,
        error: 'Purchase order not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // Fetch items with product details
    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*, product:products(sku, name)')
      .eq('po_id', id);

    if (itemsError) {
      console.error('Error fetching PO items:', itemsError);
      return {
        success: false,
        error: 'Failed to fetch purchase order items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const result = {
      ...po,
      items: items || [],
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in getPurchaseOrderForExport:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Delete a purchase order (admin/manager only)
 * Deletes the PO and all its items
 */
export async function deletePurchaseOrder(
  id: string
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to delete purchase orders',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions - admin/manager only
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<void>;

    const supabase = await createClient();

    // Check if PO exists
    const { data: existing, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: 'Purchase order not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // Delete PO items first (cascade should handle this, but being explicit)
    const { error: itemsDeleteError } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('po_id', id);

    if (itemsDeleteError) {
      console.error('Error deleting PO items:', itemsDeleteError);
      return {
        success: false,
        error: 'Failed to delete purchase order items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Delete the PO
    const { error: deleteError } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting PO:', deleteError);
      return {
        success: false,
        error: `Failed to delete purchase order: ${deleteError.message}`,
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in deletePurchaseOrder:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// ============================================================================
// PO Import Action
// ============================================================================

export interface ImportPOItem {
  sku: string;
  quantity: number;
  after_tax: number; // tax-inclusive price per unit
}

export interface ImportPOInput {
  po_date: string;
  dealer_name: string; // used to fuzzy-match account
  items: ImportPOItem[];
}

export interface ImportPOResult {
  po_number: string;
  id: string;
  skipped_skus: string[]; // SKUs that couldn't be matched
}

/**
 * Import a purchase order from parsed Excel data.
 * Looks up account by dealer_name and products by SKU.
 * Admin/Manager only.
 */
export async function importPurchaseOrder(
  input: ImportPOInput
): Promise<ActionResult<ImportPOResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'You must be logged in', code: ErrorCodes.UNAUTHORIZED };
    }
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<ImportPOResult>;

    const supabase = await createClient();

    // --- Match account by dealer_name ---
    // dealer_name format from export: "ChannelType - AccountName" e.g. "Hangon - Hangon"
    // Try exact match on dealer_name stored in purchase_orders, or match accounts table
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, channel_type')
      .eq('is_active', true);

    if (!accounts || accounts.length === 0) {
      return { success: false, error: 'No accounts found', code: ErrorCodes.NOT_FOUND };
    }

    // Try to match "ChannelType - AccountName" format
    let matchedAccount = accounts.find((a) => {
      const formatted = `${a.channel_type} - ${a.name}`.toLowerCase();
      return formatted === input.dealer_name.toLowerCase();
    });

    // Fallback: match just the account name part
    if (!matchedAccount) {
      const namePart = input.dealer_name.includes(' - ')
        ? input.dealer_name.split(' - ').slice(1).join(' - ').toLowerCase()
        : input.dealer_name.toLowerCase();
      matchedAccount = accounts.find((a) => a.name.toLowerCase() === namePart);
    }

    // Fallback: partial match
    if (!matchedAccount) {
      matchedAccount = accounts.find((a) =>
        input.dealer_name.toLowerCase().includes(a.name.toLowerCase())
      );
    }

    if (!matchedAccount) {
      return {
        success: false,
        error: `Could not match dealer "${input.dealer_name}" to any account. Please check the dealer name in the Excel file.`,
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // --- Match products by SKU ---
    const skus = input.items.map((i) => i.sku);
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name')
      .in('sku', skus);

    const productMap: Record<string, string> = {};
    (products || []).forEach((p) => { productMap[p.sku] = p.id; });

    const skipped_skus: string[] = [];
    const validItems: { product_id: string; quantity: number; before_tax: number }[] = [];

    for (const item of input.items) {
      const productId = productMap[item.sku];
      if (!productId) {
        skipped_skus.push(item.sku);
        continue;
      }
      // Reverse-calculate before_tax from after_tax
      const before_tax = item.after_tax > 0 ? Math.round((item.after_tax / 1.11) * 100) / 100 : 0;
      validItems.push({ product_id: productId, quantity: item.quantity, before_tax });
    }

    if (validItems.length === 0) {
      return {
        success: false,
        error: `No valid products found. Unmatched SKUs: ${skipped_skus.join(', ')}`,
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // --- Calculate totals ---
    let totalBeforeTax = 0;
    let totalAfterTax = 0;
    let grandTotal = 0;

    const itemsWithCalc = validItems.map((item) => {
      const afterTax = calculateAfterTax(item.before_tax);
      const lineTotal = calculateLineTotal(afterTax, item.quantity);
      totalBeforeTax += item.before_tax * item.quantity;
      totalAfterTax += afterTax * item.quantity;
      grandTotal += lineTotal;
      return { ...item, after_tax: afterTax, line_total: lineTotal };
    });

    // --- Generate PO number and insert ---
    const poNumber = await generatePONumber();

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        dealer_name: `${matchedAccount.channel_type} - ${matchedAccount.name}`,
        account_id: matchedAccount.id,
        store_id: null,
        price_source: 'retailer',
        po_date: input.po_date,
        status: 'draft',
        total_before_tax: totalBeforeTax,
        total_after_tax: totalAfterTax,
        grand_total: grandTotal,
        created_by: user.id,
      })
      .select('id, po_number')
      .single();

    if (poError || !po) {
      return { success: false, error: 'Failed to create purchase order', code: ErrorCodes.INTERNAL_ERROR };
    }

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsWithCalc.map((item) => ({ po_id: po.id, ...item })));

    if (itemsError) {
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      return { success: false, error: 'Failed to insert PO items', code: ErrorCodes.INTERNAL_ERROR };
    }

    return { success: true, data: { po_number: po.po_number, id: po.id, skipped_skus } };
  } catch (error) {
    console.error('Unexpected error in importPurchaseOrder:', error);
    return { success: false, error: 'An unexpected error occurred', code: ErrorCodes.INTERNAL_ERROR };
  }
}
