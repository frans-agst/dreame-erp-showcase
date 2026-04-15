'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSalesAchievement, getStaffAchievement, upsertStaffTarget } from '@/actions/sales';
import { getAccounts, getStoresByAccount } from '@/actions/master-data';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Select } from '@/components/ui/Select';
import { SoftCard } from '@/components/ui/SoftCard';
import { Button } from '@/components/ui/Button';
import { StoreAchievement, StaffAchievement, Account, Store } from '@/types';
import { useI18n } from '@/lib/i18n/context';
import { createClient } from '@/lib/supabase/client';

type ViewMode = 'store' | 'staff';

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Inline editable target cell for staff view
function TargetCell({
  staffId,
  initialTarget,
  monthStr,
  canEdit,
  onSaved,
}: {
  staffId: string;
  initialTarget: number;
  monthStr: string;
  canEdit: boolean;
  onSaved: (staffId: string, newTarget: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initialTarget));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(String(initialTarget));
  }, [initialTarget]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    const num = Number(value);
    if (isNaN(num) || num < 0) { setEditing(false); setValue(String(initialTarget)); return; }
    setSaving(true);
    const result = await upsertStaffTarget(staffId, monthStr, num);
    setSaving(false);
    if (result.success) { onSaved(staffId, num); setEditing(false); }
  };

  if (!canEdit) return <span>{formatCurrency(initialTarget)}</span>;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setValue(String(initialTarget)); } }}
          className="w-32 px-2 py-1 text-sm border border-accent-green rounded-lg bg-background text-primary focus:outline-none focus:ring-1 focus:ring-accent-green"
          disabled={saving}
        />
        {saving && <span className="text-xs text-secondary">saving…</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left hover:text-accent-green transition-colors group"
      title="Click to edit target"
    >
      {initialTarget === 0
        ? <span className="text-secondary italic text-sm group-hover:text-accent-green">Set target…</span>
        : formatCurrency(initialTarget)}
    </button>
  );
}

export default function SalesAchievementPage() {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>('store');
  const [storeAchievements, setStoreAchievements] = useState<StoreAchievement[]>([]);
  const [staffAchievements, setStaffAchievements] = useState<StaffAchievement[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEditTargets, setCanEditTargets] = useState(false);

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');

  const monthOptions = getMonthOptions();

  // Check user role for target editing
  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.app_metadata?.role;
      setCanEditTargets(role === 'admin' || role === 'manager');
    };
    check();
  }, []);

  // Fetch accounts on mount
  useEffect(() => {
    getAccounts(true).then((r) => { if (r.success) setAccounts(r.data); });
  }, []);

  // Fetch stores when account changes
  useEffect(() => {
    if (selectedAccountId) {
      getStoresByAccount(selectedAccountId, true).then((r) => { if (r.success) setStores(r.data); });
    } else {
      setStores([]);
    }
    setSelectedStoreId('');
  }, [selectedAccountId]);

  const fetchAchievements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === 'store') {
        const result = await getSalesAchievement(selectedMonth);
        if (result.success) {
          let data = result.data;
          if (selectedAccountId) data = data.filter((a) => a.account_id === selectedAccountId);
          if (selectedStoreId) data = data.filter((a) => a.store_id === selectedStoreId);
          setStoreAchievements(data);
        } else {
          setError(result.error);
        }
      } else {
        const result = await getStaffAchievement(selectedMonth);
        if (result.success) {
          setStaffAchievements(result.data);
        } else {
          setError(result.error);
        }
      }
    } catch {
      setError('Failed to load achievement data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedAccountId, selectedStoreId, viewMode]);

  useEffect(() => { fetchAchievements(); }, [fetchAchievements]);

  // Update target in local state after inline save
  const handleTargetSaved = (staffId: string, newTarget: number) => {
    setStaffAchievements((prev) =>
      prev.map((s) => {
        if (s.staff_id !== staffId) return s;
        const sales = s.sales;
        const achievementPct = newTarget > 0 ? (sales / newTarget) * 100 : 0;
        const runRatePct = newTarget > 0 ? (s.run_rate / newTarget) * 100 : 0;
        const status: 'red' | 'yellow' | 'green' = achievementPct >= 100 ? 'green' : achievementPct >= 70 ? 'yellow' : 'red';
        return { ...s, target: newTarget, achievement_pct: achievementPct, run_rate_pct: runRatePct, status };
      })
    );
  };

  const storeColumns: Column<StoreAchievement>[] = [
    {
      key: 'account_store',
      header: t('sales.accountStore'),
      sortable: true,
      render: (row) => <span className="font-medium">{row.account_name ? `${row.account_name} - ${row.store_name}` : row.store_name}</span>,
    },
    { key: 'sales', header: t('sales.sales'), sortable: true, render: (row) => formatCurrency(row.sales) },
    { key: 'target', header: t('sales.target'), sortable: true, render: (row) => formatCurrency(row.target) },
    { key: 'achievement_pct', header: t('sales.achievementPct'), sortable: true, render: (row) => formatPercentage(row.achievement_pct) },
    { key: 'run_rate', header: t('sales.runRate'), sortable: true, render: (row) => formatCurrency(row.run_rate) },
    { key: 'run_rate_pct', header: t('sales.runRatePct'), sortable: true, render: (row) => formatPercentage(row.run_rate_pct) },
    {
      key: 'status',
      header: t('common.status'),
      sortable: true,
      render: (row) => <StatusBadge status={row.status} label={row.status === 'red' ? t('status.low') : row.status === 'yellow' ? t('status.medium') : t('status.high')} />,
    },
  ];

  const staffColumns: Column<StaffAchievement>[] = [
    {
      key: 'staff_name',
      header: 'Staff Name',
      sortable: true,
      render: (row) => <span className="font-medium">{row.staff_name}</span>,
    },
    { key: 'sales', header: t('sales.sales'), sortable: true, render: (row) => formatCurrency(row.sales) },
    {
      key: 'target',
      header: t('sales.target'),
      sortable: true,
      render: (row) => (
        <TargetCell
          staffId={row.staff_id}
          initialTarget={row.target}
          monthStr={selectedMonth}
          canEdit={canEditTargets}
          onSaved={handleTargetSaved}
        />
      ),
    },
    { key: 'achievement_pct', header: t('sales.achievementPct'), sortable: true, render: (row) => formatPercentage(row.achievement_pct) },
    { key: 'run_rate', header: t('sales.runRate'), sortable: true, render: (row) => formatCurrency(row.run_rate) },
    { key: 'run_rate_pct', header: t('sales.runRatePct'), sortable: true, render: (row) => formatPercentage(row.run_rate_pct) },
    {
      key: 'status',
      header: t('common.status'),
      sortable: true,
      render: (row) => <StatusBadge status={row.status} label={row.status === 'red' ? t('status.low') : row.status === 'yellow' ? t('status.medium') : t('status.high')} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('sales.achievement')}</h1>
          <p className="text-secondary mt-1">{t('sales.monitorPerformance')}</p>
        </div>
        <Button variant="secondary" onClick={fetchAchievements} disabled={loading}>
          {loading
            ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          }
        </Button>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        {/* View Mode Toggle */}
        <div className="flex rounded-xl overflow-hidden border border-secondary/20 self-start">
          <button
            onClick={() => setViewMode('store')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'store' ? 'bg-accent-green text-white' : 'bg-background text-secondary hover:text-primary'}`}
          >
            By Store
          </button>
          <button
            onClick={() => setViewMode('staff')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'staff' ? 'bg-accent-green text-white' : 'bg-background text-secondary hover:text-primary'}`}
          >
            By Staff
          </button>
        </div>

        {/* Month Selector */}
        <div className="w-full sm:w-48">
          <label className="block text-sm text-secondary mb-1">{t('common.month')}</label>
          <Select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} aria-label={t('common.selectMonth')}>
            {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        {/* Account + Store filters — only in store view */}
        {viewMode === 'store' && (
          <>
            <div className="w-full sm:w-48">
              <label className="block text-sm text-secondary mb-1">{t('form.account')}</label>
              <Select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} aria-label={t('dashboard.filterByAccount')}>
                <option value="">{t('dashboard.allAccounts')}</option>
                {[...accounts]
                  .sort((a, b) => `${a.channel_type} - ${a.name}`.localeCompare(`${b.channel_type} - ${b.name}`))
                  .map((a) => <option key={a.id} value={a.id}>{a.channel_type} - {a.name}</option>)}
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm text-secondary mb-1">{t('form.store')}</label>
              <Select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)} aria-label={t('dashboard.filterByStore')} disabled={!selectedAccountId}>
                <option value="">{t('dashboard.allStores')}</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
          </>
        )}

        {/* Staff view hint for target editing */}
        {viewMode === 'staff' && canEditTargets && (
          <div className="flex items-end pb-1">
            <p className="text-xs text-secondary italic">Click a target cell to edit</p>
          </div>
        )}
      </div>

      {error && (
        <SoftCard className="bg-accent-redLight border border-accent-red/20">
          <p className="text-accent-red">{error}</p>
        </SoftCard>
      )}

      {viewMode === 'store' ? (
        <>
          {/* Summary totals */}
          {!loading && storeAchievements.length > 0 && (() => {
            const totalSales = storeAchievements.reduce((s, r) => s + r.sales, 0);
            const totalTarget = storeAchievements.reduce((s, r) => s + r.target, 0);
            const totalAchievementPct = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
            const totalRunRate = storeAchievements.reduce((s, r) => s + r.run_rate, 0);
            const totalRunRatePct = totalTarget > 0 ? (totalRunRate / totalTarget) * 100 : 0;
            const summaryStatus: 'red' | 'yellow' | 'green' = totalAchievementPct >= 100 ? 'green' : totalAchievementPct >= 70 ? 'yellow' : 'red';
            return (
              <SoftCard className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-secondary mb-1">Total Sales</p>
                  <p className="text-lg font-semibold text-primary">{formatCurrency(totalSales)}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary mb-1">Total Target</p>
                  <p className="text-lg font-semibold text-primary">{formatCurrency(totalTarget)}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary mb-1">Achievement</p>
                  <p className="text-lg font-semibold text-primary">{formatPercentage(totalAchievementPct)}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary mb-1">Run Rate</p>
                  <p className="text-lg font-semibold text-primary">{formatCurrency(totalRunRate)}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary mb-1">Run Rate %</p>
                  <p className="text-lg font-semibold text-primary">{formatPercentage(totalRunRatePct)}</p>
                </div>
                <div className="flex items-end">
                  <StatusBadge status={summaryStatus} label={summaryStatus === 'red' ? t('status.low') : summaryStatus === 'yellow' ? t('status.medium') : t('status.high')} />
                </div>
              </SoftCard>
            );
          })()}
          <DataTable
            columns={storeColumns}
            data={storeAchievements}
            keyExtractor={(row) => row.store_id}
            loading={loading}
            emptyMessage={t('sales.noDataForMonth')}
            pageSize={10}
          />
        </>
      ) : (
        <DataTable
          columns={staffColumns}
          data={staffAchievements}
          keyExtractor={(row) => row.staff_id}
          loading={loading}
          emptyMessage={t('sales.noDataForMonth')}
          pageSize={10}
        />
      )}
    </div>
  );
}
