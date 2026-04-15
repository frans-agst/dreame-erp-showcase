// Temporary debug endpoint to test sales achievement data
// Access at: /api/debug-sales?month=2026-03

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const monthParam = searchParams.get('month') || '2026-03';
    
    const [year, month] = monthParam.split('-').map(Number);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

    const supabase = await createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .single();

    // Get stores
    const { data: stores, error: storeError } = await supabase
      .from('stores')
      .select('id, name, account_id, monthly_target, account:accounts(name)')
      .eq('is_active', true)
      .order('name');

    // Get sales for the month
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id, sale_date, store_id, total_price')
      .gte('sale_date', startDateStr)
      .lte('sale_date', endDateStr);

    // Aggregate sales by store
    const salesByStore: Record<string, { count: number; total: number }> = {};
    (salesData || []).forEach((sale) => {
      const storeId = sale.store_id;
      if (storeId) {
        if (!salesByStore[storeId]) {
          salesByStore[storeId] = { count: 0, total: 0 };
        }
        salesByStore[storeId].count++;
        salesByStore[storeId].total += Number(sale.total_price || 0);
      }
    });

    // Build achievement data
    const achievements = (stores || []).map((store) => {
      const sales = salesByStore[store.id];
      const account = store.account as unknown as { name: string } | null;
      
      return {
        store_id: store.id,
        store_name: store.name,
        account_name: account?.name || '',
        sales_count: sales?.count || 0,
        sales_total: sales?.total || 0,
        target: Number(store.monthly_target) || 0,
      };
    });

    return NextResponse.json({
      debug: {
        user: {
          id: user.id,
          email: user.email,
          role: profile?.role,
        },
        dateRange: {
          start: startDateStr,
          end: endDateStr,
        },
        query: {
          storesFound: stores?.length || 0,
          storeError: storeError?.message,
          salesFound: salesData?.length || 0,
          salesError: salesError?.message,
        },
      },
      achievements,
      rawSales: salesData?.slice(0, 5), // First 5 sales for inspection
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
