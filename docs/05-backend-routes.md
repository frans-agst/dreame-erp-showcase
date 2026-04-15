# 05 — Backend Routes & Core Data Logic

This project uses **Next.js App Router** with **Server Actions** (`'use server'`) as the primary backend layer. There are no traditional REST controllers — all data logic lives in `src/actions/`. One API route exists for debugging.

---

## API Routes

| Method | Route | File | Purpose |
|---|---|---|---|
| GET | `/api/debug-sales` | `src/app/api/debug-sales/route.ts` | Debug endpoint for diagnosing sales data issues in production |

---

## Server Actions

All server actions follow a consistent return pattern:

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string }
```

---

### `src/actions/sales.ts` — Legacy Single-Product Sales

| Function | Description |
|---|---|
| `createSale(data)` | Creates a single-product sale. Validates store access via `get_user_store_ids` RPC. Atomically decrements inventory for `in_store` source; skips for `warehouse`. Stores gift details as JSONB. |
| `getSales(filters?)` | Fetches sales with optional store/date filters. RLS auto-scopes to user's assigned stores. Joins store, product, and staff. |
| `getSalesForStore(storeId, dateRange?)` | Fetches sales for a specific store. |
| `getSalesAchievement(monthStr)` | Aggregates sales from both `sales` + `transactions` tables per store. Calculates achievement %, fiscal run rate, and status (red/yellow/green) using fiscal calendar. |
| `getStaffAchievement(monthStr)` | Same as above but grouped by staff member. Joins `staff_targets` for individual targets. |
| `getAssignedStores()` | Returns stores the current user is assigned to (for dropdowns). |
| `getCurrentUserProfile()` | Returns profile with multi-store session metadata (`current_store_id`, `primary_store_id`). |
| `getCurrentUserStoreId()` | Returns the user's active store ID from JWT metadata. |

**Key business rules:**
- Inventory is only decremented for `in_store` sales, never for `warehouse`
- Gift items do NOT decrement inventory
- Sale date defaults to today (local timezone, not UTC)
- Store access is double-checked: RLS + explicit `get_user_store_ids` validation

---

### `src/actions/transactions.ts` — Multi-Product Transactions

| Function | Description |
|---|---|
| `createTransaction(input)` | Creates a multi-product transaction atomically via `create_transaction_with_items` RPC. Validates inventory availability for all items before committing. Logs full audit trail. |
| `getTransactions(filters?)` | Fetches transactions with rich filters: store, staff, date range, customer name/phone, amount range, inventory source. Returns full item details. |
| `getTransactionById(id)` | Single transaction with all items, product details, store, and staff. |
| `updateTransaction(id, updates)` | Updates only metadata fields (`customer_name`, `customer_phone`, `notes`) for audit compliance. Financial fields are immutable. |
| `deleteTransaction(id, reason?)` | Deletes transaction; restores inventory if `in_store`; logs audit trail. |
| `voidTransaction(id, reason)` | Same as delete but requires a reason; marks as a void in audit log. |
| `searchTransactions(query, filters?)` | Full-text search across customer name, phone, and transaction ID. |

**Key business rules:**
- Transaction creation uses a single DB RPC call for atomicity
- Inventory validation happens before any DB writes
- Deletion restores inventory for `in_store` transactions
- Only metadata fields can be updated post-creation (financial data is immutable)
- Retry logic (2 retries, 1s delay) on the RPC call

---

### `src/actions/dashboard.ts` — Analytics & Reporting

| Function | Description |
|---|---|
| `getDashboardMetrics(dateRange)` | Computes total GMV, order count, qty sold, avg order value, weekly/monthly GMV with period-over-period % change. Queries both `sales` and `transactions` tables. |
| `getGMVTrends(dateRange)` | Returns last 8 fiscal weeks + 6 fiscal months of GMV trends with % change vs prior period. |
| `getProductPerformance(dateRange)` | Top 10 products by GMV using `unified_sales_export` view. Includes delta qty vs prior period. |
| `getCategoryGMV(dateRange)` | GMV and qty breakdown by `sub_category`. |
| `getProvinceData(dateRange)` | GMV and qty by store region. |
| `getAccountGMV(dateRange)` | GMV aggregated by account (channel). |
| `getStoreGMV(dateRange)` | GMV aggregated by individual store. |

**Key business rules:**
- All metrics combine legacy `sales` + new `transactions` data
- Fiscal calendar is used for week/month grouping (not calendar weeks)
- Run rate = `(sales_to_date / fiscal_days_elapsed) × total_fiscal_days`
- Period comparison uses same-length prior period (not prior calendar month)

---

### `src/actions/master-data.ts` — Products, Staff, Stores, Accounts

| Function | Description |
|---|---|
| `getProducts(activeOnly?)` | Returns products with **server-side price filtering by role**: staff only see `price_retail`; dealers see `price_buy`; admin/manager see all fields including `channel_pricing`. |
| `getProductsWithFullPricing(activeOnly?)` | Admin/manager only — returns all pricing fields. Used for PO creation. |
| `createProduct(data)` | Creates product with SKU uniqueness check. Admin/manager only. |
| `updateProduct(id, data)` | Updates product. Checks for duplicate SKU excluding current. Admin/manager only. |
| `softDeleteProduct(id)` | Soft-deletes (sets `is_active = false`) if product has references in sales/POs/inventory. Hard-deletes if no references. |
| `getStaff(activeOnly?)` | Returns all staff profiles. |
| `getStaffById(id)` | Single staff member. |
| `updateStaff(id, data)` | Updates staff. Only admin can change roles. |
| `softDeleteStaff(id)` | Soft-deletes if staff has sales/day-off/opname references. Hard-deletes profile + auth user if no references. |
| `toggleStaffStatus(id)` | Toggles `is_active` flag. Admin only. |
| `getAccounts(activeOnly?)` | Returns all accounts. |
| `createAccount(data)` / `updateAccount(id, data)` | Account CRUD. Admin/manager only. |
| `getStores(activeOnly?)` | Returns all stores with account info. |
| `createStore(data)` / `updateStore(id, data)` | Store CRUD. Admin/manager only. |

**Key business rules:**
- Price filtering is enforced server-side — the client never receives fields it shouldn't see
- Soft delete is preferred over hard delete when data references exist
- Role changes require admin privileges even if the caller is a manager

---

### `src/actions/inventory.ts` — Stock Management

| Function | Description |
|---|---|
| `getInventoryMatrix(storeFilter?)` | Returns a store × product matrix of stock quantities. Filters out products with zero total stock across all stores. Supports optional store filter for multi-store staff. |
| `getInventoryForStore(storeId)` | Raw inventory items for a specific store with product details. |
| `getInventoryForMultipleStores(storeIds)` | Inventory across multiple stores — used for multi-store staff views. |

---

### `src/actions/purchase-orders.ts` — Purchase Orders

| Function | Description |
|---|---|
| `createPurchaseOrder(data)` | Creates a PO with 11% VAT calculation per line item. Generates PO number (`PO-YYYYMMDD-XXXX`). Admin/manager only. Does NOT modify inventory. |
| `createPurchaseOrderV2(data)` | V2 version with account/store selection and dynamic channel pricing (`price_source` field). |
| `getPurchaseOrders(filters)` | Paginated PO list with status/date filters. Fetches items for each PO. |
| `getPurchaseOrderById(id)` | Single PO with all line items and product details. |
| `updatePOStatus(id, status)` | Status transitions: `draft → confirmed` or `draft → cancelled`. Records `confirmed_by` and `confirmed_at`. |
| `updatePurchaseOrder(id, data)` | Edit draft POs only — replaces all items. |
| `deletePurchaseOrder(id)` | Hard delete PO and items. Admin/manager only. |
| `getPurchaseOrderForExport(id)` | Fetches PO data formatted for PDF export. |
| `getProductPriceBySource(productId, priceSource)` | Resolves product price from `retail`, `dealer`, or a channel key in `channel_pricing` JSONB. |

**Key business rules:**
- POs do not affect inventory (inventory is managed separately via stock opname)
- Tax calculation: `after_tax = before_tax × 1.11`
- Only `draft` POs can be edited or have their status changed
- PO number is sequential per day: `PO-20260415-0001`

---

### `src/actions/expenses.ts` — Operational Expenses

| Function | Description |
|---|---|
| `getExpenses(filters?)` | Filtered expense list by account, category, date range, or fiscal week. Joins account and creator. |
| `createExpense(data)` | Creates expense with Zod validation. Requires authenticated user. |
| `updateExpense(id, data)` | Partial update. Checks expense exists before updating. |
| `deleteExpense(id)` | Deletes expense. RLS enforces access. |

**Expense categories:** `POSM`, `ADS`, `Exhibition`, `Logistic Cost`, `Support Sellout`, `Brandstore Promotion`, `Branding Offline`

---

### `src/actions/store-assignments.ts` — Multi-Store Staff Management

| Function | Description |
|---|---|
| `assignStoreToStaff(staffId, storeId, isPrimary?)` | Assigns a store to staff. Auto-sets as primary if it's the first assignment. Updates `profiles.store_id` for backward compatibility. Admin only. |
| `removeStoreFromStaff(staffId, storeId)` | Removes assignment. Prevents removing the last store. Auto-promotes next oldest assignment to primary if primary was removed. Admin only. |
| `getStaffAssignments(staffId)` | Returns all store assignments for a staff member with store details. |
| `setPrimaryStore(staffId, storeId)` | Changes which store is the primary. Updates `profiles.store_id`. Admin only. |
| `updateStoreContext(storeId)` | Updates the user's active store in JWT `user_metadata.current_store_id`. Validates store is in user's assigned stores. |
| `refreshStoreAssignments()` | Reloads store assignments from DB into JWT metadata. Updates `assigned_store_ids`, `primary_store_id`, `current_store_id`, and `assignments_cached_at`. |

**Key business rules:**
- Store assignments are cached in JWT metadata with a 5-minute TTL
- `current_store_id` in JWT controls which store the user is "working in"
- All assignment changes log to `audit_log`
- Staff must always have at least one store assignment

---

### `src/actions/day-off.ts` — Staff Leave Requests

| Function | Description |
|---|---|
| `createDayOffRequest(data)` | Staff submits a leave request. Triggers email notification via Supabase Edge Function. |
| `getDayOffRequests(filters?)` | Returns requests filtered by staff, status, or date range. |
| `updateDayOffStatus(id, status, reviewedBy)` | Manager/admin approves or rejects a request. Records `reviewed_by` and `reviewed_at`. |

---

### `src/actions/audit-log.ts` — Audit Trail

| Function | Description |
|---|---|
| `getAuditLog(filters?)` | Admin-only access to full audit trail. Filterable by table, action type, user, and date range. |

---

### `src/actions/exports.ts` — Data Exports

| Function | Description |
|---|---|
| `exportWeeklySalesReport(filters)` | Generates Excel export of weekly sales data using `unified_sales_export` view. |
| `exportTransactions(filters)` | Exports transaction data to Excel. |

---

### `src/actions/dealer.ts` — Dealer Portal

| Function | Description |
|---|---|
| `getDealerDashboard()` | Returns dealer-specific metrics: YTD/MTD purchases, available credit, pending POs. |
| `getDealerPurchaseOrders()` | Returns POs scoped to the authenticated dealer. |

---

## Security Model

| Layer | Mechanism |
|---|---|
| Authentication | Supabase Auth (JWT) |
| Row-level isolation | PostgreSQL RLS policies on every table |
| Store isolation | `get_user_store_ids` RPC + RLS `store_id IN (...)` checks |
| Role enforcement | `app_metadata.role` in JWT, checked in every server action |
| Price field security | Server-side filtering in `getProducts` — staff never receive `price_buy` or `channel_pricing` |
| Audit trail | PostgreSQL triggers auto-log all data changes to `audit_log` |
| Session metadata | Store assignments cached in JWT `user_metadata` with 5-min TTL |

### Role Permissions Summary

| Action | Staff | Manager | Admin | Dealer |
|---|---|---|---|---|
| View own store sales | ✅ | ✅ | ✅ | — |
| View all store sales | — | ✅ | ✅ | — |
| Create sales/transactions | ✅ | ✅ | ✅ | — |
| Delete sales/transactions | — | ✅ | ✅ | — |
| Manage products | — | ✅ | ✅ | — |
| Manage staff | — | ✅ | ✅ | — |
| Change user roles | — | — | ✅ | — |
| Assign stores to staff | — | — | ✅ | — |
| View audit log | — | — | ✅ | — |
| Create/view own POs | — | ✅ | ✅ | ✅ |
| Confirm/cancel POs | — | ✅ | ✅ | — |
| View full pricing | — | ✅ | ✅ | ✅ (buy price only) |

---

## Supabase Edge Functions

| Function | Trigger | Purpose |
|---|---|---|
| `send-day-off-notification` | Day-off request created | Sends email notification to manager |
| `sync-user-metadata` | Auth event / manual call | Syncs `role`, `store_id`, and store assignments into JWT metadata |
