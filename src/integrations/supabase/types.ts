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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      availabilities: {
        Row: {
          created_at: string
          date: string
          id: string
          is_booked: boolean
          listing_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_booked?: boolean
          listing_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_booked?: boolean
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availabilities_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          created_at: string
          from_user: string
          id: string
          moderator_note: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          review_id: string | null
          status: string
          task_id: string | null
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          moderator_note?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string | null
          status?: string
          task_id?: string | null
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          moderator_note?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string | null
          status?: string
          task_id?: string | null
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          address: string
          contract_id: string
          created_at: string
          deadline: string | null
          id: string
          initiator: Database["public"]["Enums"]["contract_party"]
          initiator_user_id: string
          price: number | null
          subject: string
          version_number: number
        }
        Insert: {
          address?: string
          contract_id: string
          created_at?: string
          deadline?: string | null
          id?: string
          initiator: Database["public"]["Enums"]["contract_party"]
          initiator_user_id: string
          price?: number | null
          subject?: string
          version_number: number
        }
        Update: {
          address?: string
          contract_id?: string
          created_at?: string
          deadline?: string | null
          id?: string
          initiator?: Database["public"]["Enums"]["contract_party"]
          initiator_user_id?: string
          price?: number | null
          subject?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          address: string
          client_approved_version: number | null
          client_id: string
          created_at: string
          current_version: number
          deadline: string | null
          id: string
          last_initiator: Database["public"]["Enums"]["contract_party"] | null
          last_sent_at: string | null
          master_approved_version: number | null
          master_id: string
          price: number | null
          status: Database["public"]["Enums"]["contract_status"]
          subject: string
          task_id: string
          updated_at: string
        }
        Insert: {
          address?: string
          client_approved_version?: number | null
          client_id: string
          created_at?: string
          current_version?: number
          deadline?: string | null
          id?: string
          last_initiator?: Database["public"]["Enums"]["contract_party"] | null
          last_sent_at?: string | null
          master_approved_version?: number | null
          master_id: string
          price?: number | null
          status?: Database["public"]["Enums"]["contract_status"]
          subject?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          client_approved_version?: number | null
          client_id?: string
          created_at?: string
          current_version?: number
          deadline?: string | null
          id?: string
          last_initiator?: Database["public"]["Enums"]["contract_party"] | null
          last_sent_at?: string | null
          master_approved_version?: number | null
          master_id?: string
          price?: number | null
          status?: Database["public"]["Enums"]["contract_status"]
          subject?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          address: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          owner_id: string
          photos: string[]
          price_per_night: number | null
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          photos?: string[]
          price_per_night?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          photos?: string[]
          price_per_night?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      master_private_data: {
        Row: {
          created_at: string
          inn: string | null
          master_id: string
          passport_issued_by: string | null
          passport_issued_date: string | null
          passport_number: string | null
          passport_series: string | null
          registration_address: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          inn?: string | null
          master_id: string
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          passport_number?: string | null
          passport_series?: string | null
          registration_address?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          inn?: string | null
          master_id?: string
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          passport_number?: string | null
          passport_series?: string | null
          registration_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          from_name_snapshot: string | null
          from_photo_snapshot: string | null
          from_user: string
          id: string
          image_url: string | null
          task_id: string
          text: string | null
          to_user: string
        }
        Insert: {
          created_at?: string
          from_name_snapshot?: string | null
          from_photo_snapshot?: string | null
          from_user: string
          id?: string
          image_url?: string | null
          task_id: string
          text?: string | null
          to_user: string
        }
        Update: {
          created_at?: string
          from_name_snapshot?: string | null
          from_photo_snapshot?: string | null
          from_user?: string
          id?: string
          image_url?: string | null
          task_id?: string
          text?: string | null
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about: string | null
          active_role: Database["public"]["Enums"]["app_role"] | null
          blocked_until: string | null
          categories: string[] | null
          client_data: Json
          created_at: string
          id: string
          is_active: boolean
          is_photo_moderated: boolean
          is_verified: boolean | null
          lat: number | null
          lng: number | null
          master_data: Json
          master_pending_changes: Json | null
          name: string
          notification_prefs: Json
          phone: string | null
          photo: string | null
          rating: number | null
          rejection_reason: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          work_area: string | null
        }
        Insert: {
          about?: string | null
          active_role?: Database["public"]["Enums"]["app_role"] | null
          blocked_until?: string | null
          categories?: string[] | null
          client_data?: Json
          created_at?: string
          id: string
          is_active?: boolean
          is_photo_moderated?: boolean
          is_verified?: boolean | null
          lat?: number | null
          lng?: number | null
          master_data?: Json
          master_pending_changes?: Json | null
          name?: string
          notification_prefs?: Json
          phone?: string | null
          photo?: string | null
          rating?: number | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          work_area?: string | null
        }
        Update: {
          about?: string | null
          active_role?: Database["public"]["Enums"]["app_role"] | null
          blocked_until?: string | null
          categories?: string[] | null
          client_data?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_photo_moderated?: boolean
          is_verified?: boolean | null
          lat?: number | null
          lng?: number | null
          master_data?: Json
          master_pending_changes?: Json | null
          name?: string
          notification_prefs?: Json
          phone?: string | null
          photo?: string | null
          rating?: number | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          work_area?: string | null
        }
        Relationships: []
      }
      responses: {
        Row: {
          created_at: string
          id: string
          master_id: string
          master_name_snapshot: string | null
          master_photo_snapshot: string | null
          message: string | null
          status: Database["public"]["Enums"]["response_status"]
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          master_id: string
          master_name_snapshot?: string | null
          master_photo_snapshot?: string | null
          message?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          master_id?: string
          master_name_snapshot?: string | null
          master_photo_snapshot?: string | null
          message?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          from_name_snapshot: string | null
          from_photo_snapshot: string | null
          from_user: string
          hidden_reason: string | null
          id: string
          is_hidden: boolean
          parent_id: string | null
          rating: number | null
          task_id: string | null
          to_user: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          from_name_snapshot?: string | null
          from_photo_snapshot?: string | null
          from_user: string
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          parent_id?: string | null
          rating?: number | null
          task_id?: string | null
          to_user: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          from_name_snapshot?: string | null
          from_photo_snapshot?: string | null
          from_user?: string
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          parent_id?: string | null
          rating?: number | null
          task_id?: string | null
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_bookings: {
        Row: {
          created_at: string
          id: string
          passenger_id: string
          ride_id: string
          seats: number
        }
        Insert: {
          created_at?: string
          id?: string
          passenger_id: string
          ride_id: string
          seats?: number
        }
        Update: {
          created_at?: string
          id?: string
          passenger_id?: string
          ride_id?: string
          seats?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_bookings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          created_at: string
          departure_time: string
          driver_id: string
          id: string
          price: number | null
          route: Json
          seats_available: number
          seats_total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          departure_time: string
          driver_id: string
          id?: string
          price?: number | null
          route?: Json
          seats_available: number
          seats_total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          departure_time?: string
          driver_id?: string
          id?: string
          price?: number | null
          route?: Json
          seats_available?: number
          seats_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          address: string | null
          address_area: string | null
          address_full: string | null
          category: string
          client_id: string
          client_name_snapshot: string | null
          client_photo_snapshot: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          meta: Json
          order_status: Database["public"]["Enums"]["order_status"]
          order_type: Database["public"]["Enums"]["order_type"]
          phone: string | null
          photos: string[] | null
          price: number | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          work_area: string | null
        }
        Insert: {
          address?: string | null
          address_area?: string | null
          address_full?: string | null
          category: string
          client_id: string
          client_name_snapshot?: string | null
          client_photo_snapshot?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          meta?: Json
          order_status?: Database["public"]["Enums"]["order_status"]
          order_type?: Database["public"]["Enums"]["order_type"]
          phone?: string | null
          photos?: string[] | null
          price?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          work_area?: string | null
        }
        Update: {
          address?: string | null
          address_area?: string | null
          address_full?: string | null
          category?: string
          client_id?: string
          client_name_snapshot?: string | null
          client_photo_snapshot?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          meta?: Json
          order_status?: Database["public"]["Enums"]["order_status"]
          order_type?: Database["public"]["Enums"]["order_type"]
          phone?: string | null
          photos?: string[] | null
          price?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          work_area?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_master_changes: { Args: { _user_id: string }; Returns: undefined }
      create_master_profile: { Args: { _data: Json }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["admin_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_moderator: { Args: { _user_id: string }; Returns: boolean }
      notif_pref_enabled: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      reject_master_changes: {
        Args: { _reason?: string; _user_id: string }
        Returns: undefined
      }
      request_master_changes: { Args: { _data: Json }; Returns: undefined }
      snapshot_author: { Args: { _uid: string }; Returns: Json }
      switch_active_role: {
        Args: { _new_role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
      upsert_client_data: {
        Args: { _name: string; _phone: string; _photo: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_role: "admin" | "moderator"
      app_role: "client" | "master" | "moderator"
      contract_party: "client" | "master"
      contract_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "signed"
        | "cancelled"
      order_status:
        | "pending"
        | "paid"
        | "in_progress"
        | "completed"
        | "cancelled"
      order_type: "service" | "rent" | "ride" | "cargo"
      response_status: "pending" | "accepted" | "rejected"
      task_status: "open" | "in_progress" | "completed" | "cancelled"
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
      admin_role: ["admin", "moderator"],
      app_role: ["client", "master", "moderator"],
      contract_party: ["client", "master"],
      contract_status: [
        "draft",
        "pending_approval",
        "approved",
        "signed",
        "cancelled",
      ],
      order_status: [
        "pending",
        "paid",
        "in_progress",
        "completed",
        "cancelled",
      ],
      order_type: ["service", "rent", "ride", "cargo"],
      response_status: ["pending", "accepted", "rejected"],
      task_status: ["open", "in_progress", "completed", "cancelled"],
    },
  },
} as const
