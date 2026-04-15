# Design Document: Dreame Retail ERP Dashboard v2.0

## Overview

This document describes the technical design for the refactored Dreame Indonesia Retail ERP system with dynamic pricing, organization hierarchy, fiscal calendar, and strict role-based pricing visibility.

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4 with soft UI theme
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Realtime)
- **PDF/Excel**: @react-pdf/renderer, xlsx
- **Charts**: Recharts
- **i18n**: Custom React Context

## Database Schema (Refactored)

### New Tables


```sql
-- ============================================
-- 1. ACCOUNTS TABLE (NEW - Parent Organization)
-- ============================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. STORES TABLE (Replaces branches)
-- ============================================
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  region TEXT,
  monthly_target DECIMAL(15,2) DEFAULT 0 CHECK (monthly_target >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PRODUCTS TABLE (Refactored Pricing)
-- ============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  price_retail DECIMAL(15,2) NOT NULL CHECK (price_retail >= 0),  -- Price A (SRP)
  price_buy DECIMAL(15,2) NOT NULL CHECK (price_buy >= 0),        -- Price B (Dealer)
  channel_pricing JSONB DEFAULT '{}',  -- {"ec": 1500000, "hartono": 1480000, ...}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. FISCAL_CALENDAR TABLE (NEW)
-- ============================================
CREATE TABLE public.fiscal_calendar (
  date DATE PRIMARY KEY,
  day_name TEXT NOT NULL,
  fiscal_week INTEGER NOT NULL CHECK (fiscal_week BETWEEN 1 AND 53),
  fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  fiscal_year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4)
);

-- ============================================
-- 5. PROFILES TABLE (Updated)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'dealer')),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. INVENTORY TABLE (Updated FK)
-- ============================================
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  display_qty INTEGER DEFAULT 0 CHECK (display_qty >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);

-- ============================================
-- 7. SALES TABLE (Updated with gift_details)
-- ============================================
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  discount DECIMAL(15,2) DEFAULT 0 CHECK (discount >= 0),
  total_price DECIMAL(15,2) NOT NULL CHECK (total_price >= 0),
  gift_details JSONB DEFAULT '[]',  -- [{"product_id": "...", "name": "...", "qty": 1}]
  customer_name TEXT,
  customer_phone TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. PURCHASE ORDERS TABLE (Updated)
-- ============================================
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  price_source TEXT NOT NULL DEFAULT 'dealer',  -- 'retail', 'dealer', or channel key
  po_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  total_before_tax DECIMAL(15,2) NOT NULL CHECK (total_before_tax >= 0),
  total_after_tax DECIMAL(15,2) NOT NULL CHECK (total_after_tax >= 0),
  grand_total DECIMAL(15,2) NOT NULL CHECK (grand_total >= 0),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. CREDIT_NOTES TABLE (NEW - Dealer)
-- ============================================
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at DATE
);

-- ============================================
-- 10. TRAINING_MATERIALS TABLE (NEW)
-- ============================================
CREATE TABLE public.training_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. EXPENSES TABLE (NEW)
-- ============================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL,
  fiscal_week INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('POSM', 'ADS', 'Exhibition', 'Logistic Cost', 'Support Sellout', 'Brandstore Promotion', 'Branding Offline')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  evidence_url TEXT,
  remarks TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```


### Indexes

```sql
CREATE INDEX idx_stores_account_id ON public.stores(account_id);
CREATE INDEX idx_profiles_store_id ON public.profiles(store_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_inventory_store_id ON public.inventory(store_id);
CREATE INDEX idx_sales_store_id ON public.sales(store_id);
CREATE INDEX idx_sales_sale_date ON public.sales(sale_date);
CREATE INDEX idx_fiscal_calendar_week ON public.fiscal_calendar(fiscal_year, fiscal_week);
CREATE INDEX idx_fiscal_calendar_month ON public.fiscal_calendar(fiscal_year, fiscal_month);
CREATE INDEX idx_purchase_orders_account_id ON public.purchase_orders(account_id);
CREATE INDEX idx_credit_notes_dealer_id ON public.credit_notes(dealer_id);
CREATE INDEX idx_expenses_account_id ON public.expenses(account_id);
```

## TypeScript Interfaces

```typescript
// src/types/index.ts

export type UserRole = 'admin' | 'manager' | 'staff' | 'dealer';
export type ChannelType = 'Brandstore' | 'Modern Channel' | 'Retailer' | 'Dealer' | 'Hangon';
export type PriceSource = 'retail' | 'dealer' | string; // string for channel keys

export interface Account {
  id: string;
  name: string;
  channel_type: ChannelType;
  is_active: boolean;
}

export interface Store {
  id: string;
  account_id: string;
  account?: Account;
  name: string;
  region: string | null;
  monthly_target: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  price_retail: number;      // Price A - visible to Staff
  price_buy: number;         // Price B - visible to Dealer/Manager
  channel_pricing: Record<string, number>;  // Dynamic channel prices
  is_active: boolean;
}

// Role-filtered product types
export interface StaffProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  price_retail: number;  // ONLY this price visible
}

export interface DealerProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  price_buy: number;  // ONLY this price visible
}

export interface FiscalCalendar {
  date: string;
  day_name: string;
  fiscal_week: number;
  fiscal_month: number;
  fiscal_year: number;
  quarter: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  store_id: string | null;
  store?: Store;
  is_active: boolean;
}

export interface Sale {
  id: string;
  store_id: string;
  store?: Store;
  product_id: string;
  product?: Product;
  staff_id: string;
  staff?: Profile;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  gift_details: GiftItem[];
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
}

export interface GiftItem {
  product_id: string;
  name: string;
  qty: number;
}

export interface CreditNote {
  id: string;
  dealer_id: string;
  amount: number;
  status: 'available' | 'used' | 'expired';
  description: string | null;
  expires_at: string | null;
}

export interface TrainingMaterial {
  id: string;
  title: string;
  url: string;
}
```


## Row Level Security Policies

### Pricing Visibility (Server-Side Filtering)

```sql
-- Helper functions for JWT metadata
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
    'staff'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'store_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Products: All can read, but pricing filtered in server actions
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO authenticated USING (true);

-- Stores: All authenticated can read
CREATE POLICY "stores_select" ON public.stores
  FOR SELECT TO authenticated USING (true);

-- Accounts: All authenticated can read
CREATE POLICY "accounts_select" ON public.accounts
  FOR SELECT TO authenticated USING (true);

-- Inventory: Staff sees own store, admin/manager sees all
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = public.get_user_store_id()
  );

-- Sales: Staff sees own store, admin/manager sees all
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = public.get_user_store_id()
  );

-- Credit Notes: Dealer sees own only
CREATE POLICY "credit_notes_select" ON public.credit_notes
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR dealer_id = auth.uid()
  );

-- Purchase Orders: Dealer sees own, manager/admin sees all
CREATE POLICY "purchase_orders_select" ON public.purchase_orders
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager')
    OR created_by = auth.uid()
  );
```

## Server-Side Price Filtering

```typescript
// src/lib/price-filter.ts

export function filterProductsByRole(products: Product[], role: UserRole): StaffProduct[] | DealerProduct[] | Product[] {
  switch (role) {
    case 'staff':
      return products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price_retail: p.price_retail,
        // price_buy and channel_pricing are REMOVED
      }));
    
    case 'dealer':
      return products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price_buy: p.price_buy,
        // price_retail and channel_pricing are REMOVED
      }));
    
    case 'admin':
    case 'manager':
      return products; // Full access
    
    default:
      return [];
  }
}
```


## Page Structure

```
src/app/
├── (auth)/
│   ├── login/page.tsx
│   └── layout.tsx
├── (dashboard)/                    # Staff/Manager/Admin
│   ├── layout.tsx
│   ├── dashboard/page.tsx          # Main metrics
│   ├── sales/
│   │   ├── page.tsx                # Sales achievement
│   │   ├── input/page.tsx          # Sales input (Staff)
│   │   └── weekly/page.tsx         # Weekly reports
│   ├── inventory/
│   │   ├── page.tsx                # Inventory matrix
│   │   └── opname/page.tsx         # Stock opname
│   ├── purchase-orders/
│   │   ├── page.tsx                # PO list
│   │   └── new/page.tsx            # Create PO (Manager)
│   ├── staff/
│   │   └── day-off/page.tsx        # Day-off requests
│   ├── training/page.tsx           # Training materials
│   ├── master-data/
│   │   ├── accounts/page.tsx       # Account CRUD
│   │   ├── stores/page.tsx         # Store CRUD
│   │   ├── products/page.tsx       # Product CRUD
│   │   └── staff/page.tsx          # Staff CRUD
│   └── audit-log/page.tsx
├── (dealer)/                       # Dealer Portal
│   ├── layout.tsx
│   ├── dashboard/page.tsx          # Dealer dashboard
│   ├── purchase-orders/
│   │   ├── page.tsx                # Dealer PO list
│   │   └── new/page.tsx            # Create PO (auto price_buy)
│   └── credit-notes/page.tsx       # View credit notes
```

## Internationalization (i18n)

```typescript
// src/lib/i18n/translations.ts

export const translations = {
  en: {
    sidebar: {
      dashboard: 'Dashboard',
      sales: 'Sales',
      salesInput: 'Input Sales',
      salesAchievement: 'Achievement',
      weeklyReport: 'Weekly Report',
      inventory: 'Inventory',
      stockOpname: 'Stock Opname',
      purchaseOrders: 'Purchase Orders',
      dayOff: 'Day Off',
      training: 'Training',
      masterData: 'Master Data',
      auditLog: 'Audit Log',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
    },
  },
  id: {
    sidebar: {
      dashboard: 'Dasbor',
      sales: 'Penjualan',
      salesInput: 'Input Penjualan',
      salesAchievement: 'Pencapaian',
      weeklyReport: 'Laporan Mingguan',
      inventory: 'Inventaris',
      stockOpname: 'Stok Opname',
      purchaseOrders: 'Purchase Order',
      dayOff: 'Cuti',
      training: 'Pelatihan',
      masterData: 'Data Master',
      auditLog: 'Log Audit',
    },
    common: {
      save: 'Simpan',
      cancel: 'Batal',
      delete: 'Hapus',
      edit: 'Ubah',
      add: 'Tambah',
      search: 'Cari',
      filter: 'Filter',
      export: 'Ekspor',
    },
  },
};

// src/lib/i18n/context.tsx
'use client';
import { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'id';

const I18nContext = createContext<{
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}>({ lang: 'id', setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('id');
  
  useEffect(() => {
    const saved = localStorage.getItem('lang') as Language;
    if (saved) setLang(saved);
  }, []);
  
  const changeLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };
  
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };
  
  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
```


## Fiscal Calendar Utilities

```typescript
// src/lib/fiscal-calendar.ts

export async function getCurrentFiscalPeriod(supabase: SupabaseClient) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('fiscal_calendar')
    .select('*')
    .eq('date', today)
    .single();
  
  return data as FiscalCalendar | null;
}

export async function getFiscalMonthDays(
  supabase: SupabaseClient, 
  fiscalYear: number, 
  fiscalMonth: number
) {
  const { data } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_month', fiscalMonth);
  
  return {
    totalDays: data?.length || 0,
    dates: data?.map(d => d.date) || [],
  };
}

export async function getFiscalDaysElapsed(
  supabase: SupabaseClient,
  fiscalYear: number,
  fiscalMonth: number
) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_month', fiscalMonth)
    .lte('date', today);
  
  return data?.length || 0;
}

// Run Rate calculation using fiscal calendar
export function calculateFiscalRunRate(
  currentSales: number,
  fiscalDaysElapsed: number,
  totalFiscalDaysInMonth: number
): number {
  return (currentSales / Math.max(1, fiscalDaysElapsed)) * totalFiscalDaysInMonth;
}
```

## Correctness Properties

### Property 1: Role-Based Pricing Visibility
*For any* Staff user querying products, the API response SHALL contain ONLY `price_retail` and SHALL NOT contain `price_buy` or `channel_pricing`.
*For any* Dealer user querying products, the API response SHALL contain ONLY `price_buy` and SHALL NOT contain `price_retail` or `channel_pricing`.
**Validates: Requirements 1.3, 1.4, 1.5, 16.3, 16.4**

### Property 2: Store-Based Data Isolation
*For any* Staff user with assigned `store_id`, queries to sales, inventory, or store-scoped data SHALL return ONLY records where `store_id` matches the user's assigned store.
**Validates: Requirements 1.6**

### Property 3: Dealer Data Isolation
*For any* Dealer user, queries to purchase_orders and credit_notes SHALL return ONLY records linked to their `user_id`.
**Validates: Requirements 1.7, 9.6**

### Property 4: Fiscal Run Rate Calculation
*For any* store with current_sales, fiscal_days_elapsed, and total_fiscal_days_in_month, run_rate SHALL equal `(current_sales / MAX(1, fiscal_days_elapsed)) * total_fiscal_days_in_month`.
**Validates: Requirements 4.4, 5.2**

### Property 5: Gift Inventory Invariant
*For any* sale submission with gift_details, the inventory SHALL be decremented ONLY for the main sold product. Gift items SHALL NOT affect inventory quantities.
**Validates: Requirements 8.7, 8.8**

### Property 6: Channel Price Lookup
*For any* PO with price_source set to a channel key (e.g., "ec"), the line item price SHALL equal the value from `product.channel_pricing[price_source]`.
**Validates: Requirements 3.4, 3.5, 7.4**

### Property 7: Account-Store Hierarchy
*For any* Store, there SHALL exist exactly one parent Account. *For any* Account filter on dashboard, the results SHALL include data from ALL stores belonging to that account.
**Validates: Requirements 2.3, 2.5**

### Property 8: Fiscal Calendar Week Boundaries
*For any* weekly report query, the date range SHALL be determined by fiscal_calendar table where fiscal_week matches, NOT by standard SQL week functions.
**Validates: Requirements 4.2, 15.1**
