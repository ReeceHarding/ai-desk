-- Step 0: Set up schema ownership and permissions
ALTER SCHEMA public OWNER TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create ENUMs
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

-- Step 3: Create base tables
CREATE TABLE public.organizations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  sla_tier    public.sla_tier NOT NULL DEFAULT 'basic',
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Create profiles table with deferred foreign key check
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

-- Add the auth.users foreign key as a separate step
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

-- Step 4: Create helper functions
CREATE OR REPLACE FUNCTION public.fn_auto_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
SELECT EXISTS(
  SELECT 1
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'super_admin'
);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid AS $$
SELECT org_id
FROM public.profiles
WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
SELECT role
FROM public.profiles
WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Step 5: Create triggers
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

-- Step 6: Disable RLS on all tables for development
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
ALTER TABLE public.ticket_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;

-- Step 7: Create indexes
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
