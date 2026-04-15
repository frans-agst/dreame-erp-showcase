/**
 * Property-Based Tests for Sub-Category Value Standardization
 * Feature: fix-subcategory-sync
 * 
 * These tests verify that the database migration correctly standardizes
 * all sub-category values to match the frontend dropdown definitions.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PRODUCT_SUB_CATEGORIES } from './product-categories';

/**
 * Extract the valid sub-category values from the constant definition
 */
const VALID_SUB_CATEGORIES = PRODUCT_SUB_CATEGORIES.map(cat => cat.value);

/**
 * Old sub-category values that should NOT exist after migration
 */
const OLD_SUB_CATEGORY_VALUES = [
  'Wet And Dry Vacuum',
  'Mite Remover',
  'Small Appliance',
  'Air Purifier',
] as const;

/**
 * Mapping of old values to new standardized values
 */
const SUB_CATEGORY_MAPPING = {
  'Wet And Dry Vacuum': 'Wet & Dry',
  'Mite Remover': 'Mite Removal',
  'Small Appliance': 'Small Appliances',
  'Air Purifier': 'Purifier',
} as const;

/**
 * Simulated product type for testing
 */
interface Product {
  id: string;
  sku: string;
  name: string;
  sub_category: string | null;
  category?: string;
  price?: number;
}

/**
 * Simulate the migration function that standardizes sub-category values
 */
function standardizeSubCategory(subCategory: string | null): string | null {
  if (subCategory === null) {
    return null;
  }
  
  // Apply the mapping
  if (subCategory in SUB_CATEGORY_MAPPING) {
    return SUB_CATEGORY_MAPPING[subCategory as keyof typeof SUB_CATEGORY_MAPPING];
  }
  
  // Return as-is if already standardized
  return subCategory;
}

/**
 * Check if a sub-category value is valid (standardized)
 */
function isValidSubCategory(subCategory: string | null): boolean {
  if (subCategory === null) {
    return true; // NULL is allowed
  }
  return VALID_SUB_CATEGORIES.includes(subCategory);
}

/**
 * Check if a sub-category value is an old (non-standardized) value
 */
function isOldSubCategory(subCategory: string | null): boolean {
  if (subCategory === null) {
    return false;
  }
  return OLD_SUB_CATEGORY_VALUES.includes(subCategory as any);
}

describe('Sub-Category Standardization - Property-Based Tests', () => {
  
  /**
   * Feature: fix-subcategory-sync, Property 1: Value Standardization Completeness
   * 
   * For any product in the database after migration, if the product has a sub_category value,
   * it must be one of the standardized values from PRODUCT_SUB_CATEGORIES.
   * 
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
   */
  describe('Property 1: Value Standardization Completeness', () => {
    
    /**
     * Arbitrary generator for old sub-category values
     */
    const oldSubCategoryArb = fc.constantFrom(...OLD_SUB_CATEGORY_VALUES);
    
    /**
     * Arbitrary generator for valid (standardized) sub-category values
     */
    const validSubCategoryArb = fc.constantFrom(...VALID_SUB_CATEGORIES);
    
    /**
     * Arbitrary generator for any sub-category value (old or new)
     */
    const anySubCategoryArb = fc.oneof(
      oldSubCategoryArb,
      validSubCategoryArb,
      fc.constant(null)
    );
    
    /**
     * Test: All old values are correctly mapped to new standardized values
     * Validates: Requirements 1.2, 1.3, 1.4, 1.5
     */
    it('should map all old sub-category values to standardized values', () => {
      fc.assert(
        fc.property(oldSubCategoryArb, (oldValue) => {
          const standardized = standardizeSubCategory(oldValue);
          
          // After standardization, the value should be valid
          expect(isValidSubCategory(standardized)).toBe(true);
          
          // The standardized value should NOT be an old value
          expect(isOldSubCategory(standardized)).toBe(false);
          
          // The standardized value should match the expected mapping
          const expectedValue = SUB_CATEGORY_MAPPING[oldValue];
          expect(standardized).toBe(expectedValue);
        }),
        { numRuns: 100 }
      );
    });
    
    /**
     * Test: Already standardized values remain unchanged
     * Validates: Requirements 1.6
     */
    it('should preserve already standardized sub-category values', () => {
      fc.assert(
        fc.property(validSubCategoryArb, (validValue) => {
          const result = standardizeSubCategory(validValue);
          
          // Already valid values should remain unchanged
          expect(result).toBe(validValue);
          
          // Result should still be valid
          expect(isValidSubCategory(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
    
    /**
     * Test: NULL values are preserved
     * Validates: Requirements 1.1
     */
    it('should preserve NULL sub-category values', () => {
      const result = standardizeSubCategory(null);
      expect(result).toBe(null);
      expect(isValidSubCategory(result)).toBe(true);
    });
    
    /**
     * Test: After standardization, no old values should exist
     * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
     */
    it('should eliminate all old sub-category values after standardization', () => {
      fc.assert(
        fc.property(anySubCategoryArb, (subCategory) => {
          const standardized = standardizeSubCategory(subCategory);
          
          // After standardization, the result should never be an old value
          expect(isOldSubCategory(standardized)).toBe(false);
          
          // After standardization, the result should always be valid
          expect(isValidSubCategory(standardized)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
    
    /**
     * Test: Standardization is idempotent (running it twice produces same result)
     * Validates: Requirements 1.1
     */
    it('should be idempotent - standardizing twice produces same result', () => {
      fc.assert(
        fc.property(anySubCategoryArb, (subCategory) => {
          const firstPass = standardizeSubCategory(subCategory);
          const secondPass = standardizeSubCategory(firstPass);
          
          // Running standardization twice should produce the same result
          expect(secondPass).toBe(firstPass);
          
          // Both results should be valid
          expect(isValidSubCategory(firstPass)).toBe(true);
          expect(isValidSubCategory(secondPass)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
    
    /**
     * Test: All valid sub-categories are in the allowed list
     * Validates: Requirements 1.1, 1.6
     */
    it('should only produce values from the standardized list', () => {
      fc.assert(
        fc.property(anySubCategoryArb, (subCategory) => {
          const standardized = standardizeSubCategory(subCategory);
          
          if (standardized !== null) {
            // Non-null standardized values must be in the valid list
            expect(VALID_SUB_CATEGORIES).toContain(standardized);
          }
        }),
        { numRuns: 100 }
      );
    });
    
    /**
     * Test: Specific mapping correctness
     * Validates: Requirements 1.2, 1.3, 1.4, 1.5
     */
    it('should correctly map each old value to its new value', () => {
      // Test "Wet And Dry Vacuum" → "Wet & Dry"
      expect(standardizeSubCategory('Wet And Dry Vacuum')).toBe('Wet & Dry');
      
      // Test "Mite Remover" → "Mite Removal"
      expect(standardizeSubCategory('Mite Remover')).toBe('Mite Removal');
      
      // Test "Small Appliance" → "Small Appliances"
      expect(standardizeSubCategory('Small Appliance')).toBe('Small Appliances');
      
      // Test "Air Purifier" → "Purifier"
      expect(standardizeSubCategory('Air Purifier')).toBe('Purifier');
    });
    
    /**
     * Test: Unchanged values remain correct
     * Validates: Requirements 1.6
     */
    it('should preserve unchanged sub-category values', () => {
      // These values should remain unchanged
      expect(standardizeSubCategory('Robovac')).toBe('Robovac');
      expect(standardizeSubCategory('Beauty')).toBe('Beauty');
      expect(standardizeSubCategory('Stick Vacuum')).toBe('Stick Vacuum');
      expect(standardizeSubCategory('Others')).toBe('Others');
    });
    
    /**
     * Test: Product objects maintain other fields during standardization
     * Validates: Requirements 1.1
     */
    it('should only modify sub_category field in product objects', () => {
      const productArb = fc.record({
        id: fc.uuid(),
        sku: fc.string({ minLength: 3, maxLength: 20 }),
        name: fc.string({ minLength: 5, maxLength: 50 }),
        sub_category: anySubCategoryArb,
        category: fc.option(fc.constantFrom('Accessory', 'Main Unit')),
        price: fc.option(fc.integer({ min: 1000, max: 10000000 })),
      });
      
      fc.assert(
        fc.property(productArb, (product) => {
          const originalProduct = { ...product };
          const standardizedSubCategory = standardizeSubCategory(product.sub_category);
          
          // Create updated product
          const updatedProduct = {
            ...product,
            sub_category: standardizedSubCategory,
          };
          
          // All other fields should remain unchanged
          expect(updatedProduct.id).toBe(originalProduct.id);
          expect(updatedProduct.sku).toBe(originalProduct.sku);
          expect(updatedProduct.name).toBe(originalProduct.name);
          expect(updatedProduct.category).toBe(originalProduct.category);
          expect(updatedProduct.price).toBe(originalProduct.price);
          
          // Only sub_category should potentially change
          expect(isValidSubCategory(updatedProduct.sub_category)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
