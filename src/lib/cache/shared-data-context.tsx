'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Account, Store, Product } from '@/types';
import { getAccounts, getStores } from '@/actions/master-data';

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

interface CachedData<T> {
  data: T;
  timestamp: number;
}

interface SharedDataContextType {
  // Accounts
  accounts: Account[];
  accountsLoading: boolean;
  refreshAccounts: () => Promise<void>;
  
  // Stores
  stores: Store[];
  storesLoading: boolean;
  refreshStores: () => Promise<void>;
  
  // Check if cache is stale
  isCacheStale: (timestamp: number) => boolean;
}

const SharedDataContext = createContext<SharedDataContextType | null>(null);

export function SharedDataProvider({ children }: { children: ReactNode }) {
  // Accounts state
  const [accountsCache, setAccountsCache] = useState<CachedData<Account[]> | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  
  // Stores state
  const [storesCache, setStoresCache] = useState<CachedData<Store[]> | null>(null);
  const [storesLoading, setStoresLoading] = useState(false);

  const isCacheStale = useCallback((timestamp: number) => {
    return Date.now() - timestamp > CACHE_DURATION;
  }, []);

  const refreshAccounts = useCallback(async () => {
    // Skip if already loading
    if (accountsLoading) return;
    
    // Use cache if fresh
    if (accountsCache && !isCacheStale(accountsCache.timestamp)) {
      return;
    }

    setAccountsLoading(true);
    try {
      const result = await getAccounts(true);
      if (result.success) {
        setAccountsCache({
          data: result.data,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setAccountsLoading(false);
    }
  }, [accountsCache, accountsLoading, isCacheStale]);

  const refreshStores = useCallback(async () => {
    // Skip if already loading
    if (storesLoading) return;
    
    // Use cache if fresh
    if (storesCache && !isCacheStale(storesCache.timestamp)) {
      return;
    }

    setStoresLoading(true);
    try {
      const result = await getStores(true);
      if (result.success) {
        setStoresCache({
          data: result.data,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setStoresLoading(false);
    }
  }, [storesCache, storesLoading, isCacheStale]);

  // Initial load
  useEffect(() => {
    refreshAccounts();
    refreshStores();
  }, []);

  return (
    <SharedDataContext.Provider
      value={{
        accounts: accountsCache?.data || [],
        accountsLoading,
        refreshAccounts,
        stores: storesCache?.data || [],
        storesLoading,
        refreshStores,
        isCacheStale,
      }}
    >
      {children}
    </SharedDataContext.Provider>
  );
}

export function useSharedData() {
  const context = useContext(SharedDataContext);
  if (!context) {
    throw new Error('useSharedData must be used within a SharedDataProvider');
  }
  return context;
}
