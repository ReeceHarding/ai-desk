--------------------------------------------------------------------------------
-- 0. DROP ENUMS (Clean Slate)
--------------------------------------------------------------------------------

DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.ticket_status CASCADE;
DROP TYPE IF EXISTS public.ticket_priority CASCADE;
DROP TYPE IF EXISTS public.sla_tier CASCADE;

--------------------------------------------------------------------------------
-- 1. SCHEMA OWNERSHIP & PERMISSIONS
--------------------------------------------------------------------------------

ALTER SCHEMA public OWNER TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

--------------------------------------------------------------------------------
-- 2. ENABLE EXTENSIONS
--------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 3. CREATE ENUMS
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- 4. CREATE BASE FUNCTION fn_auto_update_timestamp()
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_auto_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 5. CREATE/ENSURE LOGS TABLE + INDEXES
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logs_level_timestamp_idx ON public.logs (level, timestamp);
CREATE INDEX IF NOT EXISTS logs_timestamp_idx ON public.logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS logs_level_idx ON public.logs (level);

-- Grant to service_role
GRANT ALL ON public.logs TO service_role;

-- Enable RLS + policy for service_role
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy before creating it to avoid duplication errors
DROP POLICY IF EXISTS "Service role can do all on logs" ON public.logs;

CREATE POLICY "Service role can do all on logs"
ON public.logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

--------------------------------------------------------------------------------
-- 6. CREATE FUNCTION + TRIGGER FOR NEW USER SIGNUP (AUTO-ORG)
--------------------------------------------------------------------------------

-- Drop any existing trigger/function on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
  v_existing_org_id uuid;
  v_attempt int := 0;
BEGIN
  -- Logging example
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Starting new user signup process',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'metadata', NEW.raw_user_meta_data
    )
  );

  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.logs (level, message, metadata)
    VALUES (
      'info',
      'User already has a profile, skipping',
      jsonb_build_object('user_id', NEW.id)
    );
    RETURN NEW;
  END IF;

  -- Check if user already has an organization membership
  SELECT organization_id INTO v_existing_org_id
  FROM public.organization_members
  WHERE user_id = NEW.id
  LIMIT 1;

  IF v_existing_org_id IS NOT NULL THEN
    INSERT INTO public.logs (level, message, metadata)
    VALUES (
      'info',
      'User already has organization membership',
      jsonb_build_object('user_id', NEW.id, 'org_id', v_existing_org_id)
    );

    -- Create profile with existing org
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
      v_existing_org_id,
      'customer'::public.user_role,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'https://placehold.co/400x400/png?text=👤'
    );

    RETURN NEW;
  END IF;

  -- Create personal organization name with uniqueness retry
  LOOP
    v_org_name := CASE 
      WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN 
        CASE 
          WHEN v_attempt = 0 THEN (NEW.raw_user_meta_data->>'full_name') || '''s Organization'
          ELSE (NEW.raw_user_meta_data->>'full_name') || '''s Organization ' || v_attempt
        END
      ELSE 
        'Personal Organization ' || substring(NEW.id::text, 1, 8) ||
        CASE WHEN v_attempt = 0 THEN '' ELSE ' ' || v_attempt END
    END;

    BEGIN
      INSERT INTO public.organizations (
        name,
        sla_tier,
        config
      )
      VALUES (
        v_org_name,
        'basic'::public.sla_tier,
        jsonb_build_object(
          'is_personal', true,
          'created_at_timestamp', now(),
          'created_by', NEW.id,
          'created_by_email', NEW.email
        )
      )
      RETURNING id INTO v_org_id;

      EXIT; -- break if insert succeeded
    EXCEPTION
      WHEN unique_violation THEN
        v_attempt := v_attempt + 1;
        IF v_attempt > 5 THEN
          RAISE EXCEPTION 'Failed to create unique organization name after 5 attempts';
        END IF;
        -- loop again
    END;
  END LOOP;

  -- Create profile
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
    v_org_id,
    'customer'::public.user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'https://placehold.co/400x400/png?text=👤'
  );

  -- Create organization_members row
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role
  )
  VALUES (
    v_org_id,
    NEW.id,
    'admin'
  );

  -- Log success
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Successfully completed new user signup process',
    jsonb_build_object(
      'user_id', NEW.id,
      'org_id', v_org_id,
      'org_name', v_org_name
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

--------------------------------------------------------------------------------
-- 7. CREATE BASE TABLES
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sla_tier public.sla_tier NOT NULL DEFAULT 'basic',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_access_token text,
  gmail_refresh_token text,
  gmail_watch_expiration timestamp with time zone,
  gmail_history_id text,
  gmail_watch_resource_id text,
  gmail_watch_status text CHECK (gmail_watch_status IN ('active', 'expired', 'failed', 'pending')),
  gmail_token_expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('member', 'admin', 'super_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  role public.user_role NOT NULL DEFAULT 'customer',
  display_name text,
  email text,
  phone text,
  avatar_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  -- Optional Gmail token columns, watch columns, etc.
  gmail_refresh_token text,
  gmail_access_token text,
  gmail_watch_expiration timestamptz,
  gmail_watch_resource_id text,
  gmail_watch_status text CHECK (gmail_watch_status IN ('active', 'expired', 'failed', 'pending')),
  gmail_token_expiry timestamptz,
  -- Optional new columns
  agent_rank int,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link profiles.id to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey 
      FOREIGN KEY (id) 
      REFERENCES auth.users (id) 
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_in_team text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  tag_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  article_type text,
  author_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  flagged_internal boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  article_category text,
  deleted_at timestamptz,
  pinned boolean DEFAULT false,
  rating numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.article_revisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  content_snapshot text NOT NULL,
  revision_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.article_localizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  locale text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, locale)
);

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject text NOT NULL,
  description text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'low',
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  assigned_agent_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  escalation_level int NOT NULL DEFAULT 0,
  due_at timestamptz,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_escalation_level_nonnegative CHECK (escalation_level >= 0),
  -- Additional columns
  next_followup_at timestamptz,
  feedback_score numeric
);

CREATE TABLE IF NOT EXISTS public.ticket_co_assignees (
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, agent_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  body text NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid REFERENCES public.comments (id) ON DELETE CASCADE,
  file_path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_watchers (
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  watch_level text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.article_watchers (
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  watch_level text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_name text,
  entity_id uuid,
  changes jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  thread_id text NOT NULL,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  timestamp timestamptz DEFAULT now(),
  snippet text,
  subject text,
  from_address text,
  to_address text,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  raw_content jsonb,
  labels text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Additional AI columns
  ai_classification text,
  ai_confidence numeric,
  auto_replied boolean DEFAULT false
);

-- Ensure email_logs update trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_email_logs_update_timestamp'
    AND tgrelid = 'public.email_logs'::regclass
  ) THEN
    CREATE TRIGGER tr_email_logs_update_timestamp
      BEFORE UPDATE ON public.email_logs
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS email_logs_ticket_idx ON public.email_logs (ticket_id);
CREATE INDEX IF NOT EXISTS email_logs_message_id_idx ON public.email_logs (message_id);
CREATE INDEX IF NOT EXISTS email_logs_thread_id_idx ON public.email_logs (thread_id);
CREATE INDEX IF NOT EXISTS email_logs_org_idx ON public.email_logs (org_id);

CREATE TABLE IF NOT EXISTS public.ticket_embeddings (
  ticket_id uuid PRIMARY KEY REFERENCES public.tickets (id) ON DELETE CASCADE,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comment_embeddings (
  comment_id uuid PRIMARY KEY REFERENCES public.comments (id) ON DELETE CASCADE,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type text NOT NULL,
  owner_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 7B. RAG KNOWLEDGE BASE TABLES
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_path text,
  source_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_knowledge_docs_update_timestamp'
    AND tgrelid = 'public.knowledge_docs'::regclass
  ) THEN
    CREATE TRIGGER tr_knowledge_docs_update_timestamp
      BEFORE UPDATE ON public.knowledge_docs
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.knowledge_doc_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id uuid NOT NULL REFERENCES public.knowledge_docs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_content text NOT NULL,
  embedding vector(1536),
  token_length integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_knowledge_doc_chunks_update_timestamp'
    AND tgrelid = 'public.knowledge_doc_chunks'::regclass
  ) THEN
    CREATE TRIGGER tr_knowledge_doc_chunks_update_timestamp
      BEFORE UPDATE ON public.knowledge_doc_chunks
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_knowledge_doc_chunks_doc_id
  ON public.knowledge_doc_chunks(doc_id);

CREATE INDEX IF NOT EXISTS knowledge_doc_chunks_embedding_vector_idx
  ON public.knowledge_doc_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

--------------------------------------------------------------------------------
-- 8. DISABLE RLS ON ALL PUBLIC TABLES (FOR DEV)
--------------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY;';
  END LOOP;
END
$$;

--------------------------------------------------------------------------------
-- 9. CREATE ADDITIONAL INDEXES (IDEMPOTENT)
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS profiles_org_idx ON public.profiles (org_id);
CREATE INDEX IF NOT EXISTS tickets_org_idx ON public.tickets (org_id);
CREATE INDEX IF NOT EXISTS comments_org_idx ON public.comments (org_id);
CREATE INDEX IF NOT EXISTS knowledge_base_articles_org_idx ON public.knowledge_base_articles (org_id);

CREATE INDEX IF NOT EXISTS tickets_subject_trgm_idx
  ON public.tickets
  USING GIN (subject gin_trgm_ops);

CREATE INDEX IF NOT EXISTS kb_articles_content_trgm_idx
  ON public.knowledge_base_articles
  USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ticket_embeddings_vector_idx
  ON public.ticket_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS comment_embeddings_vector_idx
  ON public.comment_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

--------------------------------------------------------------------------------
-- 10. STORAGE BUCKET & POLICIES FOR AVATARS
--------------------------------------------------------------------------------

-- Insert bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'avatars', 'avatars', true, 50000000, ARRAY['image/*']::text[]
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'avatars'
);

-- Drop existing policies before creating new ones to avoid duplication
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatar image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatar image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatar image" ON storage.objects;

-- Create new policies
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
)
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete avatar image"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

--------------------------------------------------------------------------------
-- 11. RE-DEFINE is_super_admin FUNCTION
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- 12. ORGANIZATION INSERT POLICY (SUPER ADMINS OR BRAND-NEW USERS)
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS insert_organizations ON public.organizations;

CREATE POLICY insert_organizations
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

--------------------------------------------------------------------------------
-- 13. ADD GMAIL WATCH TRACKING COLUMNS (SAFE, IF NOT EXISTS)
--------------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS gmail_watch_status text CHECK (gmail_watch_status IN ('active', 'expired', 'failed', 'pending')),
  ADD COLUMN IF NOT EXISTS gmail_token_expiry timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS gmail_watch_status text CHECK (gmail_watch_status IN ('active', 'expired', 'failed', 'pending')),
  ADD COLUMN IF NOT EXISTS gmail_token_expiry timestamptz;

CREATE INDEX IF NOT EXISTS idx_org_gmail_watch_expiration
  ON public.organizations(gmail_watch_expiration);

CREATE INDEX IF NOT EXISTS idx_profiles_gmail_watch_expiration
  ON public.profiles(gmail_watch_expiration);

--------------------------------------------------------------------------------
-- 14. CREATE EMAIL CHAT TABLES (No Conflict)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_email_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets (id) ON DELETE CASCADE,
  message_id text,
  thread_id text,
  from_name text,
  from_address text,
  to_address text[] DEFAULT '{}'::text[],
  cc_address text[] DEFAULT '{}'::text[],
  bcc_address text[] DEFAULT '{}'::text[],
  subject text,
  body text,
  attachments jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  gmail_date timestamptz,
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  ai_classification text DEFAULT 'unknown',
  ai_confidence numeric DEFAULT 0,
  ai_auto_responded boolean DEFAULT false,
  ai_draft_response text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure update trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_ticket_email_chats_update_timestamp'
    AND tgrelid = 'public.ticket_email_chats'::regclass
  ) THEN
    CREATE TRIGGER tr_ticket_email_chats_update_timestamp
      BEFORE UPDATE ON public.ticket_email_chats
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ticket_email_chats_ticket_idx ON public.ticket_email_chats (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_email_chats_message_idx ON public.ticket_email_chats (message_id);
CREATE INDEX IF NOT EXISTS ticket_email_chats_thread_idx ON public.ticket_email_chats (thread_id);
CREATE INDEX IF NOT EXISTS ticket_email_chats_org_idx ON public.ticket_email_chats (org_id);
CREATE INDEX IF NOT EXISTS ticket_email_chats_gmail_date_idx ON public.ticket_email_chats (gmail_date);

-- Create indexes for ticket_email_chats
CREATE INDEX IF NOT EXISTS ticket_email_chats_message_thread_idx 
ON public.ticket_email_chats(message_id, thread_id);

--------------------------------------------------------------------------------
-- 15. LOGS TABLE (Already Created Above)
--------------------------------------------------------------------------------

-- No additional actions needed here.

--------------------------------------------------------------------------------
-- 16. CREATE ADDITIONAL NEW TABLES (No Conflicts With Old)
--------------------------------------------------------------------------------

-- All additional tables have been created above without duplication.
-- Ensure no repeated sections exist in your script.

--------------------------------------------------------------------------------
-- 17. ADDITIONAL CLEANUP AND FINALIZATION
--------------------------------------------------------------------------------

-- Ensure all necessary triggers are in place
-- (Already handled during table creation and in step 7B)

-- Final checks or grants can be added here as needed.

--------------------------------------------------------------------------------
-- Done!
--------------------------------------------------------------------------------

-- Make all RLS commands idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Allow admins to insert Gmail tokens'
    AND polrelid = 'public.organizations'::regclass
  ) THEN
    CREATE POLICY "Allow admins to insert Gmail tokens"
      ON public.organizations FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_members.organization_id = id
          AND organization_members.user_id = auth.uid()
          AND organization_members.role IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

-- Create table for tracking processed messages
CREATE TABLE IF NOT EXISTS public.processed_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id text NOT NULL,
  thread_id text NOT NULL,
  org_id uuid REFERENCES public.organizations(id),
  processed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'retrying')),
  attempt_count int NOT NULL DEFAULT 1,
  error_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique index for message deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_messages_message_id ON public.processed_messages (message_id);
CREATE INDEX IF NOT EXISTS idx_processed_messages_thread_id ON public.processed_messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_processed_messages_org_id ON public.processed_messages (org_id);
CREATE INDEX IF NOT EXISTS idx_processed_messages_status ON public.processed_messages (status);

-- Create trigger for auto-updating timestamp
CREATE TRIGGER tr_processed_messages_timestamp
  BEFORE UPDATE ON public.processed_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_update_timestamp();

-- Create view for Gmail watch status monitoring
CREATE OR REPLACE VIEW public.v_gmail_watch_status AS
WITH combined_watches AS (
  SELECT 
    'organization' as type,
    id,
    gmail_watch_status,
    gmail_watch_expiration,
    gmail_watch_resource_id,
    updated_at
  FROM organizations
  WHERE gmail_watch_status IS NOT NULL
  UNION ALL
  SELECT 
    'profile' as type,
    id,
    gmail_watch_status,
    gmail_watch_expiration,
    gmail_watch_resource_id,
    updated_at
  FROM profiles
  WHERE gmail_watch_status IS NOT NULL
)
SELECT 
  type,
  id,
  gmail_watch_status,
  gmail_watch_expiration,
  gmail_watch_resource_id,
  CASE 
    WHEN gmail_watch_expiration < NOW() THEN 'expired'
    WHEN gmail_watch_expiration < NOW() + INTERVAL '24 hours' THEN 'expiring_soon'
    ELSE 'active'
  END as watch_health,
  updated_at
FROM combined_watches;

-- Create function to get Gmail watch statistics
CREATE OR REPLACE FUNCTION public.get_gmail_watch_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH watch_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE gmail_watch_expiration > NOW()) as active_count,
      COUNT(*) FILTER (WHERE gmail_watch_expiration <= NOW() + INTERVAL '24 hours' AND gmail_watch_expiration > NOW()) as expiring_count,
      COUNT(*) FILTER (WHERE gmail_watch_status = 'failed' OR gmail_watch_expiration <= NOW()) as failed_count
    FROM (
      SELECT gmail_watch_expiration, gmail_watch_status FROM organizations
      WHERE gmail_watch_expiration IS NOT NULL
      UNION ALL
      SELECT gmail_watch_expiration, gmail_watch_status FROM profiles
      WHERE gmail_watch_expiration IS NOT NULL
    ) combined_watches
  )
  SELECT json_build_object(
    'active_count', active_count,
    'expiring_count', expiring_count,
    'failed_count', failed_count,
    'timestamp', NOW()
  ) INTO result
  FROM watch_stats;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_gmail_watch_stats() TO authenticated;  -- Create attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'email-attachments', 'email-attachments', false, 10485760, ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]::text[]
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'email-attachments'
);

-- Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Authenticated users can view their org attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read organizations" ON public.organizations;

-- Create new policies
CREATE POLICY "Authenticated users can view their org attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'email-attachments' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'email-attachments' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
-- Fix function parameters for agent performance metrics
CREATE OR REPLACE FUNCTION public.fn_get_agent_performance(
  p_org_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
) RETURNS TABLE(
  agent_id uuid,
  agent_name text,
  tickets_assigned bigint,
  tickets_resolved bigint,
  avg_response_time text,
  avg_resolution_time text
) AS $$
BEGIN
  RETURN QUERY
  WITH agent_responses AS (
    SELECT 
      p.id as agent_id,
      p.display_name as agent_name,
      COUNT(DISTINCT t.id) as tickets_assigned,
      COUNT(DISTINCT CASE WHEN t.status = 'solved' THEN t.id END) as tickets_resolved,
      AVG(CASE WHEN c.id IS NOT NULL THEN c.created_at - t.created_at END) as response_time,
      AVG(CASE WHEN t.status = 'solved' THEN t.updated_at - t.created_at END) as resolution_time
    FROM profiles p
    LEFT JOIN tickets t ON t.assigned_agent_id = p.id
    LEFT JOIN comments c ON c.ticket_id = t.id AND c.author_id = p.id
    WHERE p.org_id = p_org_id
      AND p.role = 'agent'
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
    GROUP BY p.id, p.display_name
  )
  SELECT 
    agent_id,
    agent_name,
    tickets_assigned,
    tickets_resolved,
    COALESCE(
      CASE 
        WHEN EXTRACT(epoch FROM response_time) >= 86400 THEN 
          ROUND(EXTRACT(epoch FROM response_time) / 86400) || 'd'
        WHEN EXTRACT(epoch FROM response_time) >= 3600 THEN 
          ROUND(EXTRACT(epoch FROM response_time) / 3600) || 'h'
        ELSE 
          ROUND(EXTRACT(epoch FROM response_time) / 60) || 'm'
      END,
      '0m'
    ) as avg_response_time,
    COALESCE(
      CASE 
        WHEN EXTRACT(epoch FROM resolution_time) >= 86400 THEN 
          ROUND(EXTRACT(epoch FROM resolution_time) / 86400) || 'd'
        WHEN EXTRACT(epoch FROM resolution_time) >= 3600 THEN 
          ROUND(EXTRACT(epoch FROM resolution_time) / 3600) || 'h'
        ELSE 
          ROUND(EXTRACT(epoch FROM resolution_time) / 60) || 'm'
      END,
      '0m'
    ) as avg_resolution_time
  FROM agent_responses;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_get_agent_performance(uuid, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_get_org_performance(
  p_org_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
) RETURNS TABLE(
  total_tickets bigint,
  open_tickets bigint,
  solved_tickets bigint,
  avg_response_time interval,
  avg_resolution_time interval,
  sla_compliance_rate numeric,
  customer_satisfaction_rate numeric,
  tickets_by_priority jsonb,
  tickets_by_status jsonb,
  daily_ticket_stats jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH ticket_stats AS (
    SELECT 
      COUNT(*) as total_tickets,
      COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
      COUNT(*) FILTER (WHERE status = 'solved') as solved_tickets,
      AVG(CASE WHEN updated_at IS NOT NULL THEN updated_at - created_at END) as avg_resolution_time,
      jsonb_object_agg(priority, COUNT(*)) FILTER (WHERE priority IS NOT NULL) as tickets_by_priority,
      jsonb_object_agg(status, COUNT(*)) FILTER (WHERE status IS NOT NULL) as tickets_by_status
    FROM tickets t
    WHERE t.org_id = p_org_id
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
  ),
  response_stats AS (
    SELECT 
      AVG(CASE 
        WHEN c.id IS NOT NULL THEN c.created_at - t.created_at
      END) as avg_response_time
    FROM tickets t
    LEFT JOIN comments c ON c.ticket_id = t.id 
      AND c.author_id = t.assigned_agent_id
      AND c.is_private = false
    WHERE t.org_id = p_org_id
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
  ),
  daily_stats AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'date', date,
          'new_tickets', new_tickets,
          'resolved_tickets', resolved_tickets
        )
      ) as daily_stats
    FROM (
      SELECT 
        date_trunc('day', t.created_at)::date as date,
        COUNT(*) as new_tickets,
        COUNT(*) FILTER (WHERE t.status = 'solved') as resolved_tickets
      FROM tickets t
      WHERE t.org_id = p_org_id
        AND (p_start_date IS NULL OR t.created_at >= p_start_date)
        AND (p_end_date IS NULL OR t.created_at <= p_end_date)
      GROUP BY date_trunc('day', t.created_at)::date
      ORDER BY date
    ) daily
  )
  SELECT 
    ts.total_tickets,
    ts.open_tickets,
    ts.solved_tickets,
    rs.avg_response_time,
    ts.avg_resolution_time,
    COALESCE(
      (ts.solved_tickets::numeric / NULLIF(ts.total_tickets, 0) * 100),
      0
    ) as sla_compliance_rate,
    COALESCE(
      (ts.solved_tickets::numeric / NULLIF(ts.total_tickets, 0) * 100),
      0
    ) as customer_satisfaction_rate,
    ts.tickets_by_priority,
    ts.tickets_by_status,
    COALESCE(ds.daily_stats, '[]'::jsonb) as daily_ticket_stats
  FROM ticket_stats ts
  CROSS JOIN response_stats rs
  CROSS JOIN daily_stats ds;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_get_org_performance(uuid, timestamptz, timestamptz) TO authenticated;

-- Gmail Imports Table and Related Functions

-- Create gmail_imports table
CREATE TABLE IF NOT EXISTS public.gmail_imports (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  total_messages integer DEFAULT 0,
  processed_messages integer DEFAULT 0,
  failed_messages integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gmail_imports_user_id ON public.gmail_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_imports_org_id ON public.gmail_imports(org_id);
CREATE INDEX IF NOT EXISTS idx_gmail_imports_status ON public.gmail_imports(status);
CREATE INDEX IF NOT EXISTS idx_gmail_imports_created_at ON public.gmail_imports(created_at);

-- Create auto-update timestamp trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_gmail_imports_update_timestamp'
    AND tgrelid = 'public.gmail_imports'::regclass
  ) THEN
    CREATE TRIGGER tr_gmail_imports_update_timestamp
      BEFORE UPDATE ON public.gmail_imports
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

-- Create function to update import progress
CREATE OR REPLACE FUNCTION public.update_gmail_import_progress(
  p_import_id text,
  p_progress integer,
  p_status text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS public.gmail_imports
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_import public.gmail_imports;
BEGIN
  UPDATE public.gmail_imports
  SET
    progress = COALESCE(p_progress, progress),
    status = COALESCE(p_status, status),
    error = COALESCE(p_error, error),
    metadata = CASE 
      WHEN p_metadata IS NOT NULL 
      THEN metadata || p_metadata 
      ELSE metadata 
    END,
    completed_at = CASE 
      WHEN p_status = 'completed' OR p_status = 'failed' 
      THEN now() 
      ELSE completed_at 
    END,
    updated_at = now()
  WHERE id = p_import_id
  RETURNING * INTO v_import;

  -- Log the update
  INSERT INTO public.audit_logs (
    action,
    entity_name,
    entity_id,
    changes,
    description
  ) VALUES (
    'gmail_import_progress_update',
    'gmail_imports',
    v_import.id::uuid,
    jsonb_build_object(
      'progress', p_progress,
      'status', p_status,
      'error', p_error,
      'metadata', p_metadata
    ),
    format('Updated Gmail import progress to %s%% with status %s', p_progress, COALESCE(p_status, v_import.status))
  );

  RETURN v_import;
END;
$$;

-- Create function to cleanup old imports
CREATE OR REPLACE FUNCTION public.cleanup_old_gmail_imports(p_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.gmail_imports
    WHERE created_at < now() - (p_days || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count
  FROM deleted;

  -- Log the cleanup
  INSERT INTO public.audit_logs (
    action,
    entity_name,
    changes,
    description
  ) VALUES (
    'gmail_import_cleanup',
    'gmail_imports',
    jsonb_build_object(
      'days_threshold', p_days,
      'deleted_count', v_deleted_count
    ),
    format('Cleaned up %s old Gmail imports older than %s days', v_deleted_count, p_days)
  );

  RETURN v_deleted_count;
END;
$$;

-- Grant necessary permissions
GRANT ALL ON public.gmail_imports TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gmail_import_progress TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_gmail_imports TO authenticated;

-- Disable RLS on gmail_imports table (as per instructions)
ALTER TABLE public.gmail_imports DISABLE ROW LEVEL SECURITY;

-- Add Gmail token columns to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_access_token text,
  ADD COLUMN IF NOT EXISTS gmail_watch_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS gmail_watch_expiry timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS gmail_token_expiry timestamptz;

-- Add Gmail token columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_access_token text,
  ADD COLUMN IF NOT EXISTS gmail_watch_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS gmail_watch_expiry timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS gmail_token_expiry timestamptz;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_gmail_watch ON public.organizations (gmail_watch_status, gmail_watch_expiry);
CREATE INDEX IF NOT EXISTS idx_profile_gmail_watch ON public.profiles (gmail_watch_status, gmail_watch_expiry);

-- Add audit logging for token updates
CREATE OR REPLACE FUNCTION public.log_gmail_token_update()
RETURNS trigger AS $$
BEGIN
  IF (
    NEW.gmail_access_token IS DISTINCT FROM OLD.gmail_access_token OR
    NEW.gmail_refresh_token IS DISTINCT FROM OLD.gmail_refresh_token OR
    NEW.gmail_watch_status IS DISTINCT FROM OLD.gmail_watch_status
  ) THEN
    INSERT INTO public.audit_logs (
      action,
      entity_name,
      entity_id,
      changes,
      description
    ) VALUES (
      'gmail_token_update',
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object(
        'watch_status_changed', NEW.gmail_watch_status IS DISTINCT FROM OLD.gmail_watch_status,
        'access_token_changed', NEW.gmail_access_token IS DISTINCT FROM OLD.gmail_access_token,
        'refresh_token_changed', NEW.gmail_refresh_token IS DISTINCT FROM OLD.gmail_refresh_token
      ),
      format('Updated Gmail tokens for %s %s', TG_TABLE_NAME, NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for both tables
DROP TRIGGER IF EXISTS tr_log_org_gmail_token_update ON public.organizations;
CREATE TRIGGER tr_log_org_gmail_token_update
  AFTER UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_gmail_token_update();

DROP TRIGGER IF EXISTS tr_log_profile_gmail_token_update ON public.profiles;
CREATE TRIGGER tr_log_profile_gmail_token_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_gmail_token_update();

-- Add AI draft column to processed_messages
ALTER TABLE processed_messages ADD COLUMN IF NOT EXISTS ai_draft text;

-- Drop and recreate knowledge base tables with updated schema
DROP TABLE IF EXISTS public.knowledge_doc_chunks CASCADE;
DROP TABLE IF EXISTS public.knowledge_docs CASCADE;

-- Create knowledge_docs table
CREATE TABLE public.knowledge_docs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_path text,
  source_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create knowledge_doc_chunks table
CREATE TABLE public.knowledge_doc_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id uuid NOT NULL REFERENCES public.knowledge_docs(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  confidence_score float DEFAULT 0.0,
  token_length integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add function to update timestamps
CREATE OR REPLACE FUNCTION public.fn_update_knowledge_timestamps()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  
  -- Ensure metadata is not null
  IF NEW.metadata IS NULL THEN
    NEW.metadata = '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for both tables
DROP TRIGGER IF EXISTS tr_knowledge_docs_update ON public.knowledge_docs;
CREATE TRIGGER tr_knowledge_docs_update
  BEFORE UPDATE ON public.knowledge_docs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_knowledge_timestamps();

DROP TRIGGER IF EXISTS tr_knowledge_doc_chunks_update ON public.knowledge_doc_chunks;
CREATE TRIGGER tr_knowledge_doc_chunks_update
  BEFORE UPDATE ON public.knowledge_doc_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_knowledge_timestamps();

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org_id ON public.knowledge_docs (org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_metadata ON public.knowledge_docs USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_knowledge_doc_chunks_doc_id ON public.knowledge_doc_chunks (doc_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_chunks_metadata ON public.knowledge_doc_chunks USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_chunks_confidence ON public.knowledge_doc_chunks (confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_chunks_embedding ON public.knowledge_doc_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMIT; 