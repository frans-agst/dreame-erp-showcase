/**
 * Price filtering utilities for role-based access control
 * These are pure utility functions - NOT server actions
 */

import { UserRole } from '@/types';

/**
 * Product with all pricing fields (full access)
 */
export interface FullProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  price_retail: number;
  price_buy: number;
  channel_pricing: Record<string, number>;
  is_active: boolean;
}

/**
 * Product filtered for Staff role - ONLY brandstore price visible
 */
export interface StaffProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  price: number; // This is channel_pricing.brandstore
  is_active: boolean;
}

/**
 * Product filtered for Dealer role - ONLY retailer price visible
 */
export interface DealerProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  price: number; // This is channel_pricing.retailer
  is_active: boolean;
}

export type FilteredProduct = StaffProduct | DealerProduct | FullProduct;

/**
 * SECURITY CRITICAL: Filter product pricing based on user role
 * 
 * - Staff: Can ONLY see channel_pricing.brandstore (Brandstore price)
 * - Dealer: Can ONLY see channel_pricing.retailer (Retailer price)
 * - Manager/Admin: Can see ALL pricing (all channel prices)
 * 
 * This filtering MUST happen server-side to prevent data leakage.
 */
export function filterProductsByRole(
  products: FullProduct[],
  role: UserRole
): FilteredProduct[] {
  switch (role) {
    case 'staff':
      // Staff sees ONLY brandstore price
      return products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        sub_category: p.sub_category,
        price: p.channel_pricing?.brandstore || 0, // Map brandstore to generic 'price' field
        is_active: p.is_active,
        // All other prices: REMOVED
      })) as StaffProduct[];

    case 'dealer':
      // Dealer sees ONLY retailer price
      return products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        sub_category: p.sub_category,
        price: p.channel_pricing?.retailer || 0, // Map retailer to generic 'price' field
        is_active: p.is_active,
        // All other prices: REMOVED
      })) as DealerProduct[];

    case 'admin':
    case 'manager':
      // Full access to all pricing
      return products;

    default:
      // Unknown role - return empty for safety
      console.warn(`Unknown role "${role}" - returning empty product list`);
      return [];
  }
}

/**
 * Filter a single product by role
 */
export function filterProductByRole(
  product: FullProduct,
  role: UserRole
): FilteredProduct | null {
  const filtered = filterProductsByRole([product], role);
  return filtered[0] || null;
}

/**
 * Get the appropriate price for a product based on role and optional channel key
 * 
 * @param product - The full product with all pricing
 * @param role - User role
 * @param channelKey - Optional channel key for channel-specific pricing (manager only)
 */
export function getProductPrice(
  product: FullProduct,
  role: UserRole,
  channelKey?: string
): number {
  switch (role) {
    case 'staff':
      return product.channel_pricing?.brandstore || 0;

    case 'dealer':
      return product.channel_pricing?.retailer || 0;

    case 'admin':
    case 'manager':
      // Manager can select specific channel pricing
      if (channelKey && product.channel_pricing?.[channelKey]) {
        return product.channel_pricing[channelKey];
      }
      // Default to retailer price for POs
      return product.channel_pricing?.retailer || 0;

    default:
      return 0;
  }
}

/**
 * Get available price sources for a role
 * Used in PO creation to show available pricing options
 */
export function getAvailablePriceSources(
  product: FullProduct,
  role: UserRole
): { key: string; label: string; price: number }[] {
  if (role !== 'admin' && role !== 'manager') {
    // Non-managers only see their default price
    return [];
  }

  const sources: { key: string; label: string; price: number }[] = [];

  // Add channel-specific prices
  if (product.channel_pricing) {
    const channelLabels: Record<string, string> = {
      brandstore: 'Brandstore (Staff)',
      retailer: 'Retailer (Dealer & Hangon)',
      modern_channel_1: 'Modern Channel 1 (Best Yamada)',
      modern_channel_2: 'Modern Channel 2 (Electronic City)',
      modern_channel_3: 'Modern Channel 3 (Atria & Hartono)',
    };
    
    Object.entries(product.channel_pricing).forEach(([key, price]) => {
      sources.push({
        key,
        label: channelLabels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        price: price as number,
      });
    });
  }

  return sources;
}
