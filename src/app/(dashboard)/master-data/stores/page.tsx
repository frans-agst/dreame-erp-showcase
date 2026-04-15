'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { SoftCard } from '@/components/ui/SoftCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  getStores,
  getAccounts,
  createStore,
  updateStore,
  softDeleteStore,
} from '@/actions/master-data';
import { Store, Account } from '@/types';

const StoreFormSchema = z.object({
  account_id: z
    .string()
    .min(1, { message: 'Account is required' }),
  name: z
    .string()
    .min(1, { message: 'Store name is required' })
    .max(200, { message: 'Store name must not exceed 200 characters' }),
  region: z
    .string()
    .max(100, { message: 'Region must not exceed 100 characters' })
    .optional()
    .nullable(),
  monthly_target: z
    .number({ message: 'Monthly target must be a number' })
    .nonnegative({ message: 'Monthly target cannot be negative' }),
});

type StoreFormData = z.infer<typeof StoreFormSchema>;

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Store | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StoreFormData>({
    resolver: zodResolver(StoreFormSchema),
  });


  const fetchData = useCallback(async () => {
    setLoading(true);
    const [storesResult, accountsResult] = await Promise.all([
      getStores(!showInactive),
      getAccounts(true), // Always get active accounts for dropdown
    ]);
    
    if (storesResult.success) {
      setStores(storesResult.data);
    }
    if (accountsResult.success) {
      setAccounts(accountsResult.data);
    }
    setLoading(false);
  }, [showInactive]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setEditingStore(null);
    reset({ 
      account_id: accounts[0]?.id || '', 
      name: '', 
      region: '', 
      monthly_target: 0 
    });
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (store: Store) => {
    setEditingStore(store);
    reset({
      account_id: store.account_id,
      name: store.name,
      region: store.region || '',
      monthly_target: store.monthly_target,
    });
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStore(null);
    setSubmitError(null);
    reset();
  };

  const onSubmit = async (data: StoreFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const storeData = {
        account_id: data.account_id,
        name: data.name,
        region: data.region || null,
        monthly_target: data.monthly_target,
        is_active: editingStore ? editingStore.is_active : true,
      };
      
      const result = editingStore
        ? await updateStore(editingStore.id, storeData)
        : await createStore(storeData);

      if (result.success) {
        closeModal();
        fetchData();
      } else {
        setSubmitError(result.error);
      }
    } catch {
      setSubmitError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setIsSubmitting(true);
    const result = await softDeleteStore(deleteConfirm.id);

    if (result.success) {
      setDeleteConfirm(null);
      fetchData();
    } else {
      setSubmitError(result.error);
    }
    setIsSubmitting(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Display "Account - Store" format
  const getDisplayName = (store: Store) => {
    const accountName = store.account?.name || 'Unknown Account';
    return `${accountName} - ${store.name}`;
  };

  const columns: Column<Store>[] = [
    {
      key: 'display_name',
      header: 'Account - Store',
      sortable: true,
      render: (row) => (
        <span className="font-medium">{getDisplayName(row)}</span>
      ),
    },
    {
      key: 'channel_type',
      header: 'Channel Type',
      sortable: true,
      render: (row) => {
        const channelType = row.account?.channel_type;
        const badgeColor = channelType === 'Brandstore' ? 'green' 
          : channelType === 'Dealer' ? 'red' 
          : 'yellow';
        return (
          <StatusBadge
            status={badgeColor}
            label={channelType || '-'}
          />
        );
      },
    },
    {
      key: 'region',
      header: 'Region',
      sortable: true,
      render: (row) => row.region || '-',
    },
    {
      key: 'monthly_target',
      header: 'Monthly Target',
      sortable: true,
      render: (row) => formatCurrency(row.monthly_target),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          status={row.is_active ? 'green' : 'red'}
          label={row.is_active ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="text-accent-green hover:text-accent-green/80 text-sm font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteConfirm(row)}
            className="text-accent-red hover:text-accent-red/80 text-sm font-medium"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Stores</h1>
          <p className="text-secondary mt-1">Manage store locations under accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-secondary/20 text-accent-green focus:ring-accent-green/20"
            />
            Show inactive
          </label>
          <Button onClick={openCreateModal} disabled={accounts.length === 0}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Store
          </Button>
        </div>
      </div>

      {accounts.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-accent-yellowLight text-accent-yellow text-sm">
          Please create an account first before adding stores.
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={stores}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage="No stores found"
        pageSize={10}
      />

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />
          <SoftCard className="relative z-10 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-primary mb-6">
              {editingStore ? 'Edit Store' : 'Add Store'}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                label="Account"
                htmlFor="account_id"
                error={errors.account_id?.message}
                required
              >
                <Select
                  id="account_id"
                  {...register('account_id')}
                  error={!!errors.account_id}
                >
                  <option value="">Select an account</option>
                  {[...accounts]
                    .sort((a, b) => `${a.channel_type} - ${a.name}`.localeCompare(`${b.channel_type} - ${b.name}`))
                    .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.channel_type} - {account.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Store Name"
                htmlFor="name"
                error={errors.name?.message}
                required
              >
                <Input
                  id="name"
                  {...register('name')}
                  error={!!errors.name}
                  placeholder="e.g., Pondok Indah, Kelapa Gading"
                />
              </FormField>

              <FormField
                label="Region"
                htmlFor="region"
                error={errors.region?.message}
              >
                <Input
                  id="region"
                  {...register('region')}
                  error={!!errors.region}
                  placeholder="e.g., Jakarta, Surabaya"
                />
              </FormField>

              <FormField
                label="Monthly Target"
                htmlFor="monthly_target"
                error={errors.monthly_target?.message}
              >
                <Input
                  id="monthly_target"
                  type="number"
                  step="0.01"
                  {...register('monthly_target', { valueAsNumber: true })}
                  error={!!errors.monthly_target}
                  placeholder="0"
                />
              </FormField>

              {submitError && (
                <div className="p-3 rounded-xl bg-accent-redLight text-accent-red text-sm">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {editingStore ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </SoftCard>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteConfirm(null)}
          />
          <SoftCard className="relative z-10 w-full max-w-sm mx-4">
            <h2 className="text-xl font-semibold text-primary mb-2">
              Delete Store
            </h2>
            <p className="text-secondary mb-6">
              Are you sure you want to delete &quot;{getDisplayName(deleteConfirm)}&quot;?
              {deleteConfirm.is_active && (
                <span className="block mt-2 text-sm">
                  If this store has staff or transactions, it will be deactivated instead.
                </span>
              )}
            </p>

            {submitError && (
              <div className="p-3 rounded-xl bg-accent-redLight text-accent-red text-sm mb-4">
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteConfirm(null);
                  setSubmitError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={isSubmitting}
              >
                Delete
              </Button>
            </div>
          </SoftCard>
        </div>
      )}
    </div>
  );
}
