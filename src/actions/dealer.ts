'use server';

import { createClient } from '@/lib/supabase/server';
import { PurchaseOrder, CreditNote, DealerProduct, Store } from '@/types';
import { calculateAfterTax, calculateLineTotal } from '@/lib/calculations';

// ============================================================================
// Types
// ============================================================================

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export interface DealerDashboardData {
  total_purchases_ytd: number;
  total_purchases_mtd: number;
  available_credit: number;
  pending_pos: number;
  recent_orders: PurchaseOrder[];
}

export interface DealerPOFilters {
  status?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedDealerPOResult {
  data: PurchaseOrder[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

async function checkDealerRole(): Promise<ActionResult<string> | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      success: false,
      error: 'You must be logged in',
      code: ErrorCodes.UNAUTHORIZED,
    };
  }
  
  const role = user.app_metadata?.role;
  
  if (role !== 'dealer') {
    return {
      success: false,
      error: 'Access denied. Dealer role required.',
      code: ErrorCodes.FORBIDDEN,
    };
  }
  
  return null;
}

async function generateDealerPONumber(): Promise<string> {
  const supabase = await createClient();
  
  // Use database function for atomic PO number generation
  const { data, error } = await supabase.rpc('generate_dealer_po_number');
  
  if (error) {
    console.error('Error generating PO number:', error);
    // Fallback to timestamp-based number if function fails
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-4);
    return `DPO-${dateStr}-${timestamp}`;
  }
  
  return data as string;
}

// ============================================================================
// Dealer Store Access - For Reporting Only
// ============================================================================

/**
 * Get all active stores for dealer selection (reporting purposes only)
 * Dealers can view and select any store except Modern Channel stores
 */
export async function getDealerStores(): Promise<ActionResult<Store[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const roleCheck = await checkDealerRole();
    if (roleCheck) return roleCheck as ActionResult<Store[]>;

    const supabase = await createClient();

    // Get all active stores with account info, excluding Modern Channel
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('*, account:accounts(*)')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (storesError) {
      console.error('Error fetching stores:', storesError);
      return {
        success: false,
        error: 'Failed to fetch stores',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Filter out Modern Channel stores
    const filteredStores = (stores || []).filter(store => {
      const account = store.account as unknown as { channel_type: string } | null;
      return account?.channel_type !== 'Modern Channel';
    });

    return { success: true, data: filteredStores as Store[] };
  } catch (error) {
    console.error('Unexpected error in getDealerStores:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// ============================================================================
// Dealer Dashboard Actions
// ============================================================================

export async function getDealerDashboard(): Promise<ActionResult<DealerDashboardData>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const roleCheck = await checkDealerRole();
    if (roleCheck) return roleCheck as ActionResult<DealerDashboardData>;

    const supabase = await createClient();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const startOfYear = `${currentYear}-01-01`;
    const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;

    const { data: ytdData } = await supabase
      .from('purchase_orders')
      .select('grand_total')
      .eq('created_by', user.id)
      .eq('status', 'confirmed')
      .gte('po_date', startOfYear);

    const total_purchases_ytd = ytdData?.reduce((sum, po) => sum + (po.grand_total || 0), 0) || 0;

    const { data: mtdData } = await supabase
      .from('purchase_orders')
      .select('grand_total')
      .eq('created_by', user.id)
      .eq('status', 'confirmed')
      .gte('po_date', startOfMonth);

    const total_purchases_mtd = mtdData?.reduce((sum, po) => sum + (po.grand_total || 0), 0) || 0;

    const { data: creditData } = await supabase
      .from('credit_notes')
      .select('amount')
      .eq('dealer_id', user.id)
      .eq('status', 'available');

    const available_credit = creditData?.reduce((sum, cn) => sum + (cn.amount || 0), 0) || 0;

    const { count: pending_pos } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('status', 'draft');

    const { data: recentOrders } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      success: true,
      data: {
        total_purchases_ytd,
        total_purchases_mtd,
        available_credit,
        pending_pos: pending_pos || 0,
        recent_orders: recentOrders || [],
      },
    };
  } catch (error) {
    console.error('Unexpected error in getDealerDashboard:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// ============================================================================
// Dealer Product Actions - Uses Retailer Price
// ============================================================================

/**
 * Get products with retailer pricing (channel_pricing.retailer) for dealers
 */
export async function getDealerProducts(activeOnly: boolean = true): Promise<ActionResult<DealerProduct[]>> {
  try {
    const roleCheck = await checkDealerRole();
    if (roleCheck) return roleCheck as ActionResult<DealerProduct[]>;

    const supabase = await createClient();
    
    let query = supabase
      .from('products')
      .select('id, sku, name, category, sub_category, channel_pricing, is_active')
      .order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching dealer products:', error);
      return {
        success: false,
        error: 'Failed to fetch products',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // Map to DealerProduct type - use channel_pricing.retailer only
    const dealerProducts: DealerProduct[] = (data || []).map(p => {
      const channelPricing = (p.channel_pricing as Record<string, number>) || {};
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        sub_category: p.sub_category,
        price: channelPricing.retailer || 0,
        is_active: p.is_active,
      };
    });
    
    return { success: true, data: dealerProducts };
  } catch (error) {
    console.error('Unexpected error in getDealerProducts:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// ============================================================================
// Dealer Purchase Order Actions
// ============================================================================

export async function getDealerPurchaseOrders(
  filters: DealerPOFilters = {}
): Promise<ActionResult<PaginatedDealerPOResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const roleCheck = await checkDealerRole();
    if (roleCheck) return roleCheck as ActionResult<PaginatedDealerPOResult>;

    const supabase = await createClient();
    const page = filters.page || 1;
    const pageSize = filters.page_size || 10;
    const offset = (page - 1) * pageSize;

    let countQuery = supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', user.id);

    let dataQuery = supabase
      .from('purchase_orders')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (filters.status) {
      countQuery = countQuery.eq('status', filters.status);
      dataQuery = dataQuery.eq('status', filters.status);
    }

    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

    if (countResult.error || dataResult.error) {
      console.error('Error fetching dealer POs:', countResult.error || dataResult.error);
      return {
        success: false,
        error: 'Failed to fetch purchase orders',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const total = countResult.count || 0;
    const totalPages = Math.ceil(total / pageSize);

    const posWithItems: PurchaseOrder[] = await Promise.all(
      (dataResult.data || []).map(async (po) => {
        const { data: items } = await supabase
          .from('purchase_order_items')
          .select('*, product:products(sku, name)')
          .eq('po_id', po.id);

        return {
          ...po,
          items: items || [],
        };
      })
    );

    return {
      success: true,
      data: {
        data: posWithItems,
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
      },
    };
  } catch (error) {
    console.error('Unexpected error in getDealerPurchaseOrders:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Input type for dealer purchase order - store selection required for reporting
 */
export interface DealerPOInput {
  po_date: string;
  store_id: string; // Required - dealer must select a store for reporting purposes
  items: { product_id: string; quantity: number }[];
  credit_note_id?: string | null;
}

/**
 * Create a dealer purchase order - dealer selects store for reporting purposes
 * Store selection is required and can be any active store
 */
export async function createDealerPurchaseOrder(
  data: DealerPOInput
): Promise<ActionResult<PurchaseOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const roleCheck = await checkDealerRole();
    if (roleCheck) return roleCheck as ActionResult<PurchaseOrder>;

    const supabase = await createClient();

    // Get dealer's profile information
    const { data: dealerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching dealer profile:', profileError);
    }

    // Validate store_id is provided
    if (!data.store_id) {
      return {
        success: false,
        error: 'Store selection is required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Get store with account info (verify it exists and is active)
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, account_id, account:accounts(id, name, channel_type)')
      .eq('id', data.store_id)
      .eq('is_active', true)
      .single();

    if (storeError || !store) {
      return {
        success: false,
        error: 'Invalid store selection',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Get product prices (channel_pricing.retailer only)
    const productIds = data.items.map(item => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, channel_pricing')
      .in('id', productIds);

    if (productsError || !products) {
      return {
        success: false,
        error: 'Failed to fetch product prices',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Extract retailer price from channel_pricing only
    const priceMap = new Map(products.map(p => {
      const channelPricing = (p.channel_pricing as Record<string, number>) || {};
      return [p.id, channelPricing.retailer || 0];
    }));

    // Calculate totals using retailer price (which is tax-inclusive)
    // We need to reverse-calculate to get before-tax amounts
    let totalBeforeTax = 0;
    let totalAfterTax = 0;
    let grandTotal = 0;

    const itemsWithCalculations = data.items.map((item) => {
      const priceIncludingTax = priceMap.get(item.product_id) || 0; // This is the tax-inclusive price
      const beforeTax = priceIncludingTax / 1.11; // Reverse calculate: remove 11% VAT
      const afterTax = priceIncludingTax; // The price we have IS after tax
      const lineTotal = calculateLineTotal(afterTax, item.quantity);
      
      totalBeforeTax += beforeTax * item.quantity;
      totalAfterTax += afterTax * item.quantity;
      grandTotal += lineTotal;

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        before_tax: beforeTax,
        after_tax: afterTax,
        line_total: lineTotal,
      };
    });

    // Validate and apply credit note if provided
    let creditNoteAmount = 0;
    let creditNoteId: string | null = null;

    if (data.credit_note_id) {
      // Fetch the credit note
      const { data: creditNote, error: creditNoteError } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('id', data.credit_note_id)
        .eq('dealer_id', user.id)
        .eq('status', 'available')
        .single();

      if (creditNoteError || !creditNote) {
        return {
          success: false,
          error: 'Invalid or unavailable credit note',
          code: ErrorCodes.VALIDATION_ERROR,
        };
      }

      // Check if credit note is expired
      if (creditNote.expires_at) {
        const expiryDate = new Date(creditNote.expires_at);
        const today = new Date();
        if (expiryDate < today) {
          return {
            success: false,
            error: 'Credit note has expired',
            code: ErrorCodes.VALIDATION_ERROR,
          };
        }
      }

      // Calculate max credit note usage (50% of grand total)
      const maxCreditNoteUsage = grandTotal * 0.5;

      // Use the lesser of credit note amount or max allowed
      creditNoteAmount = Math.min(creditNote.amount, maxCreditNoteUsage);
      creditNoteId = creditNote.id;

      // Validate that credit note doesn't exceed 50%
      if (creditNote.amount > maxCreditNoteUsage) {
        // We'll use only the max allowed amount
        console.log(`Credit note amount (${creditNote.amount}) exceeds 50% limit. Using ${creditNoteAmount} instead.`);
      }
    }

    const poNumber = await generateDealerPONumber();
    
    // Use dealer's profile name for dealer_name field
    const dealerName = dealerProfile?.full_name || dealerProfile?.email || user.email || 'Dealer';

    // Insert purchase order with selected store and credit note
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        account_id: store.account_id,
        store_id: store.id,
        dealer_name: dealerName, // Use dealer's name instead of store account
        price_source: 'retailer', // Always retailer price for dealer
        po_date: data.po_date,
        status: 'draft',
        total_before_tax: totalBeforeTax,
        total_after_tax: totalAfterTax,
        grand_total: grandTotal - creditNoteAmount, // Subtract credit note from grand total
        credit_note_id: creditNoteId,
        credit_note_amount: creditNoteAmount,
        created_by: user.id,
      })
      .select()
      .single();

    if (poError) {
      console.error('Error creating dealer PO:', poError);
      return {
        success: false,
        error: `Failed to create purchase order: ${poError.message}`,
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Insert items
    const itemsToInsert = itemsWithCalculations.map((item) => ({
      po_id: po.id,
      ...item,
    }));

    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)
      .select('*, product:products(sku, name)');

    if (itemsError) {
      console.error('Error creating dealer PO items:', itemsError);
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      return {
        success: false,
        error: `Failed to create purchase order items: ${itemsError.message}`,
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // If credit note was applied, update its remaining amount
    if (creditNoteId) {
      // Use admin client to bypass RLS for credit note updates
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const adminSupabase = createAdminClient();
      
      const { data: creditNote } = await adminSupabase
        .from('credit_notes')
        .select('amount')
        .eq('id', creditNoteId)
        .single();

      if (creditNote) {
        const remainingAmount = creditNote.amount - creditNoteAmount;
        
        if (remainingAmount <= 0) {
          // Fully used - mark as used
          const { error: updateError } = await adminSupabase
            .from('credit_notes')
            .update({
              status: 'used',
              used_in_po_id: po.id,
              used_at: new Date().toISOString(),
            })
            .eq('id', creditNoteId);

          if (updateError) {
            console.error('Error updating credit note status:', updateError);
          }
        } else {
          // Partially used - reduce the amount
          const { error: updateError } = await adminSupabase
            .from('credit_notes')
            .update({
              amount: remainingAmount,
            })
            .eq('id', creditNoteId);

          if (updateError) {
            console.error('Error updating credit note amount:', updateError);
          }
        }
      }
    }

    // Fetch store info to include in response
    const { data: storeWithAccount } = await supabase
      .from('stores')
      .select('*, account:accounts(*)')
      .eq('id', store.id)
      .single();

    return {
      success: true,
      data: {
        ...po,
        store: storeWithAccount as Store,
        items: items || [],
      },
    };
  } catch (error) {
    console.error('Unexpected error in createDealerPurchaseOrder:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// ============================================================================
// Dealer Credit Notes Actions
// ============================================================================

/**
 * Get available credit notes for the current dealer
 */
export async function getAvailableCreditNotes(): Promise<ActionResult<CreditNote[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const roleCheck = await checkDealerRole();
    if (roleCheck) return roleCheck as ActionResult<CreditNote[]>;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('credit_notes')
      .select('*')
      .eq('dealer_id', user.id)
      .eq('status', 'available')
      .or('expires_at.is.null,expires_at.gte.' + new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching available credit notes:', error);
      return {
        success: false,
        error: 'Failed to fetch available credit notes',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getAvailableCreditNotes:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

export async function getDealerCreditNotes(): Promise<ActionResult<CreditNote[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const roleCheck = await checkDealerRole();
    if (roleCheck) return roleCheck as ActionResult<CreditNote[]>;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('credit_notes')
      .select('*')
      .eq('dealer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching credit notes:', error);
      return {
        success: false,
        error: 'Failed to fetch credit notes',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getDealerCreditNotes:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// ============================================================================
// Admin/Manager Credit Notes Management
// ============================================================================

export interface CreditNoteWithDealer extends Omit<CreditNote, 'dealer'> {
  dealer?: { id: string; full_name: string; email: string };
}

export interface CreditNoteFilters {
  dealer_id?: string;
  status?: string;
}

export interface CreditNoteInput {
  dealer_id: string;
  amount: number;
  description?: string;
  expires_at?: string | null;
}

/**
 * Get all credit notes (admin/manager only)
 */
export async function getAllCreditNotes(filters?: CreditNoteFilters): Promise<ActionResult<CreditNoteWithDealer[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = user.app_metadata?.role;
    if (!['admin', 'manager'].includes(role)) {
      return {
        success: false,
        error: 'Access denied. Admin or Manager role required.',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    let query = supabase
      .from('credit_notes')
      .select('*, dealer:profiles!dealer_id(id, full_name, email)')
      .order('created_at', { ascending: false });

    if (filters?.dealer_id) {
      query = query.eq('dealer_id', filters.dealer_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching credit notes:', error);
      return {
        success: false,
        error: 'Failed to fetch credit notes',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: (data || []) as CreditNoteWithDealer[] };
  } catch (error) {
    console.error('Unexpected error in getAllCreditNotes:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get all dealers for credit note assignment
 */
export async function getDealers(): Promise<ActionResult<{ id: string; full_name: string; email: string }[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = user.app_metadata?.role;
    if (!['admin', 'manager'].includes(role)) {
      return {
        success: false,
        error: 'Access denied',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'dealer')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching dealers:', error);
      return {
        success: false,
        error: 'Failed to fetch dealers',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getDealers:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Create a credit note (admin/manager only)
 */
export async function createCreditNote(input: CreditNoteInput): Promise<ActionResult<CreditNote>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = user.app_metadata?.role;
    if (!['admin', 'manager'].includes(role)) {
      return {
        success: false,
        error: 'Access denied',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    if (!input.dealer_id || input.amount <= 0) {
      return {
        success: false,
        error: 'Invalid input: dealer and positive amount required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('credit_notes')
      .insert({
        dealer_id: input.dealer_id,
        amount: input.amount,
        description: input.description || null,
        expires_at: input.expires_at || null,
        status: 'available',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating credit note:', error);
      return {
        success: false,
        error: 'Failed to create credit note',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data as CreditNote };
  } catch (error) {
    console.error('Unexpected error in createCreditNote:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update credit note status (admin/manager only)
 */
export async function updateCreditNoteStatus(
  id: string,
  status: 'available' | 'used' | 'expired'
): Promise<ActionResult<CreditNote>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = user.app_metadata?.role;
    if (!['admin', 'manager'].includes(role)) {
      return {
        success: false,
        error: 'Access denied',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('credit_notes')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating credit note:', error);
      return {
        success: false,
        error: 'Failed to update credit note',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data as CreditNote };
  } catch (error) {
    console.error('Unexpected error in updateCreditNoteStatus:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Delete credit note (admin/manager only)
 */
export async function deleteCreditNote(id: string): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = user.app_metadata?.role;
    if (!['admin', 'manager'].includes(role)) {
      return {
        success: false,
        error: 'Access denied',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('credit_notes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting credit note:', error);
      return {
        success: false,
        error: 'Failed to delete credit note',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in deleteCreditNote:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
