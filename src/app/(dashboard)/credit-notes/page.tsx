'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAllCreditNotes, getDealers, createCreditNote, updateCreditNoteStatus, deleteCreditNote, CreditNoteWithDealer } from '@/actions/dealer';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SoftCard } from '@/components/ui/SoftCard';
import { FormField } from '@/components/ui/FormField';
import { FormSuccess } from '@/components/ui/FormSuccess';
import { FormError } from '@/components/ui/FormError';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useI18n } from '@/lib/i18n/context';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusVariant(status: string): 'red' | 'yellow' | 'green' {
  switch (status) {
    case 'available': return 'green';
    case 'used': return 'yellow';
    case 'expired': return 'red';
    default: return 'yellow';
  }
}

export default function CreditNotesManagementPage() {
  const { t } = useI18n();
  const [creditNotes, setCreditNotes] = useState<CreditNoteWithDealer[]>([]);
  const [dealers, setDealers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filterDealer, setFilterDealer] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    dealer_id: '',
    amount: 0,
    description: '',
    expires_at: '',
  });

  useEffect(() => {
    const fetchDealers = async () => {
      const result = await getDealers();
      if (result.success) setDealers(result.data);
    };
    fetchDealers();
  }, []);

  const fetchCreditNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getAllCreditNotes({
      dealer_id: filterDealer || undefined,
      status: filterStatus || undefined,
    });
    if (result.success) setCreditNotes(result.data);
    else setError(result.error);
    setLoading(false);
  }, [filterDealer, filterStatus]);

  useEffect(() => { fetchCreditNotes(); }, [fetchCreditNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setSuccess(null);

    if (!formData.dealer_id || formData.amount <= 0) {
      setError('Please select a dealer and enter a valid amount');
      setFormLoading(false);
      return;
    }

    const result = await createCreditNote({
      dealer_id: formData.dealer_id,
      amount: formData.amount,
      description: formData.description || undefined,
      expires_at: formData.expires_at || null,
    });

    if (result.success) {
      setSuccess('Credit note created successfully');
      setShowModal(false);
      resetForm();
      fetchCreditNotes();
    } else setError(result.error);
    setFormLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: 'available' | 'used' | 'expired') => {
    const result = await updateCreditNoteStatus(id, newStatus);
    if (result.success) {
      setSuccess('Status updated successfully');
      fetchCreditNotes();
    } else setError(result.error);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credit note?')) return;
    const result = await deleteCreditNote(id);
    if (result.success) {
      setSuccess('Credit note deleted successfully');
      fetchCreditNotes();
    } else setError(result.error);
  };

  const resetForm = () => {
    setFormData({ dealer_id: '', amount: 0, description: '', expires_at: '' });
  };

  const totalAvailable = creditNotes.filter(cn => cn.status === 'available').reduce((sum, cn) => sum + cn.amount, 0);
  const totalUsed = creditNotes.filter(cn => cn.status === 'used').reduce((sum, cn) => sum + cn.amount, 0);

  const columns: Column<CreditNoteWithDealer>[] = [
    { key: 'created_at', header: t('common.date'), sortable: true, render: (row) => formatDate(row.created_at) },
    { key: 'dealer', header: 'Dealer', sortable: true, render: (row) => row.dealer?.full_name || '-' },
    { key: 'description', header: t('form.description'), render: (row) => row.description || '-' },
    { key: 'amount', header: t('common.amount'), sortable: true, render: (row) => formatCurrency(row.amount), className: 'text-right' },
    { key: 'status', header: t('common.status'), sortable: true, render: (row) => (
      <StatusBadge status={getStatusVariant(row.status)} label={row.status.charAt(0).toUpperCase() + row.status.slice(1)} />
    )},
    { key: 'expires_at', header: 'Expires', render: (row) => formatDate(row.expires_at) },
    { key: 'actions', header: t('common.actions'), render: (row) => (
      <div className="flex gap-2">
        <Select
          value={row.status}
          onChange={(e) => handleStatusChange(row.id, e.target.value as 'available' | 'used' | 'expired')}
          className="text-xs py-1 px-2"
        >
          <option value="available">Available</option>
          <option value="used">Used</option>
          <option value="expired">Expired</option>
        </Select>
        <button onClick={() => handleDelete(row.id)} className="text-accent-red hover:underline text-sm">{t('common.delete')}</button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Credit Notes Management</h1>
          <p className="text-secondary mt-1">Manage dealer credit notes and rebates</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>Add Credit Note</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SoftCard>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-secondary">Total Available</p>
              <p className="text-xl font-semibold text-green-600">{formatCurrency(totalAvailable)}</p>
            </div>
          </div>
        </SoftCard>
        <SoftCard>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-secondary">Total Used</p>
              <p className="text-xl font-semibold text-yellow-600">{formatCurrency(totalUsed)}</p>
            </div>
          </div>
        </SoftCard>
        <SoftCard>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-secondary">Total Notes</p>
              <p className="text-xl font-semibold text-primary">{creditNotes.length}</p>
            </div>
          </div>
        </SoftCard>
      </div>

      {/* Filters */}
      <SoftCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-secondary mb-1">Dealer</label>
            <Select value={filterDealer} onChange={(e) => setFilterDealer(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {dealers.map((dealer) => (<option key={dealer.id} value={dealer.id}>{dealer.full_name}</option>))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1">{t('common.status')}</label>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">{t('common.all')}</option>
              <option value="available">Available</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
            </Select>
          </div>
        </div>
      </SoftCard>

      {success && <FormSuccess message={success} />}
      {error && <SoftCard className="bg-accent-redLight"><FormError message={error} /></SoftCard>}

      <DataTable columns={columns} data={creditNotes} keyExtractor={(row) => row.id} loading={loading} emptyMessage="No credit notes found" pageSize={10} />

      {/* Add Credit Note Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <SoftCard className="relative z-10 w-full max-w-lg mx-4">
            <h2 className="text-xl font-semibold text-primary mb-4">Add Credit Note</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Dealer" htmlFor="dealer_id" required>
                <Select id="dealer_id" value={formData.dealer_id} onChange={(e) => setFormData({ ...formData, dealer_id: e.target.value })} required>
                  <option value="">Select Dealer</option>
                  {dealers.map((dealer) => (<option key={dealer.id} value={dealer.id}>{dealer.full_name} ({dealer.email})</option>))}
                </Select>
              </FormField>
              <FormField label={t('common.amount')} htmlFor="amount" required>
                <Input id="amount" type="number" min="1" step="1" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} required />
              </FormField>
              <FormField label={t('form.description')} htmlFor="description">
                <Input id="description" type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="e.g., Q1 Rebate, Promotion Credit" />
              </FormField>
              <FormField label="Expiry Date (Optional)" htmlFor="expires_at">
                <Input id="expires_at" type="date" value={formData.expires_at} onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })} />
              </FormField>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">{t('common.cancel')}</Button>
                <Button type="submit" isLoading={formLoading} className="flex-1">{t('common.create')}</Button>
              </div>
            </form>
          </SoftCard>
        </div>
      )}
    </div>
  );
}
