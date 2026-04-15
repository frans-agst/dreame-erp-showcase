# Sub-Category Migration Testing Guide

This guide provides step-by-step instructions for testing the sub-category standardization migration on your development database.

## Overview

The migration updates product sub-category values to match the frontend dropdown options:
- "Wet And Dry Vacuum" → "Wet & Dry"
- "Mite Remover" → "Mite Removal"
- "Small Appliance" → "Small Appliances"
- "Air Purifier" → "Purifier"

## Prerequisites

- Access to Supabase development database
- SQL Editor access in Supabase Dashboard
- OR Supabase CLI installed and configured

## Testing Steps

### Step 1: Run Pre-Migration Audit (Task 3.1)

**Purpose**: Document the current state of sub-category values before migration.

**Instructions**:

1. Open Supabase Dashboard → SQL Editor
2. Open the file: `scripts/test-subcategory-migration.sql`
3. Copy and paste the entire script into SQL Editor
4. Click "Run" to execute
5. **Save the output** - you'll need it for comparison

**Expected Output**:
- List of all distinct sub_category values
- Count of products per sub_category
- Total product count
- List of products that will be affected
- Sample products showing current values

**What to Document**:
```
Total products: ___________
Products with "Wet And Dry Vacuum": ___________
Products with "Mite Remover": ___________
Products with "Small Appliance": ___________
Products with "Air Purifier": ___________
Total affected products: ___________
```

### Step 2: Run Migration Script (Task 3.2)

**Purpose**: Execute the migration to update sub-category values.

**Instructions**:

1. Open Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/017_standardize_subcategory_values.sql`
3. Copy and paste the entire script into SQL Editor
4. Click "Run" to execute
5. **Check for errors** - there should be none
6. **Review the migration logs** in the output

**Expected Output**:
- Pre-migration audit showing current values
- Transaction BEGIN/COMMIT messages
- Post-migration log showing:
  - Number of products updated for each category
  - Verification that old values are gone
  - Success message

**What to Verify**:
- [ ] No SQL errors occurred
- [ ] Transaction completed successfully
- [ ] Migration log shows expected number of updates
- [ ] Success message: "✓ SUCCESS: All old sub-category values have been updated"

### Step 3: Verify Migration Results (Task 3.3)

**Purpose**: Confirm all changes were applied correctly.

**Instructions**:

1. Open Supabase Dashboard → SQL Editor
2. Open the file: `scripts/verify-subcategory-migration.sql`
3. Copy and paste the entire script into SQL Editor
4. Click "Run" to execute
5. **Compare with pre-migration output**

**Expected Results**:

✓ **Verification 1**: Old values remaining = 0
- No products should have "Wet And Dry Vacuum", "Mite Remover", "Small Appliance", or "Air Purifier"

✓ **Verification 2**: New values exist
- Products with "Wet & Dry" > 0
- Products with "Mite Removal" > 0
- Products with "Small Appliances" > 0
- Products with "Purifier" > 0

✓ **Verification 3**: All distinct values match dropdown
- Should see: Accessory, Beauty, Mite Removal, Others, Purifier, Robovac, Small Appliances, Steam Cleaner, Stick Vacuum, Wet & Dry

✓ **Verification 4**: Total product count unchanged
- Compare with pre-migration count - should be identical

✓ **Verification 5**: Sample products show new values
- Products that had old values now show new values

✓ **Verification 6**: Unchanged values still exist
- Robovac, Beauty, Stick Vacuum, etc. should still have products

✓ **Verification 7**: Updated timestamps
- Products should have recent updated_at timestamps

**Checklist**:
- [ ] Old values remaining = 0
- [ ] All new values present
- [ ] Total product count unchanged
- [ ] All distinct values match dropdown
- [ ] Sample products verified
- [ ] Unchanged categories still exist
- [ ] All checks passed in summary

### Step 4: Test Migration Idempotence (Task 3.4)

**Purpose**: Verify the migration is safe to run multiple times.

**Instructions**:

1. Open Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/017_standardize_subcategory_values.sql`
3. Copy and paste the entire script into SQL Editor
4. Click "Run" to execute **a second time**
5. **Check the migration logs**

**Expected Results**:

✓ **No errors** - migration should complete successfully
✓ **Zero updates** - migration log should show:
  - "Wet & Dry products: X" (same as before)
  - "Mite Removal products: X" (same as before)
  - "Small Appliances products: X" (same as before)
  - "Purifier products: X" (same as before)
  - No UPDATE statements should affect any rows

✓ **Database state unchanged** - run verification script again:
```sql
-- Quick check: should return 0
SELECT COUNT(*) as old_values_remaining
FROM public.products 
WHERE sub_category IN ('Wet And Dry Vacuum', 'Mite Remover', 'Small Appliance', 'Air Purifier');
```

**Checklist**:
- [ ] Migration ran without errors
- [ ] No products were updated (0 rows affected)
- [ ] Database state is identical to after first run
- [ ] Verification script shows same results

## Alternative: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Connect to your development database
supabase db remote set <your-project-ref>

# Run pre-migration audit
psql <your-connection-string> -f scripts/test-subcategory-migration.sql > pre-migration-audit.txt

# Run migration
supabase db push

# Run post-migration verification
psql <your-connection-string> -f scripts/verify-subcategory-migration.sql > post-migration-verification.txt

# Run migration again (idempotence test)
supabase db push

# Verify no changes
psql <your-connection-string> -f scripts/verify-subcategory-migration.sql > idempotence-verification.txt
```

## Troubleshooting

### Issue: Old values still remain after migration

**Cause**: Migration may not have completed successfully

**Solution**:
1. Check for SQL errors in migration output
2. Verify transaction completed (look for COMMIT message)
3. Run migration again (it's idempotent)
4. If still failing, check database permissions

### Issue: Product count changed

**Cause**: Products may have been deleted or added during migration

**Solution**:
1. Check if any other processes are modifying the database
2. Verify no products were deleted
3. Run migration on a stable database snapshot

### Issue: Migration fails with permission error

**Cause**: Insufficient database permissions

**Solution**:
1. Ensure you're using service role key or admin credentials
2. Check RLS policies aren't blocking updates
3. Verify you have UPDATE permission on products table

## Success Criteria

All tasks are complete when:

- [x] Pre-migration audit completed and documented
- [x] Migration executed successfully with no errors
- [x] Post-migration verification shows all checks passed
- [x] Idempotence test shows 0 updates on second run
- [x] Total product count unchanged
- [x] All old values replaced with new values
- [x] Unchanged categories still exist

## Next Steps

After successful testing on development:

1. Proceed to Task 4: Write property test for value standardization
2. Proceed to Task 5: Test sub-category filtering functionality
3. Eventually deploy to production (Task 7)

## Files Reference

- **Pre-migration audit**: `scripts/test-subcategory-migration.sql`
- **Migration script**: `supabase/migrations/017_standardize_subcategory_values.sql`
- **Post-migration verification**: `scripts/verify-subcategory-migration.sql`
- **This guide**: `scripts/MIGRATION-TESTING-GUIDE.md`

## Requirements Validated

This testing process validates:
- **Requirement 2.6**: Migration logs number of products updated
- **Requirement 5.1**: Only sub_category field is updated
- **Requirement 5.2**: No other product fields modified
- **Requirement 5.3**: No products deleted
- **Requirement 5.5**: Same number of products before and after
- **Requirement 2.5**: Migration is idempotent
