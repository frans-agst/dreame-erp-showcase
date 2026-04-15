// src/lib/validations/stock-opname.ts
import { z } from 'zod';

/**
 * Stock Opname Item Schema
 * Validates individual stock count entries
 * Requirements: 7.1, 7.2, 10.1
 */
export const StockOpnameItemSchema = z.object({
  product_id: z
    .string()
    .min(1, { message: 'Product is required' })
    .uuid({ message: 'Product ID must be a valid UUID' }),
  counted_qty: z
    .number({ message: 'Counted quantity must be a number' })
    .int({ message: 'Counted quantity must be a whole number' })
    .nonnegative({ message: 'Counted quantity cannot be negative' }),
});

export type StockOpnameItemInput = z.infer<typeof StockOpnameItemSchema>;

/**
 * Stock Opname Submission Schema
 * Validates complete stock opname submission
 * Requirements: 7.3, 7.4, 10.1
 */
export const StockOpnameSubmissionSchema = z.object({
  store_id: z
    .string()
    .min(1, { message: 'Store is required' })
    .uuid({ message: 'Store ID must be a valid UUID' }),
  items: z
    .array(StockOpnameItemSchema)
    .min(1, { message: 'At least one item count is required' }),
});

export type StockOpnameSubmissionInput = z.infer<typeof StockOpnameSubmissionSchema>;
