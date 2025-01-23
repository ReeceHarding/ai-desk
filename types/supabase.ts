export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organization_members: {
        Row: {
          organization_id: string
          user_id: string
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          user_id: string
          role: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          organization_id?: string
          user_id?: string
          role?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      article_localizations: {
        Row: {
          article_id: string
          content: string
          created_at: string
          id: string
          locale: string
          metadata: Json
          title: string
          updated_at: string
        }
        Insert: {
          article_id: string
          content: string
          created_at?: string
          id?: string
          locale: string
          metadata?: Json
          title: string
          updated_at?: string
        }
        Update: {
          article_id?: string
          content?: string
          created_at?: string
          id?: string
          locale?: string
          metadata?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_localizations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_articles"
            referencedColumns: ["id"]
          }
        ]
      }
      article_revisions: {
        Row: {
          article_id: string
          content_snapshot: string
          created_at: string
          id: string
          revision_metadata: Json
        }
        Insert: {
          article_id: string
          content_snapshot: string
          created_at?: string
          id?: string
          revision_metadata?: Json
        }
        Update: {
          article_id?: string
          content_snapshot?: string
          created_at?: string
          id?: string
          revision_metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "article_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_articles"
            referencedColumns: ["id"]
          }
        ]
      }
      article_watchers: {
        Row: {
          article_id: string
          created_at: string
          metadata: Json
          user_id: string
          watch_level: string | null
        }
        Insert: {
          article_id: string
          created_at?: string
          metadata?: Json
          user_id: string
          watch_level?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string
          metadata?: Json
          user_id?: string
          watch_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_watchers_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      attachments: {
        Row: {
          comment_id: string | null
          created_at: string
          file_path: string
          id: string
          metadata: Json
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          file_path: string
          id?: string
          metadata?: Json
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          file_path?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_name: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      comment_embeddings: {
        Row: {
          comment_id: string
          created_at: string
          embedding: string | null
          metadata: Json
          updated_at: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          embedding?: string | null
          metadata?: Json
          updated_at?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          embedding?: string | null
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_embeddings_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: true
            referencedRelation: "comments"
            referencedColumns: ["id"]
          }
        ]
      }
      comments: {
        Row: {
          id: string
          ticket_id: string
          author_id: string
          body: string
          is_private: boolean
          metadata: Json
          extra_text_1: string | null
          extra_json_1: Json
          org_id: string
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          author_id: string
          body: string
          is_private?: boolean
          metadata?: Json
          extra_text_1?: string | null
          extra_json_1?: Json
          org_id: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          author_id?: string
          body?: string
          is_private?: boolean
          metadata?: Json
          extra_text_1?: string | null
          extra_json_1?: Json
          org_id?: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          }
        ]
      }
      knowledge_base_articles: {
        Row: {
          article_category: string | null
          article_type: string | null
          author_id: string | null
          content: string
          created_at: string
          deleted_at: string | null
          extra_json_1: Json
          extra_text_1: string | null
          flagged_internal: boolean
          id: string
          metadata: Json
          org_id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          article_category?: string | null
          article_type?: string | null
          author_id?: string | null
          content: string
          created_at?: string
          deleted_at?: string | null
          extra_json_1?: Json
          extra_text_1?: string | null
          flagged_internal?: boolean
          id?: string
          metadata?: Json
          org_id: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          article_category?: string | null
          article_type?: string | null
          author_id?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          extra_json_1?: Json
          extra_text_1?: string | null
          flagged_internal?: boolean
          id?: string
          metadata?: Json
          org_id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_articles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      organizations: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          sla_tier: 'basic' | 'premium'
          updated_at: string
          gmail_refresh_token: string | null
          gmail_access_token: string | null
          gmail_watch_expiration: string | null
          gmail_watch_resource_id: string | null
          gmail_watch_status: 'active' | 'expired' | 'failed' | 'pending' | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          sla_tier?: 'basic' | 'premium'
          updated_at?: string
          gmail_refresh_token?: string | null
          gmail_access_token?: string | null
          gmail_watch_expiration?: string | null
          gmail_watch_resource_id?: string | null
          gmail_watch_status?: 'active' | 'expired' | 'failed' | 'pending' | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          sla_tier?: 'basic' | 'premium'
          updated_at?: string
          gmail_refresh_token?: string | null
          gmail_access_token?: string | null
          gmail_watch_expiration?: string | null
          gmail_watch_resource_id?: string | null
          gmail_watch_status?: 'active' | 'expired' | 'failed' | 'pending' | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: 'customer' | 'agent' | 'admin' | 'super_admin'
          display_name: string | null
          email: string | null
          phone: string | null
          avatar_url: string | null
          metadata: Json
          extra_text_1: string | null
          extra_json_1: Json
          org_id: string
          created_at: string
          updated_at: string
          gmail_refresh_token: string | null
          gmail_access_token: string | null
          gmail_watch_expiration: string | null
          gmail_watch_resource_id: string | null
          gmail_watch_status: 'active' | 'expired' | 'failed' | 'pending' | null
        }
        Insert: {
          id: string
          role?: 'customer' | 'agent' | 'admin' | 'super_admin'
          display_name?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          metadata?: Json
          extra_text_1?: string | null
          extra_json_1?: Json
          org_id: string
          created_at?: string
          updated_at?: string
          gmail_refresh_token?: string | null
          gmail_access_token?: string | null
          gmail_watch_expiration?: string | null
          gmail_watch_resource_id?: string | null
          gmail_watch_status?: 'active' | 'expired' | 'failed' | 'pending' | null
        }
        Update: {
          id?: string
          role?: 'customer' | 'agent' | 'admin' | 'super_admin'
          display_name?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          metadata?: Json
          extra_text_1?: string | null
          extra_json_1?: Json
          org_id?: string
          created_at?: string
          updated_at?: string
          gmail_refresh_token?: string | null
          gmail_access_token?: string | null
          gmail_watch_expiration?: string | null
          gmail_watch_resource_id?: string | null
          gmail_watch_status?: 'active' | 'expired' | 'failed' | 'pending' | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      tickets: {
        Row: {
          id: string
          subject: string
          description: string
          status: 'open' | 'pending' | 'on_hold' | 'solved' | 'closed' | 'overdue'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          customer_id: string
          assigned_agent_id: string | null
          escalation_level: number
          due_at: string | null
          custom_fields: Json
          metadata: Json
          extra_text_1: string | null
          extra_json_1: Json
          org_id: string
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subject: string
          description: string
          status?: 'open' | 'pending' | 'on_hold' | 'solved' | 'closed' | 'overdue'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          customer_id: string
          assigned_agent_id?: string | null
          escalation_level?: number
          due_at?: string | null
          custom_fields?: Json
          metadata?: Json
          extra_text_1?: string | null
          extra_json_1?: Json
          org_id: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subject?: string
          description?: string
          status?: 'open' | 'pending' | 'on_hold' | 'solved' | 'closed' | 'overdue'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          customer_id?: string
          assigned_agent_id?: string | null
          escalation_level?: number
          due_at?: string | null
          custom_fields?: Json
          metadata?: Json
          extra_text_1?: string | null
          extra_json_1?: Json
          org_id?: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      ticket_watchers: {
        Row: {
          created_at: string
          metadata: Json
          ticket_id: string
          user_id: string
          watch_level: string | null
        }
        Insert: {
          created_at?: string
          metadata?: Json
          ticket_id: string
          user_id: string
          watch_level?: string | null
        }
        Update: {
          created_at?: string
          metadata?: Json
          ticket_id?: string
          user_id?: string
          watch_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      ticket_email_chats: {
        Row: {
          id: string
          ticket_id: string
          message_id: string
          thread_id: string
          from_address: string
          to_address: string[]
          cc_address: string[]
          bcc_address: string[]
          subject: string | null
          body: string
          attachments: Json
          gmail_date: string
          org_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          message_id: string
          thread_id: string
          from_address: string
          to_address: string[]
          cc_address?: string[]
          bcc_address?: string[]
          subject?: string | null
          body: string
          attachments?: Json
          gmail_date: string
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          message_id?: string
          thread_id?: string
          from_address?: string
          to_address?: string[]
          cc_address?: string[]
          bcc_address?: string[]
          subject?: string | null
          body?: string
          attachments?: Json
          gmail_date?: string
          org_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_email_chats_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_email_chats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      user_role: 'customer' | 'agent' | 'admin' | 'super_admin'
      ticket_status: 'open' | 'pending' | 'on_hold' | 'solved' | 'closed' | 'overdue'
      ticket_priority: 'low' | 'medium' | 'high' | 'urgent'
      sla_tier: 'basic' | 'premium'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

