// src/types/database.ts
// Supabase generated types for database tables
// Updated for V2 schema - all branch_id renamed to store_id

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'admin' | 'manager' | 'staff';
          store_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: 'admin' | 'manager' | 'staff';
          store_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: 'admin' | 'manager' | 'staff';
          store_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounts: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      stores: {
        Row: {
          id: string;
          name: string;
          account_id: string | null;
          province: string | null;
          monthly_target: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          account_id?: string | null;
          province?: string | null;
          monthly_target?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          account_id?: string | null;
          province?: string | null;
          monthly_target?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          price: number;
          category: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          price: number;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          price?: number;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      inventory: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          staff_id: string;
          quantity: number;
          unit_price: number;
          discount: number;
          total_price: number;
          customer_name: string | null;
          customer_phone: string | null;
          gift_details: Json | null;
          sale_date: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          staff_id: string;
          quantity: number;
          unit_price: number;
          discount?: number;
          total_price: number;
          customer_name?: string | null;
          customer_phone?: string | null;
          gift_details?: Json | null;
          sale_date?: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          staff_id?: string;
          quantity?: number;
          unit_price?: number;
          discount?: number;
          total_price?: number;
          customer_name?: string | null;
          customer_phone?: string | null;
          gift_details?: Json | null;
          sale_date?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      purchase_orders: {
        Row: {
          id: string;
          po_number: string;
          dealer_name: string;
          po_date: string;
          status: 'draft' | 'confirmed' | 'cancelled';
          total_before_tax: number;
          total_after_tax: number;
          grand_total: number;
          created_by: string;
          confirmed_by: string | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          po_number: string;
          dealer_name: string;
          po_date: string;
          status?: 'draft' | 'confirmed' | 'cancelled';
          total_before_tax: number;
          total_after_tax: number;
          grand_total: number;
          created_by: string;
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          po_number?: string;
          dealer_name?: string;
          po_date?: string;
          status?: 'draft' | 'confirmed' | 'cancelled';
          total_before_tax?: number;
          total_after_tax?: number;
          grand_total?: number;
          created_by?: string;
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
      };
      purchase_order_items: {
        Row: {
          id: string;
          po_id: string;
          product_id: string;
          quantity: number;
          before_tax: number;
          after_tax: number;
          line_total: number;
        };
        Insert: {
          id?: string;
          po_id: string;
          product_id: string;
          quantity: number;
          before_tax: number;
          after_tax: number;
          line_total: number;
        };
        Update: {
          id?: string;
          po_id?: string;
          product_id?: string;
          quantity?: number;
          before_tax?: number;
          after_tax?: number;
          line_total?: number;
        };
      };
      day_off_requests: {
        Row: {
          id: string;
          staff_id: string;
          start_date: string;
          end_date: string;
          reason: string;
          status: 'pending' | 'approved' | 'rejected';
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          start_date: string;
          end_date: string;
          reason: string;
          status?: 'pending' | 'approved' | 'rejected';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          start_date?: string;
          end_date?: string;
          reason?: string;
          status?: 'pending' | 'approved' | 'rejected';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
      };
      stock_opname: {
        Row: {
          id: string;
          store_id: string;
          staff_id: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          staff_id: string;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          staff_id?: string;
          submitted_at?: string;
        };
      };
      stock_opname_items: {
        Row: {
          id: string;
          opname_id: string;
          product_id: string;
          previous_qty: number;
          counted_qty: number;
          discrepancy: number;
        };
        Insert: {
          id?: string;
          opname_id: string;
          product_id: string;
          previous_qty: number;
          counted_qty: number;
        };
        Update: {
          id?: string;
          opname_id?: string;
          product_id?: string;
          previous_qty?: number;
          counted_qty?: number;
        };
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: 'INSERT' | 'UPDATE' | 'DELETE';
          table_name: string;
          record_id: string;
          old_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: 'INSERT' | 'UPDATE' | 'DELETE';
          table_name: string;
          record_id: string;
          old_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: 'INSERT' | 'UPDATE' | 'DELETE';
          table_name?: string;
          record_id?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
      };
      fiscal_calendar: {
        Row: {
          date: string;
          fiscal_year: number;
          fiscal_month: number;
          fiscal_week: number;
        };
        Insert: {
          date: string;
          fiscal_year: number;
          fiscal_month: number;
          fiscal_week: number;
        };
        Update: {
          date?: string;
          fiscal_year?: number;
          fiscal_month?: number;
          fiscal_week?: number;
        };
      };
      staff_stores: {
        Row: {
          id: string;
          staff_id: string;
          store_id: string;
          is_primary: boolean;
          assigned_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          store_id: string;
          is_primary?: boolean;
          assigned_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          store_id?: string;
          is_primary?: boolean;
          assigned_at?: string;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          store_id: string;
          staff_id: string;
          transaction_date: string;
          total_before_discount: number;
          total_discount: number;
          total_after_discount: number;
          inventory_source: 'in_store' | 'warehouse';
          customer_name: string | null;
          customer_phone: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          staff_id: string;
          transaction_date: string;
          total_before_discount: number;
          total_discount?: number;
          total_after_discount: number;
          inventory_source?: 'in_store' | 'warehouse';
          customer_name?: string | null;
          customer_phone?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          staff_id?: string;
          transaction_date?: string;
          total_before_discount?: number;
          total_discount?: number;
          total_after_discount?: number;
          inventory_source?: 'in_store' | 'warehouse';
          customer_name?: string | null;
          customer_phone?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transaction_items: {
        Row: {
          id: string;
          transaction_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          line_discount: number;
          line_total: number;
          gift_details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          line_discount?: number;
          line_total: number;
          gift_details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          line_discount?: number;
          line_total?: number;
          gift_details?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      user_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      user_store_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      decrement_inventory: {
        Args: {
          p_store_id: string;
          p_product_id: string;
          p_qty: number;
        };
        Returns: number;
      };
      get_user_store_ids: {
        Args: {
          user_id: string;
        };
        Returns: string[];
      };
    };
    Enums: {
      user_role: 'admin' | 'manager' | 'staff';
      day_off_status: 'pending' | 'approved' | 'rejected';
      po_status: 'draft' | 'confirmed' | 'cancelled';
      audit_action: 'INSERT' | 'UPDATE' | 'DELETE';
    };
  };
}

// Helper types for Supabase client
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
