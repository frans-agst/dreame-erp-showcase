import * as XLSX from 'xlsx';
import { PurchaseOrder, POItem } from '@/types';

// Format number as currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface POItemWithProduct extends Omit<POItem, 'product'> {
  product?: {
    sku: string;
    name: string;
  };
}

/**
 * Export purchase order to Excel
 */
export function exportPurchaseOrderToExcel(
  po: PurchaseOrder & { items: POItemWithProduct[] }
): void {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Prepare header data
  const headerData = [
    ['PURCHASE ORDER'],
    [],
    ['PO Number:', po.po_number],
    ['Date:', formatDate(po.po_date)],
    ['Dealer:', po.dealer_name],
    ['Status:', po.status.toUpperCase()],
    [],
  ];

  // Prepare items data
  const itemsHeader = [
    'No',
    'SKU',
    'Product Name',
    'Quantity',
    'Before Tax',
    'After Tax',
    'Line Total',
  ];

  const itemsData = po.items.map((item, index) => [
    index + 1,
    item.product?.sku || '-',
    item.product?.name || '-',
    item.quantity,
    item.before_tax,
    item.after_tax,
    item.line_total,
  ]);

  // Prepare totals data
  const totalsData = [
    [],
    ['', '', '', '', '', 'Total Before Tax:', po.total_before_tax],
    ['', '', '', '', '', 'VAT (11%):', po.total_after_tax - po.total_before_tax],
    ['', '', '', '', '', 'Grand Total:', po.grand_total],
  ];

  // Combine all data
  const worksheetData = [
    ...headerData,
    itemsHeader,
    ...itemsData,
    ...totalsData,
  ];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },  // No
    { wch: 15 }, // SKU
    { wch: 30 }, // Product Name
    { wch: 10 }, // Quantity
    { wch: 15 }, // Before Tax
    { wch: 15 }, // After Tax
    { wch: 15 }, // Line Total
  ];

  // Style the header (bold and larger font)
  const headerCells = ['A1', 'A2'];
  headerCells.forEach(cell => {
    if (worksheet[cell]) {
      worksheet[cell].s = {
        font: { bold: true, sz: 16 },
      };
    }
  });

  // Style the items header row (bold)
  const itemsHeaderRow = headerData.length + 1;
  const itemsHeaderCells = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(
    col => `${col}${itemsHeaderRow}`
  );
  itemsHeaderCells.forEach(cell => {
    if (worksheet[cell]) {
      worksheet[cell].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'F3F4F6' } },
      };
    }
  });

  // Format currency columns
  const currencyFormat = '#,##0';
  const startRow = itemsHeaderRow + 1;
  const endRow = startRow + itemsData.length - 1;

  for (let row = startRow; row <= endRow; row++) {
    ['E', 'F', 'G'].forEach(col => {
      const cell = `${col}${row}`;
      if (worksheet[cell]) {
        worksheet[cell].z = currencyFormat;
      }
    });
  }

  // Format totals
  const totalsStartRow = endRow + 2;
  for (let i = 0; i < 3; i++) {
    const cell = `G${totalsStartRow + i}`;
    if (worksheet[cell]) {
      worksheet[cell].z = currencyFormat;
      worksheet[cell].s = {
        font: { bold: i === 2 }, // Bold for grand total
      };
    }
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Order');

  // Generate filename
  const filename = `PO_${po.po_number}_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Write file
  XLSX.writeFile(workbook, filename);
}

/**
 * Export multiple purchase orders to Excel
 */
export function exportPurchaseOrdersToExcel(
  pos: (PurchaseOrder & { items: POItemWithProduct[] })[]
): void {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Prepare summary data
  const summaryHeader = [
    'PO Number',
    'Date',
    'Dealer',
    'Status',
    'Total Before Tax',
    'VAT',
    'Grand Total',
    'Items Count',
  ];

  const summaryData = pos.map(po => [
    po.po_number,
    formatDate(po.po_date),
    po.dealer_name,
    po.status.toUpperCase(),
    po.total_before_tax,
    po.total_after_tax - po.total_before_tax,
    po.grand_total,
    po.items.length,
  ]);

  // Create summary worksheet
  const summaryWorksheet = XLSX.utils.aoa_to_sheet([
    ['PURCHASE ORDERS SUMMARY'],
    [],
    summaryHeader,
    ...summaryData,
  ]);

  // Set column widths for summary
  summaryWorksheet['!cols'] = [
    { wch: 20 }, // PO Number
    { wch: 15 }, // Date
    { wch: 25 }, // Dealer
    { wch: 12 }, // Status
    { wch: 15 }, // Total Before Tax
    { wch: 15 }, // VAT
    { wch: 15 }, // Grand Total
    { wch: 12 }, // Items Count
  ];

  // Format currency columns in summary
  const currencyFormat = '#,##0';
  for (let row = 5; row < 5 + summaryData.length; row++) {
    ['E', 'F', 'G'].forEach(col => {
      const cell = `${col}${row}`;
      if (summaryWorksheet[cell]) {
        summaryWorksheet[cell].z = currencyFormat;
      }
    });
  }

  // Add summary worksheet
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

  // Add individual PO worksheets (limit to first 10 to avoid too many sheets)
  pos.slice(0, 10).forEach((po, index) => {
    // Prepare header data
    const headerData = [
      ['PURCHASE ORDER'],
      [],
      ['PO Number:', po.po_number],
      ['Date:', formatDate(po.po_date)],
      ['Dealer:', po.dealer_name],
      ['Status:', po.status.toUpperCase()],
      [],
    ];

    // Prepare items data
    const itemsHeader = [
      'No',
      'SKU',
      'Product Name',
      'Quantity',
      'Before Tax',
      'After Tax',
      'Line Total',
    ];

    const itemsData = po.items.map((item, idx) => [
      idx + 1,
      item.product?.sku || '-',
      item.product?.name || '-',
      item.quantity,
      item.before_tax,
      item.after_tax,
      item.line_total,
    ]);

    // Prepare totals data
    const totalsData = [
      [],
      ['', '', '', '', '', 'Total Before Tax:', po.total_before_tax],
      ['', '', '', '', '', 'VAT (11%):', po.total_after_tax - po.total_before_tax],
      ['', '', '', '', '', 'Grand Total:', po.grand_total],
    ];

    // Combine all data
    const worksheetData = [
      ...headerData,
      itemsHeader,
      ...itemsData,
      ...totalsData,
    ];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },  // No
      { wch: 15 }, // SKU
      { wch: 30 }, // Product Name
      { wch: 10 }, // Quantity
      { wch: 15 }, // Before Tax
      { wch: 15 }, // After Tax
      { wch: 15 }, // Line Total
    ];

    // Format currency columns
    const startRow = headerData.length + 1;
    const endRow = startRow + itemsData.length - 1;

    for (let row = startRow; row <= endRow; row++) {
      ['E', 'F', 'G'].forEach(col => {
        const cell = `${col}${row}`;
        if (worksheet[cell]) {
          worksheet[cell].z = currencyFormat;
        }
      });
    }

    // Add worksheet with truncated PO number as sheet name
    const sheetName = po.po_number.substring(0, 31); // Excel sheet name limit
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Generate filename
  const filename = `Purchase_Orders_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Write file
  XLSX.writeFile(workbook, filename);
}
