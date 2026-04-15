'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ProductSchema,
  ProductInput,
  BranchSchema,
  BranchInput,
  StaffUpdateSchema,
  StaffUpdateInput,
  AccountSchema,
  AccountInput,
  StoreSchema,
  StoreInput,
} from '@/lib/validations/master-data';
import { Product, Branch, Profile, UserRole, Account, Store } from '@/types';
import { filterProductsByRole, FullProduct, FilteredProduct } from '@/lib/price-filter';

// ============================================================================
// Types
// ============================================================================

// Types (not exported - 'use server' files can only export async functions)
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  REFERENCE_ERROR: 'REFERENCE_ERROR',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

// Helper to get current user (kept for potential future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

async function getUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  // Get role from app_metadata (synced via JWT)
  return user.app_metadata?.role || null;
}

async function checkAdminOrManager(): Promise<ActionResult<void> | null> {
  const role = await getUserRole();
  
  if (!role || !['admin', 'manager'].includes(role)) {
    return {
      success: false,
      error: 'You do not have permission to perform this action',
      code: ErrorCodes.FORBIDDEN,
    };
  }
  
  return null;
}

async function checkAdminOnly(): Promise<ActionResult<void> | null> {
  const role = await getUserRole();
  
  if (role !== 'admin') {
    return {
      success: false,
      error: 'Only administrators can perform this action',
      code: ErrorCodes.FORBIDDEN,
    };
  }
  
  return null;
}

// ============================================================================
// Product Actions
// ============================================================================

/**
 * Get all products with optional active filter
 * SECURITY: Applies server-side price filtering based on user role
 * Requirements: 11.2, 11.4, 16.3, 16.4, 16.5
 */
export async function getProducts(activeOnly: boolean = true): Promise<ActionResult<FilteredProduct[]>> {
  try {
    const supabase = await createClient();
    
    // Get current user role for price filtering
    const { data: { user } } = await supabase.auth.getUser();
    const role = (user?.app_metadata?.role as UserRole) || 'staff';
    
    let query = supabase
      .from('products')
      .select('id, sku, name, category, sub_category, price_retail, price_buy, channel_pricing, is_active')
      .order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching products:', error);
      return {
        success: false,
        error: 'Failed to fetch products',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // SECURITY CRITICAL: Apply server-side price filtering based on role
    const filteredProducts = filterProductsByRole(
      (data || []) as FullProduct[],
      role
    );
    
    return { success: true, data: filteredProducts };
  } catch (error) {
    console.error('Unexpected error in getProducts:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get all products with FULL pricing (admin/manager only)
 * Use this for PO creation where all prices are needed
 * Requirements: 7.2, 7.3, 7.4
 */
export async function getProductsWithFullPricing(activeOnly: boolean = true): Promise<ActionResult<FullProduct[]>> {
  try {
    // Check permissions - only admin/manager can see full pricing
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<FullProduct[]>;
    
    const supabase = await createClient();
    
    let query = supabase
      .from('products')
      .select('id, sku, name, category, sub_category, price_retail, price_buy, channel_pricing, is_active')
      .order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching products:', error);
      return {
        success: false,
        error: 'Failed to fetch products',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: (data || []) as FullProduct[] };
  } catch (error) {
    console.error('Unexpected error in getProductsWithFullPricing:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


/**
 * Create a new product
 * Requirements: 11.2, 10.1, 3.1, 3.2, 3.3
 */
export async function createProduct(data: ProductInput): Promise<ActionResult<Product>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<Product>;
    
    // Validate input
    const validation = ProductSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Check for duplicate SKU
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('sku', validation.data.sku)
      .single();
    
    if (existing) {
      return {
        success: false,
        error: 'A product with this SKU already exists',
        code: ErrorCodes.CONFLICT,
      };
    }
    
    // Insert product with new pricing structure
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        sku: validation.data.sku,
        name: validation.data.name,
        price_retail: validation.data.price_retail || validation.data.price || 0,
        price_buy: validation.data.price_buy || (validation.data.price_retail || validation.data.price || 0) * 0.7,
        channel_pricing: validation.data.channel_pricing || {},
        category: validation.data.category || null,
        sub_category: validation.data.sub_category || null,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating product:', error);
      return {
        success: false,
        error: 'Failed to create product',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: product };
  } catch (error) {
    console.error('Unexpected error in createProduct:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update an existing product
 * Requirements: 11.2, 10.1, 3.1, 3.2, 3.3
 */
export async function updateProduct(id: string, data: ProductInput): Promise<ActionResult<Product>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<Product>;
    
    // Validate input
    const validation = ProductSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Product not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Check for duplicate SKU (excluding current product)
    const { data: duplicateSku } = await supabase
      .from('products')
      .select('id')
      .eq('sku', validation.data.sku)
      .neq('id', id)
      .single();
    
    if (duplicateSku) {
      return {
        success: false,
        error: 'A product with this SKU already exists',
        code: ErrorCodes.CONFLICT,
      };
    }
    
    // Update product with new pricing structure
    const { data: product, error } = await supabase
      .from('products')
      .update({
        sku: validation.data.sku,
        name: validation.data.name,
        price_retail: validation.data.price_retail || validation.data.price || 0,
        price_buy: validation.data.price_buy || (validation.data.price_retail || validation.data.price || 0) * 0.7,
        channel_pricing: validation.data.channel_pricing || {},
        category: validation.data.category || null,
        sub_category: validation.data.sub_category || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating product:', error);
      return {
        success: false,
        error: 'Failed to update product',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: product };
  } catch (error) {
    console.error('Unexpected error in updateProduct:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Soft delete a product (set is_active to false)
 * Requirements: 11.5
 */
export async function softDeleteProduct(id: string): Promise<ActionResult<void>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError;
    
    const supabase = await createClient();
    
    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('id, is_active')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Product not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Check for references in sales
    const { data: salesRefs } = await supabase
      .from('sales')
      .select('id')
      .eq('product_id', id)
      .limit(1);
    
    // Check for references in purchase_order_items
    const { data: poRefs } = await supabase
      .from('purchase_order_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);
    
    // Check for references in inventory
    const { data: invRefs } = await supabase
      .from('inventory')
      .select('id')
      .eq('product_id', id)
      .limit(1);
    
    const hasReferences = 
      (salesRefs && salesRefs.length > 0) ||
      (poRefs && poRefs.length > 0) ||
      (invRefs && invRefs.length > 0);
    
    if (hasReferences) {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        console.error('Error soft deleting product:', error);
        return {
          success: false,
          error: 'Failed to deactivate product',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    } else {
      // No references - can hard delete
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting product:', error);
        return {
          success: false,
          error: 'Failed to delete product',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in softDeleteProduct:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


// ============================================================================
// Branch Actions
// ============================================================================

/**
 * Get all branches with optional active filter
 * Requirements: 11.1, 11.4
 */
export async function getBranches(activeOnly: boolean = true): Promise<ActionResult<Branch[]>> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('branches')
      .select('*')
      .order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching branches:', error);
      return {
        success: false,
        error: 'Failed to fetch branches',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getBranches:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Create a new branch
 * Requirements: 11.1, 10.1
 */
export async function createBranch(data: BranchInput): Promise<ActionResult<Branch>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<Branch>;
    
    // Validate input
    const validation = BranchSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Insert branch
    const { data: branch, error } = await supabase
      .from('branches')
      .insert({
        name: validation.data.name,
        account: validation.data.account || null,
        province: validation.data.province || null,
        monthly_target: validation.data.monthly_target || 0,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating branch:', error);
      return {
        success: false,
        error: 'Failed to create branch',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: branch };
  } catch (error) {
    console.error('Unexpected error in createBranch:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update an existing branch
 * Requirements: 11.1, 10.1
 */
export async function updateBranch(id: string, data: BranchInput): Promise<ActionResult<Branch>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<Branch>;
    
    // Validate input
    const validation = BranchSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Check if branch exists
    const { data: existing } = await supabase
      .from('branches')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Branch not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Update branch
    const { data: branch, error } = await supabase
      .from('branches')
      .update({
        name: validation.data.name,
        account: validation.data.account || null,
        province: validation.data.province || null,
        monthly_target: validation.data.monthly_target || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating branch:', error);
      return {
        success: false,
        error: 'Failed to update branch',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: branch };
  } catch (error) {
    console.error('Unexpected error in updateBranch:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Soft delete a branch (set is_active to false)
 * Requirements: 11.5
 */
export async function softDeleteBranch(id: string): Promise<ActionResult<void>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError;
    
    const supabase = await createClient();
    
    // Check if branch exists
    const { data: existing } = await supabase
      .from('branches')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Branch not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Check for references in profiles
    const { data: profileRefs } = await supabase
      .from('profiles')
      .select('id')
      .eq('branch_id', id)
      .limit(1);
    
    // Check for references in sales
    const { data: salesRefs } = await supabase
      .from('sales')
      .select('id')
      .eq('branch_id', id)
      .limit(1);
    
    // Check for references in inventory
    const { data: invRefs } = await supabase
      .from('inventory')
      .select('id')
      .eq('branch_id', id)
      .limit(1);
    
    const hasReferences = 
      (profileRefs && profileRefs.length > 0) ||
      (salesRefs && salesRefs.length > 0) ||
      (invRefs && invRefs.length > 0);
    
    if (hasReferences) {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('branches')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        console.error('Error soft deleting branch:', error);
        return {
          success: false,
          error: 'Failed to deactivate branch',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    } else {
      // No references - can hard delete
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting branch:', error);
        return {
          success: false,
          error: 'Failed to delete branch',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in softDeleteBranch:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


// ============================================================================
// Staff Actions
// ============================================================================

/**
 * Get all staff with optional active filter
 * Requirements: 11.3, 11.4
 */
export async function getStaff(activeOnly: boolean = true): Promise<ActionResult<Profile[]>> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching staff:', error);
      return {
        success: false,
        error: 'Failed to fetch staff',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getStaff:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get a single staff member by ID
 * Requirements: 11.3
 */
export async function getStaffById(id: string): Promise<ActionResult<Profile>> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return {
        success: false,
        error: 'Staff member not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error in getStaffById:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update an existing staff member
 * Requirements: 11.3, 10.1
 * SECURITY: Only admin can change roles
 */
export async function updateStaff(id: string, data: StaffUpdateInput): Promise<ActionResult<Profile>> {
  try {
    const currentRole = await getUserRole();
    
    // Check permissions - admin or manager can update staff
    if (!currentRole || !['admin', 'manager'].includes(currentRole)) {
      return {
        success: false,
        error: 'You do not have permission to perform this action',
        code: ErrorCodes.FORBIDDEN,
      };
    }
    
    // Validate input
    const validation = StaffUpdateSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Get existing staff member
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Staff member not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // SECURITY: Only admin can change roles
    if (validation.data.role !== existing.role && currentRole !== 'admin') {
      return {
        success: false,
        error: 'Only administrators can change user roles',
        code: ErrorCodes.FORBIDDEN,
      };
    }
    
    // Use store_id
    const storeId = validation.data.store_id || null;
    
    // Update staff
    const { data: staff, error } = await supabase
      .from('profiles')
      .update({
        full_name: validation.data.full_name,
        role: validation.data.role,
        store_id: storeId,
        is_active: validation.data.is_active ?? existing.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating staff:', error);
      return {
        success: false,
        error: 'Failed to update staff member',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: staff };
  } catch (error) {
    console.error('Unexpected error in updateStaff:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Soft delete a staff member (set is_active to false)
 * Requirements: 11.5
 */
export async function softDeleteStaff(id: string): Promise<ActionResult<void>> {
  try {
    // Check permissions - only admin can delete staff
    const permError = await checkAdminOnly();
    if (permError) return permError;
    
    const supabase = await createClient();
    
    // Check if staff exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Staff member not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Check for references in sales
    const { data: salesRefs } = await supabase
      .from('sales')
      .select('id')
      .eq('staff_id', id)
      .limit(1);
    
    // Check for references in day_off_requests
    const { data: dayOffRefs } = await supabase
      .from('day_off_requests')
      .select('id')
      .eq('staff_id', id)
      .limit(1);
    
    // Check for references in stock_opname
    const { data: opnameRefs } = await supabase
      .from('stock_opname')
      .select('id')
      .eq('staff_id', id)
      .limit(1);
    
    const hasReferences = 
      (salesRefs && salesRefs.length > 0) ||
      (dayOffRefs && dayOffRefs.length > 0) ||
      (opnameRefs && opnameRefs.length > 0);
    
    if (hasReferences) {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        console.error('Error soft deleting staff:', error);
        return {
          success: false,
          error: 'Failed to deactivate staff member',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    } else {
      // No references - can hard delete both profile and auth user
      // First delete from profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
      
      if (profileError) {
        console.error('Error deleting staff profile:', profileError);
        return {
          success: false,
          error: 'Failed to delete staff member',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
      
      // Then delete from auth.users using admin client
      // This ensures the email can be reused for new staff
      try {
        const adminClient = createAdminClient();
        const { error: authError } = await adminClient.auth.admin.deleteUser(id);
        
        if (authError) {
          console.error('Error deleting auth user:', authError);
          // Profile already deleted, log warning but don't fail
          // The auth user will be orphaned but won't block new registrations
        }
      } catch (adminError) {
        // Admin client might not be available (missing service role key)
        console.warn('Could not delete auth user (admin client unavailable):', adminError);
      }
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in softDeleteStaff:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Toggle staff active status
 * Requirements: 11.3
 */
export async function toggleStaffStatus(id: string): Promise<ActionResult<Profile>> {
  try {
    // Check permissions
    const permError = await checkAdminOnly();
    if (permError) return permError as ActionResult<Profile>;
    
    const supabase = await createClient();
    
    // Get current status
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Staff member not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Toggle status
    const { data: staff, error } = await supabase
      .from('profiles')
      .update({
        is_active: !existing.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error toggling staff status:', error);
      return {
        success: false,
        error: 'Failed to update staff status',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: staff };
  } catch (error) {
    console.error('Unexpected error in toggleStaffStatus:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Create a new staff member (admin only)
 * This creates both the auth user and the profile
 * Requirements: 11.3
 */
export async function createStaff(data: {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'manager' | 'staff';
  store_id?: string | null;
}): Promise<ActionResult<Profile>> {
  try {
    // Check permissions - only admin can create staff
    const permError = await checkAdminOnly();
    if (permError) return permError as ActionResult<Profile>;

    // Validate email
    if (!data.email || !data.email.includes('@')) {
      return {
        success: false,
        error: 'Valid email is required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Validate password
    if (!data.password || data.password.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Validate full name
    if (!data.full_name || data.full_name.trim().length === 0) {
      return {
        success: false,
        error: 'Full name is required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Use store_id
    const storeId = data.store_id || null;

    // Staff must have a store
    if (data.role === 'staff' && !storeId) {
      return {
        success: false,
        error: 'Staff members must be assigned to a store',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Import admin client dynamically to avoid issues
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminClient = createAdminClient();

    // Create auth user with admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirm email
      app_metadata: {
        role: data.role,
        store_id: storeId,
      },
      user_metadata: {
        full_name: data.full_name,
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      if (authError.message.includes('already registered')) {
        return {
          success: false,
          error: 'A user with this email already exists',
          code: ErrorCodes.CONFLICT,
        };
      }
      return {
        success: false,
        error: authError.message || 'Failed to create user',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Failed to create user',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Create profile in profiles table
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        store_id: storeId,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Try to clean up the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return {
        success: false,
        error: 'Failed to create staff profile',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: profile };
  } catch (error) {
    console.error('Unexpected error in createStaff:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Hard delete a staff member (permanently remove from database)
 * Only works for inactive staff members
 * Requirements: 11.5
 */
export async function hardDeleteStaff(id: string): Promise<ActionResult<void>> {
  try {
    // Check permissions - only admin can hard delete staff
    const permError = await checkAdminOnly();
    if (permError) return permError;
    
    const supabase = await createClient();
    
    // Check if staff exists and is inactive
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, is_active, full_name')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Staff member not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Only allow hard delete for inactive staff
    if (existing.is_active) {
      return {
        success: false,
        error: 'Can only permanently delete inactive staff members. Deactivate first.',
        code: ErrorCodes.FORBIDDEN,
      };
    }
    
    // Delete related records first
    // Delete day_off_requests
    const { error: dayOffError } = await supabase
      .from('day_off_requests')
      .delete()
      .eq('staff_id', id);
    
    if (dayOffError) {
      console.error('Error deleting day off requests:', dayOffError);
    }
    
    // Delete stock_opname_items first (child of stock_opname)
    const { data: opnameIds } = await supabase
      .from('stock_opname')
      .select('id')
      .eq('staff_id', id);
    
    if (opnameIds && opnameIds.length > 0) {
      const ids = opnameIds.map(o => o.id);
      await supabase
        .from('stock_opname_items')
        .delete()
        .in('opname_id', ids);
    }
    
    // Delete stock_opname
    const { error: opnameError } = await supabase
      .from('stock_opname')
      .delete()
      .eq('staff_id', id);
    
    if (opnameError) {
      console.error('Error deleting stock opname:', opnameError);
    }
    
    // For sales and purchase_orders, we need to set staff_id/created_by to null or another user
    // Since these have RESTRICT, we'll update them to remove the reference
    // Note: This may fail if there's no other admin - in that case, return error
    
    // Check if there are sales or POs referencing this staff
    const { data: salesRefs } = await supabase
      .from('sales')
      .select('id')
      .eq('staff_id', id)
      .limit(1);
    
    const { data: poRefs } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('created_by', id)
      .limit(1);
    
    if ((salesRefs && salesRefs.length > 0) || (poRefs && poRefs.length > 0)) {
      return {
        success: false,
        error: 'Cannot permanently delete: staff has sales or purchase orders. Please reassign them first.',
        code: ErrorCodes.REFERENCE_ERROR,
      };
    }
    
    // Delete from profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    
    if (profileError) {
      console.error('Error deleting staff profile:', profileError);
      return {
        success: false,
        error: 'Failed to delete staff member',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // Delete from auth.users using admin client
    try {
      const adminClient = createAdminClient();
      const { error: authError } = await adminClient.auth.admin.deleteUser(id);
      
      if (authError) {
        console.error('Error deleting auth user:', authError);
        // Profile already deleted, log warning but don't fail
      }
    } catch (adminError) {
      console.warn('Could not delete auth user (admin client unavailable):', adminError);
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in hardDeleteStaff:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


// ============================================================================
// Account Actions (New V2.0)
// ============================================================================

/**
 * Get all accounts with optional active filter
 * Requirements: 2.1, 2.2
 */
export async function getAccounts(activeOnly: boolean = true): Promise<ActionResult<Account[]>> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('accounts')
      .select('*')
      .order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching accounts:', error);
      return {
        success: false,
        error: 'Failed to fetch accounts',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getAccounts:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Create a new account
 * Requirements: 2.1, 17.3
 */
export async function createAccount(data: AccountInput): Promise<ActionResult<Account>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<Account>;
    
    // Validate input
    const validation = AccountSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Check for duplicate name
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('name', validation.data.name)
      .single();
    
    if (existing) {
      return {
        success: false,
        error: 'An account with this name already exists',
        code: ErrorCodes.CONFLICT,
      };
    }
    
    // Insert account
    const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        name: validation.data.name,
        channel_type: validation.data.channel_type,
        is_active: validation.data.is_active ?? true,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating account:', error);
      return {
        success: false,
        error: 'Failed to create account',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: account };
  } catch (error) {
    console.error('Unexpected error in createAccount:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update an existing account
 * Requirements: 2.1, 17.3
 */
export async function updateAccount(id: string, data: AccountInput): Promise<ActionResult<Account>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<Account>;
    
    // Validate input
    const validation = AccountSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Check if account exists
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Account not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Check for duplicate name (excluding current account)
    const { data: duplicateName } = await supabase
      .from('accounts')
      .select('id')
      .eq('name', validation.data.name)
      .neq('id', id)
      .single();
    
    if (duplicateName) {
      return {
        success: false,
        error: 'An account with this name already exists',
        code: ErrorCodes.CONFLICT,
      };
    }
    
    // Update account
    const { data: account, error } = await supabase
      .from('accounts')
      .update({
        name: validation.data.name,
        channel_type: validation.data.channel_type,
        is_active: validation.data.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating account:', error);
      return {
        success: false,
        error: 'Failed to update account',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: account };
  } catch (error) {
    console.error('Unexpected error in updateAccount:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Soft delete an account
 * Requirements: 17.3
 */
export async function softDeleteAccount(id: string): Promise<ActionResult<void>> {
  try {
    // Check permissions - only admin can delete accounts
    const permError = await checkAdminOnly();
    if (permError) return permError;
    
    const supabase = await createClient();
    
    // Check if account exists
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Account not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Check for references in stores
    const { data: storeRefs } = await supabase
      .from('stores')
      .select('id')
      .eq('account_id', id)
      .limit(1);
    
    if (storeRefs && storeRefs.length > 0) {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        console.error('Error soft deleting account:', error);
        return {
          success: false,
          error: 'Failed to deactivate account',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    } else {
      // No references - can hard delete
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting account:', error);
        return {
          success: false,
          error: 'Failed to delete account',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in softDeleteAccount:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


// ============================================================================
// Store Actions (New V2.0 - Replaces Branch)
// ============================================================================

/**
 * Get all stores with optional active filter
 * Requirements: 2.2, 2.3
 */
export async function getStores(activeOnly: boolean = true): Promise<ActionResult<Store[]>> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('stores')
      .select(`
        *,
        account:accounts(id, name, channel_type)
      `)
      .order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching stores:', error);
      return {
        success: false,
        error: 'Failed to fetch stores',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getStores:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get stores by account ID
 * Requirements: 2.3
 */
export async function getStoresByAccount(accountId: string, activeOnly: boolean = true): Promise<ActionResult<Store[]>> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('stores')
      .select(`
        *,
        account:accounts(id, name, channel_type)
      `)
      .eq('account_id', accountId)
      .order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching stores by account:', error);
      return {
        success: false,
        error: 'Failed to fetch stores',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getStoresByAccount:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Create a new store
 * Requirements: 2.2, 17.4
 */
export async function createStore(data: StoreInput): Promise<ActionResult<Store>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<Store>;
    
    // Validate input
    const validation = StoreSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Verify account exists
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', validation.data.account_id)
      .single();
    
    if (!account) {
      return {
        success: false,
        error: 'Account not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Insert store
    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        account_id: validation.data.account_id,
        name: validation.data.name,
        region: validation.data.region || null,
        monthly_target: validation.data.monthly_target || 0,
        is_active: validation.data.is_active ?? true,
      })
      .select(`
        *,
        account:accounts(id, name, channel_type)
      `)
      .single();
    
    if (error) {
      console.error('Error creating store:', error);
      return {
        success: false,
        error: 'Failed to create store',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: store };
  } catch (error) {
    console.error('Unexpected error in createStore:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update an existing store
 * Requirements: 2.2, 17.4
 */
export async function updateStore(id: string, data: StoreInput): Promise<ActionResult<Store>> {
  try {
    // Check permissions
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<Store>;
    
    // Validate input
    const validation = StoreSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    // Check if store exists
    const { data: existing } = await supabase
      .from('stores')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Store not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Verify account exists
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', validation.data.account_id)
      .single();
    
    if (!account) {
      return {
        success: false,
        error: 'Account not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Update store
    const { data: store, error } = await supabase
      .from('stores')
      .update({
        account_id: validation.data.account_id,
        name: validation.data.name,
        region: validation.data.region || null,
        monthly_target: validation.data.monthly_target || 0,
        is_active: validation.data.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        account:accounts(id, name, channel_type)
      `)
      .single();
    
    if (error) {
      console.error('Error updating store:', error);
      return {
        success: false,
        error: 'Failed to update store',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: store };
  } catch (error) {
    console.error('Unexpected error in updateStore:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Export product inventory data for report
 * Returns products with inventory data per store for Excel export
 * Columns: Month, DATE, Week, Account Name, Store Name, SKU, Category, Sub category, Product Name, Display, Stock
 */
export async function getProductInventoryExport(): Promise<ActionResult<{
  date: string;
  fiscal_month: number;
  fiscal_week: number;
  fiscal_year: number;
  items: Array<{
    account_name: string;
    store_name: string;
    sku: string;
    category: string;
    sub_category: string;
    product_name: string;
    display_qty: number;
    stock_qty: number;
  }>;
}>> {
  try {
    const supabase = await createClient();
    
    // Get current date and fiscal info
    const today = new Date().toISOString().split('T')[0];
    
    const { data: fiscalData } = await supabase
      .from('fiscal_calendar')
      .select('fiscal_week, fiscal_month, fiscal_year')
      .eq('date', today)
      .single();
    
    // Get all active products
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, sku, name, category, sub_category')
      .eq('is_active', true)
      .order('name');
    
    if (productError) {
      console.error('Error fetching products:', productError);
      return {
        success: false,
        error: 'Failed to fetch products',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // Get all active stores with account info
    const { data: stores, error: storeError } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        account:accounts(name)
      `)
      .eq('is_active', true)
      .order('name');
    
    if (storeError) {
      console.error('Error fetching stores:', storeError);
      return {
        success: false,
        error: 'Failed to fetch stores',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // Get all inventory records
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('store_id, product_id, quantity, display_qty');
    
    if (invError) {
      console.error('Error fetching inventory:', invError);
      return {
        success: false,
        error: 'Failed to fetch inventory',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // Build inventory lookup: store_id -> product_id -> { quantity, display_qty }
    const invMap: Record<string, Record<string, { quantity: number; display_qty: number }>> = {};
    (inventory || []).forEach((item) => {
      if (!invMap[item.store_id]) {
        invMap[item.store_id] = {};
      }
      invMap[item.store_id][item.product_id] = {
        quantity: item.quantity || 0,
        display_qty: item.display_qty || 0,
      };
    });
    
    // Build export items: one row per store-product combination
    const items: Array<{
      account_name: string;
      store_name: string;
      sku: string;
      category: string;
      sub_category: string;
      product_name: string;
      display_qty: number;
      stock_qty: number;
    }> = [];
    
    (stores || []).forEach((store) => {
      const account = store.account as unknown as { name: string } | null;
      const accountName = account?.name || '';
      
      (products || []).forEach((product) => {
        const inv = invMap[store.id]?.[product.id];
        items.push({
          account_name: accountName,
          store_name: store.name,
          sku: product.sku,
          category: product.category || '',
          sub_category: product.sub_category || '',
          product_name: product.name,
          display_qty: inv?.display_qty || 0,
          stock_qty: inv?.quantity || 0,
        });
      });
    });
    
    return {
      success: true,
      data: {
        date: today,
        fiscal_month: fiscalData?.fiscal_month || 0,
        fiscal_week: fiscalData?.fiscal_week || 0,
        fiscal_year: fiscalData?.fiscal_year || 0,
        items,
      },
    };
  } catch (error) {
    console.error('Unexpected error in getProductInventoryExport:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Soft delete a store
 * Requirements: 17.4
 */
export async function softDeleteStore(id: string): Promise<ActionResult<void>> {
  try {
    // Check permissions - only admin can delete stores
    const permError = await checkAdminOnly();
    if (permError) return permError;
    
    const supabase = await createClient();
    
    // Check if store exists
    const { data: existing } = await supabase
      .from('stores')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Store not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Check for references in profiles
    const { data: profileRefs } = await supabase
      .from('profiles')
      .select('id')
      .eq('store_id', id)
      .limit(1);
    
    // Check for references in sales
    const { data: salesRefs } = await supabase
      .from('sales')
      .select('id')
      .eq('store_id', id)
      .limit(1);
    
    // Check for references in inventory
    const { data: invRefs } = await supabase
      .from('inventory')
      .select('id')
      .eq('store_id', id)
      .limit(1);
    
    const hasReferences = 
      (profileRefs && profileRefs.length > 0) ||
      (salesRefs && salesRefs.length > 0) ||
      (invRefs && invRefs.length > 0);
    
    if (hasReferences) {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('stores')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        console.error('Error soft deleting store:', error);
        return {
          success: false,
          error: 'Failed to deactivate store',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    } else {
      // No references - can hard delete
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting store:', error);
        return {
          success: false,
          error: 'Failed to delete store',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in softDeleteStore:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


// ============================================================================
// Bulk Price Update Actions
// ============================================================================

export interface PriceUpdateRow {
  sku: string;
  product_name: string;
  category: string;
  sub_category: string;
  brandstore: number;
  retailer: number;
  modern_channel_1: number;
  modern_channel_2: number;
  modern_channel_3: number;
}

export interface PriceUpdatePreview {
  sku: string;
  product_name: string;
  old_prices: {
    brandstore: number;
    retailer: number;
    modern_channel_1: number;
    modern_channel_2: number;
    modern_channel_3: number;
  };
  new_prices: {
    brandstore: number;
    retailer: number;
    modern_channel_1: number;
    modern_channel_2: number;
    modern_channel_3: number;
  };
  has_changes: boolean;
}

/**
 * Export all products with current prices to Excel format
 * Requirements: Bulk price update - export current data
 */
export async function exportProductPrices(): Promise<ActionResult<PriceUpdateRow[]>> {
  try {
    // Check permissions - only admin/manager
    const permissionCheck = await checkAdminOrManager();
    if (permissionCheck) return permissionCheck as ActionResult<PriceUpdateRow[]>;

    const supabase = await createClient();
    
    const { data: products, error } = await supabase
      .from('products')
      .select('sku, name, category, sub_category, channel_pricing')
      .eq('is_active', true)
      .order('sku');

    if (error) {
      console.error('Error fetching products for export:', error);
      return {
        success: false,
        error: 'Failed to fetch products',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const exportData: PriceUpdateRow[] = (products || []).map(p => {
      const channelPricing = (p.channel_pricing as Record<string, number>) || {};
      return {
        sku: p.sku,
        product_name: p.name,
        category: p.category || '',
        sub_category: p.sub_category || '',
        brandstore: channelPricing.brandstore || 0,
        retailer: channelPricing.retailer || 0,
        modern_channel_1: channelPricing.modern_channel_1 || 0,
        modern_channel_2: channelPricing.modern_channel_2 || 0,
        modern_channel_3: channelPricing.modern_channel_3 || 0,
      };
    });

    return { success: true, data: exportData };
  } catch (error) {
    console.error('Unexpected error in exportProductPrices:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Preview price updates from imported data
 * Requirements: Bulk price update - validate and preview changes
 */
export async function previewPriceUpdates(
  updates: PriceUpdateRow[]
): Promise<ActionResult<PriceUpdatePreview[]>> {
  try {
    // Check permissions - only admin/manager
    const permissionCheck = await checkAdminOrManager();
    if (permissionCheck) return permissionCheck as ActionResult<PriceUpdatePreview[]>;

    const supabase = await createClient();
    
    // Get current products
    const skus = updates.map(u => u.sku);
    const { data: products, error } = await supabase
      .from('products')
      .select('sku, name, channel_pricing')
      .in('sku', skus);

    if (error) {
      console.error('Error fetching products for preview:', error);
      return {
        success: false,
        error: 'Failed to fetch products',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    const productMap = new Map(
      (products || []).map(p => [p.sku, p])
    );

    const previews: PriceUpdatePreview[] = updates.map(update => {
      const product = productMap.get(update.sku);
      
      if (!product) {
        // SKU not found - will be skipped
        return {
          sku: update.sku,
          product_name: update.product_name,
          old_prices: {
            brandstore: 0,
            retailer: 0,
            modern_channel_1: 0,
            modern_channel_2: 0,
            modern_channel_3: 0,
          },
          new_prices: {
            brandstore: update.brandstore,
            retailer: update.retailer,
            modern_channel_1: update.modern_channel_1,
            modern_channel_2: update.modern_channel_2,
            modern_channel_3: update.modern_channel_3,
          },
          has_changes: false, // Mark as no changes since SKU doesn't exist
        };
      }

      const oldPricing = (product.channel_pricing as Record<string, number>) || {};
      const oldPrices = {
        brandstore: oldPricing.brandstore || 0,
        retailer: oldPricing.retailer || 0,
        modern_channel_1: oldPricing.modern_channel_1 || 0,
        modern_channel_2: oldPricing.modern_channel_2 || 0,
        modern_channel_3: oldPricing.modern_channel_3 || 0,
      };

      const newPrices = {
        brandstore: update.brandstore,
        retailer: update.retailer,
        modern_channel_1: update.modern_channel_1,
        modern_channel_2: update.modern_channel_2,
        modern_channel_3: update.modern_channel_3,
      };

      // Check if there are any changes
      const has_changes = 
        oldPrices.brandstore !== newPrices.brandstore ||
        oldPrices.retailer !== newPrices.retailer ||
        oldPrices.modern_channel_1 !== newPrices.modern_channel_1 ||
        oldPrices.modern_channel_2 !== newPrices.modern_channel_2 ||
        oldPrices.modern_channel_3 !== newPrices.modern_channel_3;

      return {
        sku: update.sku,
        product_name: product.name,
        old_prices: oldPrices,
        new_prices: newPrices,
        has_changes,
      };
    });

    return { success: true, data: previews };
  } catch (error) {
    console.error('Unexpected error in previewPriceUpdates:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Apply bulk price updates
 * Requirements: Bulk price update - apply validated changes
 */
export async function applyPriceUpdates(
  updates: PriceUpdateRow[]
): Promise<ActionResult<{ updated: number; skipped: number }>> {
  try {
    // Check permissions - only admin/manager
    const permissionCheck = await checkAdminOrManager();
    if (permissionCheck) return permissionCheck as ActionResult<{ updated: number; skipped: number }>;

    const supabase = await createClient();
    
    let updated = 0;
    let skipped = 0;

    for (const update of updates) {
      // Get product by SKU
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('id')
        .eq('sku', update.sku)
        .single();

      if (fetchError || !product) {
        skipped++;
        continue;
      }

      // Update channel_pricing
      const { error: updateError } = await supabase
        .from('products')
        .update({
          channel_pricing: {
            brandstore: update.brandstore,
            retailer: update.retailer,
            modern_channel_1: update.modern_channel_1,
            modern_channel_2: update.modern_channel_2,
            modern_channel_3: update.modern_channel_3,
          },
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`Error updating product ${update.sku}:`, updateError);
        skipped++;
      } else {
        updated++;
      }
    }

    return {
      success: true,
      data: { updated, skipped },
    };
  } catch (error) {
    console.error('Unexpected error in applyPriceUpdates:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
