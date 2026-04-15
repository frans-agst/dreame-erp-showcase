'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SoftCard } from '@/components/ui/SoftCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { FormError } from '@/components/ui/FormError';
import { FormSuccess } from '@/components/ui/FormSuccess';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { DayOffRequestSchema, DayOffRequestInput } from '@/lib/validations/day-off';
import { 
  createDayOffRequest, 
  getMyDayOffRequests,
  getPendingDayOffRequests,
  getProcessedDayOffRequests,
  approveDayOffRequest,
  getCurrentUserForDayOff,
  DayOffRequestWithDetails 
} from '@/actions/day-off';
import { DayOffStatus } from '@/types';
import { useI18n } from '@/lib/i18n/context';

export default function DayOffPage() {
  const { t } = useI18n();
  const [myRequests, setMyRequests] = useState<DayOffRequestWithDetails[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DayOffRequestWithDetails[]>([]);
  const [historyRequests, setHistoryRequests] = useState<DayOffRequestWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('staff');
  const [userId, setUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    requestId: string;
    action: 'approve' | 'reject';
    staffName: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DayOffRequestInput>({
    resolver: zodResolver(DayOffRequestSchema),
    defaultValues: {
      start_date: '',
      end_date: '',
      reason: '',
    },
  });

  const isManagerOrAdmin = userRole === 'manager' || userRole === 'admin';


  // Load user profile and requests on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Get user role
        const userResult = await getCurrentUserForDayOff();
        if (userResult.success) {
          setUserRole(userResult.data.role);
          setUserId(userResult.data.id);
        }

        // Get user's day-off requests
        const myResult = await getMyDayOffRequests();
        if (myResult.success) {
          setMyRequests(myResult.data);
        }

        // If manager/admin, also get pending and history requests
        if (userResult.success && (userResult.data.role === 'manager' || userResult.data.role === 'admin')) {
          const [pendingResult, historyResult] = await Promise.all([
            getPendingDayOffRequests(),
            getProcessedDayOffRequests(),
          ]);
          if (pendingResult.success) {
            setPendingRequests(pendingResult.data);
          }
          if (historyResult.success) {
            setHistoryRequests(historyResult.data);
          }
        }
      } catch (error) {
        setErrorMessage('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const onSubmit = async (data: DayOffRequestInput) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const result = await createDayOffRequest(data);
      
      if (result.success) {
        setSuccessMessage('Day-off request submitted successfully!');
        reset();
        // Refresh the requests list
        const refreshResult = await getMyDayOffRequests();
        if (refreshResult.success) {
          setMyRequests(refreshResult.data);
        }
      } else {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovalAction = (requestId: string, action: 'approve' | 'reject', staffName: string) => {
    setRejectionReason('');
    setRejectionError(null);
    setConfirmDialog({
      isOpen: true,
      requestId,
      action,
      staffName,
    });
  };

  const confirmApproval = async () => {
    if (!confirmDialog) return;

    // Validate rejection reason
    if (confirmDialog.action === 'reject' && !rejectionReason.trim()) {
      setRejectionError('Please provide a reason for rejection');
      return;
    }

    setProcessingId(confirmDialog.requestId);
    setSuccessMessage(null);
    setErrorMessage(null);
    setRejectionError(null);

    try {
      const result = await approveDayOffRequest(
        confirmDialog.requestId,
        confirmDialog.action === 'approve',
        userId,
        confirmDialog.action === 'reject' ? rejectionReason : undefined
      );

      if (result.success) {
        setSuccessMessage(
          `Request ${confirmDialog.action === 'approve' ? 'approved' : 'rejected'} successfully!`
        );
        // Refresh pending and history requests
        const [pendingResult, historyResult] = await Promise.all([
          getPendingDayOffRequests(),
          getProcessedDayOffRequests(),
        ]);
        if (pendingResult.success) {
          setPendingRequests(pendingResult.data);
        }
        if (historyResult.success) {
          setHistoryRequests(historyResult.data);
        }
      } else {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred');
    } finally {
      setProcessingId(null);
      setConfirmDialog(null);
      setRejectionReason('');
    }
  };

  const getStatusVariant = (status: DayOffStatus): 'red' | 'yellow' | 'green' => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      case 'pending':
      default:
        return 'yellow';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Extract rejection reason from the combined reason field
  const extractRejectionReason = (reason: string): string | null => {
    const parts = reason.split(' | REJECTED: ');
    return parts.length > 1 ? parts[1] : null;
  };

  // Extract original reason from the combined reason field
  const extractOriginalReason = (reason: string): string => {
    const parts = reason.split(' | REJECTED: ');
    return parts[0];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">{t('dayOff.title')}</h1>
        <p className="text-secondary mt-1">
          {isManagerOrAdmin 
            ? t('dayOff.manageRequests') || 'Manage day-off requests and submit your own'
            : t('dayOff.submitTrack') || 'Submit and track your day-off requests'}
        </p>
      </div>

      {successMessage && (
        <FormSuccess message={successMessage} />
      )}
      
      {errorMessage && (
        <FormError message={errorMessage} />
      )}

      {/* Manager/Admin: Tabs for Pending and History */}
      {isManagerOrAdmin && (
        <div className="flex gap-2 border-b border-secondary/10">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {t('dayOff.pendingApprovals') || 'Pending Approvals'} ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {t('dayOff.history') || 'History'} ({historyRequests.length})
          </button>
        </div>
      )}

      {/* Manager/Admin: Pending Requests for Approval */}
      {isManagerOrAdmin && activeTab === 'pending' && (
        <SoftCard>
          <h2 className="text-lg font-medium text-primary mb-4">{t('dayOff.pendingApprovals') || 'Pending Approvals'}</h2>
          {pendingRequests.length === 0 ? (
            <EmptyState
              title={t('dayOff.noPending') || 'No pending requests'}
              description={t('dayOff.allProcessed') || 'All day-off requests have been processed.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-secondary/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('sidebar.staff')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.store')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.startDate')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.endDate')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.reason')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.status')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((request) => (
                    <tr key={request.id} className="border-b border-secondary/5 hover:bg-background/50">
                      <td className="py-3 px-4 text-sm text-primary font-medium">
                        {request.staff?.full_name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-sm text-secondary">
                        {request.staff?.store?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-primary">
                        {formatDate(request.start_date)}
                      </td>
                      <td className="py-3 px-4 text-sm text-primary">
                        {formatDate(request.end_date)}
                      </td>
                      <td className="py-3 px-4 text-sm text-primary max-w-xs">
                        <span className="line-clamp-2">{request.reason}</span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge 
                          status={getStatusVariant(request.status)}
                          label={request.status === 'pending' ? t('dayOff.pending') : request.status === 'approved' ? t('dayOff.approved') : t('dayOff.rejected')}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprovalAction(request.id, 'approve', request.staff?.full_name || 'Staff')}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? '...' : t('common.approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleApprovalAction(request.id, 'reject', request.staff?.full_name || 'Staff')}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? '...' : t('common.reject')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SoftCard>
      )}


      {/* Manager/Admin: History of Processed Requests */}
      {isManagerOrAdmin && activeTab === 'history' && (
        <SoftCard>
          <h2 className="text-lg font-medium text-primary mb-4">{t('dayOff.history') || 'Request History'}</h2>
          {historyRequests.length === 0 ? (
            <EmptyState
              title={t('dayOff.noHistory') || 'No history yet'}
              description={t('dayOff.noProcessed') || 'No day-off requests have been processed yet.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-secondary/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('sidebar.staff')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.store')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.date')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.reason')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.status')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('dayOff.reviewedBy')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('dayOff.rejectionReason') || 'Rejection Reason'}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRequests.map((request) => (
                    <tr key={request.id} className="border-b border-secondary/5 hover:bg-background/50">
                      <td className="py-3 px-4 text-sm text-primary font-medium">
                        {request.staff?.full_name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-sm text-secondary">
                        {request.staff?.store?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-primary">
                        {formatDate(request.start_date)} - {formatDate(request.end_date)}
                      </td>
                      <td className="py-3 px-4 text-sm text-primary max-w-xs">
                        <span className="line-clamp-2">{extractOriginalReason(request.reason)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge 
                          status={getStatusVariant(request.status)}
                          label={request.status === 'pending' ? t('dayOff.pending') : request.status === 'approved' ? t('dayOff.approved') : t('dayOff.rejected')}
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-secondary">
                        {request.reviewer?.full_name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-accent-red max-w-xs">
                        {request.status === 'rejected' ? (
                          <span className="line-clamp-2">{extractRejectionReason(request.reason) || '-'}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SoftCard>
      )}

      {/* Request Form */}
      <SoftCard>
        <h2 className="text-lg font-medium text-primary mb-4">{t('dayOff.newRequest')}</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('form.startDate')} error={errors.start_date?.message} required>
              <Input
                type="date"
                {...register('start_date')}
                error={!!errors.start_date}
              />
            </FormField>

            <FormField label={t('form.endDate')} error={errors.end_date?.message} required>
              <Input
                type="date"
                {...register('end_date')}
                error={!!errors.end_date}
              />
            </FormField>
          </div>

          <FormField label={t('form.reason')} error={errors.reason?.message} required>
            <textarea
              {...register('reason')}
              rows={4}
              className={`
                w-full px-4 py-2.5 rounded-xl border bg-surface
                text-primary placeholder:text-secondary/50
                focus:outline-none focus:ring-2 focus:ring-accent-green/20 focus:border-accent-green
                transition-all duration-200
                ${errors.reason ? 'border-accent-red focus:ring-accent-red/20 focus:border-accent-red' : 'border-secondary/20'}
              `}
              placeholder={t('dayOff.reasonPlaceholder') || 'Please provide a reason for your day-off request...'}
            />
          </FormField>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('common.submit')}
            </Button>
          </div>
        </form>
      </SoftCard>


      {/* My Request History */}
      <SoftCard>
        <h2 className="text-lg font-medium text-primary mb-4">{t('dayOff.myRequests') || 'My Requests'}</h2>
        
        {myRequests.length === 0 ? (
          <EmptyState
            title={t('dayOff.noRequests') || 'No requests yet'}
            description={t('dayOff.noSubmitted') || "You haven't submitted any day-off requests."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-secondary/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.startDate')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.endDate')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.reason')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.status')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('dayOff.reviewedBy')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('dayOff.rejectionReason') || 'Rejection Reason'}</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((request) => (
                  <tr key={request.id} className="border-b border-secondary/5 hover:bg-background/50">
                    <td className="py-3 px-4 text-sm text-primary">
                      {formatDate(request.start_date)}
                    </td>
                    <td className="py-3 px-4 text-sm text-primary">
                      {formatDate(request.end_date)}
                    </td>
                    <td className="py-3 px-4 text-sm text-primary max-w-xs truncate">
                      {extractOriginalReason(request.reason)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge 
                        status={getStatusVariant(request.status)}
                        label={request.status === 'pending' ? t('dayOff.pending') : request.status === 'approved' ? t('dayOff.approved') : t('dayOff.rejected')}
                      />
                    </td>
                    <td className="py-3 px-4 text-sm text-secondary">
                      {request.reviewer?.full_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-accent-red max-w-xs">
                      {request.status === 'rejected' ? (
                        <span className="truncate">{extractRejectionReason(request.reason) || '-'}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SoftCard>

      {/* Confirmation/Rejection Dialog */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <SoftCard className="max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-primary mb-2">
              {confirmDialog.action === 'approve' ? t('dayOff.approveRequest') : t('dayOff.rejectRequest')}
            </h3>
            <p className="text-secondary mb-4">
              {confirmDialog.action === 'approve' 
                ? `${t('dayOff.confirmApprove') || 'Are you sure you want to approve the day-off request from'} `
                : `${t('dayOff.confirmReject') || 'Please provide a reason for rejecting the day-off request from'} `}
              <span className="font-medium text-primary">{confirmDialog.staffName}</span>?
            </p>

            {confirmDialog.action === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-primary mb-2">
                  {t('dayOff.rejectionReason') || 'Rejection Reason'} <span className="text-accent-red">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    setRejectionError(null);
                  }}
                  rows={3}
                  className={`
                    w-full px-4 py-2.5 rounded-xl border bg-surface
                    text-primary placeholder:text-secondary/50
                    focus:outline-none focus:ring-2 focus:ring-accent-green/20 focus:border-accent-green
                    transition-all duration-200
                    ${rejectionError ? 'border-accent-red' : 'border-secondary/20'}
                  `}
                  placeholder={t('dayOff.rejectionPlaceholder') || 'Please explain why this request is being rejected...'}
                />
                {rejectionError && (
                  <p className="text-sm text-accent-red mt-1">{rejectionError}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmDialog(null);
                  setRejectionReason('');
                  setRejectionError(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant={confirmDialog.action === 'approve' ? 'primary' : 'danger'}
                onClick={confirmApproval}
                isLoading={processingId === confirmDialog.requestId}
              >
                {confirmDialog.action === 'approve' ? t('common.approve') : t('common.reject')}
              </Button>
            </div>
          </SoftCard>
        </div>
      )}
    </div>
  );
}
