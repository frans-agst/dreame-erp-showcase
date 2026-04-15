# Debug Production Sales Achievement Issue

## Quick Diagnosis

Since you're using the same account and Supabase project, and weekly reports work, this is NOT an RLS/permissions issue. It's likely a **data query, date, or filtering issue**.

## Step 1: Check Browser Console (2 minutes)

1. Open production site: `https://your-site.vercel.app/sales`
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Refresh the page
5. Look for logs starting with `[getSalesAchievement]`

**Take a screenshot of the console and share it with me.**

Key things to look for:
- `Date range: { salesStartDate: '...', salesEndDate: '...' }` - Are the dates correct?
- `Sales data fetched: X` - Is X greater than 0?
- `First 3 sales: [...]` - Does it show actual sales data?

## Step 2: Test the Debug API (1 minute)

I've created a debug endpoint. Access it in your browser:

```
https://your-site.vercel.app/api/debug-sales?month=2026-03
```

This will show you:
- Your user info and role
- Date range being queried
- Number of stores and sales found
- Raw sales data
- Achievement calculations

**Copy the JSON output and share it with me.**

## Step 3: Check Sales Data in Supabase (1 minute)

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Check what months have sales data
SELECT 
  TO_CHAR(sale_date, 'YYYY-MM') as month,
  COUNT(*) as sale_count,
  SUM(total_price) as total_sales
FROM sales
GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
ORDER BY month DESC
LIMIT 12;
```

**Share the results** - this will show which months have sales data.

## Common Issues & Quick Fixes

### Issue 1: Wrong Month Selected
**Symptom:** Console shows "Sales data fetched: 0"
**Fix:** Select a different month that has sales data

### Issue 2: Brandstore Filter
**Symptom:** Console shows sales fetched, but UI shows Rp 0
**Fix:** The page filters for "brandstore" accounts. Check if your accounts have "brandstore" in the name.

Temporarily disable the filter:
```typescript
// In src/app/(dashboard)/sales/page.tsx, line 104-106
// Comment out:
// filteredData = filteredData.filter(a => 
//   a.account_name && a.account_name.toLowerCase().includes('brandstore')
// );
```

### Issue 3: Build Cache
**Symptom:** Changes don't appear in production
**Fix:** 
1. Go to Vercel Dashboard
2. Click "Redeploy"
3. Uncheck "Use existing build cache"
4. Deploy

### Issue 4: Date Timezone Issue
**Symptom:** Date range in console is wrong
**Fix:** Check the month parameter being passed

## Deploy Debug Endpoint

The debug endpoint I created needs to be deployed:

```bash
git add src/app/api/debug-sales/route.ts
git commit -m "Add debug endpoint for sales achievement"
git push
```

Wait for Vercel to deploy, then access:
```
https://your-site.vercel.app/api/debug-sales?month=2026-03
```

## What I Need From You

To help you fix this, please provide:

1. **Browser console output** from production (screenshot or text)
2. **Debug API response** (JSON output from /api/debug-sales)
3. **SQL query results** (which months have sales data)

With this information, I can pinpoint the exact issue and provide a specific fix.

## Most Likely Cause

Based on the symptoms (same account, same DB, weekly reports work), the most likely causes are:

1. **Client-side filter removing all data** (the "brandstore" filter)
2. **Wrong month selected** (no sales data for that month)
3. **Date calculation issue** (timezone or date format)

The console logs and debug API will tell us exactly which one it is.
