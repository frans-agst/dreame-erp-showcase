# Dreame Retail ERP v2.0 - Change Summary

## Migration Date: January 2026

---

## Database Schema Changes

### New Tables
| Table | Purpose |
|-------|---------|
| `accounts` | Parent organization (Hartono, EC, Erafone, etc.) with channel_type |
| `stores` | Physical locations, replaces `branches`, linked to accounts |
| `fiscal_calendar` | Custom fiscal weeks/months (Monday-Sunday) for 2024-2026 |
| `credit_notes` | Dealer rebates with status (available/used/expired) |
| `training_materials` | Training links (title + Google Drive URL) |
| `expenses` | Account-level expense tracking by category |

### Modified Tables
| Table | Changes |
|-------|---------|
| `products` | Added `price_retail`, `price_buy`, `channel_pricing` JSONB, `sub_category` |
| `profiles` | Added `dealer` role, renamed `branch_id` → `store_id` |
| `sales` | Renamed `branch_id` → `store_id`, `price` → `unit_price`, `final_price` → `total_price`, added `gift_details` JSONB, `customer_name`, `customer_phone` |
| `purchase_orders` | Added `account_id`, `store_id`, `price_source` |
| `inventory` | FK changed from `branch_id` → `store_id` |

### Data Migration
- All `branches` migrated to `stores` under a default "Legacy" account
- `price` column copied to `price_retail`
- Default `price_buy` set to 80% of retail price
- All `branch_id` references updated to `store_id`

---

## Pricing Model Changes

### Before (v1)
- Single `price` column
- All users see same price

### After (v2)
| Role | Visible Prices |
|------|----------------|
| Staff | `price_retail` only (Price A / SRP) |
| Dealer | `price_buy` only (Price B) |
| Manager | All prices + channel pricing |
| Admin | All prices + channel pricing |

### Channel Pricing
- Stored as JSONB: `{"ec": 1500000, "hartono": 1480000, "best": 1450000}`
- PO creation allows selecting price source
- New channels can be added without schema changes

---

## New Features

### 1. Organization Hierarchy
- Account > Store structure
- Filter dashboard by Account (all stores) or specific Store
- Display format: "Account - Store"

### 2. Dealer Portal (`/dealer/*`)
- Simplified interface for dealers
- Auto-populated dealer pricing
- Credit notes management
- Own PO history only

### 3. Fiscal Calendar
- Custom Monday-Sunday weeks
- Run rate uses fiscal days elapsed
- Weekly reports grouped by fiscal week
- Seeded for 2024-2026

### 4. Internationalization (i18n)
- Toggle: English / Bahasa Indonesia
- Persisted in localStorage
- Default: Bahasa Indonesia

### 5. Gift Tracking
- Multi-select gift items on sales
- Stored as `gift_details` JSONB
- Gifts do NOT decrement inventory

### 6. Training Materials
- Sidebar link to training page
- Opens Google Drive links in new tab

---

## Security Enhancements

### Server-Side Price Filtering
- Prices filtered at API level, not just UI
- Staff cannot see `price_buy` even in dev tools
- Dealer cannot see `price_retail` even in dev tools

### RLS Policy Updates
- Store-based isolation for staff
- Dealer sees only own POs/credit notes
- Manager/Admin see all data

---

## Breaking Changes

| Change | Migration Path |
|--------|----------------|
| `branches` → `stores` | Auto-migrated, update any custom queries |
| `branch_id` → `store_id` | Auto-migrated in all tables |
| `price` → `price_retail` | Auto-migrated |
| Single price → Multi-tier | Set `price_buy` manually for accurate dealer pricing |

---

## Test Coverage

- 962 automated tests passing
- Property-based tests for:
  - Role-based pricing visibility
  - Store-based data isolation
  - Dealer data isolation
  - Fiscal run rate calculation
  - Gift inventory invariant
  - Channel price lookup
  - Account-store hierarchy
  - Fiscal week boundaries

---

## Post-Migration Checklist

1. [ ] Verify fiscal_calendar has data for current period
2. [ ] Set accurate `price_buy` values for products
3. [ ] Configure `channel_pricing` for Modern Channel accounts
4. [ ] Create accounts and reassign stores from "Legacy"
5. [ ] Assign dealer role to dealer users
6. [ ] Test all four user roles (Admin, Manager, Staff, Dealer)
7. [ ] Verify i18n toggle works and persists

---

## Files Changed

### New Files
- `src/app/(dealer)/*` - Dealer portal pages
- `src/lib/price-filter.ts` - Server-side price filtering
- `src/lib/fiscal-calendar.ts` - Fiscal calendar utilities
- `src/lib/i18n/*` - Internationalization
- `src/actions/dealer.ts` - Dealer server actions
- `src/actions/training.ts` - Training materials actions

### Modified Files
- All pages updated `branch` → `store`
- Sidebar updated with new menu structure
- Dashboard updated with Account/Store filters
- Sales input updated with gift selection
- PO form updated with price source selection
