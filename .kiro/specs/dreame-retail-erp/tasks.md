# Implementation Plan: Dreame Retail ERP v2.0 Refactoring

## Overview

This plan refactors the existing ERP system to support:
- Dynamic pricing model (Retail, Dealer, Channel JSONB)
- Organization hierarchy (Account > Store)
- Fiscal calendar-based reporting
- Four user roles with strict pricing visibility
- Dealer portal
- Internationalization (EN/ID)

## Priority Order
1. Database Schema Migration
2. Server-Side Price Filtering (Security)
3. Manager PO with Dynamic Pricing
4. Dealer Portal

## Tasks

- [x] 1. Database Schema Migration
  - [x] 1.1 Create migration file for new schema
    - Create `supabase/migrations/004_v2_refactor.sql`
    - Create `accounts` table with channel_type enum
    - Create `stores` table with account_id FK
    - Migrate data from `branches` to `stores` (create default account)
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Refactor products table for dynamic pricing
    - Add `price_retail` column (rename from `price`)
    - Add `price_buy` column
    - Add `channel_pricing` JSONB column
    - Add `sub_category` column
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.3 Create fiscal_calendar table
    - Create table with date, fiscal_week, fiscal_month, fiscal_year, quarter
    - Create seed data for 2024-2026 (Monday-Sunday weeks)
    - Create indexes for efficient querying
    - _Requirements: 4.1, 4.3_

  - [x] 1.4 Create new supporting tables
    - Create `credit_notes` table for dealer rebates
    - Create `training_materials` table
    - Create `expenses` table
    - _Requirements: 9.5, 10.1_

  - [x] 1.5 Update profiles table
    - Add 'dealer' to role enum
    - Rename `branch_id` to `store_id`
    - Update FK to reference stores
    - _Requirements: 1.2_

  - [x] 1.6 Update sales table
    - Rename `branch_id` to `store_id`
    - Rename `price` to `unit_price`, `final_price` to `total_price`
    - Add `gift_details` JSONB column
    - Add `customer_name`, `customer_phone` columns
    - _Requirements: 8.9, 8.11_

  - [x] 1.7 Update purchase_orders table
    - Add `account_id` FK
    - Add `store_id` FK (optional)
    - Add `price_source` column
    - _Requirements: 7.1, 7.3_

  - [x] 1.8 Update RLS policies for new schema
    - Update helper functions for store_id
    - Update all policies to use stores instead of branches
    - Add dealer-specific policies
    - _Requirements: 1.6, 1.7_


- [-] 2. Server-Side Price Filtering (Security Critical)
  - [x] 2.1 Create price filtering utility
    - Create `src/lib/price-filter.ts`
    - Implement `filterProductsByRole()` function
    - Staff: return only price_retail
    - Dealer: return only price_buy
    - Manager/Admin: return all prices
    - _Requirements: 1.3, 1.4, 1.5, 16.3, 16.4_

  - [x] 2.2 Update product server actions
    - Update `getProducts()` to apply price filtering
    - Ensure filtering happens server-side, not client
    - Add role parameter from JWT
    - _Requirements: 16.5_

  - [x] 2.3 Write property test for price visibility
    - **Property 1: Role-Based Pricing Visibility**
    - Test Staff cannot see price_buy
    - Test Dealer cannot see price_retail
    - **Validates: Requirements 1.3, 1.4, 1.5**

- [-] 3. TypeScript Types Update
  - [x] 3.1 Update type definitions
    - Update `src/types/index.ts` with new interfaces
    - Add Account, Store, FiscalCalendar types
    - Add StaffProduct, DealerProduct filtered types
    - Add GiftItem, CreditNote types
    - _Requirements: All_

  - [x] 3.2 Update validation schemas
    - Update sales schema for gift_details
    - Update PO schema for price_source
    - Add account/store validation schemas
    - _Requirements: 8.5, 7.3_

- [-] 4. Fiscal Calendar Implementation
  - [x] 4.1 Create fiscal calendar utilities
    - Create `src/lib/fiscal-calendar.ts`
    - Implement `getCurrentFiscalPeriod()`
    - Implement `getFiscalMonthDays()`
    - Implement `getFiscalDaysElapsed()`
    - Implement `calculateFiscalRunRate()`
    - _Requirements: 4.2, 4.4_

  - [x] 4.2 Update dashboard calculations
    - Update run rate to use fiscal calendar
    - Update weekly grouping to use fiscal_week
    - Update monthly grouping to use fiscal_month
    - _Requirements: 5.2, 14.2_

  - [x] 4.3 Write property test for fiscal run rate
    - **Property 4: Fiscal Run Rate Calculation**
    - **Validates: Requirements 4.4, 5.2**

- [x] 5. Organization Hierarchy (Account > Store)
  - [x] 5.1 Create account management page
    - Create `src/app/(dashboard)/master-data/accounts/page.tsx`
    - CRUD for accounts with channel_type
    - _Requirements: 17.3_

  - [x] 5.2 Refactor branches page to stores
    - Rename to `src/app/(dashboard)/master-data/stores/page.tsx`
    - Add account_id dropdown (parent selection)
    - Display "Account - Store" format
    - _Requirements: 2.3, 17.4_

  - [x] 5.3 Update all branch references to store
    - Update Sidebar menu items
    - Update all server actions
    - Update all page components
    - Update all type references
    - _Requirements: 2.4_

  - [x] 5.4 Add dashboard filtering by Account/Store
    - Add Account dropdown filter
    - Add Store dropdown (filtered by account)
    - Update all dashboard queries
    - _Requirements: 5.7, 14.6_

  - [x] 5.5 Write property test for hierarchy
    - **Property 7: Account-Store Hierarchy**
    - **Validates: Requirements 2.3, 2.5**


- [x] 6. Sales Input Refactoring (Staff)
  - [x] 6.1 Update sales input form
    - Auto-fill store from user's store_id
    - Show only price_retail (Price A)
    - Add customer_name, customer_phone fields
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 6.2 Implement gift selection
    - Add dynamic gift dropdown (multi-select)
    - Store as gift_details JSONB
    - Display selected gifts with qty
    - _Requirements: 8.5, 8.9_

  - [x] 6.3 Update inventory decrement logic
    - Decrement ONLY main sold item
    - DO NOT decrement gift items
    - _Requirements: 8.7, 8.8_

  - [x] 6.4 Write property test for gift inventory
    - **Property 5: Gift Inventory Invariant**
    - **Validates: Requirements 8.7, 8.8**

- [x] 7. Purchase Order with Dynamic Pricing (Manager)
  - [x] 7.1 Update PO form for account selection
    - Add Account dropdown
    - Add Store dropdown (filtered by account)
    - _Requirements: 7.1_

  - [x] 7.2 Implement price source selection
    - Add price_source dropdown: "Retail", "Dealer", or channel keys
    - Dynamically populate channel keys from account's channel_type
    - _Requirements: 7.2, 7.3_

  - [x] 7.3 Implement channel price lookup
    - When channel key selected, lookup from channel_pricing JSONB
    - Auto-populate line item prices
    - _Requirements: 7.4_

  - [x] 7.4 Write property test for channel pricing
    - **Property 6: Channel Price Lookup**
    - **Validates: Requirements 3.4, 3.5, 7.4**

- [x] 8. Dealer Portal
  - [x] 8.1 Create dealer layout
    - Create `src/app/(dealer)/layout.tsx`
    - Simplified sidebar for dealer
    - _Requirements: 9.1_

  - [x] 8.2 Create dealer dashboard
    - Create `src/app/(dealer)/dashboard/page.tsx`
    - Show Total Purchases (YTD)
    - Show Available Credit Note Balance
    - _Requirements: 9.4_

  - [x] 8.3 Create dealer PO page
    - Create `src/app/(dealer)/purchase-orders/new/page.tsx`
    - Auto-populate price_buy (Price B)
    - Hide other pricing
    - _Requirements: 9.2, 9.3_

  - [x] 8.4 Create credit notes page
    - Create `src/app/(dealer)/credit-notes/page.tsx`
    - List credit notes for current dealer
    - Show status, amount, expiry
    - _Requirements: 9.5, 9.6_

  - [x] 8.5 Update auth redirect for dealer role
    - Redirect dealers to /dealer/dashboard
    - Block dealers from main dashboard routes
    - _Requirements: 9.1_

  - [x] 8.6 Write property test for dealer isolation
    - **Property 3: Dealer Data Isolation**
    - **Validates: Requirements 1.7, 9.6**


- [-] 9. Internationalization (i18n)
  - [x] 9.1 Create i18n infrastructure
    - Create `src/lib/i18n/translations.ts`
    - Create `src/lib/i18n/context.tsx`
    - Add EN and ID translations
    - _Requirements: 11.1, 11.2_

  - [x] 9.2 Add language toggle to UI
    - Add toggle to Header component
    - Persist preference in localStorage
    - Default to Bahasa Indonesia
    - _Requirements: 11.1, 11.3, 11.4_

  - [x] 9.3 Update all UI components
    - Update Sidebar with translations
    - Update all page headers
    - Update all form labels
    - Update all button text
    - _Requirements: 11.2_

- [x] 10. Training Materials
  - [x] 10.1 Create training materials page
    - Create `src/app/(dashboard)/training/page.tsx`
    - List training materials from database
    - Open URL in new tab on click
    - _Requirements: 10.2, 10.3_

  - [x] 10.2 Add training to sidebar
    - Add "Training" / "Pelatihan" menu item
    - Use i18n for label
    - _Requirements: 10.1_

  - [x] 10.3 Create training materials management (Admin)
    - Add CRUD for training materials
    - Title and Google Drive URL fields
    - _Requirements: 10.1_

- [x] 11. Weekly Report with Fiscal Calendar
  - [x] 11.1 Update weekly report query
    - Join with fiscal_calendar table
    - Group by fiscal_week instead of SQL week
    - _Requirements: 15.1_

  - [x] 11.2 Update report columns
    - Add Account Name, Store Name
    - Add Customer Name, Customer Phone
    - Add Gift Details display
    - _Requirements: 15.2, 15.3_

  - [x] 11.3 Add fiscal week filter
    - Replace date range with fiscal_week selector
    - Show week number and date range
    - _Requirements: 15.4_

  - [x] 11.4 Write property test for fiscal weeks
    - **Property 8: Fiscal Calendar Week Boundaries**
    - **Validates: Requirements 4.2, 15.1**

 - [x] 12. Dashboard Updates
  - [x] 12.1 Update sales achievement page
    - Show Store Name and Account Name
    - Use fiscal calendar for run rate
    - Add Account/Store filters
    - _Requirements: 5.1, 5.7_

  - [x] 12.2 Update main dashboard
    - Group trends by fiscal_week/fiscal_month
    - Add Account/Store filter dropdowns
    - _Requirements: 14.2, 14.6_

  - [x] 12.3 Update inventory page
    - Rename branch to store
    - Update matrix display
    - _Requirements: 6.1_


- [x] 13. Profile Display Updates
  - [x] 13.1 Update user profile display
    - Show "Account - Store" format
    - Update Header component
    - Update Sidebar user info
    - _Requirements: 2.3_

  - [x] 13.2 Update JWT metadata sync
    - Include store_id and account_id in JWT
    - Update Edge Function
    - _Requirements: 1.2_

- [x] 14. Data Migration
  - [x] 14.1 Create data migration script
    - Migrate branches to stores with default account
    - Update all branch_id references to store_id
    - Migrate price to price_retail
    - Set default price_buy values
    - _Requirements: All_

  - [x] 14.2 Create fiscal calendar seed data
    - Generate 2024-2026 fiscal calendar
    - Monday-Sunday week boundaries
    - Import from CSV or generate programmatically
    - _Requirements: 4.6_

- [x] 15. Security Audit
  - [x] 15.1 Verify price filtering
    - Test Staff API returns only price_retail
    - Test Dealer API returns only price_buy
    - Test Manager API returns all prices
    - _Requirements: 16.3, 16.4, 16.5_

  - [x] 15.2 Verify data isolation
    - Test Staff sees only their store data
    - Test Dealer sees only their POs/credit notes
    - _Requirements: 1.6, 1.7_

  - [x] 15.3 Write property test for store isolation
    - **Property 2: Store-Based Data Isolation**
    - **Validates: Requirements 1.6**

- [x] 16. Final Testing
  - [x] 16.1 Test all user flows
    - Admin: full access to all features
    - Manager: all stores, all prices, PO creation
    - Staff: own store, retail price only, sales input
    - Dealer: dealer portal, dealer price only
    - _Requirements: All_

  - [x] 16.2 Test fiscal calendar integration
    - Verify run rate uses fiscal days
    - Verify weekly reports use fiscal weeks
    - _Requirements: 4.4, 15.1_

  - [x] 16.3 Test i18n
    - Toggle EN/ID and verify all labels change
    - Verify persistence across sessions
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 17. Password Reset and Recovery
  - [x] 17.1 Create password reset page
    - Create `src/app/(auth)/forgot-password/page.tsx`
    - Email input form with validation
    - Send reset email via Supabase Auth
    - _Requirements: 19.1, 19.2_

  - [x] 17.2 Create password reset confirmation page
    - Create `src/app/(auth)/reset-password/page.tsx`
    - Handle reset token from URL
    - New password form with validation
    - Password strength requirements
    - _Requirements: 19.3, 19.4, 19.5_

  - [x] 17.3 Update login page
    - Add "Forgot Password?" link
    - Add success message display for completed resets
    - _Requirements: 19.1, 19.5_

  - [x] 17.4 Add password validation schema
    - Update `src/lib/validations/auth.ts`
    - Minimum 8 characters, uppercase, lowercase, number
    - _Requirements: 19.4_

  - [x] 17.5 Add rate limiting and security
    - Implement client-side rate limiting
    - Add error handling for invalid/expired tokens
    - _Requirements: 19.6, 19.7_

  - [x] 17.6 Add i18n translations
    - Add password reset translations to EN/ID
    - Update translation files
    - _Requirements: 11.2_

  - [x] 17.7 Test password reset flow
    - Test email sending
    - Test token validation
    - Test password update
    - Test error scenarios
    - _Requirements: 19.1-19.8_

## Notes

- **CRITICAL**: Price filtering MUST be server-side, not just UI hiding
- All branch references must be updated to store
- Fiscal calendar must be populated before dashboard works
- Dealer portal is a separate route group with its own layout
- Gift items do NOT affect inventory - only sold items do
