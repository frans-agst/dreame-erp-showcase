# Technical Notes: Fiscal Calendar Run Rate & Dynamic Channel Pricing

**Purpose:** Internal reference for fiscal calendar calculations and dynamic JSONB channel pricing implementation.  
**Date:** March 2026  
**Status:** Local notes only - NOT committed to repository

---

## Part 1: Fiscal Calendar Run Rate Calculation

### Overview
The system uses a fiscal calendar to calculate run rates for sales achievement tracking. The fiscal calendar defines custom week/month boundaries that may differ from standard calendar months.

### Core Calculation Function

**File:** `src/lib/fiscal-calculations.ts`

```typescript
/**
 * Calculate run rate using fiscal calendar
 * Formula: (currentSales / MAX(1, fiscalDaysElapsed)) * totalFiscalDaysInMonth
 * 
 * @param currentSales - Total sales amount to date
 * @param fiscalDaysElapsed - Number of fiscal days elapsed in the period
 * @param totalFiscalDaysInMonth - Total fiscal days in the complete period
 * @returns Projected sales for the full period
 */
export function calculateFiscalRunRate(
  currentSales: number,
  fiscalDaysElapsed: number,
  totalFiscalDaysInMonth: number
): number {
  if (totalFiscalDaysInMonth <= 0) return 0;
  
  // Use MAX(1, fiscalDaysElapsed) to prevent division by zero
  const effectiveDays = Math.max(1, fiscalDaysElapsed);
  
  // Calculate daily average and project to full period
  return (currentSales / effectiveDays) * totalFiscalDaysInMonth;
}

/**
 * Calculate run rate percentage against target
 * 
 * @param runRate - Projected sales for full period
 * @param target - Monthly sales target
 * @returns Percentage of target (0-100+)
 */
export function calculateFiscalRunRatePct(
  runRate: number,
  target: number
): number {
  if (target <= 0) return 0;
  return (runRate / target) * 100;
}
```

### Example Calculation

```typescript
// Example: Store has Rp 10,000,000 in sales after 10 days
// Fiscal month has 28 days total
// Target is Rp 50,000,000

const currentSales = 10_000_000;
const fiscalDaysElapsed = 10;
const totalFiscalDaysInMonth = 28;
const target = 50_000_000;

// Calculate run rate
const runRate = calculateFiscalRunRate(
  currentSales, 
  fiscalDaysElapsed, 
  totalFiscalDaysInMonth
);
// Result: (10,000,000 / 10) * 28 = 28,000,000

// Calculate run rate percentage
const runRatePct = calculateFiscalRunRatePct(runRate, target);
// Result: (28,000,000 / 50,000,000) * 100 = 56%
```

---

### Fiscal Calendar Helper Functions

**File:** `src/lib/fiscal-calendar.ts`

#### 1. Get Current Fiscal Period

```typescript
/**
 * Get the current fiscal period (today's fiscal week/month/year)
 * Returns fiscal info for today including days elapsed
 */
export async function getCurrentFiscalPeriod(): Promise<FiscalPeriod | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Get today's fiscal info from fiscal_calendar table
  const { data: todayData, error: todayError } = await supabase
    .from('fiscal_calendar')
    .select('*')
    .eq('date', today)
    .single();
  
  if (todayError || !todayData) {
    console.error('Error fetching current fiscal period:', todayError);
    return null;
  }
  
  const fiscal = todayData as FiscalCalendar;
  
  // Get all days in the current fiscal month
  const { data: monthDays, error: monthError } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscal.fiscal_year)
    .eq('fiscal_month', fiscal.fiscal_month)
    .order('date', { ascending: true });
  
  if (monthError || !monthDays) {
    console.error('Error fetching fiscal month days:', monthError);
    return null;
  }
  
  // Calculate days elapsed (including today)
  const daysElapsed = monthDays.filter(d => d.date <= today).length;
  
  return {
    fiscal_week: fiscal.fiscal_week,
    fiscal_month: fiscal.fiscal_month,
    fiscal_year: fiscal.fiscal_year,
    quarter: fiscal.quarter,
    start_date: monthDays[0]?.date || today,
    end_date: monthDays[monthDays.length - 1]?.date || today,
    days_elapsed: daysElapsed,
    total_days: monthDays.length,
  };
}
```

#### 2. Get Fiscal Month Information

```typescript
/**
 * Get fiscal month information
 * Returns total days, date range, and all dates in the fiscal month
 */
export async function getFiscalMonthInfo(
  fiscalYear: number,
  fiscalMonth: number
): Promise<{ 
  totalDays: number; 
  dates: string[]; 
  startDate: string; 
  endDate: string 
} | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_month', fiscalMonth)
    .order('date', { ascending: true });
  
  if (error || !data || data.length === 0) {
    console.error('Error fetching fiscal month info:', error);
    return null;
  }
  
  return {
    totalDays: data.length,
    dates: data.map(d => d.date),
    startDate: data[0].date,
    endDate: data[data.length - 1].date,
  };
}
```

#### 3. Get Fiscal Days Elapsed

```typescript
/**
 * Get days elapsed in fiscal month up to a specific date
 * Used to calculate how many days have passed in the current fiscal period
 */
export async function getFiscalDaysElapsed(
  fiscalYear: number,
  fiscalMonth: number,
  upToDate?: string
): Promise<number> {
  const supabase = await createClient();
  const targetDate = upToDate || new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_month', fiscalMonth)
    .lte('date', targetDate);
  
  if (error) {
    console.error('Error fetching fiscal days elapsed:', error);
    return 0;
  }
  
  return data?.length || 0;
}
```

---

### Usage in Sales Achievement

**File:** `src/actions/sales.ts` (getSalesAchievement function)

```typescript
// 1. Get fiscal month info
const fiscalMonthInfo = await getFiscalMonthInfo(fiscalYear, fiscalMonth);

let totalFiscalDays = endOfMonth.getDate(); // Fallback to calendar days
let fiscalDaysElapsed = 0;

if (fiscalMonthInfo) {
  totalFiscalDays = fiscalMonthInfo.totalDays;
  
  // Calculate days elapsed using fiscal calendar
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  if (todayStr >= fiscalMonthInfo.startDate && todayStr <= fiscalMonthInfo.endDate) {
    // Current fiscal month - get days elapsed up to today
    fiscalDaysElapsed = await getFiscalDaysElapsed(fiscalYear, fiscalMonth, todayStr);
  } else if (todayStr > fiscalMonthInfo.endDate) {
    // Past fiscal month - all days elapsed
    fiscalDaysElapsed = totalFiscalDays;
  } else {
    // Future fiscal month - no days elapsed
    fiscalDaysElapsed = 0;
  }
}

// 2. Calculate achievement metrics for each store
const achievements: StoreAchievement[] = stores.map((store) => {
  const sales = salesByStore[store.id] || 0;
  const target = Number(store.monthly_target) || 0;
  
  const achievementPct = calculateAchievementPct(sales, target);
  
  // Use fiscal calendar run rate calculation
  const runRate = calculateFiscalRunRate(sales, fiscalDaysElapsed, totalFiscalDays);
  const runRatePct = calculateRunRatePct(runRate, target);
  const status = getAchievementStatus(achievementPct);

  return {
    store_id: store.id,
    store_name: store.name,
    sales,
    target,
    achievement_pct: achievementPct,
    run_rate: runRate,
    run_rate_pct: runRatePct,
    status,
  };
});
```

---

## Part 2: Dynamic Channel Pricing (JSONB)

### Overview
Products have dynamic pricing stored in a JSONB column that allows different prices for different sales channels (Brandstore, Modern Channel, Dealer, etc.). When a Manager creates a Purchase Order, the system looks up the appropriate price based on the selected channel.

### Database Schema

**Table:** `products`

```sql
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  price_before_tax DECIMAL(15,2) NOT NULL,  -- Base retail price (before tax)
  price_after_tax DECIMAL(15,2) NOT NULL,   -- Base retail price (after tax)
  channel_pricing JSONB,                     -- Dynamic pricing per channel
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**JSONB Structure for `channel_pricing`:**

```json
{
  "brandstore": 2500000,
  "modern_channel": 2300000,
  "dealer_a": 2100000,
  "dealer_b": 2000000,
  "hangon": 1950000
}
```

### TypeScript Interface

**File:** `src/lib/price-filter.ts`

```typescript
export interface FullProduct {
  id: string;
  sku: string;
  name: string;
  category?: string;
  sub_category?: string;
  price_retail: number;      // price_after_tax (retail price)
  price_buy: number;         // Base dealer/buy price
  channel_pricing?: {        // JSONB column
    [key: string]: number;   // Dynamic channel keys
  };
  is_active: boolean;
}
```

---

### Server Action: Get Product Price by Source

**File:** `src/actions/purchase-orders.ts`

```typescript
/**
 * Get price for a product based on price source
 * Requirements: 7.4 - Channel price lookup
 * 
 * @param productId - UUID of the product
 * @param priceSource - Price source key ('retail', 'dealer', or channel key)
 * @returns The price for the specified source
 */
export async function getProductPriceBySource(
  productId: string,
  priceSource: string
): Promise<ActionResult<number>> {
  try {
    // Check permissions - only admin/manager can access
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<number>;

    const supabase = await createClient();

    // Fetch product with all pricing fields
    const { data: product, error } = await supabase
      .from('products')
      .select('price_retail, price_buy, channel_pricing')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return {
        success: false,
        error: 'Product not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    const fullProduct = product as FullProduct;
    let price: number;

    // Determine price based on source
    switch (priceSource) {
      case 'retail':
        // Use retail price (price_after_tax)
        price = fullProduct.price_retail;
        break;
        
      case 'dealer':
        // Use base dealer price (price_buy)
        price = fullProduct.price_buy;
        break;
        
      default:
        // Channel key lookup in JSONB
        if (fullProduct.channel_pricing && fullProduct.channel_pricing[priceSource]) {
          // Found channel-specific price
          price = fullProduct.channel_pricing[priceSource];
        } else {
          // Fallback to dealer price if channel key not found
          price = fullProduct.price_buy;
        }
    }

    return { success: true, data: price };
  } catch (error) {
    console.error('Unexpected error in getProductPriceBySource:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
```

---

### Usage in Purchase Order Creation

**File:** `src/actions/purchase-orders.ts`

```typescript
/**
 * Create a new purchase order with V2 schema (Account/Store + Dynamic Pricing)
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export async function createPurchaseOrderV2(
  data: PurchaseOrderV2Input
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to create a purchase order',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<PurchaseOrder>;

    // Validate input
    const validation = PurchaseOrderV2Schema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const validatedData = validation.data;
    const supabase = await createClient();

    // Verify account exists and get channel type
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name, channel_type')
      .eq('id', validatedData.account_id)
      .single();

    if (accountError || !account) {
      return {
        success: false,
        error: 'Account not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // Verify store exists if provided
    if (validatedData.store_id) {
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, account_id')
        .eq('id', validatedData.store_id)
        .single();

      if (storeError || !store) {
        return {
          success: false,
          error: 'Store not found',
          code: ErrorCodes.NOT_FOUND,
        };
      }

      // Verify store belongs to the selected account
      if (store.account_id !== validatedData.account_id) {
        return {
          success: false,
          error: 'Store does not belong to the selected account',
          code: ErrorCodes.VALIDATION_ERROR,
        };
      }
    }

    // Calculate totals for each item
    // NOTE: The price_source field determines which price to use
    // This is passed from the frontend based on account selection
    let totalBeforeTax = 0;
    let totalAfterTax = 0;
    let grandTotal = 0;

    const itemsWithCalculations = validatedData.items.map((item) => {
      // item.before_tax already contains the correct price from price lookup
      const afterTax = calculateAfterTax(item.before_tax);
      const lineTotal = calculateLineTotal(afterTax, item.quantity);
      
      totalBeforeTax += item.before_tax * item.quantity;
      totalAfterTax += afterTax * item.quantity;
      grandTotal += lineTotal;

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        before_tax: item.before_tax,
        after_tax: afterTax,
        line_total: lineTotal,
      };
    });

    // Generate PO number
    const poNumber = await generatePONumber();

    // Insert purchase order with V2 fields
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        dealer_name: `${account.channel_type} - ${account.name}`,
        account_id: validatedData.account_id,
        store_id: validatedData.store_id || null,
        price_source: validatedData.price_source,  // Store which pricing was used
        po_date: validatedData.po_date,
        status: 'draft',
        total_before_tax: totalBeforeTax,
        total_after_tax: totalAfterTax,
        grand_total: grandTotal,
        created_by: user.id,
      })
      .select(`
        *,
        account:accounts(id, name, channel_type),
        store:stores(id, name, account_id)
      `)
      .single();

    if (poError) {
      console.error('Error creating purchase order:', poError);
      return {
        success: false,
        error: 'Failed to create purchase order',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Insert purchase order items
    const itemsToInsert = itemsWithCalculations.map((item) => ({
      po_id: po.id,
      ...item,
    }));

    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)
      .select('*, product:products(*)');

    if (itemsError) {
      console.error('Error creating purchase order items:', itemsError);
      // Rollback: delete the PO
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      return {
        success: false,
        error: 'Failed to create purchase order items',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const result: PurchaseOrder = {
      ...po,
      items: items || [],
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Unexpected error in createPurchaseOrderV2:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
```

---

### Frontend Usage Example

**Typical Flow:**

1. Manager selects an Account (e.g., "Brandstore - Dreame Brandstore")
2. System determines price_source based on account (e.g., "brandstore")
3. When adding products, frontend calls `getProductPriceBySource(productId, "brandstore")`
4. System looks up `channel_pricing.brandstore` from JSONB
5. Price is displayed and used in PO creation
6. PO is created with `price_source: "brandstore"` stored for reference

**Example JSONB Query:**

```typescript
// Frontend code (simplified)
const account = selectedAccount; // { id: '...', channel_type: 'Brandstore', name: 'Dreame Brandstore' }
const priceSource = account.channel_type.toLowerCase().replace(' ', '_'); // 'brandstore'

// Call server action to get price
const result = await getProductPriceBySource(productId, priceSource);

if (result.success) {
  const price = result.data; // Price from channel_pricing.brandstore
  // Use this price in the PO form
}
```

---

### Price Source Mapping

| Account Channel Type | Price Source Key | JSONB Lookup |
|---------------------|------------------|--------------|
| Brandstore | `brandstore` | `channel_pricing.brandstore` |
| Modern Channel | `modern_channel` | `channel_pricing.modern_channel` |
| Dealer | `dealer` | `price_buy` (base dealer price) |
| Retailer | `retail` | `price_retail` (retail price) |
| Hangon | `hangon` | `channel_pricing.hangon` |
| Custom Channel | `custom_key` | `channel_pricing.custom_key` |

---

### Key Points

1. **JSONB Flexibility**: The `channel_pricing` JSONB column allows unlimited custom channel keys without schema changes

2. **Fallback Logic**: If a channel key doesn't exist in JSONB, the system falls back to `price_buy` (dealer price)

3. **Price Source Tracking**: The `price_source` field in `purchase_orders` table records which pricing was used for audit purposes

4. **Security**: Only Admin and Manager roles can access pricing information and create purchase orders

5. **Type Safety**: TypeScript interfaces ensure type safety when working with JSONB data

---

**End of Technical Notes**
