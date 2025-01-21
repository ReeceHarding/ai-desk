## Supabase Database Structure for FlowSupport

This document outlines the database architecture for FlowSupport leveraging Supabase. It is structured to enable a highly scalable, secure, and multi-tenant environment for managing CRM operations. The design incorporates extensions, ENUM types, base tables, helper functions, triggers, RLS policies, and indexes to maximize functionality and maintain data integrity.

###

### Step 1: Extensions

`CREATE EXTENSION IF NOT EXISTS "pgcrypto"; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS vector;`

### Step 2: ENUM Types

`CREATE TYPE user_role AS ENUM ( 'customer', 'agent', 'admin', 'super_admin' ); CREATE TYPE ticket_status AS ENUM ( 'open', 'pending', 'on_hold', 'solved', 'closed', 'overdue' ); CREATE TYPE ticket_priority AS ENUM ( 'low', 'medium', 'high', 'urgent' ); CREATE TYPE sla_tier AS ENUM ( 'basic', 'premium' );`

### Step 3: Base Tables

These base tables support the core data storage for organizations, user profiles, team structures, knowledge base, and ticket management.

`-- Organization Table CREATE TABLE public.organizations ( id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, sla_tier sla_tier NOT NULL DEFAULT 'basic', config jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now() ); -- Profiles Table CREATE TABLE public.profiles ( id uuid PRIMARY KEY, role user_role NOT NULL DEFAULT 'customer', display_name text, email text, phone text, avatar_url text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now() );`

Additional Tables: Teams, Team Members, Tags

`-- Teams CREATE TABLE public.teams ( id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, description text, org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now() ); -- Team Members CREATE TABLE public.team_members ( team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE, PRIMARY KEY (team_id, user_id) ); -- Tags CREATE TABLE public.tags ( id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text UNIQUE NOT NULL, org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now() );`

Knowledge Base & Ticket Management

`-- Knowledge Base Articles CREATE TABLE public.knowledge_base_articles ( id uuid DEFAULT gen_random_uuid() PRIMARY KEY, title text NOT NULL, content text NOT NULL, author_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL, org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE, published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now() ); -- Tickets CREATE TABLE public.tickets ( id uuid DEFAULT gen_random_uuid() PRIMARY KEY, subject text NOT NULL, description text NOT NULL, status ticket_status NOT NULL DEFAULT 'open', priority ticket_priority NOT NULL DEFAULT 'low', customer_id uuid NOT NULL REFERENCES public.profiles (id), assigned_agent_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL, org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now() );`

### Step 4: Helper Functions

Useful functions to enhance operations and enforce data rules.

`CREATE OR REPLACE FUNCTION public.fn_auto_update_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean AS $$ SELECT EXISTS( SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin' ); $$ LANGUAGE sql STABLE;`

### Step 5: Triggers

To automate table updates and maintain timestamps for last updates.

`CREATE TRIGGER tr_organizations_update_timestamp BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE PROCEDURE public.fn_auto_update_timestamp(); CREATE TRIGGER tr_profiles_update_timestamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.fn_auto_update_timestamp();`

### Step 6: Enable RLS (Row-Level Security)

Restrict data access according to organizational boundaries.

`ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY; ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;`

### Step 7: RLS Policies

Define security policies to enforce access control.

`CREATE POLICY select_organizations ON public.organizations FOR SELECT TO authenticated USING (is_super_admin() OR id = current_user_org_id()); CREATE POLICY select_profiles ON public.profiles FOR SELECT TO authenticated USING (is_super_admin() OR id = auth.uid());`

### Step 8: Indexes

Improve query performance with strategically placed indexes.

`CREATE INDEX profiles_org_idx ON public.profiles (org_id); CREATE INDEX tickets_subject_trgm_idx ON public.tickets USING GIN (subject gin_trgm_ops);`

This database structure, defined using Supabase, meets the rigorous demands of an AI-driven CRM like FlowSupport, ensuring scalability, robust security, and efficient management of organizational data.
