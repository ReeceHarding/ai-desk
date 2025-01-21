-- Create tables first
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  config jsonb not null default '{}',
  sla_tier text not null default 'basic' check (sla_tier in ('basic', 'premium')),
  gmail_refresh_token text,
  gmail_access_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('member', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Add Gmail token columns to organizations table
alter table organizations
add column if not exists gmail_refresh_token text,
add column if not exists gmail_access_token text;

-- Enable RLS
alter table organizations enable row level security;
alter table organization_members enable row level security;

-- Policies for organizations table
create policy "Allow users to view organizations they are members of"
  on organizations for select
  using (
    exists (
      select 1 from organization_members
      where organization_members.organization_id = organizations.id
      and organization_members.user_id = auth.uid()
    )
  );

create policy "Allow admins to update their organization"
  on organizations for update
  using (
    exists (
      select 1 from organization_members
      where organization_members.organization_id = organizations.id
      and organization_members.user_id = auth.uid()
      and organization_members.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from organization_members
      where organization_members.organization_id = organizations.id
      and organization_members.user_id = auth.uid()
      and organization_members.role in ('admin', 'super_admin')
    )
  );

-- Policies for organization_members table
create policy "Allow users to view organization members"
  on organization_members for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
    )
  );

create policy "Allow admins to manage organization members"
  on organization_members for all
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'super_admin')
    )
  ); 