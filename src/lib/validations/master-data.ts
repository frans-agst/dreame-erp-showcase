// src/lib/validations/master-data.ts
import { z } from 'zod';

/**
 * Channel Pricing Schema
 * Validates dynamic channel pricing JSONB
 * Requirements: 3.3, 3.4
 */
export const ChannelPricingSchema = z.record(
  z.string(),
  z.number().nonnegative({ message: 'Channel price must be non-negative' })
).optional().default({});

/**
 * Product Schema
 * Validates product master data with dynamic pricing
 * Requirements: 11.2, 10.1, 3.1, 3.2, 3.3
 */
export const ProductSchema = z.object({
  sku: z
    .string()
    .min(1, { message: 'SKU is required' })
    .regex(/^[a-zA-Z0-9-_]+$/, { message: 'SKU must be alphanumeric (letters, numbers, hyphens, underscores only)' }),
  name: z
    .string()
    .min(1, { message: 'Product name is required' })
    .max(200, { message: 'Product name must not exceed 200 characters' }),
  // Legacy price field (for backward compatibility)
  price: z
    .number({ message: 'Price must be a number' })
    .nonnegative({ message: 'Price must be non-negative' })
    .optional()
    .nullable(),
  // New pricing fields
  price_retail: z
    .number({ message: 'Retail price must be a number' })
    .nonnegative({ message: 'Retail price must be non-negative' })
    .optional()
    .nullable(),
  price_buy: z
    .number({ message: 'Buy price must be a number' })
    .nonnegative({ message: 'Buy price must be non-negative' })
    .optional()
    .nullable(),
  channel_pricing: z.record(
    z.string(),
    z.number().nonnegative({ message: 'Channel price must be non-negative' })
  ).optional().nullable(),
  category: z
    .string()
    .max(100, { message: 'Category must not exceed 100 characters' })
    .optional()
    .nullable(),
  sub_category: z
    .string()
    .max(100, { message: 'Sub-category must not exceed 100 characters' })
    .optional()
    .nullable(),
});

export type ProductInput = z.infer<typeof ProductSchema>;

/**
 * Account Schema
 * Validates account (parent organization) master data
 * Requirements: 2.1, 2.2
 */
export const AccountSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Account name is required' })
    .max(200, { message: 'Account name must not exceed 200 characters' }),
  channel_type: z.enum(['Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon'], {
    message: 'Channel type must be Brandstore, Modern Channel, Retailer, Dealer, or Hangon',
  }),
  is_active: z.boolean().optional().default(true),
});

export type AccountInput = z.infer<typeof AccountSchema>;

/**
 * Store Schema
 * Validates store master data
 * Requirements: 2.2, 2.3
 */
export const StoreSchema = z.object({
  account_id: z
    .string()
    .uuid({ message: 'Account ID must be a valid UUID' }),
  name: z
    .string()
    .min(1, { message: 'Store name is required' })
    .max(200, { message: 'Store name must not exceed 200 characters' }),
  region: z
    .string()
    .max(100, { message: 'Region must not exceed 100 characters' })
    .optional()
    .nullable(),
  monthly_target: z
    .number({ message: 'Monthly target must be a number' })
    .nonnegative({ message: 'Monthly target cannot be negative' })
    .default(0),
  is_active: z.boolean().optional().default(true),
});

export type StoreInput = z.infer<typeof StoreSchema>;

/**
 * Branch Schema (Legacy - kept for backward compatibility with existing data)
 * @deprecated Use StoreSchema instead
 */
export const BranchSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Branch name is required' })
    .max(200, { message: 'Branch name must not exceed 200 characters' }),
  account: z
    .string()
    .max(100, { message: 'Account must not exceed 100 characters' })
    .optional()
    .nullable(),
  province: z
    .string()
    .max(100, { message: 'Province must not exceed 100 characters' })
    .optional()
    .nullable(),
  monthly_target: z
    .number({ message: 'Monthly target must be a number' })
    .nonnegative({ message: 'Monthly target cannot be negative' })
    .default(0),
});

export type BranchInput = z.infer<typeof BranchSchema>;

/**
 * Staff Schema
 * Validates staff master data with dealer role
 * Requirements: 11.3, 10.1, 1.2
 */
export const StaffSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Email must be a valid email address' }),
  full_name: z
    .string()
    .min(1, { message: 'Full name is required' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  role: z.enum(['admin', 'manager', 'staff', 'dealer'], {
    message: 'Role must be admin, manager, staff, or dealer',
  }),
  store_id: z
    .string()
    .uuid({ message: 'Store ID must be a valid UUID' })
    .nullable()
    .optional(),
}).refine(
  (data) => {
    // Staff and managers must have a store_id
    if ((data.role === 'staff' || data.role === 'manager') && !data.store_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Staff and managers must be assigned to a store',
    path: ['store_id'],
  }
);

export type StaffInput = z.infer<typeof StaffSchema>;

/**
 * Staff Update Schema
 * Validates staff updates (without email change)
 * Requirements: 11.3, 10.1
 */
export const StaffUpdateSchema = z.object({
  full_name: z
    .string()
    .min(1, { message: 'Full name is required' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  role: z.enum(['admin', 'manager', 'staff', 'dealer'], {
    message: 'Role must be admin, manager, staff, or dealer',
  }),
  store_id: z
    .string()
    .uuid({ message: 'Store ID must be a valid UUID' })
    .nullable()
    .optional(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => {
    // Staff and managers must have a store_id
    if ((data.role === 'staff' || data.role === 'manager') && !data.store_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Staff and managers must be assigned to a store',
    path: ['store_id'],
  }
);

export type StaffUpdateInput = z.infer<typeof StaffUpdateSchema>;
