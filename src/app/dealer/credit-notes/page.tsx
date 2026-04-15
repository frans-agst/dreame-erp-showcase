'use client';

import { useState, useEffect } from 'react';
import { SoftCard } from '@/components/ui/SoftCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getDealerCreditNotes } from '@/actions/dealer';
import { CreditNote } from '@/types';
import { useI18n } from '@/lib/i18n/context';

// Format number as currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Get status variant for badge
function getStatusVariant(status: string): 'red' | 'yellow' | 'green' {
  switch (status) {
    case 'available':
      return 'green';
    case 'used':
      return 'yellow';
    case 'expired':
      return 'red';
    default:
      return 'yellow';
  }
}

// Get status label
function getStatusLabel(status: string): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'used':
      return 'Used';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
}

export default function DealerCreditNotesPage() {
  const { t } = useI18n();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCreditNotes() {
      try {
        const result = await getDealerCreditNotes();
        if (result.success) {
          setCreditNotes(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error('Error loading credit notes:', err);
        setError('Failed to load credit notes');
      } finally {
        setLoading(false);
      }
    }

    loadCreditNotes();
  }, []);

  // Calculate totals
  const availableTotal = creditNotes
    .filter(cn => cn.status === 'available')
    .reduce((sum, cn) => sum + cn.amount, 0);

  const usedTotal = creditNotes
    .filter(cn => cn.status === 'used')
    .reduce((sum, cn) => sum + cn.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SoftCard className="text-center p-8">
          <svg className="w-12 h-12 text-accent-red mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-secondary">{error}</p>
        </SoftCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-primary">{t('dealer.creditNotes')}</h1>
        <p className="text-secondary mt-1">{t('dealer.checkCredits')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SoftCard>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-secondary">{t('dealer.availableCreditTotal')}</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">{formatCurrency(availableTotal)}</p>
            </div>
          </div>
        </SoftCard>

        <SoftCard>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-secondary">{t('dealer.usedCredit')}</p>
              <p className="text-xl font-semibold text-primary">{formatCurrency(usedTotal)}</p>
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
              <p className="text-sm text-secondary">{t('dealer.totalNotes')}</p>
              <p className="text-xl font-semibold text-primary">{creditNotes.length}</p>
            </div>
          </div>
        </SoftCard>
      </div>

      {/* Credit Notes List */}
      <SoftCard>
        <h2 className="text-lg font-semibold text-primary mb-4">{t('dealer.creditNoteHistory')}</h2>

        {creditNotes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-secondary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-secondary">{t('dealer.noCreditNotes')}</p>
            <p className="text-sm text-secondary mt-1">{t('dealer.creditNotesWillAppear')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.date')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('form.description')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.status')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('status.expired')}</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-secondary">{t('common.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((note) => (
                  <tr key={note.id} className="border-b border-border/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="py-3 px-4 text-secondary">
                      {formatDate(note.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-primary">{note.description || t('dealer.creditNotes')}</p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={getStatusVariant(note.status)}
                        label={getStatusLabel(note.status)}
                      />
                    </td>
                    <td className="py-3 px-4 text-secondary">
                      {note.expires_at ? (
                        <span className={new Date(note.expires_at) < new Date() ? 'text-accent-red' : ''}>
                          {formatDate(note.expires_at)}
                        </span>
                      ) : (
                        <span className="text-secondary">{t('dealer.noExpiry')}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${note.status === 'available' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                        {formatCurrency(note.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SoftCard>

      {/* Info Card */}
      <SoftCard className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">{t('dealer.aboutCreditNotes')}</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {t('dealer.creditNotesInfo')}
            </p>
          </div>
        </div>
      </SoftCard>
    </div>
  );
}
