'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuditLogs, exportAuditLogs, getAuditedTables, getAuditLogUsers, AuditLogFilter, PaginatedAuditLogs } from '@/actions/audit-log';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SoftCard } from '@/components/ui/SoftCard';
import { AuditLogEntry } from '@/types';
import { useI18n } from '@/lib/i18n/context';
import { createClient } from '@/lib/supabase/client';

// Check if user is admin
async function checkAdminAccess(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  const role = user.app_metadata?.role;
  return role === 'admin';
}

// Format date/time for display
function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Format store assignment details for display
function formatAssignmentDetails(entry: AuditLogEntry): string {
  if (entry.table_name !== 'staff_stores') return '';
  
  const details: string[] = [];
  
  // For INSERT (store_assigned)
  if (entry.action === 'INSERT' && entry.new_value) {
    const newVal = entry.new_value as Record<string, unknown>;
    if (newVal.action === 'store_assigned') {
      details.push(`Store assigned`);
      if (newVal.is_primary) {
        details.push('(Primary)');
      }
    }
  }
  
  // For DELETE (store_removed)
  if (entry.action === 'INSERT' && entry.new_value) {
    const newVal = entry.new_value as Record<string, unknown>;
    if (newVal.action === 'store_removed') {
      details.push(`Store removed`);
    }
  }
  
  // For primary_store_changed
  if (entry.action === 'INSERT' && entry.new_value) {
    const newVal = entry.new_value as Record<string, unknown>;
    if (newVal.action === 'primary_store_changed') {
      details.push(`Primary store changed`);
    }
  }
  
  return details.join(' ');
}

// Get default date range (last 7 days - reduced for efficiency)
function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7); // Changed from 30 to 7 days
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// Action badge component
function ActionBadge({ action }: { action: 'INSERT' | 'UPDATE' | 'DELETE' }) {
  const styles = {
    INSERT: 'bg-accent-greenLight text-accent-green',
    UPDATE: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-accent-redLight text-accent-red',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[action]}`}>
      {action}
    </span>
  );
}

// JSON value display component
function JsonValue({ value, label }: { value: Record<string, unknown> | null; label: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!value) {
    return <span className="text-secondary">-</span>;
  }

  const jsonStr = JSON.stringify(value, null, 2);
  const preview = jsonStr.length > 50 ? jsonStr.substring(0, 50) + '...' : jsonStr;

  return (
    <div className="relative">
      {expanded ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setExpanded(false)}>
          <div className="bg-white rounded-xl p-4 max-w-2xl max-h-[80vh] overflow-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-primary">{label}</h3>
              <button onClick={() => setExpanded(false)} className="text-secondary hover:text-primary">
                ✕
              </button>
            </div>
            <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto">{jsonStr}</pre>
          </div>
        </div>
      ) : null}
      <button
        onClick={() => setExpanded(true)}
        className="text-left text-xs text-secondary hover:text-primary truncate max-w-[150px] block"
        title="Click to expand"
      >
        {preview}
      </button>
    </div>
  );
}

export default function AuditLogPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [auditLogs, setAuditLogs] = useState<PaginatedAuditLogs | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Check admin access on mount
  useEffect(() => {
    async function verifyAccess() {
      const isAdmin = await checkAdminAccess();
      setHasAccess(isAdmin);
      
      if (!isAdmin) {
        setLoading(false);
        setError('Access denied. Admin privileges required to view audit logs.');
        return;
      }
    }
    
    verifyAccess();
  }, []);

  // Filter state
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Fetch filter options
  useEffect(() => {
    if (!hasAccess) return;
    
    async function fetchFilterOptions() {
      const [tablesResult, usersResult] = await Promise.all([
        getAuditedTables(),
        getAuditLogUsers(),
      ]);

      if (tablesResult.success) {
        setTables(tablesResult.data);
      }
      if (usersResult.success) {
        setUsers(usersResult.data);
      }
    }
    fetchFilterOptions();
  }, [hasAccess]);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    if (!hasAccess) return;
    
    setLoading(true);
    setError(null);

    try {
      const filters: AuditLogFilter = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        user_id: selectedUser || undefined,
        action: selectedAction as 'INSERT' | 'UPDATE' | 'DELETE' | undefined,
        table_name: selectedTable || undefined,
        page: currentPage,
        page_size: pageSize,
      };

      const result = await getAuditLogs(filters);

      if (result.success) {
        setAuditLogs(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load audit logs');
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedUser, selectedAction, selectedTable, currentPage, hasAccess]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, selectedUser, selectedAction, selectedTable]);

  // Export handler
  const handleExportExcel = async () => {
    if (!hasAccess) return;
    
    setExporting(true);
    try {
      const result = await exportAuditLogs({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        user_id: selectedUser || undefined,
        action: selectedAction as 'INSERT' | 'UPDATE' | 'DELETE' | undefined,
        table_name: selectedTable || undefined,
      });

      if (result.success) {
        // Convert base64 to blob and download
        const byteCharacters = atob(result.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-log-${startDate}-${endDate}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Error exporting Excel:', err);
      setError('Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'created_at',
      header: t('common.date'),
      sortable: true,
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: 'user',
      header: t('auditLog.user') || 'User',
      render: (row) => row.user?.full_name || 'System',
    },
    {
      key: 'action',
      header: t('auditLog.action') || 'Action',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <ActionBadge action={row.action} />
          {row.table_name === 'staff_stores' && (
            <span className="text-xs text-secondary">
              {formatAssignmentDetails(row)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'table_name',
      header: t('auditLog.table') || 'Table',
      sortable: true,
    },
    {
      key: 'record_id',
      header: t('auditLog.recordId') || 'Record ID',
      render: (row) => (
        <span className="font-mono text-xs truncate max-w-[100px] block" title={row.record_id}>
          {row.record_id.substring(0, 8)}...
        </span>
      ),
    },
    {
      key: 'old_value',
      header: t('auditLog.oldValue') || 'Old Value',
      render: (row) => <JsonValue value={row.old_value} label={t('auditLog.oldValue') || 'Old Value'} />,
    },
    {
      key: 'new_value',
      header: t('auditLog.newValue') || 'New Value',
      render: (row) => <JsonValue value={row.new_value} label={t('auditLog.newValue') || 'New Value'} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Access denied message */}
      {hasAccess === false && (
        <SoftCard className="bg-accent-redLight border border-accent-red/20">
          <div className="text-center py-8">
            <div className="text-accent-red text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold text-accent-red mb-2">Access Denied</h2>
            <p className="text-secondary">
              You need administrator privileges to view audit logs.
            </p>
            <Button
              variant="secondary"
              onClick={() => router.push('/dashboard')}
              className="mt-4"
            >
              Return to Dashboard
            </Button>
          </div>
        </SoftCard>
      )}

      {/* Main content - only show if user has access */}
      {hasAccess && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-primary">{t('sidebar.auditLog')}</h1>
              <p className="text-secondary mt-1">{t('auditLog.description') || 'Track all data changes in the system'}</p>
            </div>
            
            {/* Export Button */}
            <Button
              variant="secondary"
              onClick={handleExportExcel}
              disabled={!auditLogs || auditLogs.data.length === 0 || exporting}
            >
              {exporting ? t('common.loading') : t('auditLog.exportExcel') || 'Export to Excel'}
            </Button>
          </div>

          {/* Filters */}
          <SoftCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t('form.startDate')}</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t('form.endDate')}</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t('auditLog.user') || 'User'}</label>
                <Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">{t('common.all')} {t('auditLog.users') || 'Users'}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t('auditLog.action') || 'Action'}</label>
                <Select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                >
                  <option value="">{t('common.all')} {t('common.actions')}</option>
                  <option value="INSERT">INSERT</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t('auditLog.table') || 'Table'}</label>
                <Select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                >
                  <option value="">{t('common.all')} {t('auditLog.tables') || 'Tables'}</option>
                  {tables.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </SoftCard>

          {/* Error Message */}
          {error && (
            <SoftCard className="bg-accent-redLight border border-accent-red/20">
              <p className="text-accent-red">{error}</p>
            </SoftCard>
          )}

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={auditLogs?.data || []}
            keyExtractor={(row) => row.id}
            loading={loading}
            emptyMessage={t('auditLog.noEntries') || 'No audit log entries found for the selected filters'}
            pageSize={pageSize}
          />

          {/* Pagination */}
          {auditLogs && auditLogs.total_pages > 1 && (
            <SoftCard>
              <div className="flex items-center justify-between">
                <p className="text-sm text-secondary">
                  {t('auditLog.showing') || 'Showing'} {((currentPage - 1) * pageSize) + 1} {t('auditLog.to') || 'to'} {Math.min(currentPage * pageSize, auditLogs.total)} {t('auditLog.of') || 'of'} {auditLogs.total} {t('auditLog.entries') || 'entries'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    {t('common.previous')}
                  </Button>
                  <span className="flex items-center px-3 text-sm text-secondary">
                    {t('auditLog.page') || 'Page'} {currentPage} {t('auditLog.of') || 'of'} {auditLogs.total_pages}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((p) => Math.min(auditLogs.total_pages, p + 1))}
                    disabled={currentPage === auditLogs.total_pages}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            </SoftCard>
          )}

          {/* Summary */}
          {auditLogs && auditLogs.data.length > 0 && (
            <SoftCard>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-secondary">{t('auditLog.totalEntries') || 'Total Entries'}</p>
                  <p className="text-xl font-semibold text-primary">{auditLogs.total}</p>
                </div>
                <div>
                  <p className="text-sm text-secondary">{t('auditLog.inserts') || 'Inserts'}</p>
                  <p className="text-xl font-semibold text-accent-green">
                    {auditLogs.data.filter((l) => l.action === 'INSERT').length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-secondary">{t('auditLog.updates') || 'Updates'}</p>
                  <p className="text-xl font-semibold text-amber-600">
                    {auditLogs.data.filter((l) => l.action === 'UPDATE').length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-secondary">{t('auditLog.deletes') || 'Deletes'}</p>
                  <p className="text-xl font-semibold text-accent-red">
                    {auditLogs.data.filter((l) => l.action === 'DELETE').length}
                  </p>
                </div>
              </div>
            </SoftCard>
          )}
        </>
      )}
    </div>
  );
}
