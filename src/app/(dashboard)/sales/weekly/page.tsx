'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTransactionGroupedWeeklySales, getFiscalWeeksForReport, getCurrentUserProfile, getAssignedStores } from '@/actions/sales';
import { getAccounts, getStores, getStaff } from '@/actions/master-data';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SoftCard } from '@/components/ui/SoftCard';
import { FormSuccess } from '@/components/ui/FormSuccess';
import { FormError } from '@/components/ui/FormError';
import { TransactionGroupedTable } from '@/components/sales/TransactionGroupedTable';
import { TransactionGroupedReport, WeeklySalesFilter, Account, Store, Profile } from '@/types';
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

// Format date for display
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format month name
function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    month: 'short',
    year: '2-digit',
  });
}

// Format week date range for display
function formatWeekRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('id-ID', options)} - ${end.toLocaleDateString('id-ID', options)}`;
}

interface FiscalWeekOption {
  week: number;
  startDate: string;
  endDate: string;
}

export default function WeeklySalesReportPage() {
  const { t } = useI18n();
  const [report, setReport] = useState<TransactionGroupedReport | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string } | Store>>([]);
  const [filteredStores, setFilteredStores] = useState<Array<{ id: string; name: string } | Store>>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [fiscalWeeks, setFiscalWeeks] = useState<FiscalWeekOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [userRole, setUserRole] = useState<string>('staff');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Filter state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [periodType, setPeriodType] = useState<'week' | 'month' | 'year'>('week');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Check if user is staff (can only see own submissions)
  const isStaff = userRole === 'staff';

  // Fetch user profile and filter options
  useEffect(() => {
    async function fetchUserAndFilterOptions() {
      // Get current user profile first
      const userResult = await getCurrentUserProfile();
      if (userResult.success && userResult.data) {
        setUserRole(userResult.data.role);
        setCurrentUserName(userResult.data.full_name);
      }
      
      const [accountResult, storeResult, staffResult] = await Promise.all([
        getAccounts(true),
        // For staff, get only assigned stores; for admin/manager, get all stores
        userResult.success && userResult.data?.role === 'staff' 
          ? getAssignedStores() 
          : getStores(true),
        getStaff(true),
      ]);

      if (accountResult.success) {
        setAccounts(accountResult.data);
      }
      if (storeResult.success) {
        setStores(storeResult.data);
        setFilteredStores(storeResult.data);
      }
      if (staffResult.success) {
        setStaff(staffResult.data);
      }
    }
    fetchUserAndFilterOptions();
  }, []);

  // Fetch fiscal weeks when year changes
  useEffect(() => {
    async function fetchFiscalWeeks() {
      const result = await getFiscalWeeksForReport(selectedYear);
      if (result.success) {
        setFiscalWeeks(result.data);
        // Set default to current week if available
        if (result.data.length > 0 && selectedWeek === null) {
          // Find current week based on today's date
          const today = new Date().toISOString().split('T')[0];
          const currentWeek = result.data.find(
            w => w.startDate <= today && w.endDate >= today
          );
          
          if (currentWeek) {
            // Found the week containing today
            setSelectedWeek(currentWeek.week);
          } else {
            // Today is not in any fiscal week (e.g., between weeks or calendar not updated)
            // Find the most recent week that has ended (week where endDate < today)
            const pastWeeks = result.data.filter(w => w.endDate < today);
            if (pastWeeks.length > 0) {
              // Default to the most recent completed week
              setSelectedWeek(pastWeeks[pastWeeks.length - 1].week);
            } else {
              // All weeks are in the future, default to first week
              setSelectedWeek(result.data[0].week);
            }
          }
        }
      }
    }
    fetchFiscalWeeks();
  }, [selectedYear, selectedWeek]);

  // Filter stores by account
  useEffect(() => {
    if (selectedAccount) {
      // Filter by account and only show brandstores
      const accountStores = stores.filter(s => 'account_id' in s && s.account_id === selectedAccount);
      const brandstores = accountStores.filter(store => {
        const account = accounts.find(a => a.id === ('account_id' in store ? store.account_id : ''));
        return account?.channel_type === 'Brandstore';
      });
      setFilteredStores(brandstores);
      setSelectedStore(''); // Reset store selection when account changes
    } else {
      // No account selected - show only brandstores from all stores
      const brandstores = stores.filter(store => {
        const account = accounts.find(a => a.id === ('account_id' in store ? store.account_id : ''));
        return account?.channel_type === 'Brandstore';
      });
      setFilteredStores(brandstores);
    }
  }, [selectedAccount, stores, accounts]);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    // For week: require selectedWeek
    // For month: require selectedMonth
    // For year: only require selectedYear
    if (periodType === 'week' && selectedWeek === null) return;
    if (periodType === 'month' && selectedMonth === null) return;
    
    setLoading(true);
    setError(null);

    try {
      let filters: WeeklySalesFilter = {
        fiscal_year: selectedYear,
        account_id: selectedAccount || undefined,
        store_id: selectedStore || undefined,
        staff_id: selectedStaff || undefined,
      };

      if (periodType === 'week') {
        filters.fiscal_week = selectedWeek!;
      } else if (periodType === 'month') {
        // Calculate start and end date for the month
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth!, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        filters.start_date = startDate;
        filters.end_date = endDate;
      } else {
        // Year: get full year data
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;
        filters.start_date = startDate;
        filters.end_date = endDate;
      }

      const result = await getTransactionGroupedWeeklySales(filters);

      if (result.success) {
        setReport(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load sales report');
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  }, [periodType, selectedWeek, selectedMonth, selectedYear, selectedAccount, selectedStore, selectedStaff, refreshTrigger]);

  useEffect(() => {
    if (periodType === 'week' && selectedWeek !== null) {
      fetchReport();
    } else if (periodType === 'month' && selectedMonth !== null) {
      fetchReport();
    } else if (periodType === 'year') {
      fetchReport();
    }
  }, [fetchReport, periodType, selectedWeek, selectedMonth]);

  // Handler for when a transaction is deleted
  const handleTransactionDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Export handlers
  const handleExportPDF = async () => {
    if (!report || report.transactions.length === 0) return;
    
    setExporting('pdf');
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { WeeklySalesReportPDF } = await import('@/lib/pdf/weekly-sales-report');
      
      const selectedWeekData = fiscalWeeks.find(w => w.week === selectedWeek);
      
      // Flatten transactions to items for PDF export
      const flattenedItems = report.transactions.flatMap(t => t.items);
      
      // Generate filename based on period type
      let filename = '';
      if (periodType === 'week') {
        filename = `sales-report-week${selectedWeek}-${selectedYear}.pdf`;
      } else if (periodType === 'month') {
        const monthName = new Date(selectedYear, selectedMonth! - 1).toLocaleDateString('en-US', { month: 'long' });
        filename = `sales-report-${monthName}-${selectedYear}.pdf`;
      } else {
        filename = `sales-report-${selectedYear}.pdf`;
      }
      
      const blob = await pdf(
        <WeeklySalesReportPDF 
          report={{
            items: flattenedItems,
            totals: {
              total_quantity: report.totals.total_quantity,
              total_revenue: report.totals.total_revenue,
              total_discount: report.totals.total_discount,
            },
            fiscal_week: report.fiscal_week,
            fiscal_year: report.fiscal_year,
            start_date: report.start_date,
            end_date: report.end_date,
          }}
          filters={{ 
            fiscalWeek: periodType === 'week' ? selectedWeek || undefined : undefined,
            fiscalYear: selectedYear,
            startDate: periodType === 'week' ? selectedWeekData?.startDate : report.start_date,
            endDate: periodType === 'week' ? selectedWeekData?.endDate : report.end_date,
            accountName: accounts.find(a => a.id === selectedAccount)?.name,
            storeName: filteredStores.find(s => s.id === selectedStore)?.name,
            periodType,
          }}
        />
      ).toBlob();
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Failed to export PDF');
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (!report || report.transactions.length === 0) return;
    
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      
      // Flatten transactions to individual items for export (one row per product)
      const excelData: any[] = [];
      
      report.transactions.forEach((transaction) => {
        transaction.items.forEach((item) => {
          const sellThru = item.unit_price;
          
          // Extract gift details
          let gift1Name = '-';
          let gift1Qty = '';
          let gift2Name = '-';
          let gift2Qty = '';
          
          if (item.gift_details && item.gift_details.length > 0) {
            if (item.gift_details[0]) {
              gift1Name = item.gift_details[0].name;
              gift1Qty = item.gift_details[0].qty.toString();
            }
            if (item.gift_details[1]) {
              gift2Name = item.gift_details[1].name;
              gift2Qty = item.gift_details[1].qty.toString();
            }
          } else if (item.gift && item.gift.trim() !== '') {
            // Legacy gift format
            gift1Name = item.gift;
            gift1Qty = '';
          }
          
          excelData.push({
            'Month': formatMonth(item.sale_date),
            'DATE': formatDate(item.sale_date),
            'Week': `Week ${item.fiscal_week}`,
            'Account Name': item.account_name || '-',
            'Store Name': item.store_name,
            'SKU': item.sku,
            'Category': item.category || '-',
            'Sub category': item.sub_category || '-',
            'Product Name': item.product_name,
            'QTY': item.quantity,
            'ST': sellThru,
            'Discount': item.discount,
            'TOTAL': item.total_price,
            'Gift Product 1': gift1Name,
            'Gift Qty 1': gift1Qty,
            'Gift Product 2': gift2Name,
            'Gift Qty 2': gift2Qty,
          });
        });
      });

      // Add totals row
      excelData.push({
        'Month': '',
        'DATE': '',
        'Week': '',
        'Account Name': '',
        'Store Name': '',
        'SKU': '',
        'Category': '',
        'Sub category': '',
        'Product Name': 'TOTAL',
        'QTY': report.totals.total_quantity,
        'ST': '' as unknown as number,
        'Discount': report.totals.total_discount,
        'TOTAL': report.totals.total_revenue,
        'Gift Product 1': '',
        'Gift Qty 1': '',
        'Gift Product 2': '',
        'Gift Qty 2': '',
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');
      
      // Generate filename based on period type
      let filename = '';
      if (periodType === 'week') {
        filename = `sales-report-week${selectedWeek}-${selectedYear}.xlsx`;
      } else if (periodType === 'month') {
        const monthName = new Date(selectedYear, selectedMonth! - 1).toLocaleDateString('en-US', { month: 'long' });
        filename = `sales-report-${monthName}-${selectedYear}.xlsx`;
      } else {
        filename = `sales-report-${selectedYear}.xlsx`;
      }
      
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      setError('Failed to export Excel');
    } finally {
      setExporting(null);
    }
  };

  // Get selected week info for display
  const selectedWeekInfo = fiscalWeeks.find(w => w.week === selectedWeek);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('sales.weeklyReport')}</h1>
          <p className="text-secondary mt-1">
            {t('weeklyReport.viewTransactions')}
            {selectedWeekInfo && (
              <span className="ml-2 text-sm">
                ({formatWeekRange(selectedWeekInfo.startDate, selectedWeekInfo.endDate)})
              </span>
            )}
          </p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleExportPDF}
            disabled={!report || report.transactions.length === 0 || exporting !== null}
          >
            {exporting === 'pdf' ? `${t('common.export')}...` : `${t('common.export')} PDF`}
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportExcel}
            disabled={!report || report.transactions.length === 0 || exporting !== null}
          >
            {exporting === 'excel' ? `${t('common.export')}...` : `${t('common.export')} Excel`}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <SoftCard>
        {/* Staff notice - only show for staff users */}
        {isStaff && (
          <div className="mb-4 p-3 bg-accent-greenLight rounded-lg">
            <p className="text-sm text-primary">
              {t('weeklyReport.viewingOwnSubmissions') || `Viewing your own submissions (${currentUserName})`}
            </p>
          </div>
        )}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isStaff ? 'lg:grid-cols-4' : 'lg:grid-cols-6'} gap-4`}>
          {/* Period Type Selector */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Period Type</label>
            <Select
              value={periodType}
              onChange={(e) => {
                setPeriodType(e.target.value as 'week' | 'month' | 'year');
                // Reset selections when changing period type
                if (e.target.value === 'month') {
                  setSelectedMonth(new Date().getMonth() + 1);
                  setSelectedWeek(null);
                } else if (e.target.value === 'year') {
                  setSelectedWeek(null);
                  setSelectedMonth(null);
                }
              }}
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">{t('weeklyReport.fiscalYear')}</label>
            <Select
              value={selectedYear.toString()}
              onChange={(e) => {
                setSelectedYear(parseInt(e.target.value));
                if (periodType === 'week') {
                  setSelectedWeek(null); // Reset week when year changes
                }
              }}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>
          
          {/* Week Selector - only show for weekly period */}
          {periodType === 'week' && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">{t('sales.fiscalWeek')}</label>
              <Select
                value={selectedWeek?.toString() || ''}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              >
                <option value="">{t('weeklyReport.selectWeek')}</option>
                {fiscalWeeks.map((week) => {
                  const today = new Date().toISOString().split('T')[0];
                  const isCurrentWeek = week.startDate <= today && week.endDate >= today;
                  return (
                    <option key={week.week} value={week.week}>
                      {t('weeklyReport.week')} {week.week} ({formatWeekRange(week.startDate, week.endDate)})
                      {isCurrentWeek ? ' ← Current' : ''}
                    </option>
                  );
                })}
              </Select>
            </div>
          )}
          
          {/* Month Selector - only show for monthly period */}
          {periodType === 'month' && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Month</label>
              <Select
                value={selectedMonth?.toString() || ''}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                <option value="">Select Month</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {new Date(selectedYear, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                  </option>
                ))}
              </Select>
            </div>
          )}
          
          {/* Account Filter - hidden for staff */}
          {!isStaff && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">{t('form.account')}</label>
              <Select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
              >
                <option value="">{t('dashboard.allAccounts')}</option>
                {[...accounts]
                  .sort((a, b) => `${a.channel_type} - ${a.name}`.localeCompare(`${b.channel_type} - ${b.name}`))
                  .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.channel_type} - {account.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">{t('form.store')}</label>
            <Select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            >
              <option value="">{t('dashboard.allStores')}</option>
              {filteredStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </div>
          {/* Staff filter - only show for admin/manager */}
          {!isStaff && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">{t('sidebar.staff')}</label>
              <Select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
              >
                <option value="">{t('weeklyReport.allStaff')}</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </SoftCard>

      {/* Success Message */}
      {successMessage && (
        <FormSuccess message={successMessage} />
      )}

      {/* Error Message */}
      {error && (
        <SoftCard className="bg-accent-redLight border border-accent-red/20">
          <FormError message={error} />
        </SoftCard>
      )}

      {/* Transaction-Grouped Table */}
      <SoftCard>
        <TransactionGroupedTable
          transactions={report?.transactions || []}
          loading={loading}
          userRole={userRole}
          onTransactionDeleted={handleTransactionDeleted}
        />
      </SoftCard>

      {/* Totals Row */}
      {report && report.transactions.length > 0 && (
        <SoftCard>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            <div>
              <p className="text-sm text-secondary">
                {periodType === 'week' && t('sales.fiscalWeek')}
                {periodType === 'month' && 'Month'}
                {periodType === 'year' && 'Year'}
              </p>
              <p className="text-xl font-semibold text-primary">
                {periodType === 'week' && `${t('weeklyReport.week')} ${report.fiscal_week}`}
                {periodType === 'month' && new Date(selectedYear, selectedMonth! - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {periodType === 'year' && selectedYear}
              </p>
            </div>
            <div>
              <p className="text-sm text-secondary">{t('weeklyReport.totalTransactions') || 'Transactions'}</p>
              <p className="text-xl font-semibold text-primary">{report.totals.total_transactions}</p>
            </div>
            <div>
              <p className="text-sm text-secondary">{t('weeklyReport.totalItems') || 'Total Items'}</p>
              <p className="text-xl font-semibold text-primary">{report.totals.total_items}</p>
            </div>
            <div>
              <p className="text-sm text-secondary">{t('weeklyReport.totalQuantity')}</p>
              <p className="text-xl font-semibold text-primary">{report.totals.total_quantity}</p>
            </div>
            <div>
              <p className="text-sm text-secondary">{t('weeklyReport.averageTransactionValue') || 'Avg Transaction'}</p>
              <p className="text-xl font-semibold text-accent-blue">{formatCurrency(report.totals.average_transaction_value)}</p>
            </div>
            <div>
              <p className="text-sm text-secondary">{t('weeklyReport.totalRevenue')}</p>
              <p className="text-xl font-semibold text-accent-green">{formatCurrency(report.totals.total_revenue)}</p>
            </div>
          </div>
        </SoftCard>
      )}
    </div>
  );
}
