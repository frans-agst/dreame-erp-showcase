# Brandstore Filter Applied

## Changes Made
Filtered store selection on Dashboard and Weekly Report pages to show only brandstores.

## Files Modified

### 1. Dashboard Page
**File:** `dreame-erp/src/app/(dashboard)/dashboard/page.tsx`

**Change:** When fetching stores by account, filter to show only stores where `account.channel_type === 'Brandstore'`

```typescript
// Before: Showed all stores for selected account
setStores(result.data);

// After: Shows only brandstores for selected account
const brandstores = result.data.filter(store => {
  const account = accounts.find(a => a.id === store.account_id);
  return account?.channel_type === 'Brandstore';
});
setStores(brandstores);
```

### 2. Weekly Report Page
**File:** `dreame-erp/src/app/(dashboard)/sales/weekly/page.tsx`

**Change:** When filtering stores by account, only show brandstores

```typescript
// Before: Showed all stores (filtered by account if selected)
if (selectedAccount) {
  setFilteredStores(stores.filter(s => 'account_id' in s && s.account_id === selectedAccount));
} else {
  setFilteredStores(stores);
}

// After: Shows only brandstores (filtered by account if selected)
if (selectedAccount) {
  const accountStores = stores.filter(s => 'account_id' in s && s.account_id === selectedAccount);
  const brandstores = accountStores.filter(store => {
    const account = accounts.find(a => a.id === ('account_id' in store ? store.account_id : ''));
    return account?.channel_type === 'Brandstore';
  });
  setFilteredStores(brandstores);
} else {
  const brandstores = stores.filter(store => {
    const account = accounts.find(a => a.id === ('account_id' in store ? store.account_id : ''));
    return account?.channel_type === 'Brandstore';
  });
  setFilteredStores(brandstores);
}
```

## How It Works

### Channel Types
The system has different channel types for accounts:
- **Brandstore** - Official brand stores (what we want to show)
- **Retailer** - Third-party retailers
- **Modern Channel 1** - Best Yamada
- **Modern Channel 2** - Electronic City
- **Modern Channel 3** - Atria & Hartono

### Filter Logic
1. When an account is selected, fetch stores for that account
2. Filter the stores to only include those where the account's `channel_type` is "Brandstore"
3. Display only the filtered brandstores in the dropdown

### User Experience

**Before:**
- Dashboard store dropdown showed all stores (brandstores, retailers, modern channels)
- Weekly report store dropdown showed all stores

**After:**
- Dashboard store dropdown shows only brandstores
- Weekly report store dropdown shows only brandstores
- Other channel types (retailers, modern channels) are hidden from selection

## Testing

### Test 1: Dashboard Page
1. Go to Dashboard page
2. Select an account from the account dropdown
3. Check the store dropdown
4. Verify only brandstores appear (no retailers or modern channels)

### Test 2: Weekly Report Page
1. Go to Sales > Weekly Report page
2. Select an account from the account dropdown
3. Check the store dropdown
4. Verify only brandstores appear (no retailers or modern channels)

### Test 3: No Account Selected
1. On either page, leave account dropdown as "All Accounts"
2. Check the store dropdown
3. Verify only brandstores from all accounts appear

## Impact

### Positive
- Cleaner store selection focused on brandstores
- Reduces confusion by hiding irrelevant store types
- Aligns with business focus on brandstore performance

### Considerations
- If you need to see other channel types in the future, you'll need to:
  - Remove or modify these filters
  - Or add a toggle to show/hide other channel types

## Rollback
If you need to revert this change:

1. Remove the filter in dashboard page:
```typescript
// Change back to:
setStores(result.data);
```

2. Remove the filter in weekly report page:
```typescript
// Change back to:
if (selectedAccount) {
  setFilteredStores(stores.filter(s => 'account_id' in s && s.account_id === selectedAccount));
} else {
  setFilteredStores(stores);
}
```

## Status
✅ **APPLIED** - Store selection now shows only brandstores on Dashboard and Weekly Report pages.
