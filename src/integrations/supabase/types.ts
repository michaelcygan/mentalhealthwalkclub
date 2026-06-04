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
          bpm: number | null
          cover_path: string | null
          created_at: string
          duration_seconds: number
          genre: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          mood_tags: string[]
          sort_order: number
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          artist?: string | null
          audio_path: string
          bpm?: number | null
          cover_path?: string | null
          created_at?: string
          duration_seconds?: number
          genre?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          mood_tags?: string[]
          sort_order?: number
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          artist?: string | null
          audio_path?: string
          bpm?: number | null
          cover_path?: string | null
          created_at?: string
          duration_seconds?: number
          genre?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          mood_tags?: string[]
          sort_order?: number
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          sent_at: string | null
          title: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          sent_at?: string | null
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sent_at?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
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
      circle_members: {
        Row: {
          circle_id: string
          id: string
          joined_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          joined_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          joined_at?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_blocklist: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_blocklist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_blocklist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_circle_allowlist: {
        Row: {
          circle_id: string
          created_at: string
          event_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          event_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_circle_allowlist_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_circle_allowlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          bytes: number | null
          caption: string | null
          created_at: string
          event_id: string
          height: number | null
          id: string
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          bytes?: number | null
          caption?: string | null
          created_at?: string
          event_id: string
          height?: number | null
          id?: string
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          bytes?: number | null
          caption?: string | null
          created_at?: string
          event_id?: string
          height?: number | null
          id?: string
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          audience_mode: string
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
          audience_mode?: string
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
          audience_mode?: string
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
            foreignKeyName: "events_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          requested_by: string
          status: string
          updated_at: string
          user_high: string
          user_low: string
        }
        Insert: {
          created_at?: string
          id?: string
          requested_by: string
          status?: string
          updated_at?: string
          user_high: string
          user_low: string
        }
        Update: {
          created_at?: string
          id?: string
          requested_by?: string
          status?: string
          updated_at?: string
          user_high?: string
          user_low?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_high_fkey"
            columns: ["user_high"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_low_fkey"
            columns: ["user_low"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          joined_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          group_id?: string
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
        ]
      }
      group_standing_walks: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          duration_minutes: number
          group_id: string
          id: string
          meetup_label: string | null
          meetup_lat: number | null
          meetup_lng: number | null
          start_local_time: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          duration_minutes?: number
          group_id: string
          id?: string
          meetup_label?: string | null
          meetup_lat?: number | null
          meetup_lng?: number | null
          start_local_time: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          duration_minutes?: number
          group_id?: string
          id?: string
          meetup_label?: string | null
          meetup_lat?: number | null
          meetup_lng?: number | null
          start_local_time?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_standing_walks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          age_band_min: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          neighborhood: string | null
          owner_id: string
          radius_miles: number | null
          scope: string
          slug: string
          status: string
          trust_locked_until: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          age_band_min?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          neighborhood?: string | null
          owner_id: string
          radius_miles?: number | null
          scope?: string
          slug: string
          status?: string
          trust_locked_until?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          age_band_min?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          neighborhood?: string | null
          owner_id?: string
          radius_miles?: number | null
          scope?: string
          slug?: string
          status?: string
          trust_locked_until?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: []
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
      merch_orders: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          environment: string
          id: string
          product_id: string | null
          quantity: number
          shipping_address: Json | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          product_id?: string | null
          quantity?: number
          shipping_address?: Json | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          product_id?: string | null
          quantity?: number
          shipping_address?: Json | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merch_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merch_products"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_products: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          inventory: number | null
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          inventory?: number | null
          is_active?: boolean
          name: string
          price_cents: number
          slug: string
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          inventory?: number | null
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          playlist_id: string
          position?: number
          track_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          mood: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          mood?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          mood?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          audio_url: string
          created_at: string
          description: string | null
          duration_seconds: number
          episode_url: string | null
          feed_id: string
          guid: string
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          mood_tags: string[]
          published_at: string | null
          title: string
          updated_at: string
          walk_fit_score: number
        }
        Insert: {
          audio_url: string
          created_at?: string
          description?: string | null
          duration_seconds?: number
          episode_url?: string | null
          feed_id: string
          guid: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          mood_tags?: string[]
          published_at?: string | null
          title: string
          updated_at?: string
          walk_fit_score?: number
        }
        Update: {
          audio_url?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number
          episode_url?: string | null
          feed_id?: string
          guid?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          mood_tags?: string[]
          published_at?: string | null
          title?: string
          updated_at?: string
          walk_fit_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "podcast_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_feeds: {
        Row: {
          category: string
          created_at: string
          credibility: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          last_sync_error: string | null
          last_synced_at: string | null
          publisher: string | null
          rss_url: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          credibility?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          publisher?: string | null
          rss_url: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          credibility?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          publisher?: string | null
          rss_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_band: string | null
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
          onboarded_at: string | null
          region: string | null
          state: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          age_band?: string | null
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
          onboarded_at?: string | null
          region?: string | null
          state?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          age_band?: string | null
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
          onboarded_at?: string | null
          region?: string | null
          state?: string | null
          updated_at?: string
          username?: string | null
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
          gateway: string
          id: string
          last_event_at: string | null
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          gateway?: string
          id?: string
          last_event_at?: string | null
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          gateway?: string
          id?: string
          last_event_at?: string | null
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trail_search_log: {
        Row: {
          cell_key: string
          last_synced_at: string
        }
        Insert: {
          cell_key: string
          last_synced_at?: string
        }
        Update: {
          cell_key?: string
          last_synced_at?: string
        }
        Relationships: []
      }
      trails: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          kind: string | null
          last_synced_at: string
          lat: number
          length_m: number | null
          lng: number
          name: string | null
          osm_id: string | null
          region: string | null
          source: string
          tags: Json
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          last_synced_at?: string
          lat: number
          length_m?: number | null
          lng: number
          name?: string | null
          osm_id?: string | null
          region?: string | null
          source?: string
          tags?: Json
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          last_synced_at?: string
          lat?: number
          length_m?: number | null
          lng?: number
          name?: string | null
          osm_id?: string | null
          region?: string | null
          source?: string
          tags?: Json
          updated_at?: string
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
      user_dob: {
        Row: {
          created_at: string
          dob: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dob: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dob?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_saved_trails: {
        Row: {
          created_at: string
          id: string
          note: string | null
          position: number
          trail_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          position?: number
          trail_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          position?: number
          trail_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_trails_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
        ]
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
      walk_sessions: {
        Row: {
          created_at: string
          distance_meters: number | null
          duration_seconds: number | null
          ended_at: string | null
          event_id: string | null
          guided_track_id: string | null
          id: string
          intention: string | null
          mood_after: string | null
          mood_after_score: number | null
          mood_before: string | null
          mood_before_score: number | null
          podcast_episode_id: string | null
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
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          event_id?: string | null
          guided_track_id?: string | null
          id?: string
          intention?: string | null
          mood_after?: string | null
          mood_after_score?: number | null
          mood_before?: string | null
          mood_before_score?: number | null
          podcast_episode_id?: string | null
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
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          event_id?: string | null
          guided_track_id?: string | null
          id?: string
          intention?: string | null
          mood_after?: string | null
          mood_after_score?: number | null
          mood_before?: string | null
          mood_before_score?: number | null
          podcast_episode_id?: string | null
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
            foreignKeyName: "walk_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
            foreignKeyName: "walk_sessions_podcast_episode_id_fkey"
            columns: ["podcast_episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      age_band_for: { Args: { _dob: string }; Returns: string }
      age_band_meets: {
        Args: { _min_band: string; _user_band: string }
        Returns: boolean
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      evaluate_badges: {
        Args: { _user_id: string; _walk_session_id: string }
        Returns: undefined
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
      host_trust_ok: { Args: { _user: string }; Returns: boolean }
      is_circle_member: {
        Args: { _circle: string; _user: string }
        Returns: boolean
      }
      is_circle_owner: {
        Args: { _circle: string; _user: string }
        Returns: boolean
      }
      is_event_host: {
        Args: { _event: string; _user: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      set_my_dob: { Args: { _dob: string }; Returns: string }
      user_in_event_allowlist: {
        Args: { _event: string; _user: string }
        Returns: boolean
      }
      user_in_event_blocklist: {
        Args: { _event: string; _user: string }
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
