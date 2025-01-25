-- ===============================================================
--  FINAL COMBINED MIGRATION SCRIPT (NO DUPLICATES)
--  Reflects the end-state after all separate migrations.
--  Redundant/overwritten definitions removed for clarity.
-- ===============================================================

------------------------------
-- 1. SCHEMA & EXTENSIONS
------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Make sure the "public" schema is owned by postgres and open
ALTER SCHEMA public OWNER TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

------------------------------
-- 2. ENUM TYPES
------------------------------
-- Final enumerations (no duplicates)
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.ticket_status CASCADE;
DROP TYPE IF EXISTS public.ticket_priority CASCADE;
DROP TYPE IF EXISTS public.sla_tier CASCADE;

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

------------------------------
-- 3. HELPER FUNCTIONS
------------------------------
-- Used for auto-updating updated_at columns
CREATE OR REPLACE FUNCTION public.fn_auto_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A specialized version used by the KB articles table
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Simple function to generate unique slugs
CREATE OR REPLACE FUNCTION public.generate_unique_slug(org_name text)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  -- Remove apostrophes, then replace non-alphanumeric chars
  base_slug := lower(regexp_replace(regexp_replace(org_name, '''', '', 'g'),
                                    '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);

  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug)
  LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

------------------------------
-- 4. LOGS TABLE (FINAL)
------------------------------
CREATE TABLE IF NOT EXISTS public.logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('info','warn','error')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_client boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  url text,
  runtime text,
  -- Final debugging columns:
  request_id uuid DEFAULT gen_random_uuid(),
  user_agent text,
  ip_address text,
  request_path text,
  request_method text,
  response_status integer,
  duration_ms integer
);

-- Indexes on logs
CREATE INDEX IF NOT EXISTS logs_level_created_at_idx ON public.logs (level, created_at);
CREATE INDEX IF NOT EXISTS logs_created_at_idx        ON public.logs (created_at DESC);
CREATE INDEX IF NOT EXISTS logs_level_idx             ON public.logs (level);

------------------------------
-- 5. ORGANIZATIONS
------------------------------
CREATE TABLE public.organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  public_mode boolean NOT NULL DEFAULT true,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- ensures if user is deleted, this becomes NULL
  sla_tier public.sla_tier NOT NULL DEFAULT 'basic',
  gmail_refresh_token text,
  gmail_access_token text,
  gmail_watch_expiration timestamptz,
  gmail_history_id text,
  avatar_url text,
  created_by uuid REFERENCES auth.users(id),
  email text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT organizations_slug_key UNIQUE (slug)
);

-- Auto-generate slug if none is supplied
CREATE OR REPLACE FUNCTION public.fn_generate_org_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_unique_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_org_slug
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_generate_org_slug();

-- Timestamp update
CREATE TRIGGER tr_organizations_update_timestamp
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

------------------------------
-- 6. PROFILES
------------------------------
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
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  gmail_refresh_token text,
  gmail_access_token text,
  gmail_watch_expiration timestamptz,
  gmail_watch_resource_id text,
  gmail_watch_status text CHECK (gmail_watch_status IN ('active','expired','failed','pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link to auth.users (1:1)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

CREATE TRIGGER tr_profiles_update_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

------------------------------
-- 7. ORGANIZATION MEMBERS
------------------------------
CREATE TABLE public.organization_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN('member','admin','super_admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE TRIGGER tr_organization_members_update_timestamp
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

------------------------------
-- 8. TEAMS & TEAM MEMBERS
------------------------------
CREATE TABLE public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_teams_update_timestamp
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_in_team text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

------------------------------
-- 9. TAGS
------------------------------
CREATE TABLE public.tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  tag_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_tags_update_timestamp
BEFORE UPDATE ON public.tags
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

------------------------------
-- 10. KNOWLEDGE BASE ARTICLES
------------------------------
CREATE TABLE public.knowledge_base_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  article_category text,
  article_type text,
  published boolean DEFAULT false,
  flagged_internal boolean DEFAULT false,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER tr_kb_articles_update_timestamp
BEFORE UPDATE ON public.knowledge_base_articles
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Indexes for quick searching
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_title
  ON public.knowledge_base_articles USING gin(to_tsvector('english', title));

CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_category
  ON public.knowledge_base_articles(article_category);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_type
  ON public.knowledge_base_articles(article_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_published
  ON public.knowledge_base_articles(published);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_org_id
  ON public.knowledge_base_articles(org_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_deleted_at
  ON public.knowledge_base_articles(deleted_at);

------------------------------
-- 11. ARTICLE REVISIONS & LOCALIZATIONS
------------------------------
CREATE TABLE public.article_revisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  content_snapshot text NOT NULL,
  revision_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.article_localizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  locale text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (article_id, locale)
);

CREATE TRIGGER tr_article_localizations_update_timestamp
BEFORE UPDATE ON public.article_localizations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

------------------------------
-- 12. TICKETS & RELATED
------------------------------
CREATE TABLE public.tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject text NOT NULL,
  description text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'low',
  escalation_level int NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  happiness_score int,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_tickets_update_timestamp
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Co-assignees
CREATE TABLE public.ticket_co_assignees (
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (ticket_id, agent_id)
);

-- Comments
CREATE TABLE public.comments (
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
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_comments_update_timestamp
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Attachments
CREATE TABLE public.attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid REFERENCES public.comments (id) ON DELETE CASCADE,
  file_path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Ticket watchers
CREATE TABLE public.ticket_watchers (
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  watch_level text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

-- Article watchers
CREATE TABLE public.article_watchers (
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  watch_level text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_name text,
  entity_id uuid,
  changes jsonb,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Email logs
CREATE TABLE public.email_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  thread_id text NOT NULL,
  direction text CHECK (direction IN ('inbound','outbound')),
  timestamp timestamptz DEFAULT now(),
  snippet text,
  subject text,
  from_address text,
  to_address text,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  raw_content jsonb,
  labels text[],
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_email_logs_update_timestamp
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Embeddings
CREATE TABLE public.ticket_embeddings (
  ticket_id uuid PRIMARY KEY REFERENCES public.tickets(id) ON DELETE CASCADE,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_ticket_embeddings_update_timestamp
BEFORE UPDATE ON public.ticket_embeddings
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TABLE public.comment_embeddings (
  comment_id uuid PRIMARY KEY REFERENCES public.comments(id) ON DELETE CASCADE,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_comment_embeddings_update_timestamp
BEFORE UPDATE ON public.comment_embeddings
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

------------------------------
-- 13. REPORTS TABLE
------------------------------
CREATE TABLE public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type text NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text_1 text,
  extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_reports_update_timestamp
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

------------------------------
-- 14. KNOWLEDGE DOCS (RAG)
------------------------------
CREATE TABLE public.knowledge_docs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_path text,
  source_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_knowledge_docs_update_timestamp
BEFORE UPDATE ON public.knowledge_docs
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TABLE public.knowledge_doc_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id uuid NOT NULL REFERENCES public.knowledge_docs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_content text NOT NULL,
  embedding vector(1536),
  token_length integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER tr_knowledge_doc_chunks_update_timestamp
BEFORE UPDATE ON public.knowledge_doc_chunks
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Vector index
CREATE INDEX IF NOT EXISTS knowledge_doc_chunks_embedding_vector_idx
  ON public.knowledge_doc_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_doc_chunks_doc_id
  ON public.knowledge_doc_chunks(doc_id);

------------------------------
-- 15. TICKET EMAIL CHATS
------------------------------
CREATE TABLE public.ticket_email_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_address text NOT NULL,
  to_address text NOT NULL,
  subject text,
  body text,
  html_body text,
  message_id text UNIQUE,
  thread_id text,
  in_reply_to text,
  reference_ids text[],
  sent_at timestamptz NOT NULL,
  received_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_email_chats_ticket_id
  ON public.ticket_email_chats(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_email_chats_message_id
  ON public.ticket_email_chats(message_id);
CREATE INDEX IF NOT EXISTS idx_ticket_email_chats_thread_id
  ON public.ticket_email_chats(thread_id);

CREATE TRIGGER tr_ticket_email_chats_updated_at
  BEFORE UPDATE ON public.ticket_email_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_update_timestamp();

------------------------------
-- 16. INVITATIONS
------------------------------
CREATE TABLE public.invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('agent','admin')),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS invitations_organization_id_idx ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx          ON public.invitations(token);
CREATE INDEX IF NOT EXISTS invitations_email_idx          ON public.invitations(email);

-- Simple function to accept an invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token text,
  p_user_id uuid,
  p_organization_id uuid,
  p_role text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark invitation used
  UPDATE public.invitations
     SET used_at = now()
   WHERE token = p_token
     AND organization_id = p_organization_id
     AND used_at IS NULL
     AND expires_at > now();

  -- Optionally update user's role if they were "customer"
  UPDATE public.profiles
     SET role = p_role
   WHERE id = p_user_id
     AND (role IS NULL OR role = 'customer');

  -- Add or update membership
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (p_organization_id, p_user_id, p_role)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, updated_at = now();
END;
$$;

------------------------------
-- 17. STORAGE BUCKETS & POLICIES (Avatars)
------------------------------
-- Create or ensure the avatars bucket
INSERT INTO storage.buckets (id, name, public)
SELECT 'avatars','avatars',true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'avatars'
);

-- For dev, no final RLS policies on storage.objects

------------------------------
-- 18. FINAL handle_new_user() TRIGGER
------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email text;
  v_display_name text;
  v_avatar_url text;
  v_request_id text;
BEGIN
  v_request_id := gen_random_uuid()::text;

  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Starting handle_new_user function',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'raw_email', NEW.email,
      'raw_metadata', NEW.raw_user_meta_data,
      'email_confirmed', NEW.email_confirmed_at IS NOT NULL,
      'timestamp', now()
    )
  );

  -- Resolve email from metadata or direct field
  v_email := COALESCE(
    NEW.email,
    NEW.raw_user_meta_data->>'email',
    NEW.raw_user_meta_data->>'preferred_email'
  );

  IF v_email IS NULL THEN
    v_email := NEW.id || '@temp.example.com';
    INSERT INTO public.logs (level, message, metadata)
    VALUES (
      'warn',
      'Using temporary email for user',
      jsonb_build_object(
        'request_id', v_request_id,
        'user_id', NEW.id,
        'temp_email', v_email
      )
    );
  END IF;

  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1)
  );

  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

  -- Create a profile for the user (without organization)
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    role,
    avatar_url,
    metadata
  )
  VALUES (
    NEW.id,
    v_email,
    v_display_name,
    'customer',
    v_avatar_url,
    jsonb_build_object(
      'signup_completed', false,
      'gmail_setup_pending', true,
      'created_at', extract(epoch from now()),
      'is_sso_user', NEW.raw_user_meta_data->>'iss' IS NOT NULL,
      'email_confirmed', NEW.email_confirmed_at IS NOT NULL,
      'request_id', v_request_id
    )
  );

  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Successfully completed handle_new_user function',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'email', v_email,
      'timestamp', now()
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'error',
    'Error in handle_new_user',
    jsonb_build_object(
      'request_id', v_request_id,
      'user_id', NEW.id,
      'error', SQLERRM
    )
  );
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the user-created trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

------------------------------
-- 19. SIMPLE STATS TRIGGERS
------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_agent_first_response_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- In final migrations, this was left as a stub
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_update_agent_resolution_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- In final migrations, this was left as a stub
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for first-response stats
CREATE TRIGGER tr_update_agent_first_response_stats
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_agent_first_response_stats();

-- Trigger for resolution stats
CREATE TRIGGER tr_update_agent_resolution_stats
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_agent_resolution_stats();

------------------------------
-- 20. SAMPLE DATA UPDATE
------------------------------
-- If 'ee0f56a0-4130-4398-bc2d-27529f82efb1' is a known org ID:
UPDATE public.organizations
SET gmail_history_id = '2180684'
WHERE id = 'ee0f56a0-4130-4398-bc2d-27529f82efb1';

------------------------------
-- 21. DISABLE RLS & GRANTS (Final State)
------------------------------
-- In the end, all RLS was disabled and wide grants given for dev.

ALTER TABLE public.logs                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_revisions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_localizations  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_co_assignees    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_watchers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_watchers       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_embeddings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_embeddings     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_email_chats     DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO public;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO public;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO public;

-- Also ensure logs is accessible
GRANT ALL ON public.logs TO postgres;
GRANT ALL ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;

-- Done!
INSERT INTO public.logs (level, message, metadata)
VALUES (
  'info',
  'Completed final combined migration script',
  jsonb_build_object('version','final-no-redundancies')
);

-- Function to calculate average first response time for an organization
CREATE OR REPLACE FUNCTION public.fn_get_avg_first_response_time(p_org_id uuid, p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL)
RETURNS text AS $$
DECLARE
  avg_time interval;
BEGIN
  SELECT AVG(first_response_time)
  INTO avg_time
  FROM (
    SELECT 
      t.id,
      MIN(c.created_at) - t.created_at as first_response_time
    FROM tickets t
    LEFT JOIN comments c ON c.ticket_id = t.id
    JOIN profiles p ON p.id = c.author_id
    WHERE t.org_id = p_org_id
      AND p.role IN ('agent', 'admin', 'super_admin')
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
    GROUP BY t.id
  ) subq;

  RETURN COALESCE(
    CASE 
      WHEN EXTRACT(epoch FROM avg_time) >= 86400 THEN 
        ROUND(EXTRACT(epoch FROM avg_time) / 86400) || 'd'
      WHEN EXTRACT(epoch FROM avg_time) >= 3600 THEN 
        ROUND(EXTRACT(epoch FROM avg_time) / 3600) || 'h'
      ELSE 
        ROUND(EXTRACT(epoch FROM avg_time) / 60) || 'm'
    END,
    '0m'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate average resolution time for an organization
CREATE OR REPLACE FUNCTION public.fn_get_avg_resolution_time(p_org_id uuid, p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL)
RETURNS text AS $$
DECLARE
  avg_time interval;
BEGIN
  SELECT AVG(resolution_time)
  INTO avg_time
  FROM (
    SELECT 
      updated_at - created_at as resolution_time
    FROM tickets
    WHERE org_id = p_org_id
      AND status = 'solved'
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
  ) subq;

  RETURN COALESCE(
    CASE 
      WHEN EXTRACT(epoch FROM avg_time) >= 86400 THEN 
        ROUND(EXTRACT(epoch FROM avg_time) / 86400) || 'd'
      WHEN EXTRACT(epoch FROM avg_time) >= 3600 THEN 
        ROUND(EXTRACT(epoch FROM avg_time) / 3600) || 'h'
      ELSE 
        ROUND(EXTRACT(epoch FROM avg_time) / 60) || 'm'
    END,
    '0m'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get ticket status breakdown for an organization
CREATE OR REPLACE FUNCTION public.fn_get_ticket_status_breakdown(p_org_id uuid)
RETURNS TABLE (
  status public.ticket_status,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.status, COUNT(*) as count
  FROM tickets t
  WHERE t.org_id = p_org_id
  GROUP BY t.status
  UNION ALL
  SELECT unnest(enum_range(NULL::public.ticket_status)) as status, 0 as count
  WHERE NOT EXISTS (
    SELECT 1 FROM tickets t WHERE t.org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get agent performance metrics
CREATE OR REPLACE FUNCTION public.fn_get_agent_performance(p_org_id uuid, p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL)
RETURNS TABLE (
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

-- Function to get ticket volume over time
CREATE OR REPLACE FUNCTION public.fn_get_ticket_volume(p_org_id uuid, p_interval text DEFAULT 'day', p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL)
RETURNS TABLE (
  time_bucket timestamptz,
  new_tickets bigint,
  resolved_tickets bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH time_series AS (
    SELECT
      date_trunc(p_interval, d) as time_bucket
    FROM generate_series(
      COALESCE(p_start_date, date_trunc('month', now()) - interval '1 month'),
      COALESCE(p_end_date, now()),
      CASE 
        WHEN p_interval = 'hour' THEN interval '1 hour'
        WHEN p_interval = 'day' THEN interval '1 day'
        WHEN p_interval = 'week' THEN interval '1 week'
        ELSE interval '1 month'
      END
    ) d
  )
  SELECT 
    ts.time_bucket,
    COALESCE(COUNT(DISTINCT CASE WHEN t.created_at >= ts.time_bucket 
      AND t.created_at < ts.time_bucket + 
        CASE 
          WHEN p_interval = 'hour' THEN interval '1 hour'
          WHEN p_interval = 'day' THEN interval '1 day'
          WHEN p_interval = 'week' THEN interval '1 week'
          ELSE interval '1 month'
        END
      THEN t.id END), 0) as new_tickets,
    COALESCE(COUNT(DISTINCT CASE WHEN t.status = 'solved' 
      AND t.updated_at >= ts.time_bucket 
      AND t.updated_at < ts.time_bucket + 
        CASE 
          WHEN p_interval = 'hour' THEN interval '1 hour'
          WHEN p_interval = 'day' THEN interval '1 day'
          WHEN p_interval = 'week' THEN interval '1 week'
          ELSE interval '1 month'
        END
      THEN t.id END), 0) as resolved_tickets
  FROM time_series ts
  LEFT JOIN tickets t ON t.org_id = p_org_id
  GROUP BY ts.time_bucket
  ORDER BY ts.time_bucket;
END;
$$ LANGUAGE plpgsql;

-- Add GIN indexes for ticket search
CREATE INDEX IF NOT EXISTS idx_tickets_subject_tsv
  ON public.tickets USING gin(to_tsvector('english', subject));

CREATE INDEX IF NOT EXISTS idx_tickets_description_tsv
  ON public.tickets USING gin(to_tsvector('english', description));

-- Add composite index for org_id and status for filtered searches
CREATE INDEX IF NOT EXISTS idx_tickets_org_status
  ON public.tickets(org_id, status);