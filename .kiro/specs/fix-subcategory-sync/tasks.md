# Implementation Plan: Fix Sub-Category Synchronization

## Overview

This implementation plan addresses the data inconsistency issue where sub-category values in the database don't match the dropdown options. The fix involves creating a database migration to standardize all sub-category values and updating the seed data to prevent future inconsistencies.

## Tasks

- [x] 1. Create database migration script
  - Create file `supabase/migrations/XXX_standardize_subcategory_values.sql`
  - Add UPDATE statement to change "Wet And Dry Vacuum" to "Wet & Dry"
  - Add UPDATE statement to change "Mite Remover" to "Mite Removal"
  - Add UPDATE statement to change "Small Appliance" to "Small Appliances"
  - Add UPDATE statement to change "Air Purifier" to "Purifier"
  - Add logging block to report number of products updated
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 1.1 Write pre-migration data audit query
  - Query to list all distinct sub_category values
  - Query to count products per sub_category
  - Save results for comparison after migration
  - _Requirements: 5.5_

- [x] 2. Update seed data file
  - Open `supabase/seed-data/products-seed.sql`
  - Replace all instances of "Wet And Dry Vacuum" with "Wet & Dry"
  - Replace all instances of "Mite Remover" with "Mite Removal"
  - Replace all instances of "Small Appliance" with "Small Appliances"
  - Replace all instances of "Air Purifier" with "Purifier"
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Test migration on development database
  - [x] 3.1 Run pre-migration audit query
    - Document current sub_category values
    - Count products that will be affected
    - _Requirements: 2.6_

  - [x] 3.2 Run migration script
    - Execute migration on development database
    - Verify no errors occurred
    - Check migration logs
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify migration results
    - Run post-migration audit query
    - Verify all old values are gone
    - Verify new values are present
    - Verify product count unchanged
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 3.4 Test migration idempotence
  - Run migration script a second time
  - Verify 0 products updated
  - Verify database state unchanged
  - _Requirements: 2.5_

- [ ] 4. Write property test for value standardization
  - **Property 1: Value Standardization Completeness**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

- [ ] 5. Test sub-category filtering functionality
  - [ ] 5.1 Test "Wet & Dry" filter
    - Navigate to sales input page
    - Select "Wet & Dry" from dropdown
    - Verify products appear
    - Verify all products have sub_category = "Wet & Dry"
    - _Requirements: 3.1_

  - [ ] 5.2 Test "Mite Removal" filter
    - Select "Mite Removal" from dropdown
    - Verify products appear
    - Verify all products have sub_category = "Mite Removal"
    - _Requirements: 3.2_

  - [ ] 5.3 Test "Small Appliances" filter
    - Select "Small Appliances" from dropdown
    - Verify products appear
    - Verify all products have sub_category = "Small Appliances"
    - _Requirements: 3.3_

  - [ ] 5.4 Test "Purifier" filter
    - Select "Purifier" from dropdown
    - Verify products appear
    - Verify all products have sub_category = "Purifier"
    - _Requirements: 3.4_

  - [ ] 5.5 Test "Robovac" filter (unchanged)
    - Select "Robovac" from dropdown
    - Verify products appear (should still work)
    - _Requirements: 1.6_

- [ ] 5.6 Write property test for filtering correctness
  - **Property 2: Sub-Category Filtering Correctness**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [ ] 6. Checkpoint - Verify all tests pass on development
  - Ensure migration completed successfully
  - Ensure all filtering tests pass
  - Ensure property tests pass
  - Ask the user if questions arise

- [ ] 7. Deploy to production
  - [ ] 7.1 Create database backup
    - Verify backup is recent and complete
    - Document backup location and timestamp
    - _Requirements: 5.3_

  - [ ] 7.2 Run migration on production database
    - Execute migration script
    - Monitor for errors
    - Check migration logs
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 7.3 Verify production migration
    - Run post-migration audit query
    - Verify all values standardized
    - Verify product count unchanged
    - _Requirements: 5.5_

- [ ] 8. Test on production (Vercel deployment)
  - [ ] 8.1 Test "Wet & Dry" filter on production
    - Navigate to sales input page
    - Select "Wet & Dry"
    - Verify products appear
    - _Requirements: 3.1_

  - [ ] 8.2 Test other sub-category filters
    - Test "Mite Removal", "Small Appliances", "Purifier"
    - Verify all filters work correctly
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ] 8.3 Record a test sale
    - Select a product from filtered list
    - Record a sale
    - Verify sale recorded successfully
    - _Requirements: 3.5_

- [ ] 9. Optional: Add validation for future data entry
  - Update `src/lib/validations/master-data.ts`
  - Add enum validation for sub_category field
  - Ensure only standardized values can be entered
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 10. Final checkpoint - Confirm fix is working
  - Verify all sub-category filters work on production
  - Verify sales can be recorded for all sub-categories
  - Monitor error logs for any issues
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive testing and validation
- Migration is a data-only change (no schema modifications)
- Migration affects approximately 20 products
- Changes can be deployed with zero downtime
- Rollback script is available if needed
- Seed data update prevents future inconsistencies
