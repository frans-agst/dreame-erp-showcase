# Sub-Category Differentiation - Quick Fix Guide

## Problem
Sub-category filtering on the sales input page isn't working because database values don't match the frontend dropdown options.

## Quick Fix (3 Steps)

### Step 1: Diagnose the Issue
Run this in Supabase SQL Editor:
```
omnierp-erp/scripts/diagnose-subcategory-issue.sql
```

This will show you:
- What sub-category values exist in your database
- Which ones don't match the dropdown
- How many products are affected

### Step 2: Apply the Fix
Run this in Supabase SQL Editor:
```
omnierp-erp/scripts/fix-subcategory-differentiation.sql
```

This will automatically fix:
- Old format values (e.g., "Wet And Dry Vacuum" → "Wet & Dry")
- Whitespace issues (if you uncomment that section)
- Case sensitivity issues (if you uncomment that section)

### Step 3: Verify the Fix
Run this in Supabase SQL Editor:
```
omnierp-erp/scripts/verify-subcategory-migration.sql
```

This will confirm:
- All old values are updated
- All values match the dropdown
- No invalid values remain

## Expected Result

After running these scripts, your database should only have these 8 sub-category values:
1. `Wet & Dry`
2. `Robovac`
3. `Beauty`
4. `Stick Vacuum`
5. `Purifier`
6. `Mite Removal`
7. `Small Appliances`
8. `Others`

## Test the Fix

1. Go to Sales Input page
2. Select a sub-category from the dropdown
3. Verify that products appear in the product dropdown
4. Try all 8 sub-categories to confirm filtering works

## If Issues Persist

If you still see differentiation issues after running the fix:

1. Check the diagnostic output for "Extra Values"
2. These are values in your database that aren't in the dropdown
3. You have two options:
   - **Option A:** Add them to the dropdown (edit `src/lib/product-categories.ts`)
   - **Option B:** Map them to existing values (uncomment Fix 4 in the fix script)

## Files Created

1. **diagnose-subcategory-issue.sql** - Comprehensive diagnostic report
2. **fix-subcategory-differentiation.sql** - Automated fix script
3. **SUBCATEGORY-DIFFERENTIATION-ANALYSIS.md** - Detailed analysis and solutions

## Common Issues

### Issue: "Steam Cleaner" or "Accessory" in database
**Solution:** Either add to dropdown or map to "Others"

### Issue: Products added after migration have old values
**Solution:** Run the fix script again (it's safe to run multiple times)

### Issue: API sync is adding old format values
**Solution:** Update the API sync code to use new format values

## Need More Help?

See the full analysis report:
```
omnierp-erp/SUBCATEGORY-DIFFERENTIATION-ANALYSIS.md
```
