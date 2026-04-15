// src/actions/exports.ts
// Server actions for transaction export functionality
// Requirements: 5.1, 3.6, 3.7

'use server';

import { createClient } from '@/lib/supabase/server';
import { getTransactionById } from './transactions';
import type { ActionResult, Transaction, ChannelType } from '@/types';
import {
  exportTransactionToExcel,
  exportMultipleTransactionsToExcel,
  generateExportFilename,
  generateBatchExportFilename,
} from '@/lib/excel/transaction-export';
import {
  ErrorCode,
  createError,
  handleTransactionError,
  logError,
  withErrorHandling
} from '@/lib/error-handling';
import {
  trackQueryPerformance,
  optimizeTransactionExport
} from '@/lib/performance-optimization';

/**
 * Exports a single transaction to PDF format
 * Requirements: 3.7, 5.1
 */
export async function exportTransactionPDF(
  transactionId: string
): Promise<ActionResult<{ blob: Blob; filename: string }>> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Validate transaction ID
    if (!transactionId || typeof transactionId !== 'string') {
      return {
        success: false,
        error: 'Invalid transaction ID'
      };
    }

    // Get transaction details
    const transactionResult = await getTransactionById(transactionId);
    if (!transactionResult.success || !transactionResult.data) {
      return {
        success: false,
        error: 'Transaction not found'
      };
    }

    const transaction = transactionResult.data;

    // Import jsPDF dynamically
    const { jsPDF } = await import('jspdf');
    require('jspdf-autotable');

    // Create PDF
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Transaction Receipt', 14, 15);
    
    // Add transaction info
    doc.setFontSize(10);
    doc.text(`Transaction ID: ${transaction.id}`, 14, 25);
    doc.text(`Date: ${new Date(transaction.transaction_date).toLocaleDateString('id-ID')}`, 14, 30);
    doc.text(`Store: ${transaction.store?.name || '-'}`, 14, 35);
    doc.text(`Staff: ${transaction.staff?.full_name || '-'}`, 14, 40);
    
    // Add items table
    const tableData = transaction.items.map(item => [
      item.product?.sku || '-',
      item.product?.name || '-',
      item.quantity.toString(),
      `Rp ${item.unit_price.toLocaleString('id-ID')}`,
      `Rp ${item.line_discount.toLocaleString('id-ID')}`,
      `Rp ${item.line_total.toLocaleString('id-ID')}`
    ]);

    (doc as any).autoTable({
      startY: 50,
      head: [['SKU', 'Product', 'Qty', 'Unit Price', 'Discount', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 }
    });

    // Add totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Subtotal: Rp ${transaction.total_before_discount.toLocaleString('id-ID')}`, 14, finalY);
    doc.text(`Discount: Rp ${transaction.total_discount.toLocaleString('id-ID')}`, 14, finalY + 5);
    doc.setFontSize(12);
    doc.text(`Total: Rp ${transaction.total_after_discount.toLocaleString('id-ID')}`, 14, finalY + 12);

    // Generate blob
    const pdfBlob = doc.output('blob');
    const filename = `transaction-${transaction.id.substring(0, 8)}-${new Date(transaction.transaction_date).toISOString().split('T')[0]}.pdf`;

    return {
      success: true,
      data: {
        blob: pdfBlob,
        filename
      }
    };

  } catch (error) {
    console.error('Export transaction PDF error:', error);
    return {
      success: false,
      error: 'Failed to generate PDF'
    };
  }
}

/**
 * Exports a single transaction to Excel format
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 5.4, 5.5, 11.1, 11.2
 */
export async function exportTransactionExcel(
  transactionId: string
): Promise<ActionResult<{ blob: Blob; filename: string }>> {
  return withErrorHandling(
    async () => {
      const supabase = await createClient();

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        const authError = createError(ErrorCode.AUTH_REQUIRED, 'User not authenticated');
        throw authError;
      }

      // Validate transaction ID
      if (!transactionId || typeof transactionId !== 'string') {
        const validationError = createError(
          ErrorCode.INVALID_INPUT,
          'Invalid transaction ID'
        );
        throw validationError;
      }

      // Get transaction details with all related data
      const transactionResult = await trackQueryPerformance(
        'getTransactionById',
        () => getTransactionById(transactionId)
      );

      if (!transactionResult.success || !transactionResult.data) {
        const notFoundError = createError(
          ErrorCode.EXPORT_DATA_NOT_FOUND,
          'Transaction not found'
        );
        throw notFoundError;
      }

      const transaction = transactionResult.data;

      // Get fiscal week from fiscal_calendar table
      const fiscalResult = await trackQueryPerformance(
        'getFiscalWeek',
        async () => {
          return await supabase
            .from('fiscal_calendar')
            .select('fiscal_week')
            .eq('date', transaction.transaction_date)
            .single();
        }
      );

      // Generate Excel file
      // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.4, 5.5
      const blob = exportTransactionToExcel(transaction, fiscalResult?.data?.fiscal_week);
      const filename = generateExportFilename(transaction, 'excel');

      return { blob, filename };
    },
    'exportTransactionExcel',
    ErrorCode.EXPORT_FAILED
  );
}

/**
 * Exports multiple transactions to a single Excel file
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.1, 11.2, 11.4
 */
export async function exportMultipleTransactions(
  transactionIds: string[]
): Promise<ActionResult<{ blob: Blob; filename: string }>> {
  return withErrorHandling(
    async () => {
      const supabase = await createClient();

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        const authError = createError(ErrorCode.AUTH_REQUIRED, 'User not authenticated');
        throw authError;
      }

      // Validate transaction IDs
      if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
        const validationError = createError(
          ErrorCode.INVALID_INPUT,
          'Invalid transaction IDs'
        );
        throw validationError;
      }

      // Optimize export for large datasets
      // Requirements: 11.4
      const optimization = await optimizeTransactionExport(transactionIds);
      
      // Log recommendations for large exports
      if (optimization.recommendations.length > 0) {
        logError('exportMultipleTransactions', 'Large export detected', {
          count: transactionIds.length,
          recommendations: optimization.recommendations
        });
      }

      // Fetch all transactions in batches
      const transactions: Transaction[] = [];
      const fiscalWeekMap = new Map<string, number>();
      
      for (const batch of optimization.batches) {
        const batchResults = await Promise.all(
          batch.map(id => trackQueryPerformance(
            'getTransactionById',
            () => getTransactionById(id)
          ))
        );

        for (const result of batchResults) {
          if (result.success && result.data) {
            transactions.push(result.data);
            
            // Get fiscal week for this transaction
            const { data: fiscalData } = await supabase
              .from('fiscal_calendar')
              .select('fiscal_week')
              .eq('date', result.data.transaction_date)
              .single();
            
            if (fiscalData?.fiscal_week) {
              fiscalWeekMap.set(result.data.id, fiscalData.fiscal_week);
            }
          }
        }
      }

      if (transactions.length === 0) {
        const notFoundError = createError(
          ErrorCode.EXPORT_DATA_NOT_FOUND,
          'No valid transactions found'
        );
        throw notFoundError;
      }

      // Generate Excel file with all transactions
      const blob = exportMultipleTransactionsToExcel(transactions, fiscalWeekMap);
      
      // Generate filename based on date range
      const dates = transactions.map(t => t.transaction_date).sort();
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      const filename = generateBatchExportFilename(startDate, endDate);

      return { blob, filename };
    },
    'exportMultipleTransactions',
    ErrorCode.EXPORT_FAILED
  );
}

/**
 * Gets the unified sales data for a transaction (for export purposes)
 * This formats transaction data in the existing export format
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export async function getTransactionExportData(
  transactionId: string
): Promise<ActionResult<any[]>> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Get transaction with all details
    const transactionResult = await getTransactionById(transactionId);
    if (!transactionResult.success || !transactionResult.data) {
      return {
        success: false,
        error: 'Transaction not found'
      };
    }

    const transaction = transactionResult.data;

    // Get fiscal calendar data for the transaction date
    const { data: fiscalData, error: fiscalError } = await supabase
      .from('fiscal_calendar')
      .select('fiscal_week, fiscal_month, fiscal_year')
      .eq('date', transaction.transaction_date)
      .single();

    if (fiscalError) {
      console.error('Error fetching fiscal data:', fiscalError);
    }

    // Format transaction items in export format (one row per product)
    const exportRows = transaction.items.map((item) => {
      // Extract gift details (up to 2 gifts as per existing format)
      const gift1 = item.gift_details?.[0];
      const gift2 = item.gift_details?.[1];

      return {
        month: fiscalData?.fiscal_month || new Date(transaction.transaction_date).getMonth() + 1,
        date: transaction.transaction_date,
        week: fiscalData?.fiscal_week || 0,
        account_name: transaction.store?.account?.name || '',
        store_name: transaction.store?.name || '',
        sku: item.product?.sku || '',
        category: item.product?.category || '',
        sub_category: item.product?.sub_category || '',
        product_name: item.product?.name || '',
        qty: item.quantity,
        st: item.unit_price, // ST = unit price
        discount: item.line_discount,
        total: item.line_total,
        gift_product_1: gift1?.name || '',
        gift_qty_1: gift1?.qty || 0,
        gift_product_2: gift2?.name || '',
        gift_qty_2: gift2?.qty || 0,
        customer_name: transaction.customer_name || '',
        customer_phone: transaction.customer_phone || '',
        staff_name: transaction.staff?.full_name || '',
        inventory_source: transaction.inventory_source
      };
    });

    return {
      success: true,
      data: exportRows
    };

  } catch (error) {
    console.error('Get transaction export data error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Export legacy sales record to Excel format
 * Requirements: 5.6, 3.7
 * 
 * Legacy sales records are exported as single-row transactions
 * maintaining backward compatibility with existing export functionality
 */
export async function exportLegacySaleExcel(
  saleId: string
): Promise<ActionResult<{ blob: Blob; filename: string }>> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Validate sale ID
    if (!saleId || typeof saleId !== 'string') {
      return {
        success: false,
        error: 'Invalid sale ID'
      };
    }

    // Get legacy sale data from unified_sales_export view
    const { data: saleData, error: saleError } = await supabase
      .from('unified_sales_export')
      .select('*')
      .eq('id', saleId)
      .eq('source_type', 'legacy')
      .single();

    if (saleError || !saleData) {
      return {
        success: false,
        error: 'Legacy sale not found'
      };
    }

    // Convert to Transaction format for export
    // Requirements: 5.6 - Handle legacy sales records as single-row transactions
    const legacyTransaction: Transaction = {
      id: saleData.id,
      store_id: saleData.store_id,
      store: {
        id: saleData.store_id,
        name: saleData.store_name,
        account: saleData.account_name ? {
          id: '',
          name: saleData.account_name,
          channel_type: 'Retailer' as ChannelType,
          is_active: true,
          created_at: '',
          updated_at: ''
        } : undefined,
        account_id: '',
        region: null,
        monthly_target: 0,
        is_active: true,
        created_at: '',
        updated_at: ''
      },
      staff_id: saleData.staff_id,
      staff: {
        id: saleData.staff_id,
        email: '',
        full_name: saleData.staff_name,
        role: 'staff',
        store_id: saleData.store_id,
        is_active: true,
        created_at: '',
        updated_at: ''
      },
      transaction_date: saleData.sale_date,
      total_before_discount: saleData.total_price + saleData.discount,
      total_discount: saleData.discount,
      total_after_discount: saleData.total_price,
      inventory_source: saleData.inventory_source,
      customer_name: saleData.customer_name,
      customer_phone: saleData.customer_phone,
      notes: null,
      created_by: saleData.staff_id,
      created_at: '',
      updated_at: '',
      items: [{
        id: saleData.id,
        transaction_id: saleData.id,
        product_id: saleData.product_id,
        product: {
          id: saleData.product_id,
          sku: saleData.sku,
          name: saleData.product_name,
          category: saleData.category,
          sub_category: saleData.sub_category,
          price_retail: saleData.unit_price,
          price_buy: saleData.unit_price,
          channel_pricing: {},
          is_active: true,
          created_at: '',
          updated_at: ''
        },
        quantity: saleData.quantity,
        unit_price: saleData.unit_price,
        line_discount: saleData.discount,
        line_total: saleData.total_price,
        gift_details: saleData.gift_details || [],
        created_at: ''
      }]
    };

    // Generate Excel file using the same export logic
    const blob = exportTransactionToExcel(legacyTransaction, saleData.fiscal_week);
    const filename = generateExportFilename(legacyTransaction, 'excel');

    return {
      success: true,
      data: { blob, filename }
    };

  } catch (error) {
    console.error('Export legacy sale Excel error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}
