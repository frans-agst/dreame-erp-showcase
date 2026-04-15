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
import { setPrimaryStore } from '@/actions/store-assignments';
import { useI18n } from '@/lib/i18n/context';

const SetPrimarySchema = z.object({
  store_id: z.string().min(1, { message: 'Please select a store' }),
});

type SetPrimaryFormData = z.infer<typeof SetPrimarySchema>;

interface SetPrimaryStoreDialogProps {
  staff: Profile;
  assignments: StaffStoreAssignment[];
  stores: Store[];
  accounts: Account[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SetPrimaryStoreDialog({
  staff,
  assignments,
  stores,
  accounts,
  onClose,
  onSuccess,
}: SetPrimaryStoreDialogProps) {
  const { t } = useI18n();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find current primary
  const currentPrimary = assignments.find(a => a.is_primary);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPrimaryFormData>({
    resolver: zodResolver(SetPrimarySchema),
    defaultValues: {
      store_id: currentPrimary?.store_id || '',
    },
  });

  // Get store display name
  const getStoreDisplayName = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) return 'Unknown Store';
    const account = accounts.find(a => a.id === store.account_id);
    return account ? `${account.name} - ${store.name}` : store.name;
  };

  const onSubmit = async (data: SetPrimaryFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await setPrimaryStore(staff.id, data.store_id);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(result.error || 'Failed to set primary store');
      }
    } catch (error) {
      setSubmitError('An unexpected error occurred');
      console.error('Error setting primary store:', error);
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
          Set Primary Store for {staff.full_name}
        </h2>
        <p className="text-secondary text-sm mb-4">
          Select which store should be the primary store for this staff member
        </p>

        {currentPrimary && (
          <div className="p-3 rounded-xl bg-accent-blueLight text-accent-blue text-sm mb-4">
            <strong>Current Primary:</strong> {getStoreDisplayName(currentPrimary.store_id)}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Primary Store"
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
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.store_id}>
                      {getStoreDisplayName(assignment.store_id)}
                      {assignment.is_primary && ' (Current)'}
                    </option>
                  ))}
                </Select>
              )}
            />
            <p className="text-xs text-secondary mt-1">
              The primary store is used as the default store context
            </p>
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
            >
              Set as Primary
            </Button>
          </div>
        </form>
      </SoftCard>
    </div>
  );
}
