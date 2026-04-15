'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { SoftCard } from '@/components/ui/SoftCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StaffUpdateInput } from '@/lib/validations/master-data';
import {
  getStaff,
  getStores,
  getAccounts,
  updateStaff,
  softDeleteStaff,
  hardDeleteStaff,
  createStaff,
} from '@/actions/master-data';
import { Profile, Store, Account, UserRole } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';

// Form schema for staff update
const StaffFormSchema = z.object({
  full_name: z
    .string()
    .min(1, { message: 'Full name is required' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  role: z.enum(['admin', 'manager', 'staff', 'dealer'], {
    message: 'Role must be admin, manager, staff, or dealer',
  }),
  store_id: z
    .string()
    .nullable()
    .optional(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => {
    // Staff and managers must have a store assigned
    if ((data.role === 'staff' || data.role === 'manager') && !data.store_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Staff and managers must be assigned to a store',
    path: ['store_id'],
  }
);

type StaffFormData = z.infer<typeof StaffFormSchema>;


// Form schema for creating new staff
const CreateStaffSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Invalid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
  full_name: z
    .string()
    .min(1, { message: 'Full name is required' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  role: z.enum(['admin', 'manager', 'staff', 'dealer'], {
    message: 'Role must be admin, manager, staff, or dealer',
  }),
  store_id: z
    .string()
    .nullable()
    .optional(),
}).refine(
  (data) => {
    // Staff and managers must have a store assigned
    if ((data.role === 'staff' || data.role === 'manager') && !data.store_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Staff and managers must be assigned to a store',
    path: ['store_id'],
  }
);

type CreateStaffFormData = z.infer<typeof CreateStaffSchema>;

export default function StaffPage() {
  const { t } = useI18n();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<Profile | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: zodResolver(StaffFormSchema),
  });

  // Create form
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    watch: watchCreate,
    control: controlCreate,
    formState: { errors: errorsCreate },
  } = useForm<CreateStaffFormData>({
    resolver: zodResolver(CreateStaffSchema),
    defaultValues: {
      role: 'staff',
    },
  });

  const watchedRole = watch('role');
  const watchedCreateRole = watchCreate('role');

  // Get current user role
  useEffect(() => {
    const fetchCurrentUserRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserRole((user.app_metadata?.role as UserRole) || 'staff');
      }
    };
    fetchCurrentUserRole();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [staffResult, storesResult, accountsResult] = await Promise.all([
      getStaff(!showInactive),
      getStores(true),
      getAccounts(true),
    ]);
    
    if (staffResult.success) {
      setStaff(staffResult.data);
    }
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

  // Get store display name in "Account - Store" format
  const getStoreDisplayName = (storeId: string | null | undefined) => {
    if (!storeId) return '-';
    const store = stores.find(s => s.id === storeId);
    if (!store) return '-';
    const account = accounts.find(a => a.id === store.account_id);
    return account ? `${account.name} - ${store.name}` : store.name;
  };

  const openEditModal = (staffMember: Profile) => {
    setEditingStaff(staffMember);
    reset({
      full_name: staffMember.full_name,
      role: staffMember.role,
      store_id: staffMember.store_id,
      is_active: staffMember.is_active,
    });
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    setSubmitError(null);
    reset();
  };

  const openCreateModal = () => {
    resetCreate({
      email: '',
      password: '',
      full_name: '',
      role: 'staff',
      store_id: null,
    });
    setSubmitError(null);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setSubmitError(null);
    resetCreate();
  };


  const onCreateSubmit = async (data: CreateStaffFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createStaff({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        role: data.role as 'admin' | 'manager' | 'staff',
        store_id: data.store_id || null, // V2: Use store_id
      });

      if (result.success) {
        closeCreateModal();
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

  const onSubmit = async (data: StaffFormData) => {
    if (!editingStaff) return;
    
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const staffData: StaffUpdateInput = {
        full_name: data.full_name,
        role: data.role,
        store_id: data.store_id || null,
        is_active: data.is_active,
      };
      
      const result = await updateStaff(editingStaff.id, staffData);

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
    const result = await softDeleteStaff(deleteConfirm.id);

    if (result.success) {
      setDeleteConfirm(null);
      fetchData();
    } else {
      setSubmitError(result.error);
    }
    setIsSubmitting(false);
  };

  const handleHardDelete = async () => {
    if (!hardDeleteConfirm) return;

    setIsSubmitting(true);
    const result = await hardDeleteStaff(hardDeleteConfirm.id);

    if (result.success) {
      setHardDeleteConfirm(null);
      fetchData();
    } else {
      setSubmitError(result.error);
    }
    setIsSubmitting(false);
  };

  const getRoleBadgeStatus = (role: UserRole): 'green' | 'yellow' | 'red' => {
    switch (role) {
      case 'admin':
        return 'green';
      case 'manager':
        return 'yellow';
      case 'dealer':
        return 'yellow';
      default:
        return 'red';
    }
  };

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: t('form.name'),
      sortable: true,
    },
    {
      key: 'email',
      header: t('form.email'),
      sortable: true,
    },
    {
      key: 'role',
      header: t('form.role'),
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={getRoleBadgeStatus(row.role)}
          label={row.role.charAt(0).toUpperCase() + row.role.slice(1)}
        />
      ),
    },
    {
      key: 'store_id',
      header: t('sales.accountStore'),
      render: (row) => getStoreDisplayName(row.store_id),
    },
    {
      key: 'is_active',
      header: t('common.status'),
      render: (row) => (
        <StatusBadge
          status={row.is_active ? 'green' : 'red'}
          label={row.is_active ? t('status.active') : t('status.inactive')}
        />
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="text-accent-green hover:text-accent-green/80 text-sm font-medium"
          >
            {t('common.edit')}
          </button>
          {currentUserRole === 'admin' && row.is_active && (
            <button
              onClick={() => setDeleteConfirm(row)}
              className="text-accent-red hover:text-accent-red/80 text-sm font-medium"
            >
              {t('common.delete')}
            </button>
          )}
          {currentUserRole === 'admin' && !row.is_active && (
            <button
              onClick={() => setHardDeleteConfirm(row)}
              className="text-accent-red hover:text-accent-red/80 text-sm font-medium"
            >
              Permanently Delete
            </button>
          )}
        </div>
      ),
    },
  ];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('sidebar.staff')}</h1>
          <p className="text-secondary mt-1">{t('masterData.manageStaff')}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-secondary/20 text-accent-green focus:ring-accent-green/20"
            />
            {t('masterData.showInactive')}
          </label>
          {currentUserRole === 'admin' && (
            <Button onClick={openCreateModal}>
              + {t('masterData.addStaff')}
            </Button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={staff}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage={t('masterData.noStaff')}
        pageSize={10}
      />

      {/* Edit Modal */}
      {isModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />
          <SoftCard className="relative z-10 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-primary mb-6">
              {t('masterData.editStaff')}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                label={t('form.email')}
                htmlFor="email"
              >
                <Input
                  id="email"
                  value={editingStaff.email}
                  disabled
                  className="bg-background"
                />
              </FormField>

              <FormField
                label={t('form.fullName')}
                htmlFor="full_name"
                error={errors.full_name?.message}
                required
              >
                <Input
                  id="full_name"
                  {...register('full_name')}
                  error={!!errors.full_name}
                  placeholder={t('form.fullName')}
                />
              </FormField>

              <FormField
                label={t('form.role')}
                htmlFor="role"
                error={errors.role?.message}
                required
              >
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select
                      id="role"
                      {...field}
                      error={!!errors.role}
                      disabled={currentUserRole !== 'admin'}
                    >
                      <option value="staff">{t('sidebar.staff')}</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="dealer">Dealer</option>
                    </Select>
                  )}
                />
                {currentUserRole !== 'admin' && (
                  <p className="text-xs text-secondary mt-1">
                    {t('masterData.onlyAdminCanChangeRoles')}
                  </p>
                )}
              </FormField>

              <FormField
                label={t('form.store')}
                htmlFor="store_id"
                error={errors.store_id?.message}
                required={watchedRole === 'staff' || watchedRole === 'manager'}
              >
                <Controller
                  name="store_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      id="store_id"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      error={!!errors.store_id}
                    >
                      <option value="">{t('masterData.noStoreAssigned')}</option>
                      {stores.map((store) => {
                        const account = accounts.find(a => a.id === store.account_id);
                        return (
                          <option key={store.id} value={store.id}>
                            {account ? `${account.name} - ${store.name}` : store.name}
                          </option>
                        );
                      })}
                    </Select>
                  )}
                />
              </FormField>

              <FormField
                label={t('common.status')}
                htmlFor="is_active"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('is_active')}
                    className="rounded border-secondary/20 text-accent-green focus:ring-accent-green/20"
                  />
                  <span className="text-sm text-primary">{t('status.active')}</span>
                </label>
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
                  {t('common.cancel')}
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {t('common.update')}
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
              {t('masterData.deleteStaff')}
            </h2>
            <p className="text-secondary mb-6">
              {t('masterData.confirmDeleteStaff')} &quot;{deleteConfirm.full_name}&quot;?
              {deleteConfirm.is_active && (
                <span className="block mt-2 text-sm">
                  {t('masterData.deactivateNote')}
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
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={isSubmitting}
              >
                {t('common.delete')}
              </Button>
            </div>
          </SoftCard>
        </div>
      )}

      {/* Hard Delete Confirmation Modal */}
      {hardDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setHardDeleteConfirm(null)}
          />
          <SoftCard className="relative z-10 w-full max-w-sm mx-4">
            <h2 className="text-xl font-semibold text-accent-red mb-2">
              Permanently Delete Staff
            </h2>
            <p className="text-secondary mb-4">
              Are you sure you want to permanently delete &quot;{hardDeleteConfirm.full_name}&quot;?
            </p>
            <p className="text-sm text-accent-red mb-6">
              ⚠️ This action cannot be undone. The user account and all related data (day-off requests, stock opname records) will be permanently removed.
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
                  setHardDeleteConfirm(null);
                  setSubmitError(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleHardDelete}
                isLoading={isSubmitting}
              >
                Permanently Delete
              </Button>
            </div>
          </SoftCard>
        </div>
      )}

      {/* Create Staff Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeCreateModal}
          />
          <SoftCard className="relative z-10 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-primary mb-6">
              {t('masterData.addStaff')}
            </h2>

            <form onSubmit={handleSubmitCreate(onCreateSubmit)} className="space-y-4">
              <FormField
                label={t('form.email')}
                htmlFor="create_email"
                error={errorsCreate.email?.message}
                required
              >
                <Input
                  id="create_email"
                  type="email"
                  {...registerCreate('email')}
                  error={!!errorsCreate.email}
                  placeholder="staff@example.com"
                />
              </FormField>

              <FormField
                label={t('form.password')}
                htmlFor="create_password"
                error={errorsCreate.password?.message}
                required
              >
                <Input
                  id="create_password"
                  type="password"
                  {...registerCreate('password')}
                  error={!!errorsCreate.password}
                  placeholder={t('errors.minLength').replace('{min}', '6')}
                />
              </FormField>

              <FormField
                label={t('form.fullName')}
                htmlFor="create_full_name"
                error={errorsCreate.full_name?.message}
                required
              >
                <Input
                  id="create_full_name"
                  {...registerCreate('full_name')}
                  error={!!errorsCreate.full_name}
                  placeholder={t('form.fullName')}
                />
              </FormField>

              <FormField
                label={t('form.role')}
                htmlFor="create_role"
                error={errorsCreate.role?.message}
                required
              >
                <Controller
                  name="role"
                  control={controlCreate}
                  render={({ field }) => (
                    <Select
                      id="create_role"
                      {...field}
                      error={!!errorsCreate.role}
                    >
                      <option value="staff">{t('sidebar.staff')}</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="dealer">Dealer</option>
                    </Select>
                  )}
                />
              </FormField>

              <FormField
                label={t('form.store')}
                htmlFor="create_store_id"
                error={errorsCreate.store_id?.message}
                required={watchedCreateRole === 'staff' || watchedCreateRole === 'manager'}
              >
                <Controller
                  name="store_id"
                  control={controlCreate}
                  render={({ field }) => (
                    <Select
                      id="create_store_id"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      error={!!errorsCreate.store_id}
                    >
                      <option value="">{t('masterData.noStoreAssigned')}</option>
                      {stores.map((store) => {
                        const account = accounts.find(a => a.id === store.account_id);
                        return (
                          <option key={store.id} value={store.id}>
                            {account ? `${account.name} - ${store.name}` : store.name}
                          </option>
                        );
                      })}
                    </Select>
                  )}
                />
                {(watchedCreateRole === 'staff' || watchedCreateRole === 'manager') && (
                  <p className="text-xs text-secondary mt-1">
                    {t('masterData.staffMustHaveStore')}
                  </p>
                )}
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
                  onClick={closeCreateModal}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {t('common.create')} {t('sidebar.staff')}
                </Button>
              </div>
            </form>
          </SoftCard>
        </div>
      )}
    </div>
  );
}
