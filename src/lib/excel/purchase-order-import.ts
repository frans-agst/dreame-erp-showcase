import * as XLSX from 'xlsx';

export interface ParsedPOItem {
  sku: string;
  product_name: string;
  quantity: number;
  after_tax: number;
}

export interface ParsedPO {
  po_number: string | null;
  po_date: string;       // YYYY-MM-DD
  dealer_name: string;   // e.g. "Hangon - Hangon"
  status: string;
  items: ParsedPOItem[];
}

/**
 * Parse a PO Excel file (single sheet or multi-sheet).
 * Supports the exported format:
 *   Row 1:  PURCHASE ORDER
 *   Row 3:  PO Nu  <po_number>
 *   Row 4:  Date   <date>
 *   Row 5:  Dealer <dealer_name>
 *   Row 6:  Status <status>
 *   Row 8:  No | SKU | Product Name | Quantity | Before Tax | After Tax | Line Total
 *   Row 9+: items
 */
export function parsePOExcel(file: File): Promise<ParsedPO[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        const results: ParsedPO[] = [];

        for (const sheetName of workbook.SheetNames) {
          // Skip the summary sheet
          if (sheetName.toLowerCase() === 'summary') continue;

          const sheet = workbook.Sheets[sheetName];
          // Convert to array of arrays (raw values)
          const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          if (!rows || rows.length < 8) continue;

          // Helper to get cell string value
          const cell = (r: number, c: number): string => String(rows[r]?.[c] ?? '').trim();

          // Row 0 (index): "PURCHASE ORDER" — validate
          if (!cell(0, 0).toUpperCase().includes('PURCHASE ORDER')) continue;

          // Row 2: PO Number (col B)
          const po_number = cell(2, 1) || null;

          // Row 3: Date (col B) — could be a Date object or string
          let po_date = '';
          const rawDate = rows[3]?.[1];
          if (rawDate instanceof Date) {
            // Use local date parts to avoid UTC timezone shift
            const y = rawDate.getFullYear();
            const m = String(rawDate.getMonth() + 1).padStart(2, '0');
            const d = String(rawDate.getDate()).padStart(2, '0');
            po_date = `${y}-${m}-${d}`;
          } else if (typeof rawDate === 'string' && rawDate) {
            const trimmed = rawDate.trim();
            // Already YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
              po_date = trimmed;
            } else {
              // Parse "15 April 2026" or "15 Apr 2026" manually — no timezone risk
              const months: Record<string, string> = {
                january: '01', february: '02', march: '03', april: '04',
                may: '05', june: '06', july: '07', august: '08',
                september: '09', october: '10', november: '11', december: '12',
                jan: '01', feb: '02', mar: '03', apr: '04',
                jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
              };
              const parts = trimmed.split(/\s+/);
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const mon = months[parts[1].toLowerCase()];
                const year = parts[2];
                if (mon && year) {
                  po_date = `${year}-${mon}-${day}`;
                } else {
                  po_date = new Date().toISOString().split('T')[0];
                }
              } else {
                po_date = new Date().toISOString().split('T')[0];
              }
            }
          } else {
            po_date = new Date().toISOString().split('T')[0];
          }

          // Row 4: Dealer (col B)
          const dealer_name = cell(4, 1);

          // Row 5: Status (col B)
          const status = cell(5, 1).toLowerCase() || 'draft';

          // Find the header row (contains "SKU")
          let headerRowIdx = -1;
          for (let i = 6; i < Math.min(rows.length, 15); i++) {
            const rowStr = rows[i]?.join(' ').toUpperCase() ?? '';
            if (rowStr.includes('SKU')) { headerRowIdx = i; break; }
          }
          if (headerRowIdx === -1) continue;

          // Map column indices from header
          const headers = (rows[headerRowIdx] as string[]).map((h) => String(h).trim().toUpperCase());
          const colIdx = (name: string) => headers.findIndex((h) => h.includes(name));
          const skuCol = colIdx('SKU');
          const qtyCol = colIdx('QUANTITY') !== -1 ? colIdx('QUANTITY') : colIdx('QTY');
          const afterTaxCol = colIdx('AFTER TAX') !== -1 ? colIdx('AFTER TAX') : colIdx('AFTER');
          const productNameCol = colIdx('PRODUCT NAME') !== -1 ? colIdx('PRODUCT NAME') : colIdx('PRODUCT');

          if (skuCol === -1 || qtyCol === -1 || afterTaxCol === -1) continue;

          const items: ParsedPOItem[] = [];
          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const sku = String(row?.[skuCol] ?? '').trim();
            if (!sku) break; // Stop at empty SKU row (totals section)

            const qty = Number(row?.[qtyCol] ?? 0);
            const afterTax = Number(row?.[afterTaxCol] ?? 0);
            const productName = productNameCol !== -1 ? String(row?.[productNameCol] ?? '').trim() : '';

            if (qty > 0) {
              items.push({ sku, product_name: productName, quantity: qty, after_tax: afterTax });
            }
          }

          if (items.length > 0) {
            results.push({ po_number, po_date, dealer_name, status, items });
          }
        }

        resolve(results);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
