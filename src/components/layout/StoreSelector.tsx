'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface Store {
  id: string;
  name: string;
}

/**
 * Store selector component for multi-store staff
 * Requirements: 5.1, 5.2, 5.3, 5.5
 * 
 * - Loads assigned stores from user metadata
 * - Displays current store name
 * - Renders SearchableSelect with store options
 * - Handles store change (updates session and reloads)
 * - Only renders if user has multiple stores
 */
export function StoreSelector() {
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadStores();
  }, []);
  
  async function loadStores() {
    try {
      const supabase = createClient();
      
      // Get user's assigned stores from metadata
      const { data: { user } } = await supabase.auth.getUser();
      const assignedStoreIds = user?.user_metadata?.assigned_store_ids || [];
      
      // Only render for multi-store staff (Requirement 5.5)
      if (assignedStoreIds.length <= 1) {
        setLoading(false);
        return;
      }
      
      // Load store details
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .in('id', assignedStoreIds)
        .order('name');
      
      setStores(data || []);
      setCurrentStoreId(user?.user_metadata?.current_store_id || '');
      setLoading(false);
    } catch (error) {
      console.error('Error loading stores:', error);
      setLoading(false);
    }
  }
  
  async function handleStoreChange(storeId: string) {
    try {
      const supabase = createClient();
      
      // Update session with new store context (Requirement 5.3)
      const { error } = await supabase.auth.updateUser({
        data: { current_store_id: storeId }
      });
      
      if (error) {
        console.error('Error updating store context:', error);
        return;
      }
      
      setCurrentStoreId(storeId);
      
      // Wait a moment for the session to update, then refresh page to reload data with new context
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('Error changing store:', error);
    }
  }
  
  // Don't render if loading or single store (Requirement 5.5)
  if (loading || stores.length <= 1) {
    return null;
  }
  
  const currentStore = stores.find(s => s.id === currentStoreId);
  
  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* Store icon */}
      <svg 
        className="w-5 h-5 text-secondary flex-shrink-0" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
        />
      </svg>
      
      {/* Store selector (Requirements 5.1, 5.2) */}
      <div className="min-w-[240px] max-w-[400px]">
        <SearchableSelect
          value={currentStoreId}
          onChange={handleStoreChange}
          options={stores.map(s => ({
            value: s.id,
            label: s.name
          }))}
          placeholder="Select store"
        />
      </div>
    </div>
  );
}
