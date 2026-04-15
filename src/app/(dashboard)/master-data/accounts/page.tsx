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
  getAccounts,
  createAccount,
  updateAccount,
  softDeleteAccount,
} from '@/actions/master-data';
import { Account, ChannelType } from '@/types';

const CHANNEL_TYPES: ChannelType[] = ['Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon'];

const AccountFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Account name is required' })
    .max(200, { message: 'Account name must not exceed 200 characters' }),
  channel_type: z.enum(['Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon'], {
    message: 'Channel type is required',
  }),
});

type AccountFormData = z.infer<typeof AccountFormSchema>;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(AccountFormSchema),
  });


  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const result = await getAccounts(!showInactive);
    if (result.success) {
      setAccounts(result.data);
    }
    setLoading(false);
  }, [showInactive]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const openCreateModal = () => {
    setEditingAccount(null);
    reset({ name: '', channel_type: 'Brandstore' });
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    reset({
      name: account.name,
      channel_type: account.channel_type,
    });
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setSubmitError(null);
    reset();
  };

  const onSubmit = async (data: AccountFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = editingAccount
        ? await updateAccount(editingAccount.id, { ...data, is_active: editingAccount.is_active })
        : await createAccount({ ...data, is_active: true });

      if (result.success) {
        closeModal();
        fetchAccounts();
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
    const result = await softDeleteAccount(deleteConfirm.id);

    if (result.success) {
      setDeleteConfirm(null);
      fetchAccounts();
    } else {
      setSubmitError(result.error);
    }
    setIsSubmitting(false);
  };

  const getChannelBadgeColor = (channelType: ChannelType): 'green' | 'yellow' | 'red' => {
    switch (channelType) {
      case 'Brandstore':
        return 'green';
      case 'Modern Channel':
        return 'yellow';
      case 'Dealer':
        return 'red';
      default:
        return 'yellow';
    }
  };

  const columns: Column<Account>[] = [
    {
      key: 'name',
      header: 'Account Name',
      sortable: true,
    },
    {
      key: 'channel_type',
      header: 'Channel Type',
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={getChannelBadgeColor(row.channel_type)}
          label={row.channel_type}
        />
      ),
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
          <h1 className="text-2xl font-semibold text-primary">Accounts</h1>
          <p className="text-secondary mt-1">Manage parent organizations</p>
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
          <Button onClick={openCreateModal}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Account
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={accounts}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage="No accounts found"
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
              {editingAccount ? 'Edit Account' : 'Add Account'}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                label="Account Name"
                htmlFor="name"
                error={errors.name?.message}
                required
              >
                <Input
                  id="name"
                  {...register('name')}
                  error={!!errors.name}
                  placeholder="e.g., Hartono, Electronic City"
                />
              </FormField>

              <FormField
                label="Channel Type"
                htmlFor="channel_type"
                error={errors.channel_type?.message}
                required
              >
                <Select
                  id="channel_type"
                  {...register('channel_type')}
                  error={!!errors.channel_type}
                >
                  {CHANNEL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
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
                  {editingAccount ? 'Update' : 'Create'}
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
              Delete Account
            </h2>
            <p className="text-secondary mb-6">
              Are you sure you want to delete &quot;{deleteConfirm.name}&quot;?
              {deleteConfirm.is_active && (
                <span className="block mt-2 text-sm">
                  If this account has stores, it will be deactivated instead.
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
