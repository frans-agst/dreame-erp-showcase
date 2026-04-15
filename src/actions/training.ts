'use server';

import { createClient } from '@/lib/supabase/server';
import { TrainingMaterial } from '@/types';

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

async function getUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
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

/**
 * Get all training materials
 * Requirements: 10.2
 */
export async function getTrainingMaterials(): Promise<ActionResult<TrainingMaterial[]>> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('training_materials')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching training materials:', error);
      return {
        success: false,
        error: 'Failed to fetch training materials',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getTrainingMaterials:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Create a new training material (Admin only)
 * Requirements: 10.1
 */
export async function createTrainingMaterial(data: {
  title: string;
  url: string;
}): Promise<ActionResult<TrainingMaterial>> {
  try {
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<TrainingMaterial>;
    
    if (!data.title?.trim()) {
      return {
        success: false,
        error: 'Title is required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    if (!data.url?.trim()) {
      return {
        success: false,
        error: 'URL is required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    const { data: material, error } = await supabase
      .from('training_materials')
      .insert({
        title: data.title.trim(),
        url: data.url.trim(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating training material:', error);
      return {
        success: false,
        error: 'Failed to create training material',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: material };
  } catch (error) {
    console.error('Unexpected error in createTrainingMaterial:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update a training material (Admin only)
 * Requirements: 10.1
 */
export async function updateTrainingMaterial(
  id: string,
  data: { title: string; url: string }
): Promise<ActionResult<TrainingMaterial>> {
  try {
    const permError = await checkAdminOrManager();
    if (permError) return permError as ActionResult<TrainingMaterial>;
    
    if (!data.title?.trim()) {
      return {
        success: false,
        error: 'Title is required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    if (!data.url?.trim()) {
      return {
        success: false,
        error: 'URL is required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    const supabase = await createClient();
    
    const { data: existing } = await supabase
      .from('training_materials')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return {
        success: false,
        error: 'Training material not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    const { data: material, error } = await supabase
      .from('training_materials')
      .update({
        title: data.title.trim(),
        url: data.url.trim(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating training material:', error);
      return {
        success: false,
        error: 'Failed to update training material',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: material };
  } catch (error) {
    console.error('Unexpected error in updateTrainingMaterial:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Delete a training material (Admin only)
 * Requirements: 10.1
 */
export async function deleteTrainingMaterial(id: string): Promise<ActionResult<void>> {
  try {
    const permError = await checkAdminOrManager();
    if (permError) return permError;
    
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('training_materials')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting training material:', error);
      return {
        success: false,
        error: 'Failed to delete training material',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in deleteTrainingMaterial:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
