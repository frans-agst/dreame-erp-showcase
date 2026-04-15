# Credit Note Usage in Purchase Orders

## Overview
Implemented the ability for dealers to apply their available credit notes when creating purchase orders, with a maximum usage limit of 50% of the total order amount.

## Implementation Date
February 9, 2026

## Database Changes

### Migration: `013_add_credit_note_to_po.sql`

Added the following fields to support credit note usage:

**purchase_orders table:**
- `credit_note_id` (UUID, nullable) - Reference to the applied credit note
- `credit_note_amount` (DECIMAL) - Amount of credit note applied (max 50% of grand_total)

**credit_notes table:**
- `used_in_po_id` (UUID, nullable) - Reference to the PO where the credit note was used
- `used_at` (TIMESTAMPTZ) - Timestamp when the credit note was used

## Features

### 1. Credit Note Selection
- Dealers can view and select from their available credit notes when creating a PO
- Only shows credit notes with status 'available' and not expired
- Optional field - dealers can choose not to use a credit note

### 2. Automatic Validation
- System validates that credit note belongs to the dealer
- Checks if credit note is still available (not already used)
- Verifies credit note hasn't expired
- Enforces 50% maximum usage rule automatically

### 3. Smart Credit Note Application
- If credit note amount exceeds 50% of order total, only 50% is applied
- If credit note amount is less than 50%, full amount is applied
- Real-time calculation shows discount and final total

### 4. Status Management
- When a credit note is applied to a PO, its status changes to 'used'
- The `used_in_po_id` field tracks which PO used the credit note
- The `used_at` timestamp records when it was used

## User Interface

### Credit Note Selection
- Dropdown showing available credit notes with:
  - Amount
  - Description
  - Expiry date (if applicable)
- Option to select "No credit note"

### Visual Feedback
- Blue info box shows when credit note is applied
- Displays the discount amount
- Shows warning if only partial amount can be used (due to 50% limit)

### Totals Display
- Shows original grand total
- Shows credit note discount (in green with minus sign)
- Shows final total after discount (bold, green)

## API Changes

### New Function: `getAvailableCreditNotes()`
**Location:** `src/actions/dealer.ts`

Returns all available credit notes for the current dealer that are:
- Status = 'available'
- Not expired (expires_at is null or in the future)

### Updated Function: `createDealerPurchaseOrder()`
**Location:** `src/actions/dealer.ts`

**New Parameter:**
- `credit_note_id` (optional) - ID of credit note to apply

**Logic:**
1. Validates credit note if provided
2. Calculates max allowed usage (50% of grand total)
3. Applies the lesser of credit note amount or max allowed
4. Stores credit note reference and amount in PO
5. Updates credit note status to 'used' with PO reference

## Type Updates

### PurchaseOrder Interface
Added fields:
- `credit_note_id?: string | null`
- `credit_note_amount?: number`

### CreditNote Interface
Added fields:
- `used_in_po_id?: string | null`
- `used_at?: string | null`

### DealerPOInput Interface
Added field:
- `credit_note_id?: string | null`

## Files Modified

1. **Database:**
   - `supabase/migrations/013_add_credit_note_to_po.sql` (new)

2. **Types:**
   - `src/types/index.ts`

3. **Actions:**
   - `src/actions/dealer.ts`
     - Added `getAvailableCreditNotes()`
     - Updated `createDealerPurchaseOrder()`
     - Updated `DealerPOInput` interface

4. **UI:**
   - `src/app/dealer/purchase-orders/new/page.tsx`
     - Added credit note selection dropdown
     - Added credit note info display
     - Updated totals calculation
     - Updated totals display

## Business Rules

1. **Maximum Usage:** Credit notes can only be applied up to 50% of the order's grand total
2. **Partial Usage:** Credit notes can be used partially - remaining balance stays available
3. **Full Usage:** When credit note balance reaches zero, status changes to 'used'
4. **Dealer Ownership:** Dealers can only use their own credit notes
5. **Expiry Check:** Expired credit notes cannot be used
6. **Status Validation:** Only 'available' credit notes can be applied

## Testing Checklist

- [ ] Dealer can see available credit notes in dropdown
- [ ] Expired credit notes are not shown
- [ ] Already used credit notes are not shown
- [ ] Credit note discount is calculated correctly
- [ ] 50% limit is enforced when credit note exceeds limit
- [ ] Full credit note amount is used when under 50% limit
- [ ] Final total is calculated correctly
- [ ] Credit note status changes to 'used' after PO creation
- [ ] PO stores correct credit_note_id and credit_note_amount
- [ ] Credit note records which PO used it (used_in_po_id)
- [ ] UI shows appropriate feedback messages
- [ ] Form validation works correctly

## Future Enhancements

1. Add credit note usage history view for dealers (track all POs where credit note was used)
2. Add ability to apply multiple credit notes to one PO
3. Add admin report showing credit note usage statistics
4. Add notification when credit note is about to expire
5. Add ability to reverse/refund credit note usage if PO is cancelled
