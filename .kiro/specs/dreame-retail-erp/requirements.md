# Requirements Document

## Introduction

This document specifies the requirements for a comprehensive retail ERP and sales dashboard system for OmniERP Indonesia. The system supports multi-tier pricing (Retail, Dealer, Channel-specific), organization hierarchy (Account > Store), fiscal calendar-based reporting, and strict role-based access control for four user roles: Admin, Manager, Staff, and Dealer.

## Glossary

- **System**: The Retail ERP Dashboard web application
- **Admin**: User role with full access to all data, pricing, and system settings
- **Manager**: User role with access to all stores, all pricing tiers, and approval permissions
- **Staff**: User role (Promotor/Brandstore) with access limited to their assigned store and retail pricing only
- **Dealer**: User role with access to dealer portal, purchase orders, and dealer pricing only
- **Account**: Parent organization (e.g., "Hartono", "Electronic City", "Erafone")
- **Store**: Physical retail location belonging to an Account (e.g., "Hartono Pondok Indah")
- **Channel Type**: Classification of Account (Brandstore, Modern Channel, Retailer, Dealer)
- **Price A (Retail)**: SRP - Suggested Retail Price visible to Staff for selling
- **Price B (Dealer/Buy)**: Base cost price visible to Dealers and Managers
- **Channel Pricing**: Dynamic JSONB storage for channel-specific prices (EC, Hartono, Best, Atria, etc.)
- **Fiscal Calendar**: Custom week/month/quarter definitions for reporting (Monday-Sunday weeks)
- **GMV**: Gross Merchandise Value - total sales revenue
- **Run Rate**: Projected monthly performance based on fiscal calendar days elapsed
- **RLS**: Row Level Security - database-level access control via Supabase
- **PO**: Purchase Order
- **SKU**: Stock Keeping Unit - unique product identifier
- **Credit Note**: Rebate/credit available to dealers

## Requirements

### Requirement 1: User Authentication and Role-Based Access

**User Story:** As a system administrator, I want to manage user authentication with four distinct roles, so that users can access appropriate data and pricing based on their role.

#### Acceptance Criteria

1. WHEN a user attempts to log in, THE System SHALL authenticate them using Supabase Auth.
2. THE System SHALL sync the user's `role`, `store_id`, and `account_id` to the Supabase Auth Metadata (JWT) upon login or profile update.
3. WHEN a Staff user queries product data, THE System SHALL return ONLY `price_retail` (Price A) and mask/remove `price_buy` and `channel_pricing`.
4. WHEN a Dealer user queries product data, THE System SHALL return ONLY `price_buy` (Price B) and mask/remove `price_retail` and `channel_pricing`.
5. WHEN a Manager or Admin user queries product data, THE System SHALL return all pricing columns including `price_retail`, `price_buy`, and `channel_pricing`.
6. WHEN a Staff user queries sales/inventory data, THE System SHALL enforce RLS to restrict access to their assigned `store_id` only.
7. WHEN a Dealer user queries data, THE System SHALL restrict access to POs and Credit Notes linked to their `user_id` only.
8. WHEN an Admin user accesses the system, THE System SHALL provide full access to all stores, accounts, and system settings.
9. WHEN a Manager user accesses the system, THE System SHALL provide read access to all store data and approval permissions.
10. THE System SHALL maintain user sessions securely and handle session expiration gracefully.

### Requirement 2: Organization Hierarchy (Account > Store)

**User Story:** As a manager, I want to organize stores under parent accounts, so that I can filter and report data by account or individual store.

#### Acceptance Criteria

1. THE System SHALL maintain an `accounts` table with: id, name, channel_type (Brandstore, Modern Channel, Retailer, Dealer).
2. THE System SHALL maintain a `stores` table with: id, account_id (FK), name, region.
3. WHEN displaying store information, THE System SHALL show both Store Name and Account Name (e.g., "Hartono - Pondok Indah").
4. WHEN a user is assigned to a store, THE System SHALL link the user profile to `store_id`.
5. WHEN filtering dashboard data, THE System SHALL allow filtering by Account (all stores under that account) or specific Store.
6. THE System SHALL support the following channel types: Brandstore, Modern Channel, Retailer, Dealer, Hangon.

### Requirement 3: Dynamic Product Pricing Model

**User Story:** As a manager, I want to manage multiple price tiers for products, so that different channels see appropriate pricing.

#### Acceptance Criteria

1. THE System SHALL store `price_retail` (Decimal) as Price A - the Suggested Retail Price.
2. THE System SHALL store `price_buy` (Decimal) as Price B - the Dealer/Brandstore base cost (After Tax / Sell-Thru price).
3. THE System SHALL store `channel_pricing` (JSONB) for dynamic channel-specific prices with structure: `{"ec": 1500000, "best": 1450000, "hartono": 1480000, "atria": 1480000}`.
4. WHEN creating a PO for a Modern Channel account, THE System SHALL allow selecting a price key from `channel_pricing` (e.g., "Use 'ec' price").
5. WHEN a price key is selected, THE System SHALL look up the value from the product's `channel_pricing` JSONB column.
6. THE System SHALL support adding new channel price keys without schema changes.

### Requirement 4: Fiscal Calendar System

**User Story:** As a manager, I want reports to use our custom fiscal calendar, so that weekly/monthly reports align with our business periods.

#### Acceptance Criteria

1. THE System SHALL maintain a `fiscal_calendar` table with: date (PK), fiscal_week, fiscal_month, fiscal_year, quarter.
2. WHEN determining "Current Week" for reports, THE System SHALL query the fiscal_calendar table instead of using standard SQL date functions.
3. THE System SHALL define weeks as Monday-Sunday (Week 1 starts on first Monday of fiscal year).
4. WHEN calculating Run Rate, THE System SHALL use fiscal calendar days: `(Current Sales / MAX(1, fiscal_days_elapsed)) * total_fiscal_days_in_month`.
5. WHEN displaying dashboard charts, THE System SHALL group data by fiscal_week or fiscal_month from the calendar table.
6. THE System SHALL support importing fiscal calendar data from CSV.

### Requirement 5: Sales Achievement Dashboard

**User Story:** As a manager, I want to view sales achievement metrics using fiscal calendar periods, so that I can monitor performance against targets.

#### Acceptance Criteria

1. WHEN displaying the sales achievement dashboard, THE System SHALL show each store with Store Name, Account Name, Sales, Target, Achievement %, Run Rate, Run Rate %, and Status.
2. WHEN calculating Run Rate, THE System SHALL use fiscal calendar: `(Current Sales / MAX(1, fiscal_days_elapsed_in_month)) * total_fiscal_days_in_month`.
3. WHEN calculating Achievement Percentage, THE System SHALL use: `(Sales / Target) * 100`.
4. WHEN Achievement Percentage is less than 50%, THE System SHALL display a red status badge.
5. WHEN Achievement Percentage is between 50% and 80% (inclusive), THE System SHALL display a yellow status badge.
6. WHEN Achievement Percentage is greater than 80%, THE System SHALL display a green status badge.
7. WHEN filtering the dashboard, THE System SHALL allow filtering by Account or specific Store.

### Requirement 6: Inventory Dashboard

**User Story:** As a manager, I want to view inventory levels across all stores, so that I can identify stock availability.

#### Acceptance Criteria

1. WHEN displaying the inventory dashboard, THE System SHALL show a matrix with store names as rows and product models as columns.
2. WHEN a product model has zero total stock across all stores, THE System SHALL hide that product column from the display.
3. WHEN displaying stock quantities, THE System SHALL show current available inventory for each store-product combination.
4. THE System SHALL update inventory levels in real-time as stock changes occur via Supabase realtime subscriptions.
5. WHEN stock quantity is between 0 and 9 units, THE System SHALL display a visual low-stock indicator for that cell.

### Requirement 7: Purchase Order Generation (Manager)

**User Story:** As a manager, I want to create Purchase Orders with dynamic channel pricing, so that I can generate accurate POs for different accounts.

#### Acceptance Criteria

1. WHEN creating a PO, THE System SHALL provide a form with: Date, Account Name dropdown, Store Name dropdown (filtered by account).
2. WHEN an Account is selected, THE System SHALL determine available price keys from `channel_pricing` based on account's channel_type.
3. WHEN adding items to the PO, THE System SHALL allow selecting the price source: "Retail", "Dealer", or a specific channel key (e.g., "ec", "hartono").
4. WHEN a channel price key is selected, THE System SHALL look up the price from `channel_pricing` JSONB.
5. WHEN calculating After Tax, THE System SHALL automatically apply 11% VAT to the Before Tax amount.
6. WHEN calculating Grand Total per line, THE System SHALL multiply the After Tax price by the Qty.
7. THE System SHALL save the PO as a standalone record without modifying inventory stock levels.
8. THE System SHALL allow exporting the PO as a PDF document.

### Requirement 8: Sales Data Input (Staff)

**User Story:** As a staff member, I want to input daily sales data with gift tracking through a mobile-responsive form.

#### Acceptance Criteria

1. WHEN a staff member accesses the sales input form, THE System SHALL display a mobile-optimized responsive interface.
2. WHEN submitting sales data, THE System SHALL provide dropdown selections for: Store Name (auto-filled from user's store), Product (SKU + Name).
3. WHEN a staff member selects a Product, THE System SHALL auto-populate `price_retail` (Price A) only.
4. WHEN entering transaction details, THE System SHALL allow input for: Qty, Discount, Customer Name, Customer Phone.
5. WHEN adding gifts, THE System SHALL provide a dynamic dropdown allowing multiple gift selections.
6. WHEN calculating Final Price, THE System SHALL compute: `(price_retail * quantity) - discount`.
7. WHEN sales data is submitted, THE System SHALL automatically decrement inventory for the SOLD ITEM only.
8. WHEN gifts are added, THE System SHALL NOT deduct inventory for gift items.
9. THE System SHALL store gift details in a JSONB column: `gift_details: [{"product_id": "...", "product_name": "...", "qty": 1}]`.
10. THE System SHALL timestamp all sales entries with the submission datetime.
11. THE System SHALL capture: transaction_date, store_name, account_name, promotor_name, sku, product_name, qty, unit_price, total_price, customer_name, customer_phone.

### Requirement 9: Dealer Portal

**User Story:** As a dealer, I want to access a simplified portal to create POs and view my credit notes.

#### Acceptance Criteria

1. WHEN a Dealer logs in, THE System SHALL redirect to a simplified dealer portal interface.
2. WHEN viewing products, THE System SHALL display ONLY `price_buy` (Price B) and mask all other pricing.
3. WHEN creating a PO, THE System SHALL auto-populate prices with `price_buy`.
4. WHEN viewing the dealer dashboard, THE System SHALL show: Total Purchases (YTD), Available Credit Note Balance.
5. THE System SHALL maintain a `credit_notes` table with: id, dealer_id, amount, status (available, used, expired), description.
6. WHEN a dealer views credit notes, THE System SHALL show only credit notes linked to their user_id.

### Requirement 10: Training Materials

**User Story:** As a staff member, I want to access training materials from the sidebar.

#### Acceptance Criteria

1. THE System SHALL maintain a `training_materials` table with: id, title, url (Google Drive link), created_at.
2. WHEN a user clicks "Training" / "Pelatihan" in the sidebar, THE System SHALL display a list of training materials.
3. WHEN a user clicks a training material, THE System SHALL open the URL in a new tab.

### Requirement 11: Internationalization (i18n)

**User Story:** As a user, I want to toggle between English and Bahasa Indonesia.

#### Acceptance Criteria

1. THE System SHALL provide a language toggle in the UI (EN/ID).
2. WHEN language is changed, THE System SHALL update all UI labels (Sidebar, Headers, Buttons, Form Labels).
3. THE System SHALL persist the language preference in localStorage.
4. THE System SHALL default to Bahasa Indonesia for new users.

### Requirement 12: Day-Off Request Management

**User Story:** As a staff member, I want to request day-off through the system.

#### Acceptance Criteria

1. WHEN a staff member submits a day-off request, THE System SHALL set the initial status to Pending.
2. WHEN a day-off request is created, THE System SHALL capture the requesting staff member, dates, and reason.
3. WHEN a Manager views day-off requests, THE System SHALL display all pending requests across all stores.
4. WHEN a Manager approves or rejects a request, THE System SHALL update the status and send an email notification.
5. THE System SHALL maintain a complete audit trail of all day-off request status changes.

### Requirement 13: Stock Opname

**User Story:** As a staff member, I want to conduct stock opname to correct inventory discrepancies.

#### Acceptance Criteria

1. WHEN conducting stock opname, THE System SHALL provide a form with product models as columns for the user's store.
2. WHEN displaying the stock input form, THE System SHALL show all product models as column headers.
3. WHEN submitting stock counts, THE System SHALL capture the staff member name for audit purposes.
4. WHEN stock opname is completed, THE System SHALL overwrite the inventory levels with the new counted values.
5. THE System SHALL timestamp stock opname submissions.
6. THE System SHALL calculate and display discrepancies between previous system count and new counted values.

### Requirement 14: Main Dashboard Metrics

**User Story:** As a manager, I want to view comprehensive dashboard metrics with fiscal calendar grouping.

#### Acceptance Criteria

1. WHEN displaying the main dashboard, THE System SHALL show: Total GMV, Order Count, GMV % change, Qty Sold, Avg Order Value.
2. WHEN displaying GMV trends, THE System SHALL group by fiscal_week or fiscal_month from fiscal_calendar table.
3. WHEN displaying product performance, THE System SHALL show: Product Name, GMV, Delta Qty.
4. WHEN showing category analysis, THE System SHALL display GMV breakdown by product category.
5. WHEN displaying store/account data, THE System SHALL show GMV and quantity sold grouped by Account.
6. THE System SHALL provide date range filters and Account/Store filters for all dashboard metrics.

### Requirement 15: Weekly Sales Reports

**User Story:** As a manager, I want to view detailed weekly sales reports aligned with fiscal calendar.

#### Acceptance Criteria

1. WHEN generating weekly reports, THE System SHALL use fiscal_week from fiscal_calendar to determine week boundaries.
2. WHEN displaying weekly sales, THE System SHALL show: Date, Promotor Name, Account Name, Store Name, SKU, Product Name, Qty, Unit Price, Total Price, Customer Name, Customer Phone, Gift Details.
3. WHEN showing store information, THE System SHALL display both Account Name and Store Name.
4. WHEN viewing weekly reports, THE System SHALL provide filtering by fiscal_week, Account, Store, and Staff.
5. THE System SHALL calculate weekly totals for quantity, revenue, and discount amounts.
6. THE System SHALL allow export of weekly reports in PDF and Excel formats.

### Requirement 16: Data Integrity and Security

**User Story:** As a system administrator, I want to ensure data integrity and strict pricing security.

#### Acceptance Criteria

1. WHEN any data modification occurs, THE System SHALL validate input data against defined business rules.
2. WHEN database operations are performed, THE System SHALL enforce referential integrity constraints.
3. WHEN Staff users access product data via API, THE System SHALL filter response to include ONLY price_retail.
4. WHEN Dealer users access product data via API, THE System SHALL filter response to include ONLY price_buy.
5. THE System SHALL implement server-side price filtering (not just UI hiding) to prevent data leakage.
6. THE System SHALL log access attempts to sensitive data in the audit log.

### Requirement 17: Master Data Management

**User Story:** As an admin or manager, I want to manage master data including accounts, stores, and products.

#### Acceptance Criteria

1. WHEN an Admin or Manager accesses master data, THE System SHALL provide interfaces to CRUD: Accounts, Stores, Products, Staff.
2. WHEN managing product data, THE System SHALL allow editing: SKU, Name, Category, Sub-Category, price_retail, price_buy, channel_pricing.
3. WHEN managing account data, THE System SHALL allow editing: Name, Channel Type.
4. WHEN managing store data, THE System SHALL allow editing: Name, Account (parent), Region.
5. WHEN managing staff data, THE System SHALL allow editing: Name, Email, Store, Role.
6. WHEN deleting master data records that are referenced in historical transactions, THE System SHALL perform a soft delete.

### Requirement 18: Audit Log

**User Story:** As an admin, I want to view a comprehensive audit log.

#### Acceptance Criteria

1. WHEN any data is created, edited, or deleted, THE System SHALL automatically log the action via database triggers.
2. WHEN displaying the audit log, THE System SHALL show: Date/Time, User, Action Type, Table Name, Record ID, Old Value, New Value.
3. WHEN viewing audit logs, THE System SHALL provide filtering by date range, user, action type, and table.
4. THE System SHALL allow export of filtered audit log data to Excel format.
5. THE System SHALL restrict audit log access to admin users only.

### Requirement 19: Password Reset and Recovery

**User Story:** As a user, I want to reset my password if I forget it, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a user clicks "Forgot Password" on the login page, THE System SHALL display a password reset form.
2. WHEN a user enters their email address for password reset, THE System SHALL send a password reset email via Supabase Auth.
3. WHEN a user clicks the reset link in their email, THE System SHALL redirect them to a secure password reset page.
4. WHEN a user sets a new password, THE System SHALL validate the password meets security requirements (minimum 8 characters, at least one uppercase, one lowercase, one number).
5. WHEN password reset is successful, THE System SHALL redirect the user to the login page with a success message.
6. THE System SHALL provide clear feedback for invalid or expired reset tokens.
7. THE System SHALL rate limit password reset requests to prevent abuse (maximum 3 requests per hour per email).
8. THE System SHALL log password reset attempts in the audit log for security monitoring.

### Requirement 20: UI/UX Design System

**User Story:** As a user, I want a "Soft UI" interface with monochrome theme and semantic accent colors.

#### Acceptance Criteria

1. THE System SHALL use a soft light gray background (#F5F5F5) for light mode with soft shadows.
2. THE System SHALL support dark mode with monochrome theme (#0A0A0A background).
3. THE System SHALL use semantic colors for status indicators: Green for positive/success, Red for negative/error, Yellow for warning.
4. THE System SHALL implement a minimalist sidebar with role-based menu items.
5. THE System SHALL provide a theme toggle (light/dark) in the sidebar and login page.
6. THE System SHALL provide a language toggle (EN/ID) in the header.
