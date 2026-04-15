// src/lib/error-handling.ts
// Comprehensive error handling utilities for the transaction system
// Requirements: 6.3, 8.5, 10.6

/**
 * Error codes for different failure scenarios
 */
export enum ErrorCode {
  // Authentication errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Inventory errors
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVENTORY_UPDATE_FAILED = 'INVENTORY_UPDATE_FAILED',
  INVENTORY_VALIDATION_FAILED = 'INVENTORY_VALIDATION_FAILED',
  
  // Transaction errors
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  TRANSACTION_CREATE_FAILED = 'TRANSACTION_CREATE_FAILED',
  TRANSACTION_UPDATE_FAILED = 'TRANSACTION_UPDATE_FAILED',
  TRANSACTION_DELETE_FAILED = 'TRANSACTION_DELETE_FAILED',
  TRANSACTION_CALCULATION_ERROR = 'TRANSACTION_CALCULATION_ERROR',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',
  
  // Export errors
  EXPORT_FAILED = 'EXPORT_FAILED',
  EXPORT_DATA_NOT_FOUND = 'EXPORT_DATA_NOT_FOUND',
  
  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error with code and user-friendly message
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  details?: any;
  field?: string;
}

/**
 * User-friendly error messages for different error codes
 * Requirements: 6.3, 8.5
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_REQUIRED]: 'You must be logged in to perform this action.',
  [ErrorCode.AUTH_INVALID]: 'Your session has expired. Please log in again.',
  
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.INVALID_INPUT]: 'The information provided is invalid.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Please fill in all required fields.',
  
  [ErrorCode.INSUFFICIENT_STOCK]: 'There is not enough stock available for this transaction.',
  [ErrorCode.INVENTORY_UPDATE_FAILED]: 'Failed to update inventory. Please try again.',
  [ErrorCode.INVENTORY_VALIDATION_FAILED]: 'Failed to validate inventory availability.',
  
  [ErrorCode.TRANSACTION_NOT_FOUND]: 'The transaction you are looking for does not exist.',
  [ErrorCode.TRANSACTION_CREATE_FAILED]: 'Failed to create transaction. Please try again.',
  [ErrorCode.TRANSACTION_UPDATE_FAILED]: 'Failed to update transaction. Please try again.',
  [ErrorCode.TRANSACTION_DELETE_FAILED]: 'Failed to delete transaction. Please try again.',
  [ErrorCode.TRANSACTION_CALCULATION_ERROR]: 'Error calculating transaction totals.',
  
  [ErrorCode.DATABASE_ERROR]: 'A database error occurred. Please try again.',
  [ErrorCode.DATABASE_CONNECTION_ERROR]: 'Unable to connect to the database. Please check your connection.',
  [ErrorCode.DATABASE_CONSTRAINT_VIOLATION]: 'This operation violates data integrity rules.',
  
  [ErrorCode.EXPORT_FAILED]: 'Failed to export data. Please try again.',
  [ErrorCode.EXPORT_DATA_NOT_FOUND]: 'No data found to export.',
  
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred. Please contact support.',
};

/**
 * Creates a structured error with user-friendly message
 * Requirements: 8.5
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: any,
  field?: string
): AppError {
  return {
    code,
    message,
    userMessage: ERROR_MESSAGES[code],
    details,
    field,
  };
}

/**
 * Formats validation errors for user display
 * Requirements: 8.5
 */
export function formatValidationErrors(
  errors: Array<{ field: string; message: string; code?: string }>
): string {
  if (errors.length === 0) return 'Validation failed';
  
  if (errors.length === 1) {
    return errors[0].message;
  }
  
  return `Please fix the following errors:\n${errors.map(e => `• ${e.message}`).join('\n')}`;
}

/**
 * Formats inventory shortage errors with specific product information
 * Requirements: 6.3
 */
export function formatInventoryShortageError(
  shortages: Array<{
    product_name: string;
    available_stock: number;
    requested_quantity: number;
    shortage: number;
  }>
): string {
  if (shortages.length === 0) return 'Insufficient inventory';
  
  if (shortages.length === 1) {
    const s = shortages[0];
    return `Insufficient stock for ${s.product_name}. Available: ${s.available_stock}, Requested: ${s.requested_quantity}`;
  }
  
  const lines = shortages.map(s => 
    `• ${s.product_name}: Available ${s.available_stock}, Requested ${s.requested_quantity} (Short by ${s.shortage})`
  );
  
  return `Insufficient stock for multiple products:\n${lines.join('\n')}`;
}

/**
 * Handles database errors and converts them to user-friendly messages
 * Requirements: 10.6
 */
export function handleDatabaseError(error: any): AppError {
  // PostgreSQL error codes
  const pgErrorCode = error?.code;
  
  switch (pgErrorCode) {
    case '23503': // Foreign key violation
      return createError(
        ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
        'Foreign key constraint violation',
        error,
      );
    
    case '23505': // Unique violation
      return createError(
        ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
        'This record already exists',
        error,
      );
    
    case '23514': // Check constraint violation
      return createError(
        ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
        'Data validation constraint violated',
        error,
      );
    
    case 'PGRST116': // Not found (PostgREST)
      return createError(
        ErrorCode.TRANSACTION_NOT_FOUND,
        'Record not found',
        error,
      );
    
    case '08000': // Connection error
    case '08003': // Connection does not exist
    case '08006': // Connection failure
      return createError(
        ErrorCode.DATABASE_CONNECTION_ERROR,
        'Database connection error',
        error,
      );
    
    default:
      return createError(
        ErrorCode.DATABASE_ERROR,
        error?.message || 'Database error occurred',
        error,
      );
  }
}

/**
 * Logs error for debugging and monitoring
 * Requirements: 11.2
 */
export function logError(
  context: string,
  error: any,
  additionalInfo?: Record<string, any>
): void {
  console.error(`[${context}]`, {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  });
}

/**
 * Wraps async operations with error handling
 * Requirements: 11.2
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    logError(context, error);
    
    // If it's already an AppError, return its user message
    if (error && typeof error === 'object' && 'code' in error && 'userMessage' in error) {
      return { success: false, error: (error as AppError).userMessage };
    }
    
    // Convert to AppError and return user message
    const appError = createError(
      errorCode,
      error instanceof Error ? error.message : 'Unknown error',
      error
    );
    
    return { success: false, error: appError.userMessage };
  }
}

/**
 * Retry logic for transient failures
 * Requirements: 10.6
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on validation errors or not found errors
      if (error && typeof error === 'object') {
        const errorCode = (error as any).code;
        if (
          errorCode === ErrorCode.VALIDATION_ERROR ||
          errorCode === ErrorCode.TRANSACTION_NOT_FOUND ||
          errorCode === ErrorCode.INSUFFICIENT_STOCK
        ) {
          throw error;
        }
      }
      
      if (attempt < maxRetries) {
        logError(context, `Attempt ${attempt} failed, retrying...`, { error });
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  logError(context, `All ${maxRetries} attempts failed`, { lastError });
  throw lastError;
}

/**
 * Validates that a transaction can be rolled back
 * Requirements: 11.2
 */
export function canRollbackTransaction(
  createdAt: string
): { canRollback: boolean; reason?: string } {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  
  // Allow rollback within 24 hours
  if (hoursSinceCreation > 24) {
    return {
      canRollback: false,
      reason: 'Transaction is too old to rollback (>24 hours)',
    };
  }
  
  return { canRollback: true };
}

/**
 * Comprehensive error handler for transaction operations
 * Requirements: 11.2
 */
export function handleTransactionError(
  error: any,
  operation: string,
  context?: Record<string, any>
): AppError {
  logError(operation, error, context);
  
  // Check if it's already an AppError
  if (error && typeof error === 'object' && 'code' in error && 'userMessage' in error) {
    return error as AppError;
  }
  
  // Handle database errors
  if (error?.code) {
    return handleDatabaseError(error);
  }
  
  // Handle validation errors
  if (error?.name === 'ValidationError' || error?.issues) {
    return createError(
      ErrorCode.VALIDATION_ERROR,
      error.message || 'Validation failed',
      error
    );
  }
  
  // Handle inventory errors
  if (error?.message?.includes('stock') || error?.message?.includes('inventory')) {
    return createError(
      ErrorCode.INSUFFICIENT_STOCK,
      error.message,
      error
    );
  }
  
  // Default error
  return createError(
    ErrorCode.INTERNAL_ERROR,
    error instanceof Error ? error.message : 'Unknown error occurred',
    error
  );
}

/**
 * Validates error response format for API consistency
 * Requirements: 11.2
 */
export function formatErrorResponse(error: AppError): {
  success: false;
  error: string;
  code: ErrorCode;
  details?: any;
} {
  return {
    success: false,
    error: error.userMessage,
    code: error.code,
    details: error.details
  };
}
