'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { SoftCard } from '@/components/ui/SoftCard';
import { Profile, Store, Account, StaffStoreAssignment } from '@/types';
import { assignStoreToStaff } from '@/actions/store-assignments';
import { useI18n } from '@/lib/i18n/context';

const AssignStoreSchema = z.object({
  store_id: z.string().min(1, { message: 'Please select a store' }),
  is_primary: z.boolean(),
});

type AssignStoreFormData = z.infer<typeof AssignStoreSchema>;

interface AssignStoreDialogProps {
  staff: Profile;
  stores: Store[];
  accounts: Account[];
  existingAssignments: StaffStoreAssignment[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignStoreDialog({
  staff,
  stores,
  accounts,
  existingAssignments,
  onClose,
  onSuccess,
}: AssignStoreDialogProps) {
  const { t } = useI18n();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AssignStoreFormData>({
    resolver: zodResolver(AssignStoreSchema),
    defaultValues: {
      store_id: '',
      is_primary: existingAssignments.length === 0, // Auto-check if first assignment
    },
  });

  // Get assigned store IDs
  const assignedStoreIds = existingAssignments.map(a => a.store_id);

  // Filter out already assigned stores
  const availableStores = stores.filter(s => !assignedStoreIds.includes(s.id));

  const onSubmit = async (data: AssignStoreFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await assignStoreToStaff(
        staff.id,
        data.store_id,
        data.is_primary
      );

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(result.error || 'Failed to assign store');
      }
    } catch (error) {
      setSubmitError('An unexpected error occurred');
      console.error('Error assigning store:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <SoftCard className="relative z-10 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-primary mb-2">
          Assign Store to {staff.full_name}
        </h2>
        <p className="text-secondary text-sm mb-6">
          Select a store to assign to this staff member
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Store"
            htmlFor="store_id"
            error={errors.store_id?.message}
            required
          >
            <Controller
              name="store_id"
              control={control}
              render={({ field }) => (
                <Select
                  id="store_id"
                  {...field}
                  error={!!errors.store_id}
                >
                  <option value="">Select a store</option>
                  {availableStores.map((store) => {
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
            {availableStores.length === 0 && (
              <p className="text-xs text-secondary mt-1">
                All stores are already assigned to this staff member
              </p>
            )}
          </FormField>

          <FormField
            label="Primary Store"
            htmlFor="is_primary"
          >
            <Controller
              name="is_primary"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={existingAssignments.length === 0}
                    className="rounded border-secondary/20 text-accent-green focus:ring-accent-green/20"
                  />
                  <span className="text-sm text-primary">
                    Set as primary store
                  </span>
                </label>
              )}
            />
            {existingAssignments.length === 0 && (
              <p className="text-xs text-secondary mt-1">
                This will be the primary store (first assignment)
              </p>
            )}
            {existingAssignments.length > 0 && (
              <p className="text-xs text-secondary mt-1">
                Setting as primary will unset the current primary store
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
              onClick={onClose}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={availableStores.length === 0}
            >
              Assign Store
            </Button>
          </div>
        </form>
      </SoftCard>
    </div>
  );
}
