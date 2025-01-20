-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create ENUMs
CREATE TYPE user_role AS ENUM (
  'customer',
  'agent',
  'admin',
  'super_admin'
);

CREATE TYPE ticket_status AS ENUM (
  'open',
  'pending',
  'on_hold',
  'solved',
  'closed',
  'overdue'
);

CREATE TYPE ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE sla_tier AS ENUM (
  'basic',
  'premium'
);

-- Step 3: Create base tables
CREATE TABLE public.organizations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  sla_tier    sla_tier NOT NULL DEFAULT 'basic',
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Create profiles table with deferred foreign key check
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'customer',
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
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'low',
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

-- Step 6: Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_localizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_co_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies
CREATE POLICY select_organizations ON public.organizations
FOR SELECT TO authenticated
USING (is_super_admin() OR id = current_user_org_id());

CREATE POLICY insert_organizations ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY update_organizations ON public.organizations
FOR UPDATE TO authenticated
USING (is_super_admin() OR id = current_user_org_id())
WITH CHECK (is_super_admin() OR id = current_user_org_id());

CREATE POLICY delete_organizations ON public.organizations
FOR DELETE TO authenticated
USING (is_super_admin());

CREATE POLICY select_profiles ON public.profiles
FOR SELECT TO authenticated
USING (is_super_admin() OR id = auth.uid());

CREATE POLICY insert_profiles ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (id = auth.uid() AND org_id = current_user_org_id()));

CREATE POLICY update_profiles ON public.profiles
FOR UPDATE TO authenticated
USING (is_super_admin() OR id = auth.uid())
WITH CHECK (is_super_admin() OR id = auth.uid());

CREATE POLICY delete_profiles ON public.profiles
FOR DELETE TO authenticated
USING (is_super_admin() OR id = auth.uid());

CREATE POLICY select_teams ON public.teams
FOR SELECT TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY insert_teams ON public.teams
FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY update_teams ON public.teams
FOR UPDATE TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id())
WITH CHECK (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY delete_teams ON public.teams
FOR DELETE TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY select_team_members ON public.team_members
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.teams t WHERE t.id = team_id) = current_user_org_id()
  )
);

CREATE POLICY insert_team_members ON public.team_members
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.teams t WHERE t.id = team_id) = current_user_org_id()
    AND (SELECT org_id FROM public.profiles p WHERE p.id = user_id) = current_user_org_id()
  )
);

CREATE POLICY delete_team_members ON public.team_members
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.teams t WHERE t.id = team_id) = current_user_org_id()
  )
);

CREATE POLICY select_tags ON public.tags
FOR SELECT TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY insert_tags ON public.tags
FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY update_tags ON public.tags
FOR UPDATE TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id())
WITH CHECK (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY delete_tags ON public.tags
FOR DELETE TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY select_knowledge_base_articles ON public.knowledge_base_articles
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND deleted_at IS NULL
    AND (
      flagged_internal = false
      OR current_user_role() IN ('agent','admin')
    )
  )
);

CREATE POLICY select_article_revisions ON public.article_revisions
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.knowledge_base_articles a WHERE a.id = article_id) = current_user_org_id()
  )
);

CREATE POLICY select_article_localizations ON public.article_localizations
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.knowledge_base_articles a WHERE a.id = article_id) = current_user_org_id()
    AND (SELECT deleted_at FROM public.knowledge_base_articles a WHERE a.id = article_id) IS NULL
  )
);

CREATE POLICY select_tickets ON public.tickets
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND deleted_at IS NULL
  )
  OR (
    customer_id = auth.uid()
    AND org_id = current_user_org_id()
    AND deleted_at IS NULL
  )
);

CREATE POLICY insert_tickets ON public.tickets
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
  )
);

CREATE POLICY update_tickets ON public.tickets
FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND deleted_at IS NULL
  )
)
WITH CHECK (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
  )
);

CREATE POLICY delete_tickets ON public.tickets
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('agent','admin')
  )
);

CREATE POLICY select_ticket_co_assignees ON public.ticket_co_assignees
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.tickets tk WHERE tk.id = ticket_id) = current_user_org_id()
    AND (SELECT deleted_at FROM public.tickets tk WHERE tk.id = ticket_id) IS NULL
  )
);

CREATE POLICY insert_ticket_co_assignees ON public.ticket_co_assignees
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.tickets tk WHERE tk.id = ticket_id) = current_user_org_id()
    AND (SELECT org_id FROM public.profiles p WHERE p.id = agent_id) = current_user_org_id()
    AND (agent_id IS DISTINCT FROM (SELECT assigned_agent_id FROM public.tickets t2 WHERE t2.id = ticket_id))
  )
);

CREATE POLICY delete_ticket_co_assignees ON public.ticket_co_assignees
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.tickets tk WHERE tk.id = ticket_id) = current_user_org_id()
  )
);

CREATE POLICY select_comments ON public.comments
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND deleted_at IS NULL
    AND (
      is_private = false
      OR (current_user_role() IN ('agent','admin'))
    )
  )
);

CREATE POLICY insert_comments ON public.comments
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND (
      (current_user_role() = 'customer' AND is_private = false)
      OR (current_user_role() IN ('agent','admin'))
    )
  )
);

CREATE POLICY update_comments ON public.comments
FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND deleted_at IS NULL
    AND author_id = auth.uid()
  )
)
WITH CHECK (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND author_id = auth.uid()
  )
);

CREATE POLICY delete_comments ON public.comments
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = current_user_org_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('agent','admin')
  )
);

CREATE POLICY select_attachments ON public.attachments
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.comments c WHERE c.id = comment_id) = current_user_org_id()
    AND (SELECT deleted_at FROM public.comments c WHERE c.id = comment_id) IS NULL
  )
);

CREATE POLICY insert_attachments ON public.attachments
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.comments c WHERE c.id = comment_id) = current_user_org_id()
  )
);

CREATE POLICY delete_attachments ON public.attachments
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.comments c WHERE c.id = comment_id) = current_user_org_id()
  )
);

CREATE POLICY select_ticket_watchers ON public.ticket_watchers
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.tickets t WHERE t.id = ticket_id) = current_user_org_id()
    AND (SELECT deleted_at FROM public.tickets t WHERE t.id = ticket_id) IS NULL
  )
);

CREATE POLICY insert_ticket_watchers ON public.ticket_watchers
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.tickets t WHERE t.id = ticket_id) = current_user_org_id()
    AND (SELECT org_id FROM public.profiles p WHERE p.id = user_id) = current_user_org_id()
  )
);

CREATE POLICY delete_ticket_watchers ON public.ticket_watchers
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.tickets t WHERE t.id = ticket_id) = current_user_org_id()
  )
);

CREATE POLICY select_article_watchers ON public.article_watchers
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.knowledge_base_articles a WHERE a.id = article_id) = current_user_org_id()
    AND (SELECT deleted_at FROM public.knowledge_base_articles a WHERE a.id = article_id) IS NULL
  )
);

CREATE POLICY insert_article_watchers ON public.article_watchers
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.knowledge_base_articles a WHERE a.id = article_id) = current_user_org_id()
    AND (SELECT org_id FROM public.profiles p WHERE p.id = user_id) = current_user_org_id()
  )
);

CREATE POLICY delete_article_watchers ON public.article_watchers
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.knowledge_base_articles a WHERE a.id = article_id) = current_user_org_id()
  )
);

CREATE POLICY select_audit_logs ON public.audit_logs
FOR SELECT TO authenticated
USING (is_super_admin() OR actor_id = auth.uid());

CREATE POLICY insert_audit_logs ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY update_audit_logs ON public.audit_logs
FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY delete_audit_logs ON public.audit_logs
FOR DELETE TO authenticated
USING (is_super_admin());

CREATE POLICY select_ticket_embeddings ON public.ticket_embeddings
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.tickets t WHERE t.id = ticket_id) = current_user_org_id()
    AND (SELECT deleted_at FROM public.tickets t WHERE t.id = ticket_id) IS NULL
  )
);

CREATE POLICY insert_ticket_embeddings ON public.ticket_embeddings
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    (SELECT org_id FROM public.tickets t WHERE t.id = ticket_id) = current_user_org_id()
  )
);

CREATE POLICY select_reports ON public.reports
FOR SELECT TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY insert_reports ON public.reports
FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY update_reports ON public.reports
FOR UPDATE TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id())
WITH CHECK (is_super_admin() OR org_id = current_user_org_id());

CREATE POLICY delete_reports ON public.reports
FOR DELETE TO authenticated
USING (is_super_admin() OR org_id = current_user_org_id());

-- Step 8: Create indexes
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
