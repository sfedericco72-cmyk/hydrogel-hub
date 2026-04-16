export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          code: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cuts_history_backfill: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          period: string
          records_loaded: number | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          period: string
          records_loaded?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          period?: string
          records_loaded?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          device_id: string
          id: string
          point_of_sale_id: string
          unassigned_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          device_id: string
          id?: string
          point_of_sale_id: string
          unassigned_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          device_id?: string
          id?: string
          point_of_sale_id?: string
          unassigned_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_assignments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_assignments_point_of_sale_id_fkey"
            columns: ["point_of_sale_id"]
            isOneToOne: false
            referencedRelation: "points_of_sale"
            referencedColumns: ["id"]
          },
        ]
      }
      device_cuts_history: {
        Row: {
          created_at: string
          cut_date: string
          daily_cuts: number | null
          fixno: string
          id: string
          total_cuts: number
        }
        Insert: {
          created_at?: string
          cut_date: string
          daily_cuts?: number | null
          fixno: string
          id?: string
          total_cuts?: number
        }
        Update: {
          created_at?: string
          cut_date?: string
          daily_cuts?: number | null
          fixno?: string
          id?: string
          total_cuts?: number
        }
        Relationships: []
      }
      device_transactions: {
        Row: {
          audit_date: string | null
          balance_after: number | null
          bill_date: string | null
          bill_no: string
          branch_name: string | null
          created_at: string
          creator: string | null
          customer_name: string | null
          fixno: string
          id: string
          quantity: number
          raw_data: Json | null
          remark: string | null
          transaction_type: string | null
        }
        Insert: {
          audit_date?: string | null
          balance_after?: number | null
          bill_date?: string | null
          bill_no: string
          branch_name?: string | null
          created_at?: string
          creator?: string | null
          customer_name?: string | null
          fixno: string
          id?: string
          quantity?: number
          raw_data?: Json | null
          remark?: string | null
          transaction_type?: string | null
        }
        Update: {
          audit_date?: string | null
          balance_after?: number | null
          bill_date?: string | null
          bill_no?: string
          branch_name?: string | null
          created_at?: string
          creator?: string | null
          customer_name?: string | null
          fixno?: string
          id?: string
          quantity?: number
          raw_data?: Json | null
          remark?: string | null
          transaction_type?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          address: string | null
          alert_email: string | null
          alerts_enabled: boolean
          branch_name: string | null
          city: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          customer_name: string | null
          cuts_today: number | null
          first_alert_sent_at: string | null
          fixno: string
          id: string
          ip_address: string | null
          last_synced_at: string
          latest_online_time: string | null
          raw_data: Json | null
          remaining_cuts: number | null
          software_version: string | null
          status: string | null
          tenant_id: string | null
          total_cuts: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          alert_email?: string | null
          alerts_enabled?: boolean
          branch_name?: string | null
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_name?: string | null
          cuts_today?: number | null
          first_alert_sent_at?: string | null
          fixno: string
          id?: string
          ip_address?: string | null
          last_synced_at?: string
          latest_online_time?: string | null
          raw_data?: Json | null
          remaining_cuts?: number | null
          software_version?: string | null
          status?: string | null
          tenant_id?: string | null
          total_cuts?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          alert_email?: string | null
          alerts_enabled?: boolean
          branch_name?: string | null
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_name?: string | null
          cuts_today?: number | null
          first_alert_sent_at?: string | null
          fixno?: string
          id?: string
          ip_address?: string | null
          last_synced_at?: string
          latest_online_time?: string | null
          raw_data?: Json | null
          remaining_cuts?: number | null
          software_version?: string | null
          status?: string | null
          tenant_id?: string | null
          total_cuts?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      equipment_sales: {
        Row: {
          branch_name: string | null
          created_at: string
          customer_name: string
          id: string
          notes: string | null
          period: string
          source: string
          units_sold: number
          updated_at: string
        }
        Insert: {
          branch_name?: string | null
          created_at?: string
          customer_name: string
          id?: string
          notes?: string | null
          period: string
          source?: string
          units_sold?: number
          updated_at?: string
        }
        Update: {
          branch_name?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          notes?: string | null
          period?: string
          source?: string
          units_sold?: number
          updated_at?: string
        }
        Relationships: []
      }
      points_of_sale: {
        Row: {
          address: string | null
          city: string | null
          client_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_of_sale_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tenant_settings: {
        Row: {
          alert_cooldown_days: number
          alert_max_window_days: number
          attach_rate_green: number
          attach_rate_yellow: number
          bcc_email: string | null
          company_name: string
          connection_green_days: number
          connection_yellow_days: number
          created_at: string
          cutabc_company_no: string | null
          cutabc_password: string | null
          cutabc_username: string | null
          disconnect_months: number
          id: string
          logo_url: string | null
          low_stock_days: number
          tenant_id: string | null
          tenant_name: string
          updated_at: string
        }
        Insert: {
          alert_cooldown_days?: number
          alert_max_window_days?: number
          attach_rate_green?: number
          attach_rate_yellow?: number
          bcc_email?: string | null
          company_name?: string
          connection_green_days?: number
          connection_yellow_days?: number
          created_at?: string
          cutabc_company_no?: string | null
          cutabc_password?: string | null
          cutabc_username?: string | null
          disconnect_months?: number
          id?: string
          logo_url?: string | null
          low_stock_days?: number
          tenant_id?: string | null
          tenant_name?: string
          updated_at?: string
        }
        Update: {
          alert_cooldown_days?: number
          alert_max_window_days?: number
          attach_rate_green?: number
          attach_rate_yellow?: number
          bcc_email?: string | null
          company_name?: string
          connection_green_days?: number
          connection_yellow_days?: number
          created_at?: string
          cutabc_company_no?: string | null
          cutabc_password?: string | null
          cutabc_username?: string | null
          disconnect_months?: number
          id?: string
          logo_url?: string | null
          low_stock_days?: number
          tenant_id?: string | null
          tenant_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      setup_new_tenant: {
        Args: {
          _bcc_email?: string
          _company_name: string
          _cutabc_company_no?: string
          _cutabc_password?: string
          _cutabc_username?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
