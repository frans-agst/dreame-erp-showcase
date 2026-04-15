'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { SoftCard } from '@/components/ui/SoftCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Profile, Store, Account, StaffStoreAssignment } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { getStaff, getStores, getAccounts } from '@/actions/master-data';
import { getStaffAssignments } from '@/actions/store-assignments';
import { AssignStoreDialog } from '@/components/master-data/AssignStoreDialog';
import { RemoveAssignmentDialog } from '@/components/master-data/RemoveAssignmentDialog';
import { SetPrimaryStoreDialog } from '@/components/master-data/SetPrimaryStoreDialog';

interface StaffWithAssignments extends Profile {
  assignments?: StaffStoreAssignment[];
}

export default function StaffAssignmentsPage() {
  const { t } = useI18n();
  const [staff, setStaff] = useState<StaffWithAssignments[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffWithAssignments | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showPrimaryDialog, setShowPrimaryDialog] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState<StaffStoreAssignment | null>(null);

  // Get current user role
  useEffect(() => {
    const fetchCurrentUserRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserRole(user.app_metadata?.role || 'staff');
      }
    };
    fetchCurrentUserRole();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    // Fetch staff, stores, and accounts
    const [staffResult, storesResult, accountsResult] = await Promise.all([
      getStaff(true), // Only active staff
      getStores(true),
      getAccounts(true),
    ]);
    
    if (staffResult.success && storesResult.success && accountsResult.success) {
      setStores(storesResult.data);
      setAccounts(accountsResult.data);
      
      // Fetch assignments for each staff member
      const staffWithAssignments = await Promise.all(
        staffResult.data
          .filter(s => s.role === 'staff') // Only show staff role
          .map(async (staffMember) => {
            const assignmentsResult = await getStaffAssignments(staffMember.id);
            return {
              ...staffMember,
              assignments: assignmentsResult.success ? assignmentsResult.data : [],
            };
          })
      );
      
      setStaff(staffWithAssignments);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get store display name
  const getStoreDisplayName = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) return 'Unknown Store';
    const account = accounts.find(a => a.id === store.account_id);
    return account ? `${account.name} - ${store.name}` : store.name;
  };

  // Handle assign store
  const handleAssignStore = (staffMember: Profile) => {
    setSelectedStaff(staffMember);
    setShowAssignDialog(true);
  };

  // Handle remove assignment
  const handleRemoveAssignment = (staffMember: Profile, assignment: StaffStoreAssignment) => {
    setSelectedStaff(staffMember);
    setAssignmentToRemove(assignment);
    setShowRemoveDialog(true);
  };

  // Handle set primary
  const handleSetPrimary = (staffMember: Profile) => {
    setSelectedStaff(staffMember);
    setShowPrimaryDialog(true);
  };

  const columns: Column<StaffWithAssignments>[] = [
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
      key: 'assignments',
      header: 'Assigned Stores',
      render: (row) => {
        if (!row.assignments || row.assignments.length === 0) {
          return <span className="text-secondary text-sm">No stores assigned</span>;
        }
        
        return (
          <div className="space-y-1">
            {row.assignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center gap-2">
                <span className="text-sm">
                  {getStoreDisplayName(assignment.store_id)}
                </span>
                {assignment.is_primary && (
                  <StatusBadge status="green" label="Primary" />
                )}
                <button
                  onClick={() => handleRemoveAssignment(row, assignment)}
                  className="text-accent-red hover:text-accent-red/80 text-xs ml-2"
                  title="Remove assignment"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleAssignStore(row)}
            className="text-accent-green hover:text-accent-green/80 text-sm font-medium text-left"
          >
            + Assign Store
          </button>
          {row.assignments && row.assignments.length > 1 && (
            <button
              onClick={() => handleSetPrimary(row)}
              className="text-accent-blue hover:text-accent-blue/80 text-sm font-medium text-left"
            >
              Set Primary
            </button>
          )}
        </div>
      ),
    },
  ];

  // Check if user is admin
  if (currentUserRole !== 'admin') {
    return (
      <div className="space-y-6">
        <SoftCard>
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-primary mb-2">
              Access Denied
            </h2>
            <p className="text-secondary">
              Only administrators can access store assignment management.
            </p>
          </div>
        </SoftCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Store Assignments</h1>
          <p className="text-secondary mt-1">Manage staff store assignments</p>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={staff}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage="No staff members found"
        pageSize={10}
      />

      {/* Dialogs */}
      {showAssignDialog && selectedStaff && (
        <AssignStoreDialog
          staff={selectedStaff}
          stores={stores}
          accounts={accounts}
          existingAssignments={selectedStaff.assignments ?? []}
          onClose={() => {
            setShowAssignDialog(false);
            setSelectedStaff(null);
          }}
          onSuccess={fetchData}
        />
      )}

      {showRemoveDialog && selectedStaff && assignmentToRemove && (
        <RemoveAssignmentDialog
          staff={selectedStaff}
          assignment={assignmentToRemove}
          storeName={getStoreDisplayName(assignmentToRemove.store_id)}
          onClose={() => {
            setShowRemoveDialog(false);
            setSelectedStaff(null);
            setAssignmentToRemove(null);
          }}
          onSuccess={fetchData}
        />
      )}

      {showPrimaryDialog && selectedStaff && (
        <SetPrimaryStoreDialog
          staff={selectedStaff}
          assignments={selectedStaff.assignments || []}
          stores={stores}
          accounts={accounts}
          onClose={() => {
            setShowPrimaryDialog(false);
            setSelectedStaff(null);
          }}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
