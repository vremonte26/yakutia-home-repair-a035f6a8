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
      complaints: {
        Row: {
          created_at: string
          from_user: string
          id: string
          reason: string
          task_id: string | null
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          reason: string
          task_id?: string | null
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          reason?: string
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
      messages: {
        Row: {
          created_at: string
          from_user: string
          id: string
          image_url: string | null
          task_id: string
          text: string | null
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          image_url?: string | null
          task_id: string
          text?: string | null
          to_user: string
        }
        Update: {
          created_at?: string
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
          categories: string[] | null
          created_at: string
          id: string
          is_active: boolean
          is_photo_moderated: boolean
          is_verified: boolean | null
          name: string
          phone: string | null
          photo: string | null
          rating: number | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          work_area: string | null
        }
        Insert: {
          about?: string | null
          categories?: string[] | null
          created_at?: string
          id: string
          is_active?: boolean
          is_photo_moderated?: boolean
          is_verified?: boolean | null
          name?: string
          phone?: string | null
          photo?: string | null
          rating?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          work_area?: string | null
        }
        Update: {
          about?: string | null
          categories?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_photo_moderated?: boolean
          is_verified?: boolean | null
          name?: string
          phone?: string | null
          photo?: string | null
          rating?: number | null
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
          message: string | null
          status: Database["public"]["Enums"]["response_status"]
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          master_id: string
          message?: string | null
          status?: Database["public"]["Enums"]["response_status"]
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          master_id?: string
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
          from_user: string
          id: string
          rating: number
          task_id: string | null
          to_user: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          from_user: string
          id?: string
          rating: number
          task_id?: string | null
          to_user: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          from_user?: string
          id?: string
          rating?: number
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
      tasks: {
        Row: {
          address: string | null
          category: string
          client_id: string
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          work_area: string | null
        }
        Insert: {
          address?: string | null
          category: string
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          work_area?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "client" | "master"
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
      app_role: ["client", "master"],
      response_status: ["pending", "accepted", "rejected"],
      task_status: ["open", "in_progress", "completed", "cancelled"],
    },
  },
} as const
