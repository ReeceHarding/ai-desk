--------------------------------------------------------------------------------
-- MASSIVE MIGRATION FILE (REWRITTEN TO AVOID BREAKING CHANGES)
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
-- ============ 0. SCHEMA OWNERSHIP & PERMISSIONS ============
--------------------------------------------------------------------------------

ALTER SCHEMA public OWNER TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

--------------------------------------------------------------------------------
-- ============ 1. ENABLE EXTENSIONS ============
--------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

--------------------------------------------------------------------------------
-- ============ 2. CREATE ENUMS ============
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
-- ============ 3. CREATE FUNCTIONS ============
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- ============ 4. CREATE BASE TABLES ============
--------------------------------------------------------------------------------

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
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  updated_at timestamptz NOT NULL DEFAULT now()
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

--------------------------------------------------------------------------------
-- ============ 4B. RAG KNOWLEDGE BASE ============
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

CREATE TRIGGER tr_knowledge_docs_update_timestamp
BEFORE UPDATE ON public.knowledge_docs
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

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

CREATE TRIGGER tr_knowledge_doc_chunks_update_timestamp
BEFORE UPDATE ON public.knowledge_doc_chunks
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE INDEX IF NOT EXISTS idx_knowledge_doc_chunks_doc_id
  ON public.knowledge_doc_chunks(doc_id);

CREATE INDEX IF NOT EXISTS knowledge_doc_chunks_embedding_vector_idx
  ON public.knowledge_doc_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

--------------------------------------------------------------------------------
-- ============ 5. CREATE TIMESTAMP-UPDATE TRIGGERS FOR EXISTING TABLES ============
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- ============ 6. DISABLE RLS ON EXISTING TABLES (DEVELOPMENT) ============
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- ============ 7. CREATE ADDITIONAL INDEXES FOR EXISTING TABLES ============
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- ============ 8. ADD GMAIL TOKEN COLUMNS (ORGANIZATIONS) ============
--------------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_access_token text;

-- Keep RLS disabled for testing
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- ============ 9. (OPTIONAL) DROP OLD ORG POLICIES IF DESIRED; RECREATE THEM ============
-- (Keep or remove these if you want to preserve old RLS policies.)
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow users to view organizations they are members of" ON public.organizations;
DROP POLICY IF EXISTS "Allow admins to update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow admins to insert Gmail tokens" ON public.organizations;

CREATE POLICY "Allow users to view organizations they are members of"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow admins to update their organization"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('admin', 'super_admin')
    )
  );

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

--------------------------------------------------------------------------------
-- ============ 10. ADD GMAIL TOKENS / WATCH EXPIRATION TO PROFILES (IF NOT EXISTS) ============
--------------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gmail_refresh_token text,
  ADD COLUMN IF NOT EXISTS gmail_access_token text,
  ADD COLUMN IF NOT EXISTS gmail_watch_expiration timestamptz;

--------------------------------------------------------------------------------
-- ============ 11. CREATE FUNCTION + TRIGGER FOR NEW USER SIGNUP (AUTO-ORG) ============
-- Keep your original auto-org creation approach
--------------------------------------------------------------------------------

-- Remove old triggers first (if they exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS tr_create_personal_organization ON auth.users;

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
    VALUES ('info', 'User already has a profile, skipping', jsonb_build_object('user_id', NEW.id));
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
      'https://example.com/default-avatar.png'
    );

    RETURN NEW;
  END IF;

  -- Create personal organization name with uniqueness retry logic
  LOOP
    v_org_name := CASE 
      WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN 
        CASE 
          WHEN v_attempt = 0 THEN (NEW.raw_user_meta_data->>'full_name') || '''s Organization'
          ELSE (NEW.raw_user_meta_data->>'full_name') || '''s Organization ' || v_attempt
        END
      ELSE 
        'Personal Organization ' || substring(NEW.id::text, 1, 8) || CASE 
          WHEN v_attempt = 0 THEN ''
          ELSE ' ' || v_attempt
        END
    END;

    BEGIN
      INSERT INTO public.organizations (
        name,
        created_by,
        email,
        config
      ) VALUES (
        v_org_name,
        NEW.id,
        NEW.email,
        jsonb_build_object(
          'is_personal', true,
          'created_at_timestamp', now()
        )
      ) RETURNING id INTO v_org_id;

      EXIT; -- if insert succeeded, break out
    EXCEPTION
      WHEN unique_violation THEN
        v_attempt := v_attempt + 1;
        IF v_attempt > 5 THEN
          RAISE EXCEPTION 'Failed to create unique organization name after 5 attempts';
        END IF;
        -- continue loop
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
    'https://example.com/default-avatar.png'
  );

  -- Create organization_members row
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role
  ) VALUES (
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
-- ============ 12. STORAGE BUCKET & POLICIES FOR AVATARS ============
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- ============ RE-DEFINE is_super_admin (DUPLICATE, FOR COMPLETENESS) ============
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
-- ============ ORGANIZATION INSERT POLICY (SUPER ADMINS OR BRAND-NEW USERS) ============
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- ============ OPTIONAL: RETAIN OLD RLS ON organization_members OR OVERRIDE ============
-- We simply keep your existing approach, not forcing new "id" PK or referencing auth.users.
--------------------------------------------------------------------------------


--------------------------------------------------------------------------------
-- ============ 13. ADD GMAIL WATCH TRACKING COLUMNS (SAFE, IF NOT EXISTS) ============
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- ============ 14. EMAIL CHAT TABLES (no conflict) ============
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_email_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  message_id text NOT NULL,
  thread_id text NOT NULL,
  from_name text,
  from_address text,
  to_address text[],
  cc_address text[] DEFAULT '{}'::text[],
  bcc_address text[] DEFAULT '{}'::text[],
  subject text,
  body text,
  attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  gmail_date timestamptz,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  ai_classification text DEFAULT 'unknown',
  ai_confidence numeric DEFAULT 0,
  ai_auto_responded boolean DEFAULT false,
  ai_draft_response text,
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
CREATE INDEX ticket_email_chats_gmail_date_idx ON public.ticket_email_chats (gmail_date);

--------------------------------------------------------------------------------
-- ============ 15. LOGS TABLE (IF NOT EXISTS) ============
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
GRANT ALL ON public.logs TO service_role;
CREATE INDEX IF NOT EXISTS logs_timestamp_idx ON public.logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS logs_level_idx ON public.logs (level);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do all on logs"
ON public.logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

--------------------------------------------------------------------------------
-- ============ 16. OPTIONAL: Additional Column & Index for ticket_email_chats.gmail_date ============
-- Already included above if you want it. No conflict with old code.
--------------------------------------------------------------------------------


--------------------------------------------------------------------------------
-- ============ KEEP OLD AUTO-ORGANIZATION CREATION (do not drop it) ============
-- We do not remove it or replace with a minimal handle_new_user
--------------------------------------------------------------------------------


--------------------------------------------------------------------------------
-- ============ NEW OPTIONAL COLUMNS FOR TICKETS, PROFILES, ETC. ============
--------------------------------------------------------------------------------

-- organizations: store additional brand/outreach settings, subscription_plan, etc.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS outreach_preferences jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_voice text,
  ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_scrape_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_plan text;

-- profiles: store optional agent_rank + preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_rank int,
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;

-- tickets: store next_followup_at & feedback_score
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_score numeric;

-- knowledge_base_articles: pinned + rating
ALTER TABLE public.knowledge_base_articles
  ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating numeric;

-- email_logs: AI classification columns
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS ai_classification text,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS auto_replied boolean DEFAULT false;

--------------------------------------------------------------------------------
-- ============ 17. CREATE 40+ NEW TABLES (No Conflicts With Old) ============
--------------------------------------------------------------------------------
-- (All are new. They do not overwrite or rename old tables.)

---------------------------------------------
-- A) Macros & Automations
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.macros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  macro_name text NOT NULL,
  macro_content text NOT NULL,
  is_global boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid 
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.macro_uses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  macro_id uuid NOT NULL
    REFERENCES public.macros(id) ON DELETE CASCADE,
  used_by uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ticket_id uuid
    REFERENCES public.tickets(id) ON DELETE SET NULL,
  usage_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escalations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  escalation_name text NOT NULL,
  description text,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid 
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escalation_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  escalation_id uuid NOT NULL
    REFERENCES public.escalations(id) ON DELETE CASCADE,
  ticket_id uuid 
    REFERENCES public.tickets(id) ON DELETE SET NULL,
  log_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_conditions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id uuid NOT NULL
    REFERENCES public.automations(id) ON DELETE CASCADE,
  condition_type text NOT NULL,
  condition_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id uuid NOT NULL
    REFERENCES public.automations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- B) Achievements, Notifications
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  achievement_name text NOT NULL,
  description text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_points int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid 
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- C) Marketing & Drip Campaigns
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  description text,
  created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  filter_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text,
  full_name text,
  location text,
  status text NOT NULL DEFAULT 'new',
  lead_score int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_workflow_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL
    REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  step_type text NOT NULL,
  step_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_lead_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL
    REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  campaign_id uuid
    REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- D) Deals / Opportunities
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_name text NOT NULL,
  stage text NOT NULL DEFAULT 'prospect',
  deal_value numeric NOT NULL DEFAULT 0,
  assigned_agent_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deal_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL
    REFERENCES public.deals(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text,
  created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- E) Outreach / Scraping / Sequences
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  daily_send_limit int NOT NULL DEFAULT 50,
  created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_scraping_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scraping_job_id uuid 
    REFERENCES public.outreach_scraping_jobs(id) ON DELETE CASCADE,
  domain text NOT NULL,
  company_name text,
  location text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL
    REFERENCES public.outreach_companies(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'new',
  lead_score int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_sequences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL
    REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  sequence_name text NOT NULL,
  total_steps int NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_sequence_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id uuid NOT NULL
    REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  delay_days int NOT NULL DEFAULT 0,
  template_content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- F) Knowledge Base Attachments & Categories
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_doc_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid 
    REFERENCES public.knowledge_base_articles(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_doc_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- G) Seats, Brand Configs, AI Configs
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.seat_licenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_seats int NOT NULL DEFAULT 1,
  used_seats int NOT NULL DEFAULT 0,
  plan_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text,
  secondary_color text,
  disclaimers text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.advanced_ai_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  model_preference text DEFAULT 'gpt-4',
  auto_respond_threshold numeric DEFAULT 0.85,
  brand_tone text,
  additional_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- H) Retargeting / Re-Engagement
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.retargeting_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retargeting_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL
    REFERENCES public.retargeting_campaigns(id) ON DELETE CASCADE,
  lead_email text NOT NULL,
  full_name text,
  last_contacted_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retargeting_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL
    REFERENCES public.retargeting_leads(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- I) Personal Macros, Personal Workflows
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_macros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  macro_name text NOT NULL,
  macro_content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_workflows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  workflow_name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- J) Classifications, Lead Scores, Project Settings
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.inbound_classifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email_log_id uuid 
    REFERENCES public.email_logs(id) ON DELETE CASCADE,
  classification_label text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1.0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  marketing_lead_id uuid 
    REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  score int NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------
-- K) Domain Warmups, Integrations, Voice Outreach
---------------------------------------------
CREATE TABLE IF NOT EXISTS public.domain_warmups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  daily_emails_sent int NOT NULL DEFAULT 0,
  goal_emails_per_day int NOT NULL DEFAULT 20,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ringcentral_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  rc_account_id text NOT NULL,
  rc_auth_token text,
  rc_refresh_token text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.slack_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  slack_team_id text NOT NULL,
  slack_bot_token text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.twilio_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  twilio_account_sid text NOT NULL,
  twilio_auth_token text,
  twilio_phone_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.voice_outreach (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid,  
  phone_number text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  attempt_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- ============ 18. ADD TIMESTAMP UPDATE TRIGGERS ON NEW TABLES ============
--------------------------------------------------------------------------------

-- Any new table that has "updated_at" gets a trigger:

CREATE TRIGGER tr_macros_update_timestamp
BEFORE UPDATE ON public.macros
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_escalations_update_timestamp
BEFORE UPDATE ON public.escalations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_automations_update_timestamp
BEFORE UPDATE ON public.automations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_achievements_update_timestamp
BEFORE UPDATE ON public.achievements
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_marketing_campaigns_update_timestamp
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_marketing_segments_update_timestamp
BEFORE UPDATE ON public.marketing_segments
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_marketing_leads_update_timestamp
BEFORE UPDATE ON public.marketing_leads
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_deals_update_timestamp
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_outreach_campaigns_update_timestamp
BEFORE UPDATE ON public.outreach_campaigns
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_outreach_scraping_jobs_update_timestamp
BEFORE UPDATE ON public.outreach_scraping_jobs
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_outreach_contacts_update_timestamp
BEFORE UPDATE ON public.outreach_contacts
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_outreach_sequences_update_timestamp
BEFORE UPDATE ON public.outreach_sequences
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_knowledge_doc_categories_update_timestamp
BEFORE UPDATE ON public.knowledge_doc_categories
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_seat_licenses_update_timestamp
BEFORE UPDATE ON public.seat_licenses
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_brand_configs_update_timestamp
BEFORE UPDATE ON public.brand_configs
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_advanced_ai_configs_update_timestamp
BEFORE UPDATE ON public.advanced_ai_configs
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_retargeting_campaigns_update_timestamp
BEFORE UPDATE ON public.retargeting_campaigns
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_retargeting_leads_update_timestamp
BEFORE UPDATE ON public.retargeting_leads
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_personal_workflows_update_timestamp
BEFORE UPDATE ON public.personal_workflows
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_domain_warmups_update_timestamp
BEFORE UPDATE ON public.domain_warmups
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_ringcentral_integrations_update_timestamp
BEFORE UPDATE ON public.ringcentral_integrations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_slack_integrations_update_timestamp
BEFORE UPDATE ON public.slack_integrations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_twilio_integrations_update_timestamp
BEFORE UPDATE ON public.twilio_integrations
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

CREATE TRIGGER tr_voice_outreach_update_timestamp
BEFORE UPDATE ON public.voice_outreach
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

--------------------------------------------------------------------------------
-- ============ 19. DISABLE RLS ON ALL NEW TABLES (FOR DEV) ============
--------------------------------------------------------------------------------

ALTER TABLE public.macros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_uses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_conditions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.marketing_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_segments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_workflow_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_lead_activity DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.outreach_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_scraping_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequence_steps DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_doc_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_doc_categories DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.seat_licenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.advanced_ai_configs DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.retargeting_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.retargeting_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.retargeting_activity DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.personal_macros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_workflows DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.inbound_classifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_settings DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.domain_warmups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ringcentral_integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_outreach DISABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- ============ 20. CREATE A NEW STORAGE BUCKET (EXAMPLE) "scrapedfiles" ============
--------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('scrapedfiles', 'scrapedfiles', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read for scrapedfiles" ON storage.objects;
CREATE POLICY "Public read for scrapedfiles"
ON storage.objects
FOR SELECT
USING (bucket_id = 'scrapedfiles');

DROP POLICY IF EXISTS "Authenticated can create scrapedfiles" ON storage.objects;
CREATE POLICY "Authenticated can create scrapedfiles"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'scrapedfiles' 
  AND auth.role() = 'authenticated'
);

--------------------------------------------------------------------------------
-- DONE: This final script merges your entire existing schema plus new features
-- with minimal disruption to the old "organization_members" structure and user triggers.
--------------------------------------------------------------------------------