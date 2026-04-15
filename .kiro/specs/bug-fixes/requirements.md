# Requirements Document: Bug Fixes for Audit Log and Sales Achievement

## Introduction

This document outlines the requirements for fixing two critical bugs in the Dreame Retail ERP system:
1. Audit log not capturing recent data changes
2. Sales achievement showing 0 despite having sales data

## Glossary

- **Audit_Log**: System table that tracks all data changes (INSERT, UPDATE, DELETE operations)
- **Sales_Achievement**: Dashboard feature showing store performance against monthly targets
- **Database_Trigger**: Automated database function that executes when specific events occur
- **Staff_Stores**: Table managing the many-to-many relationship between staff and stores
- **Transaction_Date**: The actual date field name in the sales table (vs sale_date used in queries)

## Requirements

### Requirement 1: Fix Audit Log Trigger Coverage

**User Story:** As an administrator, I want all data changes to be logged in the audit log, so that I can track system activity and maintain compliance.

#### Acceptance Criteria

1. WHEN a record is inserted into the staff_stores table, THEN the system SHALL create an audit log entry with action='INSERT'
2. WHEN a record is updated in the staff_stores table, THEN the system SHALL create an audit log entry with action='UPDATE'  
3. WHEN a record is deleted from the staff_stores table, THEN the system SHALL create an audit log entry with action='DELETE'
4. THE audit log trigger SHALL capture the user_id, table_name, record_id, old_value, and new_value for all operations
5. THE audit log SHALL be queryable by administrators through the audit log page

### Requirement 2: Fix Sales Achievement Zero Data Issue

**User Story:** As a manager, I want to see accurate sales achievement data for all stores in production, so that I can monitor performance against targets.

#### Problem Statement

The sales achievement page shows Rp 0 for all stores in the production environment, while the same code works correctly in the local development environment. Both environments use the same Supabase project and the same user account.

#### Root Cause Analysis

Through extensive debugging, we have identified:

1. **Sales data EXISTS in the database** - SQL queries confirm 16 sales totaling Rp 56,606,000 for March 2026
2. **The Supabase query returns data** - Test endpoint `/api/test-sales-direct` successfully retrieves 10 sales records
3. **RLS policies are working** - User has correct permissions (admin role)
4. **Store IDs match** - No mismatch between stores and sales tables
5. **The issue is environment-specific** - Same code, same database, different results

#### Suspected Causes

1. **Caching Issue**: Production might be caching stale data or empty results
2. **Server Action Execution**: The `getSalesAchievement` function may not be executing properly in production
3. **Build-time vs Runtime**: Some data might be fetched at build time instead of runtime
4. **Supabase Client Configuration**: Different client behavior between local and production

#### Acceptance Criteria

1. WHEN querying sales data for achievement calculations in production, THE system SHALL return the same data as in local development
2. WHEN sales exist for a store in a given month, THE achievement calculation SHALL return the correct sales total (not zero)
3. WHEN calculating achievement percentage, THE system SHALL use the formula (sales / target) * 100 with actual sales data
4. WHEN displaying achievement data, THE system SHALL show non-zero values when sales data exists in the database
5. THE sales achievement query SHALL aggregate all sales by store_id for the specified date range consistently across environments
6. THE system SHALL NOT cache sales achievement data inappropriately
7. THE server action logs SHALL appear in production for debugging purposes

### Requirement 3: Verify Dashboard Queries

**User Story:** As a user, I want the dashboard to display accurate sales data, so that I can make informed business decisions.

#### Acceptance Criteria

1. WHEN the dashboard queries sales data, THE system SHALL use the correct column name (transaction_date)
2. WHEN aggregating sales by date range, THE system SHALL include all sales within the specified period
3. THE dashboard metrics SHALL match the actual sales data in the database
4. THE GMV trends SHALL accurately reflect sales over time using the correct date field
5. THE product performance data SHALL aggregate correctly using the transaction_date field
