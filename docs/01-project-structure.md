# 01 — Project Structure

## Complete Folder & File Tree

```
omnierp-erp/
├── .env.development
├── .env.local
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
├── vitest.config.ts
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   ├── logo-full.svg
│   ├── logo-icon.svg
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── scripts/                                  # SQL diagnostics & migration helpers
│   ├── check-product-api-data.sql
│   ├── check-sale-dates.sql
│   ├── check-staff-store-assignments.sql
│   ├── check-store-id-mismatch.sql
│   ├── check-subcategories.sql
│   ├── diagnose-product-pricing.sql
│   ├── diagnose-sales-achievement.sql
│   ├── diagnose-subcategory-issue.sql
│   ├── fix-product-pricing.sql
│   ├── fix-sales-achievement-rls.sql
│   ├── fix-sales-pricing.sql
│   ├── fix-subcategory-differentiation.sql
│   ├── generate-fiscal-calendar-csv.ts
│   ├── IMMEDIATE-FIX.sql
│   ├── quick-fix-user-role.sql
│   ├── sync-staff-metadata.sql
│   ├── test-subcategory-migration.sql
│   ├── verify-multi-store-setup.ts
│   ├── verify-subcategory-migration.sql
│   ├── MIGRATION-TESTING-GUIDE.md
│   ├── README.md
│   └── SALES-ACHIEVEMENT-FIX-GUIDE.md
│
├── src/
│   ├── proxy.ts
│   │
│   ├── types/
│   │   ├── index.ts                          # All TypeScript interfaces & types
│   │   └── database.ts                       # Supabase-generated DB types
│   │
│   ├── actions/                              # Next.js Server Actions (all backend logic)
│   │   ├── audit-log.ts
│   │   ├── audit-log.test.ts
│   │   ├── dashboard.ts
│   │   ├── dashboard.test.ts
│   │   ├── day-off.ts
│   │   ├── day-off.test.ts
│   │   ├── dealer.ts
│   │   ├── expenses.ts
│   │   ├── exports.ts
│   │   ├── inventory.ts
│   │   ├── master-data.ts
│   │   ├── purchase-orders.ts
│   │   ├── purchase-orders.test.ts
│   │   ├── sales.ts
│   │   ├── sales.test.ts
│   │   ├── stock-opname.ts
│   │   ├── store-assignments.ts
│   │   ├── store-assignments.test.ts
│   │   ├── training.ts
│   │   ├── transactions.ts
│   │   └── transactions.test.ts
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── globals.css
│   │   ├── icon.svg
│   │   │
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── audit-log/page.tsx
│   │   │   ├── credit-notes/page.tsx
│   │   │   ├── expenses/page.tsx
│   │   │   ├── training/page.tsx
│   │   │   ├── sales/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── input/page.tsx
│   │   │   │   └── weekly/page.tsx
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx
│   │   │   │   └── opname/page.tsx
│   │   │   ├── purchase-orders/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── edit/page.tsx
│   │   │   │       └── export/page.tsx
│   │   │   ├── staff/
│   │   │   │   └── day-off/page.tsx
│   │   │   └── master-data/
│   │   │       ├── accounts/page.tsx
│   │   │       ├── branches/page.tsx
│   │   │       ├── products/page.tsx
│   │   │       ├── staff/page.tsx
│   │   │       ├── staff-assignments/page.tsx
│   │   │       └── stores/page.tsx
│   │   │
│   │   ├── api/
│   │   │   └── debug-sales/route.ts
│   │   │
│   │   ├── dealer/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── credit-notes/page.tsx
│   │   │   └── purchase-orders/
│   │   │       ├── page.tsx
│   │   │       ├── new/page.tsx
│   │   │       └── [id]/page.tsx
│   │   │
│   │   └── no-assignments/page.tsx
│   │
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   ├── ThemeProvider.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MobileMenuTrigger.tsx
│   │   │   ├── StoreSelector.tsx
│   │   │   ├── StoreSelector.test.tsx
│   │   │   └── index.ts
│   │   ├── sales/
│   │   │   ├── TransactionInputSimple.tsx
│   │   │   ├── TransactionList.tsx
│   │   │   ├── TransactionGroupedTable.tsx
│   │   │   └── SimpleGiftManager.tsx
│   │   ├── master-data/
│   │   │   ├── AssignStoreDialog.tsx
│   │   │   ├── RemoveAssignmentDialog.tsx
│   │   │   └── SetPrimaryStoreDialog.tsx
│   │   ├── purchase-orders/
│   │   │   └── ImportPOModal.tsx
│   │   ├── exports/
│   │   │   └── TransactionExporter.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── MultiSelect.tsx
│   │       ├── SearchableSelect.tsx
│   │       ├── DataTable.tsx
│   │       ├── MetricCard.tsx
│   │       ├── SoftCard.tsx
│   │       ├── StatusBadge.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── EmptyState.tsx
│   │       ├── FormField.tsx
│   │       ├── FormError.tsx
│   │       ├── FormSuccess.tsx
│   │       ├── LanguageToggle.tsx
│   │       ├── ThemeToggle.tsx
│   │       └── index.ts
│   │
│   ├── lib/
│   │   ├── calculations.ts               # Achievement % and run-rate math
│   │   ├── fiscal-calendar.ts            # Fiscal week/month lookups
│   │   ├── fiscal-calculations.ts        # Fiscal run-rate calculations
│   │   ├── fiscal-calendar-generator.ts
│   │   ├── transaction-calculations.ts
│   │   ├── transaction-validation.ts
│   │   ├── inventory-management.ts
│   │   ├── audit-logging.ts
│   │   ├── error-handling.ts
│   │   ├── price-filter.ts               # Role-based price field filtering
│   │   ├── product-categories.ts
│   │   ├── soft-delete.ts
│   │   ├── legacy-data-access.ts
│   │   ├── performance-optimization.ts
│   │   ├── channel-pricing.test.ts
│   │   ├── dealer-isolation.test.ts
│   │   ├── security-audit.md
│   │   ├── security-audit.test.ts
│   │   ├── auth/
│   │   │   ├── role-access.ts
│   │   │   ├── role-access.test.ts
│   │   │   ├── sync-metadata.ts
│   │   │   └── sync-metadata.test.ts
│   │   ├── cache/
│   │   │   ├── index.ts
│   │   │   └── shared-data-context.tsx
│   │   ├── excel/
│   │   │   ├── purchase-order.ts
│   │   │   ├── purchase-order-import.ts
│   │   │   ├── transaction-export.ts
│   │   │   └── transaction-export.test.ts
│   │   ├── i18n/
│   │   │   ├── context.tsx
│   │   │   ├── index.ts
│   │   │   └── translations.ts
│   │   ├── pdf/
│   │   │   ├── purchase-order.tsx
│   │   │   ├── dealer-purchase-order.tsx
│   │   │   ├── weekly-sales-report.tsx
│   │   │   ├── expenses-report.tsx
│   │   │   ├── inventory-report.tsx
│   │   │   └── product-inventory-report.tsx
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser Supabase client
│   │   │   ├── server.ts               # Server Supabase client
│   │   │   ├── admin.ts                # Service-role admin client
│   │   │   └── middleware.ts           # Auth middleware helpers
│   │   └── validations/
│   │       ├── auth.ts
│   │       ├── master-data.ts
│   │       ├── sales.ts
│   │       ├── sales.test.ts
│   │       ├── purchase-order.ts
│   │       ├── transactions.ts
│   │       ├── transactions.test.ts
│   │       ├── day-off.ts
│   │       ├── stock-opname.ts
│   │       └── index.ts
│   │
│   └── test/
│       └── setup.ts
│
├── supabase/
│   ├── dev-setup.sql
│   ├── dev-setup-v2.sql
│   ├── PENDING_MIGRATIONS.md
│   ├── functions/
│   │   ├── send-day-off-notification/index.ts
│   │   └── sync-user-metadata/index.ts
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_add_sales_created_by.sql
│   │   ├── 003_audit_triggers.sql
│   │   ├── 004_jwt_metadata_sync_trigger.sql
│   │   ├── 004_v2_refactor.sql
│   │   ├── 005_data_migration.sql
│   │   ├── 005_decrement_inventory_function.sql
│   │   ├── 006_fiscal_calendar_seed.sql
│   │   ├── 007_branch_to_store_migration.sql
│   │   ├── 007b_fix_stock_opname_items_rls.sql
│   │   ├── 007c_fix_stock_opname_items_rls_simple.sql
│   │   ├── 008_restrict_audit_log_admin_only.sql
│   │   ├── 009_multi_store_staff_assignment.sql
│   │   ├── 009b_fix_get_user_store_ids.sql
│   │   ├── 009c_diagnostic_store_access.sql
│   │   ├── 009d_complete_fix.sql
│   │   ├── 009e_diagnostic_sales_insert.sql
│   │   ├── 009f_cleanup_duplicate_policies.sql
│   │   ├── 010_update_rls_for_multi_store.sql
│   │   ├── 011_fix_fiscal_calendar_2026.sql
│   │   ├── 012_add_delete_policies.sql
│   │   ├── 013_add_credit_note_to_po.sql
│   │   ├── 014_fix_po_number_generation.sql
│   │   ├── 015_fix_sales_total_price.sql
│   │   ├── 016_add_expenses_update_policy.sql
│   │   ├── 017_standardize_subcategory_values.sql
│   │   ├── 018_fix_audit_triggers.sql
│   │   ├── 019_add_sales_rpc_function.sql
│   │   ├── 020_fix_all_audit_triggers.sql
│   │   ├── 021_add_inventory_source_to_sales.sql
│   │   ├── 022_create_transactions_table.sql
│   │   ├── 023_create_transaction_items_table.sql
│   │   ├── 024_create_unified_sales_export_view.sql
│   │   ├── 025_create_transaction_management_functions.sql
│   │   ├── 026_fix_warehouse_inventory_handling.sql
│   │   ├── 027_fix_transaction_total_validation.sql
│   │   ├── 028_fix_transactions_delete_policy.sql
│   │   ├── 029_staff_targets.sql
│   │   ├── 030_allow_staff_delete_own_transactions.sql
│   │   ├── README_009.md
│   │   └── README_010.md
│   └── seed-data/
│       ├── fiscal-calendar-2024-2026.csv
│       └── products-seed.sql
│
└── docs/                                     # (this analysis)
    ├── 01-project-structure.md
    ├── 02-dependencies.md
    ├── 03-readme.md
    ├── 04-database-schema.md
    └── 05-backend-routes.md
```
