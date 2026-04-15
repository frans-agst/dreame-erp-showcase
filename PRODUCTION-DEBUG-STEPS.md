# Production Debugging Steps for Sales Achievement

## The Real Issue

Since you're using:
- ✅ Same account on local and production
- ✅ Same Supabase project
- ✅ Weekly reports work (so RLS is fine)
- ❌ Only Sales Achievement shows Rp 0

This is NOT an RLS issue. It's likely a **data query or date handling issue**.

## Debug Steps

### Step 1: Check Browser Console in Production

1. Open your production site: `https://omnierp-erp.vercel.app/sales` (or your actual URL)
2. Open Browser DevTools (F12)
3. Go to **Console** tab
4. Refresh the page
5. Look for these console logs:

```
[getSalesAchievement] Function called with month: ...
[getSalesAchievement] User: ...
[getSalesAchievement] Supabase client created
[getSalesAchievement] Fetching stores...
[getSalesAchievement] Stores fetched: X
[getSalesAchievement] Processing X stores
[getSalesAchievement] Date range: { salesStartDate: '...', salesEndDate: '...' }
[getSalesAchievement] Sales data fetched: X
[getSalesAchievement] First 3 sales: [...]
[getSalesAchievement] Sales by store: X stores
[getSalesAchievement] Sample aggregation: [...]
```

### Step 2: Identify the Problem

Look at the console output:

**If "Sales data fetched: 0":**
- The query is returning no sales
- Check the date range in the logs
- The dates might be wrong (timezone issue or wrong month)

**If "Sales data fetched: X" (X > 0) but "Sales by store: 0":**
- Sales are fetched but not aggregated
- Likely a `store_id` mismatch issue

**If "Sample aggregation" shows data but UI shows Rp 0:**
- Data is fetched correctly
- Issue is in the client-side filtering

### Step 3: Check the Date Range

The most likely issue is the **date range**. In the console, check:

```
[getSalesAchievement] Date range: { salesStartDate: '2026-03-01', salesEndDate: '2026-03-31' }
```

**Common issues:**
- Wrong month (e.g., showing February instead of March)
- Wrong year (e.g., 2025 instead of 2026)
- Timezone causing date shift

### Step 4: Verify Sales Data Exists

Open Supabase Dashboard → SQL Editor and run:

```sql
-- Check if sales exist for March 2026
SELECT 
  sale_date,
  store_id,
  total_price,
  COUNT(*) OVER() as total_count
FROM sales
WHERE sale_date >= '2026-03-01'
  AND sale_date <= '2026-03-31'
ORDER BY sale_date DESC
LIMIT 10;
```

**If no results:**
- Sales don't exist for March 2026 in production
- Check what months have sales:

```sql
SELECT 
  DATE_TRUNC('month', sale_date) as month,
  COUNT(*) as sale_count,
  SUM(total_price) as total_sales
FROM sales
GROUP BY DATE_TRUNC('month', sale_date)
ORDER BY month DESC;
```

### Step 5: Check Client-Side Filtering

The page has this filter:

```typescript
// Filter to show only Brandstore (OmniERP Brandstore) accounts
filteredData = filteredData.filter(a => 
  a.account_name && a.account_name.toLowerCase().includes('brandstore')
);
```

**This might be filtering out all data!**

Check in console if the data has `account_name` with "brandstore":

```javascript
// In browser console, after the page loads:
console.log('Achievements before filter:', achievements);
```

## Most Likely Causes

### Cause 1: Date/Month Mismatch
The selected month in production doesn't have sales data.

**Solution:** Select a different month that has sales.

### Cause 2: Account Name Filter
The "brandstore" filter is removing all data because account names don't match.

**Solution:** Temporarily remove the filter to test:

```typescript
// Comment out this line in src/app/(dashboard)/sales/page.tsx
// filteredData = filteredData.filter(a => 
//   a.account_name && a.account_name.toLowerCase().includes('brandstore')
// );
```

### Cause 3: Timezone Issue
The date being passed to the server is different due to timezone.

**Solution:** Check the console log for the month parameter.

### Cause 4: Build Cache
Vercel is serving a cached version of the page.

**Solution:** 
1. Go to Vercel Dashboard
2. Find your deployment
3. Click "Redeploy" → "Use existing build cache: OFF"

## Quick Test

Add this temporary debug code to the page:

```typescript
// In src/app/(dashboard)/sales/page.tsx, after line 98
console.log('=== DEBUG INFO ===');
console.log('Selected month:', selectedMonth);
console.log('Month date:', monthDate);
console.log('Result:', result);
console.log('Raw data count:', result.data?.length);
console.log('After brandstore filter:', filteredData.length);
console.log('Sample data:', filteredData.slice(0, 2));
console.log('==================');
```

Then check the browser console in production.

## Expected Console Output (Working)

```
[getSalesAchievement] Function called with month: Wed Mar 01 2026 00:00:00 GMT+0700
[getSalesAchievement] User: abc123-user-id
[getSalesAchievement] Supabase client created
[getSalesAchievement] Fetching stores...
[getSalesAchievement] Stores fetched: 6
[getSalesAchievement] Processing 6 stores
[getSalesAchievement] Date range: { salesStartDate: '2026-03-01', salesEndDate: '2026-03-31' }
[getSalesAchievement] Sales data fetched: 15
[getSalesAchievement] First 3 sales: [{store_id: '...', total_price: 53616000}, ...]
[getSalesAchievement] Sales by store: 6 stores
[getSalesAchievement] Sample aggregation: [['store-id-1', 53616000], ['store-id-2', 0]]
```

## Next Steps

1. **Check browser console** in production
2. **Share the console output** with me
3. Based on the logs, we'll identify the exact issue
4. Apply the specific fix

The console logs will tell us exactly where the data is being lost!
