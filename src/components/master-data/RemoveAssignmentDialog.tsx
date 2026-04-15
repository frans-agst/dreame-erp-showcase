'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SoftCard } from '@/components/ui/SoftCard';
import { Profile, StaffStoreAssignment } from '@/types';
import { removeStoreFromStaff } from '@/actions/store-assignments';
import { useI18n } from '@/lib/i18n/context';

interface RemoveAssignmentDialogProps {
  staff: Profile;
  assignment: StaffStoreAssignment;
  storeName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RemoveAssignmentDialog({
  staff,
  assignment,
  storeName,
  onClose,
  onSuccess,
}: RemoveAssignmentDialogProps) {
  const { t } = useI18n();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRemove = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await removeStoreFromStaff(staff.id, assignment.store_id);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(result.error || 'Failed to remove store assignment');
      }
    } catch (error) {
      setSubmitError('An unexpected error occurred');
      console.error('Error removing assignment:', error);
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
          Remove Store Assignment
        </h2>
        <p className="text-secondary mb-4">
          Are you sure you want to remove <strong>{staff.full_name}</strong> from{' '}
          <strong>{storeName}</strong>?
        </p>

        {assignment.is_primary && (
          <div className="p-3 rounded-xl bg-accent-yellowLight text-accent-yellow text-sm mb-4">
            ⚠️ <strong>Warning:</strong> This is the primary store. If removed, another store will
            automatically be set as primary.
          </div>
        )}

        {submitError && (
          <div className="p-3 rounded-xl bg-accent-redLight text-accent-red text-sm mb-4">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={handleRemove}
            isLoading={isSubmitting}
          >
            Remove Assignment
          </Button>
        </div>
      </SoftCard>
    </div>
  );
}
