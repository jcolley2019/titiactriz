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
      acting_credits: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: string
          order_index: number
          poster_url: string | null
          production: string | null
          role_en: string | null
          role_es: string | null
          title_en: string
          title_es: string
          updated_at: string
          url: string | null
          video_id: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          order_index?: number
          poster_url?: string | null
          production?: string | null
          role_en?: string | null
          role_es?: string | null
          title_en: string
          title_es: string
          updated_at?: string
          url?: string | null
          video_id?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          order_index?: number
          poster_url?: string | null
          production?: string | null
          role_en?: string | null
          role_es?: string | null
          title_en?: string
          title_es?: string
          updated_at?: string
          url?: string | null
          video_id?: string | null
          year?: number | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
          message: string | null
          name: string
          phone: string | null
          tiktok_handle: string | null
          type: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          message?: string | null
          name: string
          phone?: string | null
          tiktok_handle?: string | null
          type: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          tiktok_handle?: string | null
          type?: string
        }
        Relationships: []
      }
      dance_credits: {
        Row: {
          city: string | null
          created_at: string
          enabled: boolean
          id: string
          order_index: number
          poster_url: string | null
          title_en: string
          title_es: string
          updated_at: string
          url: string | null
          venue_en: string | null
          venue_es: string | null
          year: number | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          order_index?: number
          poster_url?: string | null
          title_en: string
          title_es: string
          updated_at?: string
          url?: string | null
          venue_en?: string | null
          venue_es?: string | null
          year?: number | null
        }
        Update: {
          city?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          order_index?: number
          poster_url?: string | null
          title_en?: string
          title_es?: string
          updated_at?: string
          url?: string | null
          venue_en?: string | null
          venue_es?: string | null
          year?: number | null
        }
        Relationships: []
      }
      gallery_photos: {
        Row: {
          alt_text: string | null
          content_hash: string | null
          created_at: string
          id: string
          image_url: string
          is_archived: boolean
          is_published: boolean
          sort_order: number
        }
        Insert: {
          alt_text?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_archived?: boolean
          is_published?: boolean
          sort_order?: number
        }
        Update: {
          alt_text?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_archived?: boolean
          is_published?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      social_links: {
        Row: {
          created_at: string
          enabled: boolean
          handle: string | null
          id: string
          og_description: string | null
          og_fetched_at: string | null
          og_image: string | null
          og_title: string | null
          order_index: number
          platform: string
          title_en: string | null
          title_es: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          handle?: string | null
          id?: string
          og_description?: string | null
          og_fetched_at?: string | null
          og_image?: string | null
          og_title?: string | null
          order_index?: number
          platform: string
          title_en?: string | null
          title_es?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          handle?: string | null
          id?: string
          og_description?: string | null
          og_fetched_at?: string | null
          og_image?: string | null
          og_title?: string | null
          order_index?: number
          platform?: string
          title_en?: string | null
          title_es?: string | null
          updated_at?: string
          url?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
