// src/lib/inventory-management.ts
// Inventory management integration for transactions
// Requirements: 6.1, 6.2, 6.4, 6.5

import { createClient } from '@/lib/supabase/server';
import type { TransactionItemInput } from '@/types';

export interface InventoryValidationResult {
  isValid: boolean;
  errors: Array<{
    product_id: string;
    product_name: string;
    requested_quantity: number;
    available_stock: number;
    shortage: number;
  }>;
}

export interface InventoryUpdateResult {
  success: boolean;
  error?: string;
  updated_products: Array<{
    product_id: string;
    previous_stock: number;
    new_stock: number;
    quantity_changed: number;
  }>;
}

/**
 * Validates stock availability for all transaction items
 * Requirements: 6.2
 */
export async function validateInventoryAvailability(
  storeId: string,
  items: TransactionItemInput[],
  inventorySource: 'in_store' | 'warehouse' = 'in_store'
): Promise<InventoryValidationResult> {
  try {
    const supabase = await createClient();

    // Skip validation for warehouse inventory
    if (inventorySource === 'warehouse') {
      return {
        isValid: true,
        errors: []
      };
    }

    const productIds = items.map(item => item.product_id);
    
    // Get current inventory levels
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select(`
        product_id,
        quantity,
        product:products(name)
      `)
      .eq('store_id', storeId)
      .in('product_id', productIds);

    if (error) {
      console.error('Inventory validation error:', error);
      return {
        isValid: false,
        errors: []
      };
    }

    const errors: InventoryValidationResult['errors'] = [];

    // Check stock for each item
    for (const item of items) {
      const inventoryItem = inventory?.find(inv => inv.product_id === item.product_id);
      
      if (!inventoryItem) {
        errors.push({
          product_id: item.product_id,
          product_name: 'Unknown Product',
          requested_quantity: item.quantity,
          available_stock: 0,
          shortage: item.quantity
        });
        continue;
      }

      if (inventoryItem.quantity < item.quantity) {
        const shortage = item.quantity - inventoryItem.quantity;
        errors.push({
          product_id: item.product_id,
          product_name: (inventoryItem.product as any)?.name || 'Unknown Product',
          requested_quantity: item.quantity,
          available_stock: inventoryItem.quantity,
          shortage
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };

  } catch (error) {
    console.error('Inventory validation error:', error);
    return {
      isValid: false,
      errors: []
    };
  }
}

/**
 * Atomically updates stock levels for all transaction items
 * Requirements: 6.4
 */
export async function updateInventoryForTransaction(
  storeId: string,
  items: TransactionItemInput[],
  inventorySource: 'in_store' | 'warehouse' = 'in_store',
  operation: 'decrement' | 'increment' = 'decrement'
): Promise<InventoryUpdateResult> {
  try {
    const supabase = await createClient();

    // Skip inventory updates for warehouse source
    if (inventorySource === 'warehouse') {
      return {
        success: true,
        updated_products: []
      };
    }

    const updatedProducts: InventoryUpdateResult['updated_products'] = [];

    // Process each item
    for (const item of items) {
      const quantityChange = operation === 'decrement' ? -item.quantity : item.quantity;

      // Get current stock level
      const { data: currentInventory, error: fetchError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('store_id', storeId)
        .eq('product_id', item.product_id)
        .single();

      if (fetchError) {
        console.error('Failed to fetch current inventory:', fetchError);
        return {
          success: false,
          error: `Failed to fetch inventory for product ${item.product_id}`,
          updated_products: []
        };
      }

      const previousStock = currentInventory.quantity;
      const newStock = previousStock + quantityChange;

      // Prevent negative stock for decrements
      if (operation === 'decrement' && newStock < 0) {
        return {
          success: false,
          updated_products: [],
          error: `Insufficient stock for product ${item.product_id}. Available: ${previousStock}, Requested: ${item.quantity}`
        };
      }

      // Update inventory using the decrement_inventory function for decrements
      // or direct update for increments
      if (operation === 'decrement') {
        const { data: updatedQuantity, error: updateError } = await supabase
          .rpc('decrement_inventory', {
            p_store_id: storeId,
            p_product_id: item.product_id,
            p_qty: item.quantity
          });

        if (updateError) {
          console.error('Failed to decrement inventory:', updateError);
          return {
            success: false,
            updated_products: [],
            error: `Failed to update inventory for product ${item.product_id}: ${updateError.message}`
          };
        }

        updatedProducts.push({
          product_id: item.product_id,
          previous_stock: previousStock,
          new_stock: updatedQuantity,
          quantity_changed: quantityChange
        });
      } else {
        // For increments, update directly
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ quantity: newStock })
          .eq('store_id', storeId)
          .eq('product_id', item.product_id);

        if (updateError) {
          console.error('Failed to increment inventory:', updateError);
          return {
            success: false,
            updated_products: [],
            error: `Failed to update inventory for product ${item.product_id}: ${updateError.message}`
          };
        }

        updatedProducts.push({
          product_id: item.product_id,
          previous_stock: previousStock,
          new_stock: newStock,
          quantity_changed: quantityChange
        });
      }
    }

    return {
      success: true,
      updated_products: updatedProducts
    };

  } catch (error) {
    console.error('Inventory update error:', error);
    return {
      success: false,
      updated_products: [],
      error: 'Internal server error during inventory update'
    };
  }
}

/**
 * Restores stock levels for voided/returned transactions
 * Requirements: 6.5
 */
export async function restoreInventoryForTransaction(
  transactionId: string
): Promise<InventoryUpdateResult> {
  try {
    const supabase = await createClient();

    // Get transaction details including items and inventory source
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select(`
        store_id,
        inventory_source,
        items:transaction_items(
          product_id,
          quantity
        )
      `)
      .eq('id', transactionId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch transaction for inventory restoration:', fetchError);
      return {
        success: false,
        updated_products: [],
        error: 'Failed to fetch transaction details'
      };
    }

    if (!transaction.items || transaction.items.length === 0) {
      return {
        success: true,
        updated_products: []
      };
    }

    // Convert transaction items to the format expected by updateInventoryForTransaction
    const items: TransactionItemInput[] = transaction.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: 0, // Not needed for inventory operations
      line_discount: 0,
      gift_details: []
    }));

    // Restore inventory by incrementing stock levels
    return await updateInventoryForTransaction(
      transaction.store_id,
      items,
      transaction.inventory_source as 'in_store' | 'warehouse',
      'increment'
    );

  } catch (error) {
    console.error('Inventory restoration error:', error);
    return {
      success: false,
      updated_products: [],
      error: 'Internal server error during inventory restoration'
    };
  }
}

/**
 * Gets current inventory levels for products in a store
 * Requirements: 6.2
 */
export async function getInventoryLevels(
  storeId: string,
  productIds: string[]
): Promise<Array<{
  product_id: string;
  product_name: string;
  sku: string;
  current_stock: number;
}>> {
  try {
    const supabase = await createClient();

    const { data: inventory, error } = await supabase
      .from('inventory')
      .select(`
        product_id,
        quantity,
        product:products(name, sku)
      `)
      .eq('store_id', storeId)
      .in('product_id', productIds);

    if (error) {
      console.error('Failed to fetch inventory levels:', error);
      return [];
    }

    return inventory?.map(item => ({
      product_id: item.product_id,
      product_name: (item.product as any)?.name || 'Unknown Product',
      sku: (item.product as any)?.sku || '',
      current_stock: item.quantity
    })) || [];

  } catch (error) {
    console.error('Get inventory levels error:', error);
    return [];
  }
}

/**
 * Validates that inventory operations can be performed atomically
 * Requirements: 6.4
 */
export async function validateAtomicInventoryOperation(
  storeId: string,
  items: TransactionItemInput[],
  inventorySource: 'in_store' | 'warehouse' = 'in_store'
): Promise<{
  canProceed: boolean;
  validationResult: InventoryValidationResult;
  inventoryLevels: Array<{
    product_id: string;
    product_name: string;
    sku: string;
    current_stock: number;
  }>;
}> {
  try {
    // Get current inventory levels
    const productIds = items.map(item => item.product_id);
    const inventoryLevels = await getInventoryLevels(storeId, productIds);

    // Validate availability
    const validationResult = await validateInventoryAvailability(
      storeId,
      items,
      inventorySource
    );

    return {
      canProceed: validationResult.isValid,
      validationResult,
      inventoryLevels
    };

  } catch (error) {
    console.error('Atomic inventory validation error:', error);
    return {
      canProceed: false,
      validationResult: { isValid: false, errors: [] },
      inventoryLevels: []
    };
  }
}