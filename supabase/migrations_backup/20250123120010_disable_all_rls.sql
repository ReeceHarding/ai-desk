-- Drop all policies for logs table
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.logs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.logs;
DROP POLICY IF EXISTS "Allow postgres role full access" ON public.logs;
DROP POLICY IF EXISTS "Service role can do all on logs" ON public.logs;

-- Disable RLS on all tables
ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.logs TO postgres;
GRANT ALL ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;

-- Grant all permissions to public role for development
GRANT ALL ON ALL TABLES IN SCHEMA public TO public;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO public;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO public;

-- Log the change
INSERT INTO public.logs (level, message, metadata)
VALUES (
  'info',
  'Disabled RLS on all tables for development',
  jsonb_build_object(
    'migration', '20250123120010_disable_all_rls',
    'changes', ARRAY[
      'Disabled RLS on all tables',
      'Granted all permissions to public role'
    ]
  )
); 