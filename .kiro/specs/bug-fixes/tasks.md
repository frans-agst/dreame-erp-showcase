# Implementation Plan: Bug Fixes for Audit Log and Sales Achievement

## Overview

This plan fixes two critical bugs by adding a missing audit trigger and correcting column name mismatches in sales queries.

## Tasks

- [x] 1. Create migration file for missing audit trigger
  - Create `supabase/migrations/004_fix_audit_triggers.sql`
  - Add audit trigger for staff_stores table
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Fix sales achievement production caching issue
  - [x] 2.1 Add cache control directives to sales actions
    - Add `export const dynamic = 'force-dynamic'` to src/actions/sales.ts
    - Add `export const revalidate = 0` to src/actions/sales.ts
    - _Requirements: 2.6_
  
  - [x] 2.2 Add explicit ordering to prevent query caching
    - Add `.order('sale_date', { ascending: false })` to sales query
    - _Requirements: 2.1, 2.5_
  
  - [x] 2.3 Enhance logging for production debugging
    - Add comprehensive console.log statements
    - Add console.error for critical data points
    - Include JSON.stringify for complex objects
    - _Requirements: 2.7_
  
  - [x] 2.4 Verify data type consistency in aggregation
    - Ensure store_id is consistently typed (string)
    - Add explicit String() conversion if needed
    - Verify Number() conversion for prices
    - _Requirements: 2.2, 2.5_
  
  - [x]* 2.5 Create RPC function as fallback (if needed)
    - Create migration with get_sales_for_month function
    - Update getSalesAchievement to use RPC if direct query fails
    - _Requirements: 2.1, 2.2_

- [-] 3. Test and verify the fix
  - [x] 3.1 Deploy changes to production
    - Commit and push changes
    - Wait for Vercel deployment
    - _Requirements: 2.1, 2.6_
  
  - [ ] 3.2 Clear browser cache and test
    - Open incognito window
    - Navigate to sales achievement page
    - Verify non-zero values appear
    - _Requirements: 2.2, 2.3, 2.4_
  
  - [ ] 3.3 Check Vercel function logs
    - Access Vercel dashboard → Logs
    - Verify [getSalesAchievement] logs appear
    - Check for any errors
    - _Requirements: 2.7_
  
  - [ ] 3.4 Verify data consistency
    - Compare local vs production results
    - Verify all stores show correct sales amounts
    - Check calculations match expected values
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  
  - [ ] 3.5 Test with different months
    - Select different months in dropdown
    - Verify data updates correctly
    - Ensure no caching of previous results
    - _Requirements: 2.1, 2.5, 2.6_

## Notes

- All tasks must be completed in order
- Migration must be applied before code changes are deployed
- Test each component after making changes
- Monitor error logs after deployment
