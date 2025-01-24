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

CREATE OR REPLACE FUNCTION public.generate_unique_slug(org_name text)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  -- Convert name to lowercase, remove apostrophes first, then replace remaining non-alphanumeric chars with hyphens
  base_slug := lower(regexp_replace(regexp_replace(org_name, '''', '', 'g'), '[^a-zA-Z0-9]+', '-', 'g'));
  -- Remove leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  
  -- Try the base slug first
  final_slug := base_slug;
  
  -- Keep trying with incrementing numbers until we find a unique slug
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.can_access_organization(org_slug text, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.slug = org_slug
    AND (
      o.public_mode = true
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = o.id
        AND om.user_id = user_id
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 4. CREATE BASE TABLES
-- =========================================

CREATE TABLE public.logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for faster querying by level and created_at
CREATE INDEX IF NOT EXISTS logs_level_created_at_idx ON public.logs (level, created_at);

CREATE TABLE public.organizations (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  name text NOT NULL,
  owner_id uuid NOT NULL,
  slug text NOT NULL,
  public_mode boolean NOT NULL DEFAULT true,
  sla_tier text DEFAULT 'standard'::text NOT NULL,
  gmail_refresh_token text,
  gmail_access_token text,
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id),
  CONSTRAINT organizations_slug_key UNIQUE (slug)
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
  org_id uuid
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
-- RAG KNOWLEDGE BASE
-- =========================================

-- Table to store high-level knowledge documents that a user uploads
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

-- Trigger for update timestamp
CREATE TRIGGER tr_knowledge_docs_update_timestamp
BEFORE UPDATE ON public.knowledge_docs
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Table to store the chunked segments from each doc
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

-- Trigger for update timestamp
CREATE TRIGGER tr_knowledge_doc_chunks_update_timestamp
BEFORE UPDATE ON public.knowledge_doc_chunks
FOR EACH ROW
EXECUTE PROCEDURE public.fn_auto_update_timestamp();

-- Indexes for knowledge base tables
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_chunks_doc_id
  ON public.knowledge_doc_chunks(doc_id);

CREATE INDEX IF NOT EXISTS knowledge_doc_chunks_embedding_vector_idx
  ON public.knowledge_doc_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

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

-- Remove old triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS tr_create_personal_organization ON auth.users;

-- Combined robust handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
  v_existing_org_id uuid;
  v_attempt int := 0;
BEGIN
  -- Logging
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
      'https://ucbtpddvvbsrqroqhvev.supabase.co/storage/v1/object/public/avatars/profile-circle-icon-256x256-cm91gqm2.png'
    );

    RETURN NEW;
  END IF;

  -- Create organization name with uniqueness retry logic
  LOOP
    v_org_name := CASE 
      WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN 
        CASE 
          WHEN v_attempt = 0 THEN NEW.raw_user_meta_data->>'full_name'
          ELSE NEW.raw_user_meta_data->>'full_name' || ' ' || v_attempt
        END
      ELSE 
        CASE
          WHEN v_attempt = 0 THEN split_part(NEW.email, '@', 1)
          ELSE split_part(NEW.email, '@', 1) || ' ' || v_attempt
        END
    END;

    BEGIN
      -- Create personal organization
      INSERT INTO public.organizations (
        name,
        slug,
        created_by,
        email,
        config
      ) VALUES (
        v_org_name || '''s Organization',
        public.generate_unique_slug(v_org_name),
        NEW.id,
        NEW.email,
        jsonb_build_object(
          'is_personal', true,
          'created_at_timestamp', now()
        )
      ) RETURNING id INTO v_org_id;
      
      -- If we get here, the insert succeeded
      EXIT;
    EXCEPTION 
      WHEN unique_violation THEN
        v_attempt := v_attempt + 1;
        IF v_attempt > 5 THEN
          INSERT INTO public.logs (level, message, metadata)
          VALUES (
            'error',
            'Failed to create unique organization name after 5 attempts',
            jsonb_build_object('user_id', NEW.id, 'last_attempt', v_org_name)
          );
          RAISE EXCEPTION 'Failed to create unique organization name after 5 attempts';
        END IF;
        -- Continue to next iteration of loop
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
    'https://ucbtpddvvbsrqroqhvev.supabase.co/storage/v1/object/public/avatars/profile-circle-icon-256x256-cm91gqm2.png'
  );

  -- Create organization membership
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role
  ) VALUES (
    v_org_id,
    NEW.id,
    'admin'
  );

  -- Log successful completion
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
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'error',
    'Error in handle_new_user()',
    jsonb_build_object(
      'user_id', NEW.id,
      'error', SQLERRM,
      'state', SQLSTATE
    )
  );
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create single trigger for user creation
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
-- EMAIL CHAT TABLES
-- =========================================

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
  ai_classification text CHECK (ai_classification IN ('should_respond','no_response','unknown')) DEFAULT 'unknown',
  ai_confidence numeric(5,2) DEFAULT 0.00,
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

-- =========================================
-- LOGS TABLE
-- =========================================

-- Create logs table for application logging
CREATE TABLE IF NOT EXISTS public.logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for faster querying by level and created_at
CREATE INDEX IF NOT EXISTS logs_level_created_at_idx ON public.logs (level, created_at);

-- Grant access to service role
GRANT ALL ON public.logs TO service_role;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS logs_created_at_idx ON public.logs (created_at DESC);
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

-- Add function to create personal organization
CREATE OR REPLACE FUNCTION public.fn_create_personal_organization()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
  v_attempt int := 0;
  v_email text;
  v_display_name text;
BEGIN
  -- Get email from either direct field or metadata
  v_email := COALESCE(
    NEW.email,
    NEW.raw_user_meta_data->>'email',
    NEW.raw_user_meta_data->>'preferred_email'
  );

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No email found for user';
  END IF;

  -- Get display name from metadata or fallback to email prefix
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1)
  );

  -- Log profile creation
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Creating profile for new user',
    jsonb_build_object(
      'user_id', NEW.id,
      'email', v_email,
      'display_name', v_display_name,
      'trigger', 'handle_new_user'
    )
  );

  -- Create organization name with uniqueness retry logic
  LOOP
    v_org_name := CASE 
      WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN 
        CASE 
          WHEN v_attempt = 0 THEN NEW.raw_user_meta_data->>'full_name'
          ELSE NEW.raw_user_meta_data->>'full_name' || ' ' || v_attempt
        END
      ELSE 
        CASE
          WHEN v_attempt = 0 THEN split_part(NEW.email, '@', 1)
          ELSE split_part(NEW.email, '@', 1) || ' ' || v_attempt
        END
    END;

    BEGIN
      -- Create personal organization
      INSERT INTO public.organizations (
        name,
        slug,
        created_by,
        email,
        config
      ) VALUES (
        v_org_name || '''s Organization',
        public.generate_unique_slug(v_org_name),
        NEW.id,
        NEW.email,
        jsonb_build_object(
          'is_personal', true,
          'created_at_timestamp', now()
        )
      ) RETURNING id INTO v_org_id;
      
      -- If we get here, the insert succeeded
      EXIT;
    EXCEPTION 
      WHEN unique_violation THEN
        v_attempt := v_attempt + 1;
        IF v_attempt > 5 THEN
          RAISE EXCEPTION 'Failed to create unique organization name after 5 attempts';
        END IF;
        -- Continue to next iteration of loop
    END;
  END LOOP;

  -- Add user as admin of organization
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role
  ) VALUES (
    v_org_id,
    NEW.id,
    'admin'
  );

  -- Create or update profile
  INSERT INTO public.profiles (
    id,
    role,
    email,
    display_name,
    org_id
  ) VALUES (
    NEW.id,
    'customer',
    v_email,
    v_display_name,
    v_org_id
  )
  ON CONFLICT (id) DO UPDATE
  SET org_id = v_org_id
  WHERE profiles.id = NEW.id;

  -- Log organization creation
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'info',
    'Created personal organization for new user',
    jsonb_build_object(
      'org_id', v_org_id,
      'user_id', NEW.id,
      'org_name', v_org_name,
      'trigger', 'create_personal_organization'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  INSERT INTO public.logs (level, message, metadata)
  VALUES (
    'error',
    'Failed to create personal organization',
    jsonb_build_object(
      'user_id', NEW.id,
      'error', SQLERRM,
      'state', SQLSTATE,
      'trigger', 'create_personal_organization'
    )
  );
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create personal organization on user signup
DROP TRIGGER IF EXISTS tr_create_personal_organization ON auth.users;
CREATE TRIGGER tr_create_personal_organization
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_personal_organization();

-- Add after other trigger definitions
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

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('agent', 'admin')),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS invitations_organization_id_idx ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations(email);

-- Add RLS policies
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invitations" ON public.invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Create function to accept invitation
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
  -- Update invitation
  UPDATE public.invitations
  SET used_at = NOW()
  WHERE token = p_token
    AND organization_id = p_organization_id
    AND used_at IS NULL
    AND expires_at > NOW();

  -- Update user's role in profiles if needed
  UPDATE public.profiles
  SET role = p_role
  WHERE id = p_user_id
    AND (role IS NULL OR role = 'customer');

  -- Add or update organization membership
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role
  )
  VALUES (
    p_organization_id,
    p_user_id,
    p_role
  )
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = NOW();
END;
$$;

-- Function to update agent stats for first response
CREATE OR REPLACE FUNCTION public.fn_update_agent_first_response_stats()
RETURNS TRIGGER AS $$
DECLARE
  ticket_created_at timestamptz;
  agent_stats jsonb;
  response_time_mins int;
BEGIN
  -- Only proceed if this is an agent's comment
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = NEW.author_id 
    AND role IN ('agent', 'admin')
  ) THEN
    RETURN NEW;
  END IF;

  -- Get ticket creation time
  SELECT created_at INTO ticket_created_at
  FROM public.tickets
  WHERE id = NEW.ticket_id;

  -- Calculate response time in minutes
  response_time_mins := EXTRACT(EPOCH FROM (NEW.created_at - ticket_created_at)) / 60;

  -- Check if this is the first response from any agent
  IF NOT EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.profiles p ON c.author_id = p.id
    WHERE c.ticket_id = NEW.ticket_id
    AND p.role IN ('agent', 'admin')
    AND c.id != NEW.id
    AND c.created_at < NEW.created_at
  ) THEN
    -- Get current agent stats
    SELECT COALESCE(extra_json_1->'agentStats', '{}'::jsonb) INTO agent_stats
    FROM public.profiles
    WHERE id = NEW.author_id;

    -- Update agent stats
    UPDATE public.profiles
    SET extra_json_1 = jsonb_set(
      COALESCE(extra_json_1, '{}'::jsonb),
      '{agentStats}',
      jsonb_build_object(
        'totalFirstResponseTime', (COALESCE((agent_stats->>'totalFirstResponseTime')::int, 0) + response_time_mins),
        'totalTicketsResponded', (COALESCE((agent_stats->>'totalTicketsResponded')::int, 0) + 1),
        'totalResolutionTime', COALESCE((agent_stats->>'totalResolutionTime')::int, 0),
        'totalTicketsResolved', COALESCE((agent_stats->>'totalTicketsResolved')::int, 0)
      )
    )
    WHERE id = NEW.author_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update agent stats when a ticket is solved
CREATE OR REPLACE FUNCTION public.fn_update_agent_resolution_stats()
RETURNS TRIGGER AS $$
DECLARE
  agent_stats jsonb;
  resolution_time_mins int;
BEGIN
  -- Only proceed if status is changing to 'solved'
  IF NEW.status != 'solved' OR OLD.status = 'solved' THEN
    RETURN NEW;
  END IF;

  -- Only proceed if there's an assigned agent
  IF NEW.assigned_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate resolution time in minutes
  resolution_time_mins := EXTRACT(EPOCH FROM (NEW.updated_at - NEW.created_at)) / 60;

  -- Get current agent stats
  SELECT COALESCE(extra_json_1->'agentStats', '{}'::jsonb) INTO agent_stats
  FROM public.profiles
  WHERE id = NEW.assigned_agent_id;

  -- Update agent stats
  UPDATE public.profiles
  SET extra_json_1 = jsonb_set(
    COALESCE(extra_json_1, '{}'::jsonb),
    '{agentStats}',
    jsonb_build_object(
      'totalFirstResponseTime', COALESCE((agent_stats->>'totalFirstResponseTime')::int, 0),
      'totalTicketsResponded', COALESCE((agent_stats->>'totalTicketsResponded')::int, 0),
      'totalResolutionTime', (COALESCE((agent_stats->>'totalResolutionTime')::int, 0) + resolution_time_mins),
      'totalTicketsResolved', (COALESCE((agent_stats->>'totalTicketsResolved')::int, 0) + 1)
    )
  )
  WHERE id = NEW.assigned_agent_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update agent stats
CREATE TRIGGER tr_update_agent_first_response_stats
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_agent_first_response_stats();

CREATE TRIGGER tr_update_agent_resolution_stats
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_agent_resolution_stats();

-- Disable RLS on organizations
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Disable RLS on organization_members
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;

-- Drop existing policies since we're disabling RLS
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations they are members of" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners and admins can manage their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON public.organization_members;
