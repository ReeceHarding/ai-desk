-- =========================================
-- 0. SCHEMA OWNERSHIP & PERMISSIONS
-- =========================================

ALTER SCHEMA public OWNER TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- =========================================
-- 1. ENABLE EXTENSIONS
-- =========================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================================
-- 2. CREATE ENUMS
-- =========================================

CREATE TYPE public.user_role AS ENUM (
  'customer',
  'agent',
  'admin',
  'super_admin'
);

CREATE TYPE public.ticket_status AS ENUM (
  'open',
  'pending',
  'on_hold',
  'solved',
  'closed',
  'overdue'
);

CREATE TYPE public.ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE public.sla_tier AS ENUM (
  'basic',
  'premium'
);

-- =========================================
-- 3. CREATE FUNCTIONS
-- =========================================

CREATE OR REPLACE FUNCTION public.fn_auto_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- First definition of is_super_admin (redefined below, but included here to preserve the script)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT org_id FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 4. CREATE BASE TABLES
-- =========================================

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sla_tier public.sla_tier NOT NULL DEFAULT 'basic',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_access_token text,
  gmail_refresh_token text,
  gmail_watch_expiration timestamp with time zone,
  gmail_history_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- Role can be member, admin, super_admin
  role text NOT NULL CHECK (role IN ('member', 'admin', 'super_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role public.user_role NOT NULL DEFAULT 'customer',
  display_name text,
  email text,
  phone text,
  avatar_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Separate step to add FK reference to auth.users
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users (id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  team_id uuid NOT NULL
    REFERENCES public.teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_in_team text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE public.tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  tag_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.knowledge_base_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  article_type text,
  author_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  flagged_internal boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  article_category text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.article_revisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL
    REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  content_snapshot text NOT NULL,
  revision_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.article_localizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL
    REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  locale text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, locale)
);

CREATE TABLE public.tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject text NOT NULL,
  description text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'low',
  customer_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  assigned_agent_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  escalation_level int NOT NULL DEFAULT 0,
  due_at timestamptz,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_escalation_level_nonnegative
    CHECK (escalation_level >= 0)
);

CREATE TABLE public.ticket_co_assignees (
  ticket_id uuid NOT NULL
    REFERENCES public.tickets (id) ON DELETE CASCADE,
  agent_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, agent_id)
);

CREATE TABLE public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL
    REFERENCES public.tickets (id) ON DELETE CASCADE,
  author_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  body text NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid
    REFERENCES public.comments (id) ON DELETE CASCADE,
  file_path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_watchers (
  ticket_id uuid NOT NULL
    REFERENCES public.tickets (id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  watch_level text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE TABLE public.article_watchers (
  article_id uuid NOT NULL
    REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  watch_level text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);

CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_name text,
  entity_id uuid,
  changes jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  snippet TEXT,
  subject TEXT,
  from_address TEXT,
  to_address TEXT,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  raw_content JSONB,
  labels TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_email_logs_update_timestamp
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE INDEX email_logs_ticket_idx ON public.email_logs (ticket_id);
CREATE INDEX email_logs_message_id_idx ON public.email_logs (message_id);
CREATE INDEX email_logs_thread_id_idx ON public.email_logs (thread_id);
CREATE INDEX email_logs_org_idx ON public.email_logs (org_id);

CREATE TABLE public.ticket_embeddings (
  ticket_id uuid PRIMARY KEY
    REFERENCES public.tickets (id) ON DELETE CASCADE,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comment_embeddings (
  comment_id uuid PRIMARY KEY
    REFERENCES public.comments (id) ON DELETE CASCADE,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type text NOT NULL,
  owner_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================
-- 5. CREATE TIMESTAMP-UPDATE TRIGGERS
-- =========================================

CREATE TRIGGER tr_organizations_update_timestamp
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_profiles_update_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_teams_update_timestamp
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_tags_update_timestamp
BEFORE UPDATE ON public.tags
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_kb_articles_update_timestamp
BEFORE UPDATE ON public.knowledge_base_articles
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_article_localizations_update_timestamp
BEFORE UPDATE ON public.article_localizations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_tickets_update_timestamp
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_comments_update_timestamp
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_ticket_embeddings_update_timestamp
BEFORE UPDATE ON public.ticket_embeddings
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_comment_embeddings_update_timestamp
BEFORE UPDATE ON public.comment_embeddings
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_reports_update_timestamp
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- =========================================
-- 6. DISABLE RLS ON ALL TABLES (DEVELOPMENT)
-- =========================================

ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_revisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_localizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_co_assignees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_watchers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_watchers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;

-- =========================================
-- 7. CREATE ADDITIONAL INDEXES
-- =========================================

CREATE INDEX profiles_org_idx ON public.profiles (org_id);
CREATE INDEX tickets_org_idx ON public.tickets (org_id);
CREATE INDEX comments_org_idx ON public.comments (org_id);
CREATE INDEX knowledge_base_articles_org_idx ON public.knowledge_base_articles (org_id);

CREATE INDEX tickets_subject_trgm_idx
  ON public.tickets
  USING GIN (subject gin_trgm_ops);

CREATE INDEX kb_articles_content_trgm_idx
  ON public.knowledge_base_articles
  USING GIN (content gin_trgm_ops);

CREATE INDEX ticket_embeddings_vector_idx
  ON public.ticket_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX comment_embeddings_vector_idx
  ON public.comment_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =========================================
-- ADD GMAIL TOKEN COLUMNS (ORGANIZATIONS)
-- =========================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_access_token text;

-- Disable RLS for testing
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- =========================================
-- DROP OLD ORGANIZATION POLICIES IF EXIST
-- =========================================

DROP POLICY IF EXISTS "Allow users to view organizations they are members of" ON organizations;
DROP POLICY IF EXISTS "Allow admins to update their organization" ON organizations;
DROP POLICY IF EXISTS "Allow admins to insert Gmail tokens" ON organizations;

-- =========================================
-- CREATE POLICIES FOR ORGANIZATIONS
-- =========================================

CREATE POLICY "Allow users to view organizations they are members of"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow admins to update their organization"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Allow admins to insert Gmail tokens"
  ON organizations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'super_admin')
    )
  );

-- =========================================
-- POLICIES FOR ORGANIZATION_MEMBERS (EARLIER VERSION)
-- =========================================

CREATE POLICY "Allow users to view organization members"
  ON organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow admins to manage organization members"
  ON organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'super_admin')
    )
  );

-- =========================================
-- ADD GMAIL TOKENS / WATCH EXPIRATION TO PROFILES
-- =========================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_access_token text,
  ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz;

-- =========================================
-- CREATE FUNCTION FOR NEW USER SIGNUP
-- =========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_org_id uuid;
  existing_profile_id uuid;
BEGIN
  -- Logging
  RAISE LOG '[PROFILE_CREATION] START - handle_new_user() called for:';
  RAISE LOG '[PROFILE_CREATION] User ID: %', NEW.id;
  RAISE LOG '[PROFILE_CREATION] Email: %', NEW.email;
  RAISE LOG '[PROFILE_CREATION] Role: %', NEW.role;
  
  SELECT id INTO existing_profile_id FROM public.profiles WHERE id = NEW.id;
  
  IF existing_profile_id IS NULL THEN
    RAISE LOG '[PROFILE_CREATION] No existing profile found for user_id: %', NEW.id;
  ELSE
    RAISE LOG '[PROFILE_CREATION] Found existing profile with id: %', existing_profile_id;
    RETURN NEW;
  END IF;
  
  IF existing_profile_id IS NULL THEN
    BEGIN
      -- Create/get default organization
      INSERT INTO public.organizations (name, sla_tier)
      VALUES ('Default Organization', 'basic')
      ON CONFLICT (name) DO UPDATE
        SET name = EXCLUDED.name
      RETURNING id INTO default_org_id;
      
      RAISE LOG '[PROFILE_CREATION] Using organization with ID: %', default_org_id;
      
      IF default_org_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create or get default organization';
      END IF;
      
      INSERT INTO public.profiles (
        id,
        email,
        org_id,
        role,
        display_name,
        avatar_url
      )
      VALUES (
        NEW.id,
        NEW.email,
        default_org_id,
        'customer'::public.user_role,
        split_part(NEW.email, '@', 1),
        'https://ucbtpddvvbsrqroqhvev.supabase.co/storage/v1/object/public/avatars/profile-circle-icon-256x256-cm91gqm2.png'
      );
      
      RAISE LOG '[PROFILE_CREATION] Successfully created profile for user_id: % with org_id: %', NEW.id, default_org_id;
      
      -- Also create the membership entry
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (default_org_id, NEW.id, 'admin');
      
      RAISE LOG '[PROFILE_CREATION] Successfully created organization member entry';
      
      RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[PROFILE_CREATION] Error in transaction:';
      RAISE LOG '[PROFILE_CREATION] Error State: %', SQLSTATE;
      RAISE LOG '[PROFILE_CREATION] Error Message: %', SQLERRM;
      RAISE;
    END;
  END IF;
  
  RAISE LOG '[PROFILE_CREATION] END - handle_new_user() completed successfully';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- STORAGE BUCKET & POLICIES FOR AVATARS
-- =========================================

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatar image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatar image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatar image" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'avatars';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  50000000, -- 50MB
  ARRAY['image/*']::text[]
);

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatar image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update avatar image"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete avatar image"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- =========================================
-- RE-DEFINE is_super_admin (DUPLICATE, KEPT FOR COMPLETENESS)
-- =========================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- ORGANIZATION INSERT POLICY (SUPER ADMINS OR BRAND-NEW USERS)
-- =========================================

DROP POLICY IF EXISTS insert_organizations ON public.organizations;

CREATE POLICY insert_organizations ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin()
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- =========================================
-- DROP OLD ORGANIZATION_MEMBERS POLICIES
-- =========================================

DROP POLICY IF EXISTS "Allow users to view organization members" ON organization_members;
DROP POLICY IF EXISTS "Allow admins to manage organization members" ON organization_members;

-- =========================================
-- CREATE SIMPLER POLICIES FOR ORGANIZATION_MEMBERS
-- (these override the ones we created earlier)
-- =========================================

CREATE POLICY "organization_members_select_policy"
ON organization_members FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "organization_members_insert_policy"
ON organization_members FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "organization_members_update_policy"
ON organization_members FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "organization_members_delete_policy"
ON organization_members FOR DELETE
TO authenticated
USING (true);

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- WARNING: This is a testing-only configuration
-- RLS is disabled on other tables but left enabled here

-- =========================================
-- CREATE ORGANIZATION_MEMBERS TABLE IF NOT EXISTS (REDUNDANT)
-- =========================================
-- This block won't overwrite the existing table or keys,
-- but is included verbatim to preserve the script's logic.

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('member', 'admin', 'super_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- Add update timestamp trigger
CREATE TRIGGER tr_organization_members_update_timestamp
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- =========================================
-- ADD GMAIL WATCH TRACKING COLUMNS
-- =========================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS gmail_watch_status text CHECK (gmail_watch_status IN ('active', 'expired', 'failed', 'pending'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS gmail_watch_status text CHECK (gmail_watch_status IN ('active', 'expired', 'failed', 'pending'));

CREATE INDEX IF NOT EXISTS idx_org_gmail_watch_expiration
  ON public.organizations(gmail_watch_expiration);

CREATE INDEX IF NOT EXISTS idx_profiles_gmail_watch_expiration
  ON public.profiles(gmail_watch_expiration);

-- =========================================
-- CREATE TICKET_EMAIL_CHATS (FIRST ATTEMPT)
-- =========================================
-- (You have an initial create, then a drop/recreate below.)

CREATE TABLE public.ticket_email_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  message_id text,
  thread_id text,
  from_address text,
  to_address text[],
  cc_address text[],
  bcc_address text[],
  subject text,
  body text,
  attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_date timestamptz,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_ticket_email_chats_update_timestamp
BEFORE UPDATE ON public.ticket_email_chats
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE INDEX ticket_email_chats_ticket_idx ON public.ticket_email_chats (ticket_id);
CREATE INDEX ticket_email_chats_message_idx ON public.ticket_email_chats (message_id);
CREATE INDEX ticket_email_chats_thread_idx ON public.ticket_email_chats (thread_id);
CREATE INDEX ticket_email_chats_org_idx ON public.ticket_email_chats (org_id);

-- =========================================
-- DROP / RECREATE TICKET_EMAIL_CHATS (FINAL)
-- =========================================

DROP TABLE IF EXISTS public.ticket_email_chats;

CREATE TABLE public.ticket_email_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL
    REFERENCES public.tickets (id) ON DELETE CASCADE,
  message_id text NOT NULL,
  thread_id text NOT NULL,
  from_address text NOT NULL,
  to_address text[] NOT NULL,
  cc_address text[] NOT NULL DEFAULT '{}',
  bcc_address text[] NOT NULL DEFAULT '{}',
  subject text,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_date timestamptz NOT NULL,
  org_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_email_chats_ticket_idx
  ON public.ticket_email_chats (ticket_id);

CREATE INDEX ticket_email_chats_message_idx
  ON public.ticket_email_chats (message_id);

CREATE INDEX ticket_email_chats_thread_idx
  ON public.ticket_email_chats (thread_id);

CREATE INDEX ticket_email_chats_org_idx
  ON public.ticket_email_chats (org_id);

CREATE TRIGGER tr_ticket_email_chats_update_timestamp
BEFORE UPDATE ON public.ticket_email_chats
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Create logs table for application logging
CREATE TABLE IF NOT EXISTS public.logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for faster querying by level and timestamp
CREATE INDEX IF NOT EXISTS logs_level_timestamp_idx ON public.logs (level, timestamp);

-- Grant access to service role
GRANT ALL ON public.logs TO service_role;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS logs_timestamp_idx ON public.logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS logs_level_idx ON public.logs (level);

-- Add RLS policies
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can do all on logs"
ON public.logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
