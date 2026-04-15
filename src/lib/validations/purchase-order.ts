// src/lib/validations/purchase-order.ts
import { z } from 'zod';

/**
 * PO Header Schema (Legacy - for backward compatibility)
 * Validates purchase order header data
 * Requirements: 4.1, 4.2, 10.1
 */
export const POHeaderSchema = z.object({
  dealer_name: z
    .string()
    .min(1, { message: 'Dealer name is required' })
    .max(100, { message: 'Dealer name must not exceed 100 characters' }),
  po_date: z
    .string()
    .min(1, { message: 'PO date is required' })
    .refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'PO date must be a valid date' }
    ),
});

export type POHeaderInput = z.infer<typeof POHeaderSchema>;

/**
 * PO Item Schema
 * Validates individual purchase order line items
 * Requirements: 4.2, 4.3, 10.1
 */
export const POItemSchema = z.object({
  product_id: z
    .string()
    .min(1, { message: 'Product is required' })
    .uuid({ message: 'Product ID must be a valid UUID' }),
  quantity: z
    .number({ message: 'Quantity must be a number' })
    .int({ message: 'Quantity must be a whole number' })
    .positive({ message: 'Quantity must be positive' }),
  before_tax: z
    .number({ message: 'Before tax price must be a number' })
    .positive({ message: 'Before tax price must be positive' }),
});

export type POItemInput = z.infer<typeof POItemSchema>;

/**
 * Full Purchase Order Schema (Legacy - for backward compatibility)
 * Validates complete purchase order with header and items
 * Requirements: 4.1, 4.2, 10.1
 */
export const PurchaseOrderSchema = z.object({
  dealer_name: z
    .string()
    .min(1, { message: 'Dealer name is required' })
    .max(100, { message: 'Dealer name must not exceed 100 characters' }),
  po_date: z
    .string()
    .min(1, { message: 'PO date is required' })
    .refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'PO date must be a valid date' }
    ),
  items: z
    .array(POItemSchema)
    .min(1, { message: 'At least one item is required' }),
});

export type PurchaseOrderInput = z.infer<typeof PurchaseOrderSchema>;

/**
 * V2 PO Schema with Account/Store and Dynamic Pricing
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export const PurchaseOrderV2Schema = z.object({
  account_id: z
    .string()
    .min(1, { message: 'Account is required' })
    .uuid({ message: 'Account ID must be a valid UUID' }),
  store_id: z
    .string()
    .uuid({ message: 'Store ID must be a valid UUID' })
    .nullable()
    .optional(),
  price_source: z
    .string()
    .min(1, { message: 'Price source is required' }),
  po_date: z
    .string()
    .min(1, { message: 'PO date is required' })
    .refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'PO date must be a valid date' }
    ),
  items: z
    .array(POItemSchema)
    .min(1, { message: 'At least one item is required' }),
});

export type PurchaseOrderV2Input = z.infer<typeof PurchaseOrderV2Schema>;

/**
 * PO Status Update Schema
 * Validates status changes for purchase orders
 */
export const POStatusUpdateSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'cancelled'], {
    message: 'Status must be draft, confirmed, or cancelled',
  }),
});

export type POStatusUpdateInput = z.infer<typeof POStatusUpdateSchema>;
