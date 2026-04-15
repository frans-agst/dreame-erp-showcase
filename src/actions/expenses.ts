'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export interface Expense {
  id: string;
  account_id: string;
  expense_date: string;
  fiscal_week: number;
  category: string;
  amount: number;
  evidence_url: string | null;
  remarks: string | null;
  created_by: string;
  created_at: string;
  account?: { id: string; name: string; channel_type: string };
  creator?: { id: string; full_name: string };
}

export interface ExpenseFilters {
  account_id?: string;
  category?: string;
  start_date?: string;
  end_date?: string;
  fiscal_week?: number;
}

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const EXPENSE_CATEGORIES = [
  'POSM', 'ADS', 'Exhibition', 'Logistic Cost', 'Support Sellout', 'Brandstore Promotion', 'Branding Offline',
] as const;

const ExpenseInputSchema = z.object({
  account_id: z.string().uuid('Invalid account'),
  expense_date: z.string().min(1, 'Date is required'),
  fiscal_week: z.number().int().min(1).max(53),
  category: z.enum(EXPENSE_CATEGORIES, { message: 'Invalid category' }),
  amount: z.number().positive('Amount must be positive'),
  evidence_url: z.string().url().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getExpenses(filters?: ExpenseFilters): Promise<ActionResult<Expense[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'You must be logged in to view expenses' };

    const supabase = await createClient();
    let query = supabase
      .from('expenses')
      .select(`*, account:accounts(id, name, channel_type), creator:profiles!created_by(id, full_name)`)
      .order('expense_date', { ascending: false });

    if (filters?.account_id) query = query.eq('account_id', filters.account_id);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.start_date) query = query.gte('expense_date', filters.start_date);
    if (filters?.end_date) query = query.lte('expense_date', filters.end_date);
    if (filters?.fiscal_week) query = query.eq('fiscal_week', filters.fiscal_week);

    const { data, error } = await query;
    if (error) { console.error('Error fetching expenses:', error); return { success: false, error: 'Failed to fetch expenses' }; }
    return { success: true, data: (data || []) as Expense[] };
  } catch (error) {
    console.error('Unexpected error in getExpenses:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function createExpense(data: ExpenseInput): Promise<ActionResult<Expense>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'You must be logged in to create an expense' };

    const validation = ExpenseInputSchema.safeParse(data);
    if (!validation.success) return { success: false, error: validation.error.issues[0].message };

    const supabase = await createClient();
    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({ ...validation.data, created_by: user.id })
      .select(`*, account:accounts(id, name, channel_type), creator:profiles!created_by(id, full_name)`)
      .single();

    if (error) { console.error('Error creating expense:', error); return { success: false, error: 'Failed to create expense' }; }
    return { success: true, data: expense as Expense };
  } catch (error) {
    console.error('Unexpected error in createExpense:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateExpense(id: string, data: Partial<ExpenseInput>): Promise<ActionResult<Expense>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'You must be logged in to update an expense' };

    const supabase = await createClient();
    
    // First check if the expense exists and user has access
    const { data: existingExpense, error: fetchError } = await supabase
      .from('expenses')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existingExpense) {
      return { success: false, error: 'Expense not found or access denied' };
    }

    // Perform the update
    const { data: expense, error } = await supabase
      .from('expenses')
      .update(data)
      .eq('id', id)
      .select(`*, account:accounts(id, name, channel_type), creator:profiles!created_by(id, full_name)`)
      .single();

    if (error) { 
      console.error('Error updating expense:', error); 
      return { success: false, error: 'Failed to update expense. You may not have permission to edit this expense.' }; 
    }
    
    return { success: true, data: expense as Expense };
  } catch (error) {
    console.error('Unexpected error in updateExpense:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteExpense(id: string): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'You must be logged in to delete an expense' };

    const supabase = await createClient();
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { console.error('Error deleting expense:', error); return { success: false, error: 'Failed to delete expense' }; }
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in deleteExpense:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
