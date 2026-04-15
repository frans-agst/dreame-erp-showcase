// src/lib/validations/sales.ts
import { z } from 'zod';

/**
 * Gift Item Schema for gift_details JSONB
 * Requirements: 8.5, 8.9
 */
export const GiftItemSchema = z.object({
  product_id: z.string().uuid({ message: 'Gift product ID must be a valid UUID' }),
  name: z.string().min(1, { message: 'Gift name is required' }),
  qty: z.number().int().positive({ message: 'Gift quantity must be at least 1' }),
});

/**
 * Sale Input Schema
 * Validates sales data input from staff
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.9, 8.11
 */
export const SaleInputSchema = z.object({
  store_id: z
    .string()
    .min(1, { message: 'Store is required' })
    .uuid({ message: 'Store ID must be a valid UUID' }),
  product_id: z
    .string()
    .min(1, { message: 'Product is required' })
    .uuid({ message: 'Product ID must be a valid UUID' }),
  staff_id: z
    .string()
    .min(1, { message: 'Staff is required' })
    .uuid({ message: 'Staff ID must be a valid UUID' }),
  quantity: z
    .number({ message: 'Quantity must be a number' })
    .int({ message: 'Quantity must be a whole number' })
    .positive({ message: 'Quantity must be at least 1' }),
  price: z
    .number({ message: 'Price must be a number' })
    .positive({ message: 'Price must be a positive number' }),
  discount: z
    .number({ message: 'Discount must be a number' })
    .nonnegative({ message: 'Discount cannot be negative' })
    .default(0),
  // Inventory source - determines if stock should be deducted
  inventory_source: z
    .enum(['in_store', 'warehouse'], { message: 'Inventory source must be either "in_store" or "warehouse"' })
    .default('in_store'),
  // Sale date (optional, defaults to today)
  sale_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Sale date must be in YYYY-MM-DD format' })
    .optional(),
  // Legacy gift field (text)
  gift: z
    .string()
    .max(200, { message: 'Gift description must not exceed 200 characters' })
    .optional()
    .nullable(),
  // New gift_details JSONB field (Requirements: 8.5, 8.9)
  gift_details: z
    .array(GiftItemSchema)
    .optional()
    .default([]),
  // Customer info (Requirements: 8.4, 8.11)
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
}).refine(
  (data) => data.discount <= data.price * data.quantity,
  {
    message: 'Discount cannot exceed total price',
    path: ['discount'],
  }
);

export type SaleInput = z.infer<typeof SaleInputSchema>;

/**
 * Sales Filter Schema
 * Validates filters for sales queries
 */
export const SalesFilterSchema = z.object({
  store_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export type SalesFilter = z.infer<typeof SalesFilterSchema>;
