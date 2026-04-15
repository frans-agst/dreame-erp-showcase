'use client';

import { useState, useRef } from 'react';
import { SoftCard } from '@/components/ui/SoftCard';
import { Button } from '@/components/ui/Button';
import { parsePOExcel, ParsedPO } from '@/lib/excel/purchase-order-import';
import { importPurchaseOrder } from '@/actions/purchase-orders';

interface ImportResult {
  po_number: string;
  id: string;
  skipped_skus: string[];
  sheet_name?: string;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function ImportPOModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsedPOs, setParsedPOs] = useState<ParsedPO[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [errors, setErrors] = useState<{ sheet: string; error: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);

    try {
      const parsed = await parsePOExcel(file);
      if (parsed.length === 0) {
        setParseError('No valid purchase order sheets found. Make sure the file matches the exported PO format.');
        return;
      }
      setParsedPOs(parsed);
      setStep('preview');
    } catch (err) {
      setParseError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleImport = async () => {
    setStep('importing');
    const importResults: ImportResult[] = [];
    const importErrors: { sheet: string; error: string }[] = [];

    for (let i = 0; i < parsedPOs.length; i++) {
      const po = parsedPOs[i];
      const sheetLabel = po.po_number || `Sheet ${i + 1}`;
      const result = await importPurchaseOrder({
        po_date: po.po_date,
        dealer_name: po.dealer_name,
        items: po.items.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
          after_tax: item.after_tax,
        })),
      });

      if (result.success) {
        importResults.push({ ...result.data, sheet_name: sheetLabel });
      } else {
        importErrors.push({ sheet: sheetLabel, error: result.error });
      }
    }

    setResults(importResults);
    setErrors(importErrors);
    setStep('done');
    if (importResults.length > 0) onImported();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <SoftCard className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-primary">Import Purchase Orders</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              Upload an Excel file exported from this system. Each PO sheet will be imported as a new draft purchase order.
            </p>
            <div
              className="border-2 border-dashed border-secondary/30 rounded-xl p-8 text-center cursor-pointer hover:border-accent-green/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <svg className="w-10 h-10 mx-auto text-secondary mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-secondary">Click to select an Excel file (.xlsx)</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>
            {parseError && <p className="text-sm text-accent-red">{parseError}</p>}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              Found <span className="font-medium text-primary">{parsedPOs.length}</span> purchase order(s) in <span className="font-medium text-primary">{fileName}</span>. Review before importing:
            </p>
            <div className="space-y-3">
              {parsedPOs.map((po, i) => (
                <div key={i} className="border border-secondary/20 rounded-xl p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-primary text-sm">{po.po_number || `PO ${i + 1}`}</span>
                    <span className="text-xs text-secondary uppercase">{po.status}</span>
                  </div>
                  <p className="text-xs text-secondary">Date: {po.po_date}</p>
                  <p className="text-xs text-secondary">Dealer: {po.dealer_name}</p>
                  <p className="text-xs text-secondary">{po.items.length} item(s): {po.items.map((it) => it.sku).join(', ')}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => { setStep('upload'); setParsedPOs([]); setFileName(''); }}>Back</Button>
              <Button onClick={handleImport}>Import {parsedPOs.length} PO(s)</Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-green" />
            <p className="text-secondary text-sm">Importing purchase orders…</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="space-y-4">
            {results.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-accent-green">✓ {results.length} PO(s) imported successfully</p>
                {results.map((r, i) => (
                  <div key={i} className="text-xs text-secondary pl-3 border-l-2 border-accent-green/40">
                    <span className="font-medium text-primary">{r.po_number}</span>
                    {r.skipped_skus.length > 0 && (
                      <span className="text-accent-red ml-2">(skipped SKUs: {r.skipped_skus.join(', ')})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-accent-red">✗ {errors.length} PO(s) failed</p>
                {errors.map((e, i) => (
                  <div key={i} className="text-xs text-accent-red pl-3 border-l-2 border-accent-red/40">
                    <span className="font-medium">{e.sheet}:</span> {e.error}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        )}

      </SoftCard>
    </div>
  );
}
