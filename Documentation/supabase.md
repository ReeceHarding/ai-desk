# Supabase Configuration Documentation

## Database Information

API URL: https://ucbtpddvvbsrqroqhvev.supabase.co
GraphQL URL: http://127.0.0.1:54321/graphql/v1
S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
JWT secret: E8aYEQPrx2qj1lSHpzhadIOtafNy4DNF1ehuuUeR9/5sJsE/lvmP7eC577wheV5aaI2nonl2ZkO5Q8a6T4PRiQ==
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYnRwZGR2dmJzcnFyb3FodmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MDI2NDEsImV4cCI6MjA1Mjk3ODY0MX0.M1DQlj8-IxmSWvGP4cydOUNgxo6MsgElXlunvp2ffPE
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYnRwZGR2dmJzcnFyb3FodmV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzQwMjY0MSwiZXhwIjoyMDUyOTc4NjQxfQ.COsl2ot_nlityKLptKW_a2Fs0b3Y8dy0ZO7s9MpAKSU
S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
S3 Region: local

## Database Schema

### Tables and Columns
```sql
                                                   List of relations
   Schema   |          Name           | Type  |     Owner      | Persistence | Access method |    Size    | Description 
------------+-------------------------+-------+----------------+-------------+---------------+------------+-------------
 extensions | pg_stat_statements      | view  | supabase_admin | permanent   |               | 0 bytes    | 
 extensions | pg_stat_statements_info | view  | supabase_admin | permanent   |               | 0 bytes    | 
 public     | organization_members    | table | postgres       | permanent   | heap          | 8192 bytes | 
 public     | organizations           | table | postgres       | permanent   | heap          | 8192 bytes | 
(4 rows)

```

### Table Details


#### organizations
```sql
                                                          Table "public.organizations"
       Column        |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
---------------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id                  | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 name                | text                     |           | not null |                   | extended |             |              | 
 config              | jsonb                    |           | not null | '{}'::jsonb       | extended |             |              | 
 sla_tier            | text                     |           | not null | 'basic'::text     | extended |             |              | 
 gmail_refresh_token | text                     |           |          |                   | extended |             |              | 
 gmail_access_token  | text                     |           |          |                   | extended |             |              | 
 created_at          | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at          | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "organizations_pkey" PRIMARY KEY, btree (id)
Check constraints:
    "organizations_sla_tier_check" CHECK (sla_tier = ANY (ARRAY['basic'::text, 'premium'::text]))
Referenced by:
    TABLE "organization_members" CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
Policies:
    POLICY "Allow admins to update their organization" FOR UPDATE
      USING ((EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.organization_id = organizations.id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))))
      WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.organization_id = organizations.id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))))
    POLICY "Allow users to view organizations they are members of" FOR SELECT
      USING ((EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.organization_id = organizations.id) AND (organization_members.user_id = auth.uid())))))
Access method: heap

```

#### organization_members
```sql
                                                Table "public.organization_members"
     Column      |           Type           | Collation | Nullable | Default | Storage  | Compression | Stats target | Description 
-----------------+--------------------------+-----------+----------+---------+----------+-------------+--------------+-------------
 organization_id | uuid                     |           | not null |         | plain    |             |              | 
 user_id         | uuid                     |           | not null |         | plain    |             |              | 
 role            | text                     |           | not null |         | extended |             |              | 
 created_at      | timestamp with time zone |           | not null | now()   | plain    |             |              | 
 updated_at      | timestamp with time zone |           | not null | now()   | plain    |             |              | 
Indexes:
    "organization_members_pkey" PRIMARY KEY, btree (organization_id, user_id)
Check constraints:
    "organization_members_role_check" CHECK (role = ANY (ARRAY['member'::text, 'admin'::text, 'super_admin'::text]))
Foreign-key constraints:
    "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
Policies:
    POLICY "Allow admins to manage organization members"
      USING ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = organization_members.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))))
    POLICY "Allow users to view organization members" FOR SELECT
      USING ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = organization_members.organization_id) AND (om.user_id = auth.uid())))))
Access method: heap

```

#### profiles
```sql
```
