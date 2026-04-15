# Tax Calculation Logic - Reverse Implementation

## Overview
Updated the tax calculation logic to handle prices that already include VAT (tax-inclusive pricing).

## Implementation Date
February 9, 2026

## Problem
The original system assumed prices were entered BEFORE tax and added 11% VAT:
- Input: Rp 800,000 (before tax)
- After Tax: Rp 888,000 (800,000 × 1.11)

However, the actual prices in the database are already tax-inclusive, so we need to reverse-calculate.

## Solution
Implemented reverse tax calculation to extract the before-tax amount from tax-inclusive prices.

### New Calculation Logic

**Given**: Price = Rp 888,000 (tax-inclusive)

**Calculate**:
- Before Tax = 888,000 / 1.11 = Rp 800,000
- After Tax = 888,000 (the original price)
- VAT Amount = 888,000 - 800,000 = Rp 88,000

### Formula
```
Before Tax = After Tax / 1.11
VAT Amount = After Tax - Before Tax
```

## Files Modified

### 1. src/lib/calculations.ts
Added new function:
```typescript
export function calculateBeforeTax(afterTax: number): number {
  return afterTax / 1.11;
}
```

### 2. src/actions/dealer.ts
Updated `createDealerPurchaseOrder()`:
- Changed price interpretation: prices from database are tax-inclusive
- Calculate before-tax by dividing by 1.11
- Store correct before-tax and after-tax amounts

### 3. src/app/dealer/purchase-orders/new/page.tsx
Updated display calculations:
- Product prices are treated as tax-inclusive
- Reverse-calculate to show before-tax amount
- Display correct VAT amount

## Impact

### Before Change
- Input Price: Rp 800,000
- System calculated: Rp 888,000 (added 11%)
- **Problem**: Prices were already tax-inclusive, so this double-counted tax

### After Change
- Input Price: Rp 888,000 (tax-inclusive)
- System calculates: Rp 800,000 before tax, Rp 88,000 VAT
- **Correct**: Properly extracts tax component from inclusive price

## Display Changes

### PO Summary Display
```
Total Before Tax: Rp 800,000  (calculated: 888,000 / 1.11)
VAT (11%):        Rp  88,000  (calculated: 888,000 - 800,000)
Subtotal:         Rp 888,000  (the actual price)
```

## Testing

To verify the calculation:
1. Create a PO with a product priced at Rp 888,000
2. Check that Before Tax shows Rp 800,000
3. Check that VAT shows Rp 88,000
4. Check that Subtotal shows Rp 888,000

### Validation Formula
```
Before Tax × 1.11 = After Tax
800,000 × 1.11 = 888,000 ✓
```

## Notes

- This change affects ALL purchase orders (dealer POs)
- Existing POs in database are not affected (historical data preserved)
- Only new POs created after this change will use reverse calculation
- The database schema remains unchanged - only calculation logic updated
