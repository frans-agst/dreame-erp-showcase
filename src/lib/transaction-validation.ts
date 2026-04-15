// src/lib/transaction-validation.ts
// Transaction validation business logic
// Requirements: 8.1, 8.2, 8.3, 8.6

import { createClient } from '@/lib/supabase/server';
import type { TransactionInput, TransactionItemInput } from '@/types';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ProductValidationInfo {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  current_stock?: number;
}

export interface StockValidationInfo {
  product_id: string;
  product_name: string;
  requested_quantity: number;
  available_stock: number;
  shortage: number;
}

/**
 * Validates transaction input against business rules
 * Requirements: 8.1, 8.2, 8.3, 8.6
 */
export async function validateTransactionInput(
  input: TransactionInput
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  try {
    // Validate products exist and are active
    const productValidation = await validateProducts(input.items);
    if (!productValidation.isValid) {
      errors.push(...productValidation.errors);
    }

    // Validate pricing matches current product prices
    const priceValidation = await validatePricing(input.items);
    if (!priceValidation.isValid) {
      errors.push(...priceValidation.errors);
    }

    // Validate stock availability (only for in_store inventory)
    if (input.inventory_source === 'in_store') {
      const stockValidation = await validateStockAvailability(
        input.store_id,
        input.items
      );
      if (!stockValidation.isValid) {
        errors.push(...stockValidation.errors);
      }
    }

    // Validate store and staff exist and are active
    const entityValidation = await validateEntities(input.store_id, input.staff_id);
    if (!entityValidation.isValid) {
      errors.push(...entityValidation.errors);
    }

    // Validate customer information format
    const customerValidation = validateCustomerInfo(input);
    if (!customerValidation.isValid) {
      errors.push(...customerValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [
        {
          field: 'general',
          message: 'Validation failed due to system error',
          code: 'VALIDATION_ERROR',
        },
      ],
    };
  }
}

/**
 * Validates that all products exist and are active
 * Requirements: 8.6
 */
async function validateProducts(items: TransactionItemInput[]): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const supabase = await createClient();

  const productIds = items.map(item => item.product_id);
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price_retail, is_active')
    .in('id', productIds);

  if (error) {
    errors.push({
      field: 'products',
      message: 'Failed to validate products',
      code: 'PRODUCT_VALIDATION_ERROR',
    });
    return { isValid: false, errors };
  }

  // Check each product
  for (const item of items) {
    const product = products?.find(p => p.id === item.product_id);
    
    if (!product) {
      errors.push({
        field: `items.${items.indexOf(item)}.product_id`,
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
      continue;
    }

    if (!product.is_active) {
      errors.push({
        field: `items.${items.indexOf(item)}.product_id`,
        message: `Product "${product.name}" is not active`,
        code: 'PRODUCT_INACTIVE',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that product prices match current pricing rules
 * Requirements: 8.1
 * 
 * Note: Price validation is relaxed to allow staff to adjust prices based on market conditions.
 * The unit_price in the transaction represents the after-tax price that can be edited by staff.
 */
async function validatePricing(items: TransactionItemInput[]): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const supabase = await createClient();

  const productIds = items.map(item => item.product_id);
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price_retail, channel_pricing')
    .in('id', productIds);

  if (error) {
    errors.push({
      field: 'pricing',
      message: 'Failed to validate pricing',
      code: 'PRICING_VALIDATION_ERROR',
    });
    return { isValid: false, errors };
  }

  // Check each item's pricing - ensure price is positive
  for (const item of items) {
    const product = products?.find(p => p.id === item.product_id);
    
    if (!product) {
      continue; // Product validation will catch this
    }

    // Validate price is positive
    if (item.unit_price <= 0) {
      errors.push({
        field: `items.${items.indexOf(item)}.unit_price`,
        message: `Price for "${product.name}" must be greater than zero`,
        code: 'INVALID_PRICE',
      });
    }

    // Optional: Warn if price deviates significantly from retail price (more than 50%)
    // This is a soft validation - we don't block the transaction
    const retailPrice = product.price_retail;
    if (retailPrice > 0) {
      const deviation = Math.abs(item.unit_price - retailPrice) / retailPrice;
      if (deviation > 0.5) {
        // Log warning but don't add error
        console.warn(`Price deviation detected for ${product.name}: ${(deviation * 100).toFixed(1)}%`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates stock availability for in-store inventory
 * Requirements: 6.2, 6.3
 */
async function validateStockAvailability(
  storeId: string,
  items: TransactionItemInput[]
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const supabase = await createClient();

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
    errors.push({
      field: 'inventory',
      message: 'Failed to validate stock availability',
      code: 'INVENTORY_VALIDATION_ERROR',
    });
    return { isValid: false, errors };
  }

  // Check stock for each item
  for (const item of items) {
    const inventoryItem = inventory?.find(inv => inv.product_id === item.product_id);
    
    if (!inventoryItem) {
      errors.push({
        field: `items.${items.indexOf(item)}.quantity`,
        message: 'Product not found in store inventory',
        code: 'PRODUCT_NOT_IN_INVENTORY',
      });
      continue;
    }

    if (inventoryItem.quantity < item.quantity) {
      const shortage = item.quantity - inventoryItem.quantity;
      errors.push({
        field: `items.${items.indexOf(item)}.quantity`,
        message: `Insufficient stock for "${(inventoryItem.product as any)?.name}". Available: ${inventoryItem.quantity}, Requested: ${item.quantity}, Shortage: ${shortage}`,
        code: 'INSUFFICIENT_STOCK',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that store and staff exist and are active
 * Requirements: 8.3
 */
async function validateEntities(storeId: string, staffId: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const supabase = await createClient();

  // Validate store
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, is_active')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    errors.push({
      field: 'store_id',
      message: 'Store not found',
      code: 'STORE_NOT_FOUND',
    });
  } else if (!store.is_active) {
    errors.push({
      field: 'store_id',
      message: `Store "${store.name}" is not active`,
      code: 'STORE_INACTIVE',
    });
  }

  // Validate staff
  const { data: staff, error: staffError } = await supabase
    .from('profiles')
    .select('id, full_name, is_active')
    .eq('id', staffId)
    .single();

  if (staffError || !staff) {
    errors.push({
      field: 'staff_id',
      message: 'Staff member not found',
      code: 'STAFF_NOT_FOUND',
    });
  } else if (!staff.is_active) {
    errors.push({
      field: 'staff_id',
      message: `Staff member "${staff.full_name}" is not active`,
      code: 'STAFF_INACTIVE',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates customer information format
 * Requirements: 8.3
 */
function validateCustomerInfo(input: TransactionInput): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate phone number format if provided
  if (input.customer_phone) {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(input.customer_phone)) {
      errors.push({
        field: 'customer_phone',
        message: 'Customer phone number contains invalid characters',
        code: 'INVALID_PHONE_FORMAT',
      });
    }
  }

  // Validate customer name format if provided
  if (input.customer_name) {
    const nameRegex = /^[a-zA-Z\s\-\.]+$/;
    if (!nameRegex.test(input.customer_name)) {
      errors.push({
        field: 'customer_name',
        message: 'Customer name contains invalid characters',
        code: 'INVALID_NAME_FORMAT',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets detailed stock information for validation display
 * Requirements: 6.3
 */
export async function getStockValidationInfo(
  storeId: string,
  items: TransactionItemInput[]
): Promise<StockValidationInfo[]> {
  const supabase = await createClient();
  const productIds = items.map(item => item.product_id);
  
  const { data: inventory } = await supabase
    .from('inventory')
    .select(`
      product_id,
      quantity,
      product:products(name)
    `)
    .eq('store_id', storeId)
    .in('product_id', productIds);

  return items.map(item => {
    const inventoryItem = inventory?.find(inv => inv.product_id === item.product_id);
    const availableStock = inventoryItem?.quantity || 0;
    const shortage = Math.max(0, item.quantity - availableStock);

    return {
      product_id: item.product_id,
      product_name: (inventoryItem?.product as any)?.name || 'Unknown Product',
      requested_quantity: item.quantity,
      available_stock: availableStock,
      shortage,
    };
  });
}