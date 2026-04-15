'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SoftCard } from '@/components/ui/SoftCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BranchInput } from '@/lib/validations/master-data';
import {
  getBranches,
  createBranch,
  updateBranch,
  softDeleteBranch,
} from '@/actions/master-data';
import { Branch } from '@/types';

// Form schema with required monthly_target for the form
const BranchFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Branch name is required' })
    .max(200, { message: 'Branch name must not exceed 200 characters' }),
  account: z
    .string()
    .max(100, { message: 'Account must not exceed 100 characters' })
    .optional()
    .nullable(),
  province: z
    .string()
    .max(100, { message: 'Province must not exceed 100 characters' })
    .optional()
    .nullable(),
  monthly_target: z
    .number({ message: 'Monthly target must be a number' })
    .nonnegative({ message: 'Monthly target cannot be negative' }),
});

type BranchFormData = z.infer<typeof BranchFormSchema>;

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Branch | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BranchFormData>({
    resolver: zodResolver(BranchFormSchema),
  });

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    const result = await getBranches(!showInactive);
    if (result.success) {
      setBranches(result.data);
    }
    setLoading(false);
  }, [showInactive]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const openCreateModal = () => {
    setEditingBranch(null);
    reset({ name: '', account: '', province: '', monthly_target: 0 });
    setSubmitError(null);
    setIsModalOpen(true);
  };


  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    reset({
      name: branch.name,
      account: branch.account || '',
      province: branch.province || '',
      monthly_target: branch.monthly_target,
    });
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBranch(null);
    setSubmitError(null);
    reset();
  };

  const onSubmit = async (data: BranchFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const branchData: BranchInput = {
        name: data.name,
        account: data.account,
        province: data.province,
        monthly_target: data.monthly_target,
      };
      
      const result = editingBranch
        ? await updateBranch(editingBranch.id, branchData)
        : await createBranch(branchData);

      if (result.success) {
        closeModal();
        fetchBranches();
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
    const result = await softDeleteBranch(deleteConfirm.id);

    if (result.success) {
      setDeleteConfirm(null);
      fetchBranches();
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

  const columns: Column<Branch>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
    },
    {
      key: 'account',
      header: 'Account',
      sortable: true,
      render: (row) => row.account || '-',
    },
    {
      key: 'province',
      header: 'Province',
      sortable: true,
      render: (row) => row.province || '-',
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
          <h1 className="text-2xl font-semibold text-primary">Branches</h1>
          <p className="text-secondary mt-1">Manage your branch locations</p>
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
            Add Branch
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={branches}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage="No branches found"
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
              {editingBranch ? 'Edit Branch' : 'Add Branch'}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                label="Name"
                htmlFor="name"
                error={errors.name?.message}
                required
              >
                <Input
                  id="name"
                  {...register('name')}
                  error={!!errors.name}
                  placeholder="Branch name"
                />
              </FormField>

              <FormField
                label="Account"
                htmlFor="account"
                error={errors.account?.message}
              >
                <Input
                  id="account"
                  {...register('account')}
                  error={!!errors.account}
                  placeholder="Account identifier"
                />
              </FormField>

              <FormField
                label="Province"
                htmlFor="province"
                error={errors.province?.message}
              >
                <Input
                  id="province"
                  {...register('province')}
                  error={!!errors.province}
                  placeholder="Province"
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
                  {editingBranch ? 'Update' : 'Create'}
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
              Delete Branch
            </h2>
            <p className="text-secondary mb-6">
              Are you sure you want to delete &quot;{deleteConfirm.name}&quot;?
              {deleteConfirm.is_active && (
                <span className="block mt-2 text-sm">
                  If this branch has staff or transactions, it will be deactivated instead.
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
