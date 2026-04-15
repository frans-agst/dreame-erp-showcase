// src/lib/transaction-calculations.ts
// Transaction calculation logic for multi-product sales
// Requirements: 1.3, 3.5, 5.5

import type { TransactionItemInput, TransactionItem, UnifiedSalesItem } from '@/types';

export interface TransactionTotals {
  subtotal: number;
  totalDiscount: number;
  total: number;
  itemCount: number;
  totalQuantity: number;
}

export interface LineCalculation {
  subtotal: number;
  discount: number;
  total: number;
}

export interface DiscountDistribution {
  product_id: string;
  original_line_total: number;
  distributed_discount: number;
  final_line_total: number;
  discount_percentage: number;
}

/**
 * Calculates line total for a single transaction item
 * Requirements: 1.3
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  lineDiscount: number = 0
): LineCalculation {
  const subtotal = quantity * unitPrice;
  const discount = Math.min(lineDiscount, subtotal); // Ensure discount doesn't exceed subtotal
  const total = subtotal - discount;

  return {
    subtotal,
    discount,
    total,
  };
}

/**
 * Calculates transaction totals from all items
 * Requirements: 1.3
 */
export function calculateTransactionTotals(
  items: TransactionItemInput[],
  transactionDiscount: number = 0
): TransactionTotals {
  let subtotal = 0;
  let totalLineDiscounts = 0;
  let totalQuantity = 0;

  // Calculate subtotals and line discounts
  for (const item of items) {
    const lineCalc = calculateLineTotal(item.quantity, item.unit_price, item.line_discount);
    subtotal += lineCalc.subtotal;
    totalLineDiscounts += lineCalc.discount;
    totalQuantity += item.quantity;
  }

  // Apply transaction-level discount
  const totalDiscount = totalLineDiscounts + transactionDiscount;
  const total = subtotal - totalDiscount;

  return {
    subtotal,
    totalDiscount,
    total: Math.max(0, total), // Ensure total is not negative
    itemCount: items.length,
    totalQuantity,
  };
}

/**
 * Distributes transaction-level discount proportionally across items for exports
 * Requirements: 3.5, 5.5
 */
export function distributeTransactionDiscount(
  items: TransactionItem[],
  transactionDiscount: number
): DiscountDistribution[] {
  if (transactionDiscount <= 0 || items.length === 0) {
    return items.map(item => ({
      product_id: item.product_id,
      original_line_total: item.line_total,
      distributed_discount: 0,
      final_line_total: item.line_total,
      discount_percentage: 0,
    }));
  }

  // Calculate total of all line totals (before transaction discount)
  const totalLineAmount = items.reduce((sum, item) => sum + item.line_total, 0);

  if (totalLineAmount <= 0) {
    return items.map(item => ({
      product_id: item.product_id,
      original_line_total: item.line_total,
      distributed_discount: 0,
      final_line_total: item.line_total,
      discount_percentage: 0,
    }));
  }

  let remainingDiscount = transactionDiscount;
  const distributions: DiscountDistribution[] = [];

  // Distribute discount proportionally
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLastItem = i === items.length - 1;

    let distributedDiscount: number;
    
    if (isLastItem) {
      // Give remaining discount to last item to handle rounding
      distributedDiscount = remainingDiscount;
    } else {
      // Calculate proportional discount
      const proportion = item.line_total / totalLineAmount;
      distributedDiscount = Math.round(transactionDiscount * proportion * 100) / 100;
    }

    remainingDiscount -= distributedDiscount;

    const finalLineTotal = Math.max(0, item.line_total - distributedDiscount);
    const discountPercentage = item.line_total > 0 
      ? (distributedDiscount / item.line_total) * 100 
      : 0;

    distributions.push({
      product_id: item.product_id,
      original_line_total: item.line_total,
      distributed_discount: distributedDiscount,
      final_line_total: finalLineTotal,
      discount_percentage: discountPercentage,
    });
  }

  return distributions;
}

/**
 * Converts transaction items to unified sales format for exports
 * Requirements: 3.2, 3.5, 5.5
 */
export function convertTransactionToUnifiedSales(
  transaction: {
    id: string;
    transaction_date: string;
    store_id: string;
    store_name: string;
    account_name: string | null;
    staff_id: string;
    staff_name: string;
    customer_name: string | null;
    customer_phone: string | null;
    total_discount: number;
    inventory_source: 'in_store' | 'warehouse';
    items: TransactionItem[];
  },
  fiscalInfo: {
    fiscal_week: number;
    fiscal_year: number;
  }
): UnifiedSalesItem[] {
  // Distribute transaction-level discount across items
  const discountDistribution = distributeTransactionDiscount(
    transaction.items,
    transaction.total_discount
  );

  return transaction.items.map((item, index) => {
    const distribution = discountDistribution[index];
    const totalDiscount = item.line_discount + distribution.distributed_discount;

    return {
      id: item.id,
      transaction_id: transaction.id,
      sale_date: transaction.transaction_date,
      fiscal_week: fiscalInfo.fiscal_week,
      fiscal_year: fiscalInfo.fiscal_year,
      store_id: transaction.store_id,
      store_name: transaction.store_name,
      account_name: transaction.account_name,
      staff_id: transaction.staff_id,
      staff_name: transaction.staff_name,
      product_id: item.product_id,
      sku: item.product?.sku || '',
      product_name: item.product?.name || '',
      category: item.product?.category || null,
      sub_category: item.product?.sub_category || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: totalDiscount,
      total_price: distribution.final_line_total,
      customer_name: transaction.customer_name,
      customer_phone: transaction.customer_phone,
      gift_details: item.gift_details,
      inventory_source: transaction.inventory_source,
      source_type: 'transaction' as const,
    };
  });
}

/**
 * Validates transaction calculation consistency
 * Requirements: 8.4
 */
export function validateTransactionCalculations(
  items: TransactionItemInput[],
  expectedTotal: number,
  transactionDiscount: number = 0
): { isValid: boolean; calculatedTotal: number; difference: number } {
  const totals = calculateTransactionTotals(items, transactionDiscount);
  const difference = Math.abs(totals.total - expectedTotal);
  
  // Allow for small rounding differences (1 cent)
  const isValid = difference < 0.01;

  return {
    isValid,
    calculatedTotal: totals.total,
    difference,
  };
}

/**
 * Calculates average transaction value for reporting
 * Requirements: 4.2
 */
export function calculateAverageTransactionValue(
  transactions: { total_after_discount: number }[]
): number {
  if (transactions.length === 0) return 0;
  
  const totalValue = transactions.reduce((sum, t) => sum + t.total_after_discount, 0);
  return totalValue / transactions.length;
}

/**
 * Calculates transaction metrics for dashboard
 * Requirements: 4.1, 4.2
 */
export function calculateTransactionMetrics(
  transactions: {
    total_after_discount: number;
    items: { quantity: number }[];
  }[]
): {
  totalTransactions: number;
  totalRevenue: number;
  totalItems: number;
  averageTransactionValue: number;
  averageItemsPerTransaction: number;
} {
  const totalTransactions = transactions.length;
  const totalRevenue = transactions.reduce((sum, t) => sum + t.total_after_discount, 0);
  const totalItems = transactions.reduce(
    (sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );

  return {
    totalTransactions,
    totalRevenue,
    totalItems,
    averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
    averageItemsPerTransaction: totalTransactions > 0 ? totalItems / totalTransactions : 0,
  };
}