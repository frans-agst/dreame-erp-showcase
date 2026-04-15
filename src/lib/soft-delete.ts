/**
 * Soft Delete Utility
 * Determines whether a record should be soft deleted (deactivated) or hard deleted
 * based on whether it has references in other tables.
 * 
 * Requirements: 11.5
 */

export interface ReferenceCheck {
  tableName: string;
  hasReferences: boolean;
}

/**
 * Determines the delete action based on reference checks
 * @param references Array of reference checks from related tables
 * @returns 'soft' if any references exist, 'hard' if no references
 */
export function determineDeleteAction(references: ReferenceCheck[]): 'soft' | 'hard' {
  const hasAnyReferences = references.some(ref => ref.hasReferences);
  return hasAnyReferences ? 'soft' : 'hard';
}

/**
 * Validates that a soft delete operation correctly sets is_active to false
 * @param originalIsActive The original is_active value
 * @param newIsActive The new is_active value after soft delete
 * @returns true if the soft delete was performed correctly
 */
export function validateSoftDelete(originalIsActive: boolean, newIsActive: boolean): boolean {
  // After soft delete, is_active should always be false
  return newIsActive === false;
}

/**
 * Validates that a record with references cannot be hard deleted
 * @param hasReferences Whether the record has references
 * @param deleteAction The action that was taken
 * @returns true if the action is correct for the reference state
 */
export function validateDeleteAction(hasReferences: boolean, deleteAction: 'soft' | 'hard'): boolean {
  if (hasReferences) {
    // Records with references must be soft deleted
    return deleteAction === 'soft';
  }
  // Records without references can be either soft or hard deleted
  return true;
}

/**
 * Simulates the soft delete behavior for testing
 * @param record The record to delete
 * @param hasReferences Whether the record has references
 * @returns The result of the delete operation
 */
export function simulateSoftDelete<T extends { is_active: boolean }>(
  record: T,
  hasReferences: boolean
): { action: 'soft' | 'hard'; result: T | null } {
  if (hasReferences) {
    // Soft delete - set is_active to false
    return {
      action: 'soft',
      result: { ...record, is_active: false },
    };
  } else {
    // Hard delete - record is removed
    return {
      action: 'hard',
      result: null,
    };
  }
}
