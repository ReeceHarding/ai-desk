-- Enable necessary extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "vector";

-- Create custom types
create type user_role as enum ('admin', 'agent', 'customer');

-- Create organizations table
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create profiles table
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  organization_id uuid references organizations on delete set null,
  role user_role not null default 'customer',
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create teams table
create table teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create team_members table
create table team_members (
  team_id uuid references teams on delete cascade,
  profile_id uuid references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

-- Create tickets table
create table tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  team_id uuid references teams on delete set null,
  assigned_to uuid references profiles on delete set null,
  created_by uuid not null references profiles on delete cascade,
  status text not null default 'open',
  priority text not null default 'medium',
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create comments table
create table comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create attachments table
create table attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets on delete cascade,
  comment_id uuid references comments on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  created_at timestamptz not null default now(),
  check (
    (ticket_id is not null and comment_id is null) or
    (ticket_id is null and comment_id is not null)
  )
);

-- Enable Row Level Security
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table tickets enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;

-- Create policies
-- Organizations policies
create policy "Users can view their organization"
  on organizations for select
  using (id in (
    select organization_id from profiles
    where id = auth.uid()
  ));

create policy "Admins can update their organization"
  on organizations for update
  using (id in (
    select organization_id from profiles
    where id = auth.uid() and role = 'admin'
  ));

-- Profiles policies
create policy "Users can view profiles in their organization"
  on profiles for select
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid()
  ));

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

-- Teams policies
create policy "Users can view teams in their organization"
  on teams for select
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid()
  ));

create policy "Admins can manage teams"
  on teams for all
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid() and role = 'admin'
  ));

-- Team members policies
create policy "Users can view team members in their organization"
  on team_members for select
  using (team_id in (
    select id from teams
    where organization_id in (
      select organization_id from profiles
      where id = auth.uid()
    )
  ));

create policy "Admins can manage team members"
  on team_members for all
  using (team_id in (
    select id from teams
    where organization_id in (
      select organization_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  ));

-- Tickets policies
create policy "Users can view tickets in their organization"
  on tickets for select
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid()
  ));

create policy "Users can create tickets in their organization"
  on tickets for insert
  with check (organization_id in (
    select organization_id from profiles
    where id = auth.uid()
  ));

create policy "Agents and admins can update tickets"
  on tickets for update
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid() and role in ('agent', 'admin')
  ));

-- Comments policies
create policy "Users can view comments on accessible tickets"
  on comments for select
  using (ticket_id in (
    select id from tickets
    where organization_id in (
      select organization_id from profiles
      where id = auth.uid()
    )
  ));

create policy "Users can create comments on accessible tickets"
  on comments for insert
  with check (ticket_id in (
    select id from tickets
    where organization_id in (
      select organization_id from profiles
      where id = auth.uid()
    )
  ));

-- Attachments policies
create policy "Users can view attachments on accessible tickets"
  on attachments for select
  using (
    (ticket_id in (
      select id from tickets
      where organization_id in (
        select organization_id from profiles
        where id = auth.uid()
      )
    )) or
    (comment_id in (
      select id from comments
      where ticket_id in (
        select id from tickets
        where organization_id in (
          select organization_id from profiles
          where id = auth.uid()
        )
      )
    ))
  );

create policy "Users can upload attachments to accessible tickets"
  on attachments for insert
  with check (
    (ticket_id in (
      select id from tickets
      where organization_id in (
        select organization_id from profiles
        where id = auth.uid()
      )
    )) or
    (comment_id in (
      select id from comments
      where ticket_id in (
        select id from tickets
        where organization_id in (
          select organization_id from profiles
          where id = auth.uid()
        )
      )
    ))
  );
