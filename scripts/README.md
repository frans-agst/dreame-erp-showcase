# Migration Testing Scripts

This directory contains scripts for testing the sub-category standardization migration.

## Files

### 1. test-subcategory-migration.sql
**Purpose**: Pre-migration data audit

Run this script BEFORE executing the migration to document the current state of sub-category values in your database.

**What it does**:
- Lists all distinct sub_category values
- Counts products per sub_category
- Identifies products that will be affected by the migration
- Provides sample products showing current values

**Usage**:
```sql
-- In Supabase SQL Editor, run this entire script
-- Save the output for comparison
```

### 2. verify-subcategory-migration.sql
**Purpose**: Post-migration verification

Run this script AFTER executing the migration to verify all changes were applied correctly.

**What it does**:
- Checks that no old values remain
- Verifies new standardized values exist
- Confirms total product count is unchanged
- Validates all distinct values match the dropdown
- Provides a comprehensive verification summary

**Usage**:
```sql
-- In Supabase SQL Editor, run this entire script
-- Compare results with pre-migration audit
```

### 3. MIGRATION-TESTING-GUIDE.md
**Purpose**: Step-by-step testing instructions

Comprehensive guide that walks you through:
- Running pre-migration audit (Task 3.1)
- Executing the migration (Task 3.2)
- Verifying migration results (Task 3.3)
- Testing migration idempotence (Task 3.4)

**Usage**:
Open this file and follow the step-by-step instructions.

## Quick Start

1. **Read the guide first**: Open `MIGRATION-TESTING-GUIDE.md`
2. **Run pre-migration audit**: Execute `test-subcategory-migration.sql` in Supabase SQL Editor
3. **Save the output**: Document the current state
4. **Run migration**: Execute `supabase/migrations/017_standardize_subcategory_values.sql`
5. **Verify results**: Execute `verify-subcategory-migration.sql`
6. **Test idempotence**: Run the migration again and verify 0 updates

## Testing Workflow

```
┌─────────────────────────────────────┐
│ 1. Pre-Migration Audit              │
│    test-subcategory-migration.sql   │
│    → Document current state         │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ 2. Run Migration                    │
│    017_standardize_subcategory_     │
│    values.sql                       │
│    → Update sub-category values     │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ 3. Post-Migration Verification      │
│    verify-subcategory-migration.sql │
│    → Confirm all changes applied    │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ 4. Idempotence Test                 │
│    Run migration again              │
│    → Verify 0 updates               │
└─────────────────────────────────────┘
```

## Requirements Validated

These scripts help validate:
- **Requirement 2.6**: Migration logs number of products updated
- **Requirement 5.1**: Only sub_category field is updated
- **Requirement 5.2**: No other product fields modified
- **Requirement 5.3**: No products deleted
- **Requirement 5.5**: Same number of products before and after
- **Requirement 2.5**: Migration is idempotent

## Support

If you encounter issues:
1. Check the Troubleshooting section in `MIGRATION-TESTING-GUIDE.md`
2. Verify database permissions
3. Ensure no other processes are modifying the database during migration
4. Review the migration logs for specific error messages

## Next Steps

After successful testing:
1. Proceed to Task 4: Write property test for value standardization
2. Proceed to Task 5: Test sub-category filtering functionality
3. Eventually deploy to production (Task 7)
