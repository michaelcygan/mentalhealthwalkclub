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
      ambient_tracks: {
        Row: {
          artist: string | null
          audio_path: string
          created_at: string
          duration_seconds: number
          id: string
          is_active: boolean
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          artist?: string | null
          audio_path: string
          created_at?: string
          duration_seconds?: number
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          artist?: string | null
          audio_path?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      audio_room_participants: {
        Row: {
          audio_room_id: string
          id: string
          is_muted: boolean
          joined_at: string
          left_at: string | null
          participant_role: string
          role: string
          status: string
          user_id: string
          walk_session_id: string
        }
        Insert: {
          audio_room_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          left_at?: string | null
          participant_role?: string
          role?: string
          status?: string
          user_id: string
          walk_session_id: string
        }
        Update: {
          audio_room_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          left_at?: string | null
          participant_role?: string
          role?: string
          status?: string
          user_id?: string
          walk_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_room_participants_audio_room_id_fkey"
            columns: ["audio_room_id"]
            isOneToOne: false
            referencedRelation: "audio_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_room_participants_walk_session_id_fkey"
            columns: ["walk_session_id"]
            isOneToOne: false
            referencedRelation: "walk_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_rooms: {
        Row: {
          allow_guest_listeners: boolean
          audience_count: number
          audience_mode: string
          created_at: string
          current_participant_count: number
          ends_at: string | null
          event_id: string | null
          external_room_name: string | null
          external_room_url: string | null
          facilitator_seat_reserved: boolean
          facilitator_user_id: string | null
          group_id: string | null
          host_user_id: string | null
          id: string
          is_locked: boolean
          lobby_capacity: number
          max_participants: number
          parent_room_id: string | null
          pod_index: number | null
          reactions_enabled: boolean
          requires_active_walk: boolean
          room_type: string
          scheduled_event_id: string | null
          share_code: string | null
          starts_at: string | null
          status: string
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_guest_listeners?: boolean
          audience_count?: number
          audience_mode?: string
          created_at?: string
          current_participant_count?: number
          ends_at?: string | null
          event_id?: string | null
          external_room_name?: string | null
          external_room_url?: string | null
          facilitator_seat_reserved?: boolean
          facilitator_user_id?: string | null
          group_id?: string | null
          host_user_id?: string | null
          id?: string
          is_locked?: boolean
          lobby_capacity?: number
          max_participants?: number
          parent_room_id?: string | null
          pod_index?: number | null
          reactions_enabled?: boolean
          requires_active_walk?: boolean
          room_type?: string
          scheduled_event_id?: string | null
          share_code?: string | null
          starts_at?: string | null
          status?: string
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_guest_listeners?: boolean
          audience_count?: number
          audience_mode?: string
          created_at?: string
          current_participant_count?: number
          ends_at?: string | null
          event_id?: string | null
          external_room_name?: string | null
          external_room_url?: string | null
          facilitator_seat_reserved?: boolean
          facilitator_user_id?: string | null
          group_id?: string | null
          host_user_id?: string | null
          id?: string
          is_locked?: boolean
          lobby_capacity?: number
          max_participants?: number
          parent_room_id?: string | null
          pod_index?: number | null
          reactions_enabled?: boolean
          requires_active_walk?: boolean
          room_type?: string
          scheduled_event_id?: string | null
          share_code?: string | null
          starts_at?: string | null
          status?: string
          theme?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_rooms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_rooms_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_rooms_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_definitions: {
        Row: {
          category: string | null
          created_at: string
          criteria: Json
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          key: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          environment: string
          event_type: string
          id: string
          metadata: Json
          source: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          environment?: string
          event_type: string
          id?: string
          metadata?: Json
          source?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          environment?: string
          event_type?: string
          id?: string
          metadata?: Json
          source?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_user_id_fkey"
            columns: ["blocker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          checked_in_at: string | null
          created_at: string
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          accessibility_notes: string | null
          address: string | null
          attendee_count: number
          audio_room_id: string | null
          breakout_rotate_minutes: number | null
          breakout_size: number
          capacity: number | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          donation_note: string | null
          donation_percent: number
          ended_at: string | null
          ends_at: string | null
          event_type: string
          group_id: string | null
          host_user_id: string | null
          id: string
          image_url: string | null
          is_seed: boolean
          last_pod_rotation_at: string | null
          lat: number | null
          lng: number | null
          location_label: string | null
          meeting_point: string | null
          practice_id: string | null
          price_cents: number
          region: string | null
          slug: string
          started_at: string | null
          starts_at: string
          state: string | null
          status: string
          timezone: string | null
          title: string
          updated_at: string
          venue_name: string | null
          vibe: string | null
          visibility: string
        }
        Insert: {
          accessibility_notes?: string | null
          address?: string | null
          attendee_count?: number
          audio_room_id?: string | null
          breakout_rotate_minutes?: number | null
          breakout_size?: number
          capacity?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          donation_note?: string | null
          donation_percent?: number
          ended_at?: string | null
          ends_at?: string | null
          event_type?: string
          group_id?: string | null
          host_user_id?: string | null
          id?: string
          image_url?: string | null
          is_seed?: boolean
          last_pod_rotation_at?: string | null
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          meeting_point?: string | null
          practice_id?: string | null
          price_cents?: number
          region?: string | null
          slug: string
          started_at?: string | null
          starts_at: string
          state?: string | null
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string
          venue_name?: string | null
          vibe?: string | null
          visibility?: string
        }
        Update: {
          accessibility_notes?: string | null
          address?: string | null
          attendee_count?: number
          audio_room_id?: string | null
          breakout_rotate_minutes?: number | null
          breakout_size?: number
          capacity?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          donation_note?: string | null
          donation_percent?: number
          ended_at?: string | null
          ends_at?: string | null
          event_type?: string
          group_id?: string | null
          host_user_id?: string | null
          id?: string
          image_url?: string | null
          is_seed?: boolean
          last_pod_rotation_at?: string | null
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          meeting_point?: string | null
          practice_id?: string | null
          price_cents?: number
          region?: string | null
          slug?: string
          started_at?: string | null
          starts_at?: string
          state?: string | null
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
          venue_name?: string | null
          vibe?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      facilitator_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bio: string | null
          created_at: string
          credentials: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          created_at?: string
          credentials?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          created_at?: string
          credentials?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      facilitator_sessions: {
        Row: {
          created_at: string
          current_audio_room_id: string | null
          ended_at: string | null
          facilitator_user_id: string
          id: string
          pods_visited: number
          started_at: string
          status: string
          total_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_audio_room_id?: string | null
          ended_at?: string | null
          facilitator_user_id: string
          id?: string
          pods_visited?: number
          started_at?: string
          status?: string
          total_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_audio_room_id?: string | null
          ended_at?: string | null
          facilitator_user_id?: string
          id?: string
          pods_visited?: number
          started_at?: string
          status?: string
          total_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      facilitator_visits: {
        Row: {
          audio_room_id: string
          created_at: string
          facilitator_session_id: string
          facilitator_user_id: string
          id: string
          joined_at: string
          left_at: string | null
          notes: string | null
          outcome: string | null
          planned_duration_seconds: number
        }
        Insert: {
          audio_room_id: string
          created_at?: string
          facilitator_session_id: string
          facilitator_user_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          notes?: string | null
          outcome?: string | null
          planned_duration_seconds?: number
        }
        Update: {
          audio_room_id?: string
          created_at?: string
          facilitator_session_id?: string
          facilitator_user_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          notes?: string | null
          outcome?: string | null
          planned_duration_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "facilitator_visits_facilitator_session_id_fkey"
            columns: ["facilitator_session_id"]
            isOneToOne: false
            referencedRelation: "facilitator_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ghost_host_assignments: {
        Row: {
          created_at: string
          group_id: string
          host_user_id: string
          id: string
          weight: number
        }
        Insert: {
          created_at?: string
          group_id: string
          host_user_id: string
          id?: string
          weight?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          host_user_id?: string
          id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ghost_host_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ghost_walk_config: {
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
      goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          is_active: boolean
          period: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          is_active?: boolean
          period?: string
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          is_active?: boolean
          period?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_signals: {
        Row: {
          badge_id: string | null
          created_at: string
          created_day: string | null
          group_id: string
          id: string
          kind: string
          read_at: string | null
          recipient_user_id: string
          sender_user_id: string
        }
        Insert: {
          badge_id?: string | null
          created_at?: string
          created_day?: string | null
          group_id: string
          id?: string
          kind: string
          read_at?: string | null
          recipient_user_id: string
          sender_user_id: string
        }
        Update: {
          badge_id?: string | null
          created_at?: string
          created_day?: string | null
          group_id?: string
          id?: string
          kind?: string
          read_at?: string | null
          recipient_user_id?: string
          sender_user_id?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          auto_join: boolean
          city: string | null
          country: string | null
          cover_credit: string | null
          cover_set: string | null
          created_at: string
          description: string | null
          ghost_cadence_override: number | null
          group_type: string | null
          id: string
          image_url: string | null
          is_active: boolean
          lat: number | null
          lng: number | null
          location_label: string | null
          member_count: number
          name: string
          owner_user_id: string | null
          practice_id: string | null
          region: string | null
          slug: string
          state: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          auto_join?: boolean
          city?: string | null
          country?: string | null
          cover_credit?: string | null
          cover_set?: string | null
          created_at?: string
          description?: string | null
          ghost_cadence_override?: number | null
          group_type?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          member_count?: number
          name: string
          owner_user_id?: string | null
          practice_id?: string | null
          region?: string | null
          slug: string
          state?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          auto_join?: boolean
          city?: string | null
          country?: string | null
          cover_credit?: string | null
          cover_set?: string | null
          created_at?: string
          description?: string | null
          ghost_cadence_override?: number | null
          group_type?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          member_count?: number
          name?: string
          owner_user_id?: string | null
          practice_id?: string | null
          region?: string | null
          slug?: string
          state?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_practice_fk"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_tracks: {
        Row: {
          audio_url: string | null
          category: string
          cover_url: string | null
          created_at: string
          duration_seconds: number
          generative_key: string | null
          host: string | null
          host_role: string | null
          id: string
          intro_seconds: number
          is_active: boolean
          mood_tags: string[]
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number
          generative_key?: string | null
          host?: string | null
          host_role?: string | null
          id?: string
          intro_seconds?: number
          is_active?: boolean
          mood_tags?: string[]
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number
          generative_key?: string | null
          host?: string | null
          host_role?: string | null
          id?: string
          intro_seconds?: number
          is_active?: boolean
          mood_tags?: string[]
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      impact_donations: {
        Row: {
          created_at: string
          donation_amount_cents: number
          donation_percent: number
          gross_revenue_cents: number
          id: string
          net_profit_cents: number
          notes: string | null
          organization_name: string | null
          organization_url: string | null
          period_end: string
          period_start: string
          published: boolean
        }
        Insert: {
          created_at?: string
          donation_amount_cents?: number
          donation_percent?: number
          gross_revenue_cents?: number
          id?: string
          net_profit_cents?: number
          notes?: string | null
          organization_name?: string | null
          organization_url?: string | null
          period_end: string
          period_start: string
          published?: boolean
        }
        Update: {
          created_at?: string
          donation_amount_cents?: number
          donation_percent?: number
          gross_revenue_cents?: number
          id?: string
          net_profit_cents?: number
          notes?: string | null
          organization_name?: string | null
          organization_url?: string | null
          period_end?: string
          period_start?: string
          published?: boolean
        }
        Relationships: []
      }
      practice_members: {
        Row: {
          created_at: string
          id: string
          practice_id: string
          role: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          practice_id: string
          role?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          practice_id?: string
          role?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_members_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practices: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          state: string | null
          subscription_status: string
          updated_at: string
          visibility: string
          website: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          state?: string | null
          subscription_status?: string
          updated_at?: string
          visibility?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          state?: string | null
          subscription_status?: string
          updated_at?: string
          visibility?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practices_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          id: string
          is_host_account: boolean
          is_private: boolean
          lat: number | null
          lng: number | null
          location_label: string | null
          region: string | null
          state: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_host_account?: boolean
          is_private?: boolean
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          region?: string | null
          state?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_host_account?: boolean
          is_private?: boolean
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          region?: string | null
          state?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      room_audience_presence: {
        Row: {
          audio_room_id: string
          guest_id: string | null
          id: string
          last_seen_at: string
          user_id: string | null
        }
        Insert: {
          audio_room_id: string
          guest_id?: string | null
          id?: string
          last_seen_at?: string
          user_id?: string | null
        }
        Update: {
          audio_room_id?: string
          guest_id?: string | null
          id?: string
          last_seen_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      room_reactions: {
        Row: {
          audio_room_id: string
          created_at: string
          guest_id: string | null
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          audio_room_id: string
          created_at?: string
          guest_id?: string | null
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          audio_room_id?: string
          created_at?: string
          guest_id?: string | null
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      safety_reports: {
        Row: {
          audio_room_id: string | null
          created_at: string
          details: string | null
          event_id: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_user_id: string
          status: string
          updated_at: string
          walk_session_id: string | null
        }
        Insert: {
          audio_room_id?: string | null
          created_at?: string
          details?: string | null
          event_id?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_user_id: string
          status?: string
          updated_at?: string
          walk_session_id?: string | null
        }
        Update: {
          audio_room_id?: string | null
          created_at?: string
          details?: string | null
          event_id?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_user_id?: string
          status?: string
          updated_at?: string
          walk_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_reports_audio_room_id_fkey"
            columns: ["audio_room_id"]
            isOneToOne: false
            referencedRelation: "audio_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_reports_walk_session_id_fkey"
            columns: ["walk_session_id"]
            isOneToOne: false
            referencedRelation: "walk_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          last_event_at: string | null
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          last_event_at?: string | null
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          last_event_at?: string | null
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          event_id: string | null
          id: string
          user_id: string
          walk_session_id: string | null
        }
        Insert: {
          badge_id: string
          earned_at?: string
          event_id?: string | null
          id?: string
          user_id: string
          walk_session_id?: string | null
        }
        Update: {
          badge_id?: string
          earned_at?: string
          event_id?: string | null
          id?: string
          user_id?: string
          walk_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_walk_session_id_fkey"
            columns: ["walk_session_id"]
            isOneToOne: false
            referencedRelation: "walk_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          allow_group_signals: boolean
          allow_location_features: boolean
          allow_mood_insights: boolean
          allow_step_import: boolean
          audio_comfort_level: string | null
          created_at: string
          id: string
          preferred_themes: string[] | null
          preferred_walk_modes: string[] | null
          stride_meters: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_group_signals?: boolean
          allow_location_features?: boolean
          allow_mood_insights?: boolean
          allow_step_import?: boolean
          audio_comfort_level?: string | null
          created_at?: string
          id?: string
          preferred_themes?: string[] | null
          preferred_walk_modes?: string[] | null
          stride_meters?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_group_signals?: boolean
          allow_location_features?: boolean
          allow_mood_insights?: boolean
          allow_step_import?: boolean
          audio_comfort_level?: string | null
          created_at?: string
          id?: string
          preferred_themes?: string[] | null
          preferred_walk_modes?: string[] | null
          stride_meters?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      walk_live_pings: {
        Row: {
          group_id: string | null
          heading: number | null
          id: string
          lat: number
          lng: number
          pinged_at: string
          user_id: string
          walk_session_id: string
        }
        Insert: {
          group_id?: string | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          pinged_at?: string
          user_id: string
          walk_session_id: string
        }
        Update: {
          group_id?: string | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          pinged_at?: string
          user_id?: string
          walk_session_id?: string
        }
        Relationships: []
      }
      walk_photos: {
        Row: {
          bytes: number | null
          caption: string | null
          created_at: string
          height: number | null
          id: string
          storage_path: string
          taken_at_seconds: number
          user_id: string
          walk_session_id: string
          width: number | null
        }
        Insert: {
          bytes?: number | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          storage_path: string
          taken_at_seconds?: number
          user_id: string
          walk_session_id: string
          width?: number | null
        }
        Update: {
          bytes?: number | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          storage_path?: string
          taken_at_seconds?: number
          user_id?: string
          walk_session_id?: string
          width?: number | null
        }
        Relationships: []
      }
      walk_routes: {
        Row: {
          created_at: string
          id: string
          points: Json
          updated_at: string
          user_id: string
          walk_session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: Json
          updated_at?: string
          user_id: string
          walk_session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: Json
          updated_at?: string
          user_id?: string
          walk_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "walk_routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_routes_walk_session_id_fkey"
            columns: ["walk_session_id"]
            isOneToOne: true
            referencedRelation: "walk_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      walk_sessions: {
        Row: {
          audio_room_id: string | null
          created_at: string
          distance_meters: number | null
          duration_seconds: number | null
          ended_at: string | null
          event_id: string | null
          group_id: string | null
          guided_track_id: string | null
          id: string
          intention: string | null
          mood_after: string | null
          mood_after_score: number | null
          mood_before: string | null
          mood_before_score: number | null
          privacy: string
          reflection_note: string | null
          route_snapshot_path: string | null
          share_map: boolean
          started_at: string
          status: string
          steps: number | null
          updated_at: string
          user_id: string
          walk_type: string
          weather_at_end: Json | null
        }
        Insert: {
          audio_room_id?: string | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          event_id?: string | null
          group_id?: string | null
          guided_track_id?: string | null
          id?: string
          intention?: string | null
          mood_after?: string | null
          mood_after_score?: number | null
          mood_before?: string | null
          mood_before_score?: number | null
          privacy?: string
          reflection_note?: string | null
          route_snapshot_path?: string | null
          share_map?: boolean
          started_at?: string
          status?: string
          steps?: number | null
          updated_at?: string
          user_id: string
          walk_type?: string
          weather_at_end?: Json | null
        }
        Update: {
          audio_room_id?: string | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          event_id?: string | null
          group_id?: string | null
          guided_track_id?: string | null
          id?: string
          intention?: string | null
          mood_after?: string | null
          mood_after_score?: number | null
          mood_before?: string | null
          mood_before_score?: number | null
          privacy?: string
          reflection_note?: string | null
          route_snapshot_path?: string | null
          share_map?: boolean
          started_at?: string
          status?: string
          steps?: number | null
          updated_at?: string
          user_id?: string
          walk_type?: string
          weather_at_end?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "walk_sessions_audio_room_id_fkey"
            columns: ["audio_room_id"]
            isOneToOne: false
            referencedRelation: "audio_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_sessions_guided_track_id_fkey"
            columns: ["guided_track_id"]
            isOneToOne: false
            referencedRelation: "guided_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      walk_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          length_minutes: number
          theme: string
          title_pattern: string
          vibe: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          length_minutes?: number
          theme: string
          title_pattern: string
          vibe?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          length_minutes?: number
          theme?: string
          title_pattern?: string
          vibe?: string | null
          weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      evaluate_badges: {
        Args: { _user_id: string; _walk_session_id: string }
        Returns: undefined
      }
      get_leaderboard: {
        Args: { _group_id?: string; _period?: string }
        Returns: {
          avatar_url: string
          badge_count: number
          city: string
          display_name: string
          rank: number
          total_minutes: number
          total_walks: number
          user_id: string
        }[]
      }
      get_my_rank: {
        Args: { _group_id?: string; _period?: string }
        Returns: {
          next_rank_minutes: number
          rank: number
          total_minutes: number
        }[]
      }
      group_pulse_week: {
        Args: never
        Returns: {
          group_id: string
          walkers_week: number
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "member" | "facilitator"
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
      app_role: ["admin", "moderator", "member", "facilitator"],
    },
  },
} as const
