# Requirements Document

## Introduction

This specification addresses a critical data inconsistency issue where the sub-category values defined in the frontend dropdown (`src/lib/product-categories.ts`) do not match the actual sub-category values stored in the database. This causes the sub-category filtering feature in the sales input page to fail, preventing users from filtering products by sub-categories like "Wet & Dry", "Robovac", etc.

**Root Cause:** The dropdown shows "Wet & Dry" but products in the database have "Wet And Dry Vacuum", causing the exact match filter to fail.

## Glossary

- **Product Categories Definition**: The constant array in `src/lib/product-categories.ts` that defines dropdown options
- **Database Sub-Category Values**: The actual `sub_category` values stored in the products table
- **Sub-Category**: A product classification field that categorizes products (e.g., "Wet And Dry Vacuum", "Robovac", "Beauty")
- **Sales Input Page**: The UI page at `/sales/input` where staff record product sales
- **Exact Match Filtering**: The current filtering logic that requires exact string equality between dropdown value and database value

## Requirements

### Requirement 1: Sub-Category Value Standardization

**User Story:** As a system administrator, I want the sub-category values in the database to match the dropdown options, so that filtering works correctly.

#### Acceptance Criteria

1. THE System SHALL use consistent sub-category values between the dropdown definition and database
2. WHEN a product has sub_category "Wet And Dry Vacuum", THE System SHALL update it to "Wet & Dry"
3. WHEN a product has sub_category "Mite Remover", THE System SHALL update it to "Mite Removal"
4. WHEN a product has sub_category "Small Appliance", THE System SHALL update it to "Small Appliances"
5. WHEN a product has sub_category "Air Purifier", THE System SHALL update it to "Purifier"
6. THE System SHALL preserve "Robovac", "Beauty", "Stick Vacuum", "Steam Cleaner", and "Others" values unchanged

### Requirement 2: Database Migration

**User Story:** As a developer, I want a safe database migration script to update existing sub-category values, so that all products use the standardized naming.

#### Acceptance Criteria

1. THE Migration SHALL update all products with sub_category "Wet And Dry Vacuum" to "Wet & Dry"
2. THE Migration SHALL update all products with sub_category "Mite Remover" to "Mite Removal"
3. THE Migration SHALL update all products with sub_category "Small Appliance" to "Small Appliances"
4. THE Migration SHALL update all products with sub_category "Air Purifier" to "Purifier"
5. THE Migration SHALL be idempotent (safe to run multiple times)
6. THE Migration SHALL log the number of products updated for each category

### Requirement 3: Sub-Category Filtering

**User Story:** As a staff member, I want to select a sub-category and see only products in that sub-category, so that I can efficiently find and record sales for specific product types.

#### Acceptance Criteria

1. WHEN a user selects "Wet & Dry" sub-category, THE System SHALL display all products with `sub_category = 'Wet & Dry'`
2. WHEN a user selects "Mite Removal" sub-category, THE System SHALL display all products with `sub_category = 'Mite Removal'`
3. WHEN a user selects "Small Appliances" sub-category, THE System SHALL display all products with `sub_category = 'Small Appliances'`
4. WHEN a user selects "Purifier" sub-category, THE System SHALL display all products with `sub_category = 'Purifier'`
5. WHEN a user changes the selected sub-category, THE System SHALL reset the product selection and update the filtered product list
6. WHEN no sub-category is selected, THE System SHALL disable the product dropdown

### Requirement 4: Data Validation

**User Story:** As a developer, I want to validate that all products use standardized sub-category values, so that future data entry maintains consistency.

#### Acceptance Criteria

1. WHEN creating a new product, THE System SHALL only accept sub-category values from the standardized list
2. WHEN updating a product, THE System SHALL only accept sub-category values from the standardized list
3. THE System SHALL provide clear error messages when invalid sub-category values are submitted
4. THE System SHALL allow NULL sub-category values for products without a category

### Requirement 5: Backward Compatibility

**User Story:** As a system administrator, I want the migration to preserve all product data except sub-category values, so that no sales history or other data is lost.

#### Acceptance Criteria

1. THE Migration SHALL only update the `sub_category` field
2. THE Migration SHALL not modify any other product fields (sku, name, price, etc.)
3. THE Migration SHALL not delete any products
4. THE Migration SHALL maintain all foreign key relationships
5. WHEN the migration completes, THE System SHALL have the same number of products as before
