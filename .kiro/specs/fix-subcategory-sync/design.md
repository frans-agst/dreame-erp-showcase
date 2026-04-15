# Design Document: Fix Sub-Category Synchronization

## Overview

This design addresses the data inconsistency issue where sub-category values in the product database do not match the dropdown options defined in the frontend code. The mismatch causes filtering to fail because the system uses exact string matching.

**Problem Examples:**
- Dropdown: "Wet & Dry" → Database: "Wet And Dry Vacuum" ❌
- Dropdown: "Mite Removal" → Database: "Mite Remover" ❌
- Dropdown: "Small Appliances" → Database: "Small Appliance" ❌
- Dropdown: "Purifier" → Database: "Air Purifier" ❌
- Dropdown: "Robovac" → Database: "Robovac" ✅ (works!)

The fix involves creating a database migration to standardize all sub-category values to match the dropdown definitions.

## Architecture

### Current State (Broken)

```
Frontend Dropdown (product-categories.ts)
├── "Wet & Dry"
├── "Mite Removal"
├── "Small Appliances"
└── "Purifier"
     ↓ (exact match filter)
     ✗ NO MATCH
     ↓
Database Values
├── "Wet And Dry Vacuum"
├── "Mite Remover"
├── "Small Appliance"
└── "Air Purifier"
```

### Target State (Fixed)

```
Frontend Dropdown (product-categories.ts)
├── "Wet & Dry"
├── "Mite Removal"
├── "Small Appliances"
└── "Purifier"
     ↓ (exact match filter)
     ✓ MATCH!
     ↓
Database Values (UPDATED)
├── "Wet & Dry"
├── "Mite Removal"
├── "Small Appliances"
└── "Purifier"
```

## Components and Interfaces

### 1. Database Migration Script

**Purpose:** Update all existing products to use standardized sub-category values

**Migration SQL:**
```sql
-- Migration: Standardize Sub-Category Values
-- File: supabase/migrations/XXX_standardize_subcategory_values.sql

-- Update "Wet And Dry Vacuum" to "Wet & Dry"
UPDATE public.products
SET sub_category = 'Wet & Dry',
    updated_at = NOW()
WHERE sub_category = 'Wet And Dry Vacuum';

-- Update "Mite Remover" to "Mite Removal"
UPDATE public.products
SET sub_category = 'Mite Removal',
    updated_at = NOW()
WHERE sub_category = 'Mite Remover';

-- Update "Small Appliance" to "Small Appliances"
UPDATE public.products
SET sub_category = 'Small Appliances',
    updated_at = NOW()
WHERE sub_category = 'Small Appliance';

-- Update "Air Purifier" to "Purifier"
UPDATE public.products
SET sub_category = 'Purifier',
    updated_at = NOW()
WHERE sub_category = 'Air Purifier';

-- Log results
DO $$
DECLARE
  wet_dry_count INTEGER;
  mite_count INTEGER;
  appliance_count INTEGER;
  purifier_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO wet_dry_count FROM public.products WHERE sub_category = 'Wet & Dry';
  SELECT COUNT(*) INTO mite_count FROM public.products WHERE sub_category = 'Mite Removal';
  SELECT COUNT(*) INTO appliance_count FROM public.products WHERE sub_category = 'Small Appliances';
  SELECT COUNT(*) INTO purifier_count FROM public.products WHERE sub_category = 'Purifier';
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - Wet & Dry products: %', wet_dry_count;
  RAISE NOTICE '  - Mite Removal products: %', mite_count;
  RAISE NOTICE '  - Small Appliances products: %', appliance_count;
  RAISE NOTICE '  - Purifier products: %', purifier_count;
END $$;
```

### 2. Product Categories Definition

**Current (Correct):**
```typescript
// src/lib/product-categories.ts
export const PRODUCT_SUB_CATEGORIES = [
  { value: 'Wet & Dry', label: 'Wet & Dry' },
  { value: 'Robovac', label: 'Robovac' },
  { value: 'Beauty', label: 'Beauty' },
  { value: 'Stick Vacuum', label: 'Stick Vacuum' },
  { value: 'Purifier', label: 'Purifier' },
  { value: 'Mite Removal', label: 'Mite Removal' },
  { value: 'Small Appliances', label: 'Small Appliances' },
  { value: 'Others', label: 'Others' },
] as const;
```

**No changes needed** - this is already correct!

### 3. Sales Input Page Filtering

**Current Code (Already Correct):**
```typescript
// src/app/(dashboard)/sales/input/page.tsx
const filteredProducts = selectedSubCategory
  ? products.filter(p => (p as unknown as { sub_category?: string }).sub_category === selectedSubCategory)
  : [];
```

**After Migration:**
This code will work correctly once database values match the dropdown values. The type casting is a separate issue that can be addressed later.

### 4. Seed Data Update

**Update seed data file** to use standardized values:
```sql
-- supabase/seed-data/products-seed.sql
-- Change all instances:
'Wet And Dry Vacuum' → 'Wet & Dry'
'Mite Remover' → 'Mite Removal'
'Small Appliance' → 'Small Appliances'
'Air Purifier' → 'Purifier'
```

## Data Models

### Sub-Category Value Mapping

| Old Value (Database) | New Value (Standardized) | Status |
|---------------------|-------------------------|---------|
| "Wet And Dry Vacuum" | "Wet & Dry" | ❌ Needs Update |
| "Mite Remover" | "Mite Removal" | ❌ Needs Update |
| "Small Appliance" | "Small Appliances" | ❌ Needs Update |
| "Air Purifier" | "Purifier" | ❌ Needs Update |
| "Robovac" | "Robovac" | ✅ Already Correct |
| "Beauty" | "Beauty" | ✅ Already Correct |
| "Stick Vacuum" | "Stick Vacuum" | ✅ Already Correct |
| "Steam Cleaner" | "Steam Cleaner" | ✅ Already Correct |
| "Others" | "Others" | ✅ Already Correct |
| "Accessory" | "Accessory" | ✅ Already Correct |

### Affected Products Count (from seed data analysis)

- **Wet And Dry Vacuum**: ~15 products need updating
- **Mite Remover**: ~3 products need updating
- **Small Appliance**: ~1 product needs updating
- **Air Purifier**: ~1 product needs updating

**Total**: Approximately 20 products will be updated by the migration.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Value Standardization Completeness

*For any* product in the database after migration, if the product has a sub_category value, it must be one of the standardized values from PRODUCT_SUB_CATEGORIES.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

### Property 2: Sub-Category Filtering Correctness

*For any* selected sub-category value from the dropdown, filtering the product list should return all and only products where `sub_category` exactly matches the selected value.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Migration Idempotence

*For any* number of times the migration is run, the final state of sub_category values should be identical to running it once.

**Validates: Requirements 2.5**

### Property 4: Data Preservation

*For any* product updated by the migration, all fields except `sub_category` and `updated_at` should remain unchanged.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

## Error Handling

### Migration Safety

**Pre-Migration Checks:**
- Verify database connection
- Count products that will be affected
- Create backup recommendation

**During Migration:**
- Use transactions to ensure atomicity
- Log each UPDATE operation
- Handle NULL values gracefully

**Post-Migration Validation:**
- Verify no products have old sub-category values
- Verify product count unchanged
- Verify all foreign keys intact

### Rollback Strategy

If issues arise during migration:
```sql
-- Rollback: Restore original values
UPDATE public.products
SET sub_category = 'Wet And Dry Vacuum',
    updated_at = NOW()
WHERE sub_category = 'Wet & Dry';

UPDATE public.products
SET sub_category = 'Mite Remover',
    updated_at = NOW()
WHERE sub_category = 'Mite Removal';

UPDATE public.products
SET sub_category = 'Small Appliance',
    updated_at = NOW()
WHERE sub_category = 'Small Appliances';

UPDATE public.products
SET sub_category = 'Air Purifier',
    updated_at = NOW()
WHERE sub_category = 'Purifier';
```

### Validation Errors

**Future Product Creation/Updates:**
- Validate sub_category against PRODUCT_SUB_CATEGORIES
- Return clear error message: "Invalid sub-category. Must be one of: Wet & Dry, Robovac, Beauty, ..."
- Allow NULL values for products without categories

## Testing Strategy

### Pre-Migration Tests

1. **Data Audit Test**
   - Query all distinct sub_category values
   - Count products per sub_category
   - Identify which values need updating

2. **Backup Verification**
   - Ensure database backup exists
   - Verify backup is recent and complete

### Migration Tests

1. **Dry Run Test**
   - Run migration on development/staging database first
   - Verify expected number of products updated
   - Check no unintended side effects

2. **Idempotence Test**
   - Run migration twice
   - Verify second run updates 0 products
   - Verify final state is identical

### Post-Migration Tests

1. **Data Integrity Tests**
   - Verify all "Wet And Dry Vacuum" → "Wet & Dry"
   - Verify all "Mite Remover" → "Mite Removal"
   - Verify all "Small Appliance" → "Small Appliances"
   - Verify all "Air Purifier" → "Purifier"
   - Verify product count unchanged
   - Verify no NULL values introduced

2. **Filtering Tests**
   - Test "Wet & Dry" filter returns correct products
   - Test "Mite Removal" filter returns correct products
   - Test "Small Appliances" filter returns correct products
   - Test "Purifier" filter returns correct products
   - Test "Robovac" filter still works (unchanged)

### Integration Tests

1. **Sales Input Page Test**
   - Load sales input page
   - Select "Wet & Dry" sub-category
   - Verify products appear in dropdown
   - Select a product
   - Record a sale
   - Verify sale recorded successfully

2. **End-to-End Test**
   - Navigate to sales input page
   - Test each sub-category filter
   - Verify all filters work correctly
   - Record sales for different sub-categories
   - Verify all sales recorded successfully

### Property-Based Tests

Property-based tests will be implemented using Vitest.

1. **Property Test: Value Standardization**
   - **Property 1: Value Standardization Completeness**
   - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

2. **Property Test: Filtering Correctness**
   - **Property 2: Sub-Category Filtering Correctness**
   - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Implementation Notes

### Files to Create/Modify

1. **Create Migration File**
   - `supabase/migrations/XXX_standardize_subcategory_values.sql`
   - Contains UPDATE statements to standardize values
   - Includes logging and validation

2. **Update Seed Data File**
   - `supabase/seed-data/products-seed.sql`
   - Replace all old sub-category values with standardized ones
   - Ensures future reseeds use correct values

3. **Optional: Add Validation**
   - `src/lib/validations/master-data.ts`
   - Add sub_category enum validation
   - Prevent future data entry with wrong values

### Deployment Considerations

**Pre-Deployment:**
- Test migration on staging database
- Verify backup exists
- Document rollback procedure

**Deployment Steps:**
1. Run migration on production database
2. Verify migration success (check logs)
3. Test sub-category filtering on production
4. Monitor for any errors

**Post-Deployment:**
- Verify all sub-category filters work
- Check sales input page functionality
- Monitor error logs for 24 hours

### Rollback Plan

If issues arise:
1. Run rollback SQL script (reverse the updates)
2. Restore from backup if necessary
3. Investigate root cause
4. Fix and re-test before retry

### Zero Downtime

- Migration can run while system is live
- UPDATE operations are fast (~20 products)
- No schema changes (only data updates)
- No application code changes required initially

## Dependencies

- PostgreSQL database (Supabase)
- SQL migration system (already in place)
- No new dependencies required

## Performance Considerations

- Migration affects ~20 products (very fast)
- UPDATE operations use indexed columns
- No performance degradation expected
- Filtering performance unchanged (still exact match)
- No additional database queries needed
