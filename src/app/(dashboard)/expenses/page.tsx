'use client';

import { useState, useEffect, useCallback } from 'react';
import { getExpenses, createExpense, updateExpense, deleteExpense, Expense, ExpenseInput } from '@/actions/expenses';
import { getStores } from '@/actions/master-data';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SoftCard } from '@/components/ui/SoftCard';
import { FormField } from '@/components/ui/FormField';
import { FormSuccess } from '@/components/ui/FormSuccess';
import { FormError } from '@/components/ui/FormError';
import { Store } from '@/types';
import { useI18n } from '@/lib/i18n/context';

const EXPENSE_CATEGORIES = ['POSM', 'ADS', 'Exhibition', 'Logistic Cost', 'Support Sellout', 'Brandstore Promotion', 'Branding Offline'] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCurrentFiscalWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
}

function getStoreDisplayName(store: Store): string {
  const channelType = store.account?.channel_type || 'Unknown';
  return `${channelType} - ${store.name}`;
}

export default function ExpensesPage() {
  const { t } = useI18n();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  // Filters - only Store (no Channel Type)
  const [filterStore, setFilterStore] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Form state - only Store (no Channel Type)
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formStoreId, setFormStoreId] = useState<string>('');
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    fiscal_week: getCurrentFiscalWeek(),
    category: 'POSM' as typeof EXPENSE_CATEGORIES[number],
    amount: 0,
    evidence_url: null as string | null,
    remarks: null as string | null,
  });

  useEffect(() => {
    const fetchStores = async () => {
      const result = await getStores(true);
      if (result.success) setStores(result.data);
    };
    fetchStores();
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    const selectedStore = stores.find(s => s.id === filterStore);
    const result = await getExpenses({
      account_id: selectedStore?.account_id || undefined,
      category: filterCategory || undefined,
      start_date: filterStartDate || undefined,
      end_date: filterEndDate || undefined,
    });
    if (result.success) setExpenses(result.data);
    else setError(result.error);
    setLoading(false);
  }, [filterStore, filterCategory, filterStartDate, filterEndDate, stores]);

  useEffect(() => { if (stores.length > 0) fetchExpenses(); }, [fetchExpenses, stores.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setSuccess(null);

    const selectedStore = stores.find(s => s.id === formStoreId);
    if (!selectedStore) { setError('Please select a store'); setFormLoading(false); return; }

    const expenseData: ExpenseInput = { ...formData, account_id: selectedStore.account_id };
    const result = editingExpense ? await updateExpense(editingExpense.id, expenseData) : await createExpense(expenseData);

    if (result.success) {
      setSuccess(editingExpense ? 'Expense updated successfully' : 'Expense created successfully');
      setShowModal(false);
      setEditingExpense(null);
      resetForm();
      fetchExpenses();
    } else setError(result.error);
    setFormLoading(false);
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    const result = await deleteExpense(expense.id);
    if (result.success) { setSuccess('Expense deleted successfully'); fetchExpenses(); }
    else setError(result.error);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    const expenseStore = stores.find(s => s.account_id === expense.account_id);
    setFormStoreId(expenseStore?.id || '');
    setFormData({
      expense_date: expense.expense_date,
      fiscal_week: expense.fiscal_week,
      category: expense.category as typeof EXPENSE_CATEGORIES[number],
      amount: expense.amount,
      evidence_url: expense.evidence_url,
      remarks: expense.remarks,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormStoreId('');
    setFormData({ expense_date: new Date().toISOString().split('T')[0], fiscal_week: getCurrentFiscalWeek(), category: 'POSM', amount: 0, evidence_url: null, remarks: null });
  };

  const getExpenseStoreDisplay = (expense: Expense) => {
    const expStore = stores.find(s => s.account_id === expense.account_id);
    if (expStore) return getStoreDisplayName(expStore);
    return expense.account ? `${expense.account.channel_type} - ${expense.account.name}` : '-';
  };

  const handleExportExcel = async () => {
    if (expenses.length === 0) return;
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      const excelData = expenses.map((exp) => ({
        'Date': formatDate(exp.expense_date), 'Fiscal Week': exp.fiscal_week, 'Store': getExpenseStoreDisplay(exp),
        'Category': exp.category, 'Amount': exp.amount, 'Evidence URL': exp.evidence_url || '-',
        'Remarks': exp.remarks || '-', 'Created By': exp.creator?.full_name || '-',
      }));
      const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      excelData.push({ 'Date': '', 'Fiscal Week': '' as unknown as number, 'Store': '', 'Category': 'TOTAL', 'Amount': totalAmount, 'Evidence URL': '', 'Remarks': '', 'Created By': '' });
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
      XLSX.writeFile(workbook, `expenses-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { console.error('Error exporting Excel:', err); setError('Failed to export Excel'); }
    finally { setExporting(null); }
  };

  const handleExportPDF = async () => {
    if (expenses.length === 0) return;
    setExporting('pdf');
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { ExpensesReportPDF } = await import('@/lib/pdf/expenses-report');
      const selectedStore = stores.find(s => s.id === filterStore);
      const blob = await pdf(<ExpensesReportPDF expenses={expenses} filters={{ accountName: selectedStore ? getStoreDisplayName(selectedStore) : undefined, category: filterCategory, startDate: filterStartDate, endDate: filterEndDate }} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expenses-report-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('Error exporting PDF:', err); setError('Failed to export PDF'); }
    finally { setExporting(null); }
  };

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const sortedStores = [...stores].sort((a, b) => getStoreDisplayName(a).localeCompare(getStoreDisplayName(b)));

  const columns: Column<Expense>[] = [
    { key: 'expense_date', header: t('common.date'), sortable: true, render: (row) => formatDate(row.expense_date) },
    { key: 'fiscal_week', header: t('expenses.fiscalWeek') || 'Fiscal Week', sortable: true, render: (row) => `Week ${row.fiscal_week}` },
    { key: 'store', header: t('form.store') || 'Store', sortable: true, render: (row) => getExpenseStoreDisplay(row) },
    { key: 'category', header: t('form.category'), sortable: true },
    { key: 'amount', header: t('common.amount'), sortable: true, render: (row) => formatCurrency(row.amount), className: 'text-right' },
    { key: 'remarks', header: t('form.remarks'), render: (row) => row.remarks || '-' },
    { key: 'actions', header: t('common.actions'), render: (row) => (
      <div className="flex gap-2">
        <button onClick={() => handleEdit(row)} className="text-accent-blue hover:underline text-sm">{t('common.edit')}</button>
        <button onClick={() => handleDelete(row)} className="text-accent-red hover:underline text-sm">{t('common.delete')}</button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('expenses.title') || 'Expenses'}</h1>
          <p className="text-secondary mt-1">{t('expenses.description') || 'Manage and track expenses'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportPDF} disabled={expenses.length === 0 || exporting !== null}>{exporting === 'pdf' ? 'Exporting...' : 'Export PDF'}</Button>
          <Button variant="secondary" onClick={handleExportExcel} disabled={expenses.length === 0 || exporting !== null}>{exporting === 'excel' ? 'Exporting...' : 'Export Excel'}</Button>
          <Button onClick={() => { resetForm(); setEditingExpense(null); setShowModal(true); }}>{t('expenses.addExpense') || 'Add Expense'}</Button>
        </div>
      </div>

      {/* FILTERS - Only Store dropdown, NO Channel Type */}
      <SoftCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-secondary mb-1">{t('form.store') || 'Store'}</label>
            <Select value={filterStore} onChange={(e) => setFilterStore(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {sortedStores.map((store) => (<option key={store.id} value={store.id}>{getStoreDisplayName(store)}</option>))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1">{t('form.category')}</label>
            <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {EXPENSE_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1">{t('form.startDate')}</label>
            <Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1">{t('form.endDate')}</label>
            <Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
          </div>
        </div>
      </SoftCard>

      {success && <FormSuccess message={success} />}
      {error && <SoftCard className="bg-accent-redLight"><FormError message={error} /></SoftCard>}

      <SoftCard>
        <div className="flex justify-between items-center">
          <span className="text-secondary">{t('expenses.totalExpenses') || 'Total Expenses'}</span>
          <span className="text-2xl font-semibold text-primary">{formatCurrency(totalAmount)}</span>
        </div>
      </SoftCard>

      <DataTable columns={columns} data={expenses} keyExtractor={(row) => row.id} loading={loading} emptyMessage={t('expenses.noExpenses') || 'No expenses found'} pageSize={10} />

      {/* MODAL - Only Store dropdown, NO Channel Type */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <SoftCard className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-primary mb-4">{editingExpense ? (t('expenses.editExpense') || 'Edit Expense') : (t('expenses.addExpense') || 'Add Expense')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ONLY Store field - format: "ChannelType - StoreName" */}
              <FormField label={t('form.store') || 'Store'} htmlFor="store_id" required>
                <Select id="store_id" value={formStoreId} onChange={(e) => setFormStoreId(e.target.value)} required>
                  <option value="">Select Store</option>
                  {sortedStores.map((store) => (<option key={store.id} value={store.id}>{getStoreDisplayName(store)}</option>))}
                </Select>
              </FormField>
              <FormField label={t('common.date')} htmlFor="expense_date" required>
                <Input id="expense_date" type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} required />
              </FormField>
              <FormField label={t('expenses.fiscalWeek') || 'Fiscal Week'} htmlFor="fiscal_week" required>
                <Input id="fiscal_week" type="number" min="1" max="53" value={formData.fiscal_week} onChange={(e) => setFormData({ ...formData, fiscal_week: parseInt(e.target.value) || 1 })} required />
              </FormField>
              <FormField label={t('form.category')} htmlFor="category" required>
                <Select id="category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as typeof EXPENSE_CATEGORIES[number] })} required>
                  {EXPENSE_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                </Select>
              </FormField>
              <FormField label={t('common.amount')} htmlFor="amount" required>
                <Input id="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} required />
              </FormField>
              <FormField label={t('expenses.evidenceUrl') || 'Evidence URL'} htmlFor="evidence_url">
                <Input id="evidence_url" type="url" value={formData.evidence_url || ''} onChange={(e) => setFormData({ ...formData, evidence_url: e.target.value || null })} placeholder="https://..." />
              </FormField>
              <FormField label={t('form.remarks')} htmlFor="remarks">
                <Input id="remarks" type="text" value={formData.remarks || ''} onChange={(e) => setFormData({ ...formData, remarks: e.target.value || null })} maxLength={500} />
              </FormField>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">{t('common.cancel')}</Button>
                <Button type="submit" isLoading={formLoading} className="flex-1">{editingExpense ? t('common.update') : t('common.create')}</Button>
              </div>
            </form>
          </SoftCard>
        </div>
      )}
    </div>
  );
}
