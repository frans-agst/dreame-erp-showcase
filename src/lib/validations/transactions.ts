// src/lib/validations/transactions.ts
import { z } from 'zod';
import { GiftItemSchema } from './sales';

/**
 * Transaction Item Input Schema
 * Validates individual items within a transaction
 * Requirements: 1.2, 8.1, 8.2, 8.6
 */
export const TransactionItemInputSchema = z.object({
  product_id: z
    .string()
    .min(1, { message: 'Product is required' })
    .uuid({ message: 'Product ID must be a valid UUID' }),
  quantity: z
    .number({ message: 'Quantity must be a number' })
    .int({ message: 'Quantity must be a whole number' })
    .positive({ message: 'Quantity must be at least 1' }),
  unit_price: z
    .number({ message: 'Unit price must be a number' })
    .nonnegative({ message: 'Unit price cannot be negative' }),
  line_discount: z
    .number({ message: 'Line discount must be a number' })
    .nonnegative({ message: 'Line discount cannot be negative' })
    .default(0),
  gift_details: z
    .array(GiftItemSchema)
    .optional()
    .default([]),
}).refine(
  (data) => {
    const lineTotal = (data.quantity * data.unit_price) - data.line_discount;
    return data.line_discount <= (data.quantity * data.unit_price);
  },
  {
    message: 'Line discount cannot exceed line total',
    path: ['line_discount'],
  }
);

export type TransactionItemInput = z.infer<typeof TransactionItemInputSchema>;

/**
 * Transaction Input Schema
 * Validates complete transaction data input
 * Requirements: 1.1, 1.2, 1.4, 8.1, 8.2, 8.3, 8.6
 */
export const TransactionInputSchema = z.object({
  store_id: z
    .string()
    .min(1, { message: 'Store is required' })
    .uuid({ message: 'Store ID must be a valid UUID' }),
  staff_id: z
    .string()
    .min(1, { message: 'Staff is required' })
    .uuid({ message: 'Staff ID must be a valid UUID' }),
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Transaction date must be in YYYY-MM-DD format' }),
  inventory_source: z
    .enum(['in_store', 'warehouse'], { 
      message: 'Inventory source must be either "in_store" or "warehouse"' 
    })
    .default('in_store'),
  customer_name: z
    .string()
    .max(100, { message: 'Customer name must not exceed 100 characters' })
    .optional()
    .nullable(),
  customer_phone: z
    .string()
    .max(20, { message: 'Customer phone must not exceed 20 characters' })
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, { message: 'Notes must not exceed 500 characters' })
    .optional()
    .nullable(),
  items: z
    .array(TransactionItemInputSchema)
    .min(1, { message: 'Transaction must contain at least one product' })
    .max(50, { message: 'Transaction cannot contain more than 50 products' }),
}).refine(
  (data) => {
    // Validate no duplicate products in the same transaction
    const productIds = data.items.map(item => item.product_id);
    const uniqueProductIds = new Set(productIds);
    return productIds.length === uniqueProductIds.size;
  },
  {
    message: 'Transaction cannot contain duplicate products',
    path: ['items'],
  }
);

export type TransactionInput = z.infer<typeof TransactionInputSchema>;

/**
 * Transaction Filter Schema
 * Validates filters for transaction queries
 * Requirements: 9.1, 9.5
 */
export const TransactionFilterSchema = z.object({
  store_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  min_total: z.number().nonnegative().optional(),
  max_total: z.number().nonnegative().optional(),
  inventory_source: z.enum(['in_store', 'warehouse']).optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  {
    message: 'Start date must be before or equal to end date',
    path: ['end_date'],
  }
).refine(
  (data) => {
    if (data.min_total !== undefined && data.max_total !== undefined) {
      return data.min_total <= data.max_total;
    }
    return true;
  },
  {
    message: 'Minimum total must be less than or equal to maximum total',
    path: ['max_total'],
  }
);

export type TransactionFilter = z.infer<typeof TransactionFilterSchema>;

/**
 * Transaction Update Schema
 * Validates transaction updates (limited fields)
 * Requirements: 7.2
 */
export const TransactionUpdateSchema = z.object({
  customer_name: z
    .string()
    .max(100, { message: 'Customer name must not exceed 100 characters' })
    .optional()
    .nullable(),
  customer_phone: z
    .string()
    .max(20, { message: 'Customer phone must not exceed 20 characters' })
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, { message: 'Notes must not exceed 500 characters' })
    .optional()
    .nullable(),
});

export type TransactionUpdate = z.infer<typeof TransactionUpdateSchema>;