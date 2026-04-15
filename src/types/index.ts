// src/types/index.ts
// OmniERP Retail ERP v2.0 - Updated Types

// ============================================
// ENUMS AND BASIC TYPES
// ============================================

export type UserRole = 'admin' | 'manager' | 'staff' | 'dealer';
export type ChannelType = 'Brandstore' | 'Modern Channel' | 'Retailer' | 'Dealer' | 'Hangon';
export type DayOffStatus = 'pending' | 'approved' | 'rejected';
export type POStatus = 'draft' | 'confirmed' | 'cancelled';
export type CreditNoteStatus = 'available' | 'used' | 'expired';
export type PriceSource = 'retail' | 'dealer' | string; // string for channel keys
export type ExpenseCategory = 'POSM' | 'ADS' | 'Exhibition' | 'Logistic Cost' | 'Support Sellout' | 'Brandstore Promotion' | 'Branding Offline';

// ============================================
// ORGANIZATION HIERARCHY
// ============================================

export interface Account {
  id: string;
  name: string;
  channel_type: ChannelType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  account_id: string;
  account?: Account;
  name: string;
  region: string | null;
  monthly_target: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Legacy Branch type (for backward compatibility during migration)
export interface Branch {
  id: string;
  name: string;
  account: string | null;
  province: string | null;
  monthly_target: number;
  is_active: boolean;
}

// ============================================
// USER PROFILES
// ============================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  store_id: string | null;
  store?: Store;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// MULTI-STORE STAFF ASSIGNMENT
// ============================================

export interface StaffStoreAssignment {
  id: string;
  staff_id: string;
  store_id: string;
  is_primary: boolean;
  assigned_at: string;
  created_at: string;
  staff?: Profile;
  store?: Store;
}

// ============================================
// PRODUCTS WITH DYNAMIC PRICING
// ============================================

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  price_retail: number;  // Price A - SRP (visible to Staff)
  price_buy: number;     // Price B - Dealer cost (visible to Dealer/Manager)
  channel_pricing: Record<string, number>;  // Dynamic channel prices
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Role-filtered product types (for API responses)
export interface StaffProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  price: number;  // This is price_retail
  is_active: boolean;
}

export interface DealerProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  price: number;  // This is price_buy
  is_active: boolean;
}

// Legacy Product type (for backward compatibility)
export interface LegacyProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  category: string | null;
  is_active: boolean;
}

// ============================================
// FISCAL CALENDAR
// ============================================

export interface FiscalCalendar {
  date: string;
  day_name: string;
  fiscal_week: number;
  fiscal_month: number;
  fiscal_year: number;
  quarter: number;
}

export interface FiscalPeriod {
  fiscal_week: number;
  fiscal_month: number;
  fiscal_year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  days_elapsed: number;
  total_days: number;
}


// ============================================
// INVENTORY
// ============================================

export interface InventoryItem {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  display_qty: number;
  store?: Store;
  product?: Product;
  updated_at: string;
}

// ============================================
// SALES
// ============================================

export interface GiftItem {
  product_id: string;
  name: string;
  qty: number;
}

export interface Sale {
  id: string;
  store_id: string;
  store?: Store;
  product_id: string;
  product?: Product;
  staff_id: string;
  staff?: Profile;
  created_by: string | null;
  created_by_user?: Profile;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  gift_details: GiftItem[];
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
  created_at: string;
}

// ============================================
// TRANSACTIONS (Multi-Product Sales)
// ============================================

export interface Transaction {
  id: string;
  store_id: string;
  store?: Store;
  staff_id: string;
  staff?: Profile;
  transaction_date: string;
  total_before_discount: number;
  total_discount: number;
  total_after_discount: number;
  inventory_source: 'in_store' | 'warehouse';
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_by: string;
  created_by_user?: Profile;
  created_at: string;
  updated_at: string;
  items: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number;
  line_discount: number;
  line_total: number;
  gift_details: GiftItem[];
  created_at: string;
}

// Input types for transaction creation
export interface TransactionInput {
  store_id: string;
  staff_id: string;
  transaction_date: string;
  inventory_source: 'in_store' | 'warehouse';
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
  items: TransactionItemInput[];
}

export interface TransactionItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  line_discount?: number;
  gift_details?: GiftItem[];
}

// Filter types for transaction queries
export interface TransactionFilter {
  store_id?: string;
  staff_id?: string;
  start_date?: string;
  end_date?: string;
  customer_name?: string;
  customer_phone?: string;
  min_total?: number;
  max_total?: number;
  inventory_source?: 'in_store' | 'warehouse';
}

// Update types for transaction modification
export interface TransactionUpdate {
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
}

// Unified export format (compatible with existing exports)
export interface UnifiedSalesItem {
  id: string;
  transaction_id: string | null; // null for legacy sales
  sale_date: string;
  fiscal_week: number;
  fiscal_year: number;
  store_id: string;
  store_name: string;
  account_name: string | null;
  staff_id: string;
  staff_name: string;
  product_id: string;
  sku: string;
  product_name: string;
  category: string | null;
  sub_category: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  customer_name: string | null;
  customer_phone: string | null;
  gift_details: GiftItem[];
  inventory_source: 'in_store' | 'warehouse';
  source_type: 'transaction' | 'legacy';
}

// ============================================
// PURCHASE ORDERS
// ============================================

export interface PurchaseOrder {
  id: string;
  po_number: string;
  account_id: string;
  account?: Account;
  store_id: string | null;
  store?: Store;
  price_source: PriceSource;
  po_date: string;
  status: POStatus;
  total_before_tax: number;
  total_after_tax: number;
  grand_total: number;
  credit_note_id?: string | null;
  credit_note_amount?: number;
  created_by: string;
  created_by_user?: Profile;
  confirmed_by?: string | null;
  confirmed_by_user?: Profile;
  confirmed_at?: string | null;
  items: POItem[];
  created_at: string;
  // Legacy field
  dealer_name?: string;
}

export interface POItem {
  id: string;
  po_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  before_tax: number;
  after_tax: number;
  line_total: number;
}

// ============================================
// CREDIT NOTES (Dealer)
// ============================================

export interface CreditNote {
  id: string;
  dealer_id: string;
  dealer?: Profile;
  amount: number;
  status: CreditNoteStatus;
  description: string | null;
  created_at: string;
  expires_at: string | null;
  used_in_po_id?: string | null;
  used_at?: string | null;
}

// ============================================
// TRAINING MATERIALS
// ============================================

export interface TrainingMaterial {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

// ============================================
// EXPENSES
// ============================================

export interface Expense {
  id: string;
  account_id: string;
  account?: Account;
  expense_date: string;
  fiscal_week: number;
  category: ExpenseCategory;
  amount: number;
  evidence_url: string | null;
  remarks: string | null;
  created_by: string;
  created_by_user?: Profile;
  created_at: string;
}

// ============================================
// DAY OFF REQUESTS
// ============================================

export interface DayOffRequest {
  id: string;
  staff_id: string;
  staff?: Profile;
  start_date: string;
  end_date: string;
  reason: string;
  status: DayOffStatus;
  reviewed_by: string | null;
  reviewer?: Profile;
  reviewed_at: string | null;
  created_at: string;
}

// ============================================
// STOCK OPNAME
// ============================================

export interface StockOpname {
  id: string;
  store_id: string;
  store?: Store;
  staff_id: string;
  staff?: Profile;
  submitted_at: string;
  items: StockOpnameItem[];
}

export interface StockOpnameItem {
  id: string;
  opname_id: string;
  product_id: string;
  product?: Product;
  previous_qty: number;
  counted_qty: number;
  discrepancy: number;
}

// ============================================
// AUDIT LOG
// ============================================

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user?: Profile;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}


// ============================================
// DASHBOARD & REPORTS
// ============================================

export interface StoreAchievement {
  store_id: string;
  store_name: string;
  account_id: string;
  account_name: string;
  sales: number;
  target: number;
  achievement_pct: number;
  run_rate: number;
  run_rate_pct: number;
  status: 'red' | 'yellow' | 'green';
}

// Legacy type alias (deprecated)
export type BranchAchievement = StoreAchievement;

export interface StaffAchievement {
  staff_id: string;
  staff_name: string;
  sales: number;
  target: number;
  achievement_pct: number;
  run_rate: number;
  run_rate_pct: number;
  status: 'red' | 'yellow' | 'green';
}

export interface DashboardMetrics {
  total_gmv: number;
  gmv_change_pct: number;
  order_count: number;
  qty_sold: number;
  avg_order_value: number;
  weekly_gmv: number;
  weekly_gmv_change_pct: number;
  monthly_gmv: number;
  monthly_gmv_change_pct: number;
}

export interface ProductPerformance {
  product_id: string;
  product_name: string;
  sku: string;
  gmv: number;
  delta_qty: number;
}

export interface CategoryGMV {
  category: string;
  gmv: number;
  qty: number;
}

export interface AccountGMV {
  account_id: string;
  account_name: string;
  gmv: number;
  qty_sold: number;
  store_count: number;
}

export interface StoreGMV {
  store_id: string;
  store_name: string;
  account_name: string;
  gmv: number;
  qty_sold: number;
}

export interface ProvinceData {
  province: string;
  gmv: number;
  qty_sold: number;
}

// ============================================
// WEEKLY SALES REPORT
// ============================================

export interface WeeklySalesItem {
  id: string;
  sale_date: string;
  fiscal_week: number;
  staff_name: string;
  submitted_by: string;
  account_name: string;
  store_name: string;
  sku: string;
  category: string;
  sub_category: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  customer_name: string | null;
  customer_phone: string | null;
  gift_details: GiftItem[];
  // Legacy fields
  account?: string | null;
  branch_name?: string;
  item_name?: string;
  price?: number;
  final_price?: number;
  gift?: string | null;
}

export interface WeeklySalesTotals {
  total_quantity: number;
  total_revenue: number;
  total_discount: number;
}

export interface WeeklySalesReport {
  items: WeeklySalesItem[];
  totals: WeeklySalesTotals;
  fiscal_week: number;
  fiscal_year: number;
  start_date?: string;
  end_date?: string;
}

export interface WeeklySalesFilter {
  fiscal_week?: number;
  fiscal_year?: number;
  start_date?: string;
  end_date?: string;
  account_id?: string;
  store_id?: string;
  staff_id?: string;
}

// Transaction-grouped weekly sales types (Requirements 4.1, 4.2, 4.3)
export interface TransactionGroupItem {
  transaction_id: string | null; // null for legacy sales
  sale_date: string;
  fiscal_week: number;
  staff_name: string;
  account_name: string;
  store_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  item_count: number; // number of products in transaction
  total_quantity: number; // sum of quantities
  total_before_discount: number;
  total_discount: number;
  total_after_discount: number;
  items: WeeklySalesItem[]; // individual products in transaction
  source_type: 'transaction' | 'legacy';
}

export interface TransactionGroupedReport {
  transactions: TransactionGroupItem[];
  totals: WeeklySalesTotals & {
    total_transactions: number;
    average_transaction_value: number;
    total_items: number;
  };
  fiscal_week: number;
  fiscal_year: number;
  start_date?: string;
  end_date?: string;
}

// ============================================
// DEALER PORTAL
// ============================================

export interface DealerDashboard {
  total_purchases_ytd: number;
  total_purchases_mtd: number;
  available_credit: number;
  pending_pos: number;
  recent_orders: PurchaseOrder[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Re-export database types
export * from './database';
