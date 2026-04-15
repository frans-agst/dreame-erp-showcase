# Multi-Store Staff Assignment - User Guide

Welcome to the multi-store staff assignment feature! This guide will help you understand and use the new capabilities for managing staff across multiple store locations.

## Table of Contents

1. [Overview](#overview)
2. [For Staff Members](#for-staff-members)
3. [For Administrators](#for-administrators)
4. [Frequently Asked Questions](#frequently-asked-questions)
5. [Troubleshooting](#troubleshooting)

---

## Overview

### What's New?

Previously, each staff member could only be assigned to one store. With the multi-store feature, staff members can now:

- Be assigned to multiple stores simultaneously
- Switch between their assigned stores easily
- View and manage data across all their assigned stores
- Have one "primary" store as their default

### Who Can Use This Feature?

- **Staff Members**: Can view and work with data from all their assigned stores
- **Administrators**: Can assign staff to multiple stores and manage these assignments
- **Managers & Dealers**: Continue to have access to all stores (no change)

### Key Concepts

**Assigned Stores**: The stores that a staff member has access to. Staff can only view and create data for their assigned stores.

**Primary Store**: The main store for a staff member. This is the default store shown when logging in and is used for backward compatibility.

**Store Context**: The currently active store that a staff member is viewing. This determines which store's data is displayed and where new records are created.

---

## For Staff Members

### Viewing Your Assigned Stores

When you log in, if you're assigned to multiple stores, you'll see a **Store Selector** in the header:

```
┌─────────────────────────────────────────┐
│  OmniERP ERP    Store: [Downtown ▼]     │
└─────────────────────────────────────────┘
```

The store selector shows:
- Your currently active store
- A dropdown to switch between your assigned stores

**Note**: If you're only assigned to one store, the store selector won't appear.

### Switching Between Stores

To switch to a different store:

1. Click on the **Store Selector** dropdown in the header
2. Select the store you want to work with
3. The page will reload with data from the selected store

**Example**:
```
Current: Downtown Store
Click dropdown → Select "Mall Store"
→ Page reloads showing Mall Store data
```

### Understanding Store Context

Your **store context** determines:
- Which store's data you see in lists and reports
- Which store new records are created in (sales, expenses, etc.)
- Which store's inventory you're viewing

**Important**: Always check the store selector before creating new records to ensure you're working in the correct store!

### Creating Records in Different Stores

#### Creating a Sale

1. Navigate to **Sales → Input**
2. Check the store selector in the header - this is where the sale will be created
3. If you need to create the sale in a different store:
   - Switch stores using the header selector first
   - Then create the sale
4. Fill in the sale details and submit

**Alternative Method**:
Some forms (like sales input) have their own store selector. You can choose the store directly in the form without switching your global store context.

#### Recording Expenses

1. Navigate to **Expenses**
2. Verify your current store context in the header
3. Click "Add Expense"
4. The expense will be recorded for your current store

#### Managing Inventory

1. Navigate to **Inventory**
2. By default, you'll see inventory from **all your assigned stores**
3. Use the store filter to view inventory for a specific store
4. The inventory table shows which store each item belongs to

**Inventory Table Example**:
```
Product         | Store          | Quantity | Value
─────────────────────────────────────────────────
Vacuum L10      | Downtown       | 15       | $4,500
Vacuum L10      | Mall Store     | 8        | $2,400
Mop M12         | Downtown       | 22       | $3,300
```

### Viewing Sales and Reports

#### Sales List

When viewing sales:
- You'll see sales from **all your assigned stores** by default
- Use the store filter to view sales from a specific store
- The sales table shows which store each sale belongs to

#### Weekly Sales Report

The weekly sales report shows data from all your assigned stores, grouped by store.

#### Dashboard

Your dashboard shows aggregated metrics across all your assigned stores.

### Best Practices for Multi-Store Staff

1. **Always Check Your Store Context**: Before creating any record, verify you're in the correct store
2. **Use Filters**: When viewing lists, use store filters to focus on one store at a time
3. **Understand Store Columns**: Pay attention to the store column in tables to know which store each record belongs to
4. **Primary Store**: Your primary store is your "home base" - it's selected by default when you log in

### What Hasn't Changed

- Your login credentials remain the same
- Your role and permissions are unchanged
- The interface looks the same (just with an added store selector)
- All existing features work the same way

---

## For Administrators

### Managing Store Assignments

As an administrator, you can assign staff members to multiple stores and manage these assignments.

#### Accessing the Assignment Management Page

1. Log in as an administrator
2. Navigate to **Master Data → Staff Assignments**
3. You'll see a list of all staff members with their current store assignments

#### Understanding the Staff Assignments List

The list shows:
- Staff member name and email
- All stores assigned to each staff member
- Primary store indicator (⭐ or "Primary" badge)
- Actions to manage assignments

**Example View**:
```
Staff Member          | Assigned Stores                    | Actions
────────────────────────────────────────────────────────────────────
John Doe             | ⭐ Downtown, Mall Store            | [Assign] [Remove]
john@example.com     |                                    | [Set Primary]
────────────────────────────────────────────────────────────────────
Jane Smith           | ⭐ Mall Store                      | [Assign] [Remove]
jane@example.com     |                                    | [Set Primary]
```

### Assigning a Store to Staff

To assign an additional store to a staff member:

1. Find the staff member in the list
2. Click the **"Assign Store"** button
3. In the dialog:
   - Select the store to assign
   - Optionally check "Set as Primary Store" if this should be their main store
4. Click **"Assign"**

**Important Notes**:
- A staff member can be assigned to the same store only once
- If you set a new primary store, the old primary store will automatically be unmarked
- The staff member will see the new store in their store selector immediately after their next login

### Removing a Store Assignment

To remove a store from a staff member:

1. Find the staff member in the list
2. Click the **"Remove Assignment"** button next to the store you want to remove
3. Confirm the removal in the dialog

**Important Restrictions**:
- You **cannot** remove the last store assignment - staff must have at least one store
- If you remove the primary store, another store will automatically become primary
- The staff member will lose access to that store's data immediately

### Changing the Primary Store

To change which store is primary for a staff member:

1. Find the staff member in the list
2. Click the **"Set Primary Store"** button
3. In the dialog, select the new primary store from their assigned stores
4. Click **"Set as Primary"**

**What Happens**:
- The old primary store becomes a regular assigned store
- The new store becomes the primary store (marked with ⭐)
- The staff member will see the new primary store by default on their next login

### Assignment Management Best Practices

1. **Plan Assignments Carefully**: Consider which stores each staff member actually works at
2. **Set Logical Primary Stores**: The primary store should be where the staff member works most often
3. **Communicate Changes**: Let staff know when you change their assignments
4. **Regular Reviews**: Periodically review assignments to ensure they're still accurate
5. **Minimum One Store**: Always ensure staff have at least one store assigned

### Viewing Assignment History

All store assignment changes are logged in the audit log:

1. Navigate to **Audit Log**
2. Filter by action type: "Store Assignment"
3. You'll see:
   - Who made the change (admin)
   - What changed (store assigned/removed/primary changed)
   - When it happened
   - Which staff member was affected

**Audit Log Example**:
```
Timestamp           | Admin          | Action              | Details
──────────────────────────────────────────────────────────────────────
2024-02-09 10:30    | admin@co.com   | Store Assigned      | Assigned Mall Store to john@example.com
2024-02-09 10:35    | admin@co.com   | Primary Changed     | Changed primary from Downtown to Mall Store
2024-02-09 11:00    | admin@co.com   | Store Removed       | Removed Downtown from jane@example.com
```

### Handling Special Cases

#### New Staff Member

When creating a new staff member:
1. Create the user account first
2. Assign their initial store (this becomes their primary store automatically)
3. Add additional stores if needed

#### Staff Member Transferring Stores

When a staff member permanently moves to a different store:
1. Assign the new store
2. Set the new store as primary
3. Remove the old store (if they no longer work there)

#### Staff Member Working Temporarily at Another Store

When a staff member temporarily works at another location:
1. Assign the temporary store (keep their original as primary)
2. They can switch between stores as needed
3. Remove the temporary store when no longer needed

#### Staff Member Leaving

When a staff member leaves the company:
1. Deactivate or delete their user account
2. All store assignments are automatically removed (CASCADE delete)

---

## Frequently Asked Questions

### For Staff Members

**Q: Why don't I see the store selector?**  
A: The store selector only appears if you're assigned to multiple stores. If you only have one store, there's no need to switch.

**Q: Can I be assigned to stores in different cities?**  
A: Yes! You can be assigned to any stores in the system, regardless of location.

**Q: What happens if I create a sale in the wrong store?**  
A: Contact your administrator. They may be able to help correct the record, but it's best to always verify your store context before creating records.

**Q: Will my store context reset when I log out?**  
A: When you log back in, you'll start with your primary store selected. Your last selected store is not remembered across sessions.

**Q: Can I see data from stores I'm not assigned to?**  
A: No. You can only view and create data for your assigned stores. This ensures data security and privacy.

**Q: How do I know which store a record belongs to?**  
A: Most tables include a "Store" column showing which store each record belongs to.

### For Administrators

**Q: Can I assign a staff member to all stores?**  
A: Yes, you can assign a staff member to as many stores as needed. However, consider if they really need access to all stores.

**Q: What happens to existing data when I change assignments?**  
A: Existing data is not affected. The staff member simply gains or loses access to view/create data for specific stores.

**Q: Can staff members assign themselves to stores?**  
A: No. Only administrators can manage store assignments.

**Q: Is there a limit to how many stores a staff member can be assigned to?**  
A: There's no technical limit, but for practical purposes, assign only the stores they actually work at.

**Q: What if I accidentally remove all stores from a staff member?**  
A: The system prevents this - you cannot remove the last store assignment. Staff must always have at least one store.

**Q: Can I bulk assign stores to multiple staff members?**  
A: Currently, assignments must be done individually. Bulk assignment may be added in a future update.

**Q: How do I know if a staff member has logged in after I changed their assignments?**  
A: Check the audit log for their login activity, or ask them to confirm they can see the new stores.

---

## Troubleshooting

### Issue: Store Selector Not Appearing

**Problem**: I'm assigned to multiple stores but don't see the store selector.

**Solutions**:
1. Log out and log back in to refresh your session
2. Clear your browser cache and reload the page
3. Verify with your administrator that you're actually assigned to multiple stores
4. Try a different browser

### Issue: Cannot See Data After Store Assignment

**Problem**: Administrator assigned me to a new store, but I can't see any data from it.

**Solutions**:
1. Log out and log back in to refresh your session
2. Check the store selector - make sure you've switched to the new store
3. Verify the store actually has data to display
4. Contact your administrator to confirm the assignment was successful

### Issue: "You Do Not Have Access to This Store" Error

**Problem**: Getting an error when trying to create a record.

**Solutions**:
1. Check your store context in the header
2. Verify you're assigned to the store you're trying to access
3. If you recently lost access to a store, log out and log back in
4. Contact your administrator if you believe you should have access

### Issue: Wrong Store Selected

**Problem**: I accidentally created a record in the wrong store.

**Solutions**:
1. Contact your administrator - they may be able to help correct it
2. In the future, always verify your store context before creating records
3. Use the store selector to switch to the correct store first

### Issue: Primary Store Confusion

**Problem**: I'm not sure which store is my primary store.

**Solutions**:
1. Your primary store is the one selected by default when you log in
2. Ask your administrator to confirm your primary store
3. The primary store is typically where you work most often

### Issue: Store Selector Dropdown Not Working

**Problem**: I can't click or open the store selector dropdown.

**Solutions**:
1. Refresh the page
2. Check browser console for JavaScript errors
3. Try a different browser
4. Clear browser cache
5. Contact IT support if the issue persists

### Issue: Data Showing from Wrong Store

**Problem**: I'm seeing data from a store I'm not assigned to.

**Solutions**:
1. This should not happen - it may be a security issue
2. Log out immediately
3. Contact your administrator and IT support
4. Document what you saw (screenshot if possible)

---

## Getting Help

### For Staff Members

If you need help with multi-store features:
1. Check this user guide first
2. Ask your store manager or supervisor
3. Contact your system administrator
4. Reach out to IT support

### For Administrators

If you need technical assistance:
1. Review the [Deployment Guide](./DEPLOYMENT.md)
2. Check the [API Documentation](./API-DOCUMENTATION.md)
3. Review Supabase logs for errors
4. Contact your development team or system integrator

---

## Tips for Success

### For Staff Members

✅ **DO**:
- Always check your store context before creating records
- Use store filters to focus on one store at a time
- Log out and back in if you experience issues
- Ask your administrator if you need access to additional stores

❌ **DON'T**:
- Don't assume you're in the right store - always verify
- Don't try to access stores you're not assigned to
- Don't share your login credentials with others
- Don't create records without checking the store context

### For Administrators

✅ **DO**:
- Assign stores based on actual work locations
- Set logical primary stores (where staff work most)
- Communicate assignment changes to affected staff
- Regularly review and update assignments
- Use the audit log to track changes

❌ **DON'T**:
- Don't assign unnecessary stores to staff
- Don't remove all stores from a staff member
- Don't forget to set a primary store
- Don't make changes without notifying affected staff
- Don't ignore assignment history in the audit log

---

## Feedback and Improvements

We're always looking to improve the multi-store feature. If you have:
- Suggestions for improvements
- Feature requests
- Bug reports
- Usability feedback

Please contact your system administrator or development team.

---

**Thank you for using the multi-store staff assignment feature!**

For technical documentation, see:
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./API-DOCUMENTATION.md)
- [Requirements Document](./requirements.md)
- [Design Document](./design.md)
