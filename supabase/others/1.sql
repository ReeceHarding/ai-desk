--------------------------------------------------------------------------------
-- 0. DROP ENUMS (clean slate) 
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
      'https://example.com/default-avatar.png'
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
    'https://example.com/default-avatar.png'
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
-- 8. CREATE TIMESTAMP-UPDATE TRIGGERS FOR RELEVANT TABLES
--------------------------------------------------------------------------------

-- We'll handle each table that has "updated_at":

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_organizations_update_timestamp'
    AND tgrelid = 'public.organizations'::regclass
  ) THEN
    CREATE TRIGGER tr_organizations_update_timestamp
      BEFORE UPDATE ON public.organizations
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_profiles_update_timestamp'
    AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER tr_profiles_update_timestamp
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_teams_update_timestamp'
    AND tgrelid = 'public.teams'::regclass
  ) THEN
    CREATE TRIGGER tr_teams_update_timestamp
      BEFORE UPDATE ON public.teams
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_tags_update_timestamp'
    AND tgrelid = 'public.tags'::regclass
  ) THEN
    CREATE TRIGGER tr_tags_update_timestamp
      BEFORE UPDATE ON public.tags
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_kb_articles_update_timestamp'
    AND tgrelid = 'public.knowledge_base_articles'::regclass
  ) THEN
    CREATE TRIGGER tr_kb_articles_update_timestamp
      BEFORE UPDATE ON public.knowledge_base_articles
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_article_localizations_update_timestamp'
    AND tgrelid = 'public.article_localizations'::regclass
  ) THEN
    CREATE TRIGGER tr_article_localizations_update_timestamp
      BEFORE UPDATE ON public.article_localizations
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_tickets_update_timestamp'
    AND tgrelid = 'public.tickets'::regclass
  ) THEN
    CREATE TRIGGER tr_tickets_update_timestamp
      BEFORE UPDATE ON public.tickets
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_comments_update_timestamp'
    AND tgrelid = 'public.comments'::regclass
  ) THEN
    CREATE TRIGGER tr_comments_update_timestamp
      BEFORE UPDATE ON public.comments
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_ticket_embeddings_update_timestamp'
    AND tgrelid = 'public.ticket_embeddings'::regclass
  ) THEN
    CREATE TRIGGER tr_ticket_embeddings_update_timestamp
      BEFORE UPDATE ON public.ticket_embeddings
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_comment_embeddings_update_timestamp'
    AND tgrelid = 'public.comment_embeddings'::regclass
  ) THEN
    CREATE TRIGGER tr_comment_embeddings_update_timestamp
      BEFORE UPDATE ON public.comment_embeddings
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_reports_update_timestamp'
    AND tgrelid = 'public.reports'::regclass
  ) THEN
    CREATE TRIGGER tr_reports_update_timestamp
      BEFORE UPDATE ON public.reports
      FOR EACH ROW
      EXECUTE PROCEDURE public.fn_auto_update_timestamp();
  END IF;
END
$$;

-- Next set of new big tables (macros, automations, etc.) also need updated_at triggers
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

--------------------------------------------------------------------------------
-- 9. DISABLE RLS ON TABLES (DEV MODE)
--------------------------------------------------------------------------------

-- We'll just disable RLS if the table has it; no harm if not set.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'organizations'
      AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- (Repeat the same pattern for all other public.* tables we want to ensure are not RLS in dev.)

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
-- 10. CREATE ADDITIONAL INDEXES (IDEMPOTENT)
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
-- 11. ADD OPTIONAL ORGANIZATION POLICY FOR INSERTS
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
-- 12. CREATE/REPLACE is_super_admin() HELPER
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
-- 13. ADD OPTIONAL NEW COLUMNS (OUTREACH, BRAND, ETC.) IF NOT EXISTS
--------------------------------------------------------------------------------

-- organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS outreach_preferences jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_voice text,
  ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_scrape_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_plan text;

-- We already included the columns for profiles, tickets, knowledge_base_articles, email_logs
-- so there's nothing more to add here that wasn't already in the create statements.

--------------------------------------------------------------------------------
-- 14. CREATE TICKET_EMAIL_CHATS TABLE
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_email_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  message_id text NOT NULL,
  thread_id text NOT NULL,
  from_name text,
  from_address text,
  to_address text[] DEFAULT '{}'::text[],
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

--------------------------------------------------------------------------------
-- 15. STORAGE BUCKET & POLICIES FOR AVATARS
--------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'avatars', 'avatars', true, 50000000, ARRAY['image/*']::text[]
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'avatars'
);

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatar image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatar image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatar image" ON storage.objects;

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
-- 16. CREATE ADDITIONAL NEW TABLES (Macros, Automations, Deals, etc.)
--    (No conflicts with old)
--------------------------------------------------------------------------------

-- Below are all the "big list" tables that do not overwrite existing ones.
-- They each have updated_at columns, so we place triggers after creation.
-- For brevity, we keep them together.

CREATE TABLE IF NOT EXISTS public.macros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  macro_name text NOT NULL,
  macro_content text NOT NULL,
  is_global boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.macro_uses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  macro_id uuid NOT NULL REFERENCES public.macros(id) ON DELETE CASCADE,
  used_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  usage_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escalations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  escalation_name text NOT NULL,
  description text,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escalation_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  escalation_id uuid NOT NULL REFERENCES public.escalations(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  log_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_conditions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  condition_type text NOT NULL,
  condition_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  filter_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  step_type text NOT NULL,
  step_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_lead_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_name text NOT NULL,
  stage text NOT NULL DEFAULT 'prospect',
  deal_value numeric NOT NULL DEFAULT 0,
  assigned_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deal_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  daily_send_limit int NOT NULL DEFAULT 50,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_scraping_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scraping_job_id uuid REFERENCES public.outreach_scraping_jobs(id) ON DELETE CASCADE,
  domain text NOT NULL,
  company_name text,
  location text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.outreach_companies(id) ON DELETE CASCADE,
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
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  sequence_name text NOT NULL,
  total_steps int NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_sequence_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id uuid NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  delay_days int NOT NULL DEFAULT 0,
  template_content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_doc_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid REFERENCES public.knowledge_base_articles(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_doc_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seat_licenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_seats int NOT NULL DEFAULT 1,
  used_seats int NOT NULL DEFAULT 0,
  plan_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  model_preference text DEFAULT 'gpt-4',
  auto_respond_threshold numeric DEFAULT 0.85,
  brand_tone text,
  additional_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retargeting_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retargeting_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.retargeting_campaigns(id) ON DELETE CASCADE,
  lead_email text NOT NULL,
  full_name text,
  last_contacted_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retargeting_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.retargeting_leads(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_macros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  macro_name text NOT NULL,
  macro_content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personal_workflows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workflow_name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inbound_classifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email_log_id uuid REFERENCES public.email_logs(id) ON DELETE CASCADE,
  classification_label text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1.0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  marketing_lead_id uuid REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.domain_warmups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slack_team_id text NOT NULL,
  slack_bot_token text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.twilio_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  twilio_account_sid text NOT NULL,
  twilio_auth_token text,
  twilio_phone_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.voice_outreach (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid,
  phone_number text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  attempt_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 17. ADD TIMESTAMP UPDATE TRIGGERS ON NEW TABLES (MACROS, ESCALATIONS, etc.)
--------------------------------------------------------------------------------

-- We'll do the standard "IF NOT EXISTS" approach for each new table having an updated_at:

DO $$
DECLARE
  t TEXT[];
  tbl TEXT;
BEGIN
  -- List of new tables that have an updated_at to trigger
  t := ARRAY[
    'macros',
    'escalations',
    'automations',
    'achievements',
    'marketing_campaigns',
    'marketing_segments',
    'marketing_leads',
    'deals',
    'outreach_campaigns',
    'outreach_scraping_jobs',
    'outreach_contacts',
    'outreach_sequences',
    'knowledge_doc_categories',
    'seat_licenses',
    'brand_configs',
    'advanced_ai_configs',
    'retargeting_campaigns',
    'retargeting_leads',
    'personal_workflows',
    'domain_warmups',
    'ringcentral_integrations',
    'slack_integrations',
    'twilio_integrations',
    'voice_outreach'
  ];

  FOREACH tbl IN ARRAY t
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'tr_'||tbl||'_update_timestamp'
      AND tgrelid = ('public.'||tbl)::regclass
    ) THEN
      EXECUTE 'CREATE TRIGGER tr_'||tbl||'_update_timestamp
               BEFORE UPDATE ON public.'||tbl||'
               FOR EACH ROW
               EXECUTE PROCEDURE public.fn_auto_update_timestamp();';
    END IF;
  END LOOP;
END
$$;

--------------------------------------------------------------------------------
-- 18. DISABLE RLS ON NEW TABLES (DEV)
--------------------------------------------------------------------------------

-- We already used a DO block that disables RLS on all public.* tables that have it,
-- so we're covered. No need to individually repeat it.

--------------------------------------------------------------------------------
-- Done!
--------------------------------------------------------------------------------