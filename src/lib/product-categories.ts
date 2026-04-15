/**
 * Product Categories and Sub-Categories
 * Fixed dropdown options for product classification
 */

export const PRODUCT_CATEGORIES = [
  { value: 'Accessory', label: 'Accessory' },
  { value: 'Main Unit', label: 'Main Unit' },
] as const;

export const PRODUCT_SUB_CATEGORIES = [
  // Vacuum cleaners
  { value: 'Wet & Dry', label: 'Wet & Dry' },
  { value: 'Stick Vacuum', label: 'Stick Vacuum' },
  { value: 'Robovac', label: 'Robovac' },
  { value: 'Mite Removal', label: 'Mite Removal' },
  // Cleaners
  { value: 'Steam Cleaner', label: 'Steam Cleaner' },
  // Air quality
  { value: 'Purifier', label: 'Purifier' },
  // Personal care
  { value: 'Beauty', label: 'Beauty' },
  // Other products
  { value: 'Small Appliances', label: 'Small Appliances' },
  { value: 'Accessory', label: 'Accessory' },
] as const;

/**
 * Price Channels for Products
 * 5 types of prices that can be set per product
 */
export const PRICE_CHANNELS = [
  { key: 'brandstore', label: 'Brandstore', description: 'For Staff' },
  { key: 'retailer', label: 'Retailer', description: 'For Dealer & Hangon' },
  { key: 'modern_channel_1', label: 'Modern Channel 1', description: 'For Best Yamada' },
  { key: 'modern_channel_2', label: 'Modern Channel 2', description: 'For Electronic City' },
  { key: 'modern_channel_3', label: 'Modern Channel 3', description: 'For Atria & Hartono' },
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number]['value'];
export type ProductSubCategory = typeof PRODUCT_SUB_CATEGORIES[number]['value'];
export type PriceChannelKey = typeof PRICE_CHANNELS[number]['key'];
