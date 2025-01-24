Below is a comprehensive, step-by-step set of instructions that unify all aspects of your ticketing system. These instructions reference your Supabase database and the Next.js (or similar) codebase you have, including how to store agent/customer/admin roles, manage organizations and slugs, handle sign-up flows, connect Gmail, and record agent statistics. Each instruction set is written in a definitive voice. No additional disclaimers are provided. Follow these steps exactly, in the order presented, stopping at the designated checkpoints for verification.

1. SUPABASE SCHEMA & MIGRATION UPDATES ✅

1.1. Add slug and public_mode Columns in organizations ✅

Open your existing Supabase migration file (for example, 20250123111534_schema.sql or whichever is your main current schema) and append the following in the relevant organizations section (near where name, sla_tier, etc. are created). Since you are "modifying existing supabase migrations rather than creating new migrations," simply locate the CREATE TABLE public.organizations block and ensure these two new columns exist:

-- 1. Add slug (unique, immutable) if not exists
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_mode boolean NOT NULL DEFAULT false;

-- Ensure slug is never null
ALTER TABLE public.organizations
  ALTER COLUMN slug SET NOT NULL;

	1.	The slug column is a unique text field that never changes once assigned. ✅
	2.	The public_mode column is a boolean that decides if the organization's "new-ticket" page can be accessed publicly (no token) or requires a token. ✅

	Checkpoint: After adding these lines to the relevant migration file (where organizations is created or modified) and re-running supabase db push (or your normal migration workflow), confirm that slug and public_mode now exist in the organizations table with the required constraints. ✅

1.2. Insert or Update "needs_verification" in Profiles Metadata ✅

Open the same main schema file where profiles is defined. Inside profiles, ensure we have a JSONB column (metadata or extra_json_1) for partial account flags. The code is:

-- The 'metadata' or 'extra_json_1' is already defined as jsonb in your 'profiles' table.
-- We do not need a new column, just ensure we can store a boolean there.

-- Example usage in code (no direct DDL needed):
-- We'll store "needs_verification": true/false in "metadata" or "extra_json_1".

No direct DDL changes are needed unless the profiles table has no JSONB. If it lacks JSONB, add:

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb;

	Checkpoint: Confirm that each profiles row can store metadata->needs_verification or extra_json_1->needs_verification. Test by manually inserting a profile row in psql or in the Supabase dashboard. ✅

1.3. Ticket "customer_side_solved" Flag in tickets Metadata ✅

Inside your main schema file, where tickets is created, ensure we can store the customer's solved indicator:

-- 'metadata' or 'extra_json_1' in tickets can store 'customer_side_solved'
-- No direct DDL needed if tickets already have a JSONB metadata.

-- Example usage in code:
-- "metadata" -> 'customer_side_solved' is set to true or false by the customer when they confirm they are satisfied.

Again, if your tickets table lacks a JSONB, add:

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS extra_json_1 jsonb NOT NULL DEFAULT '{}'::jsonb;

	Checkpoint: Confirm that the tickets table can store a JSON object with customer_side_solved: boolean. Test by inserting a row with metadata = '{"customer_side_solved": true}'. ✅

1.4. Agent Statistics in profiles.extra_json_1 ✅

We store agent stats in profiles.extra_json_1->agentStats. For instance:

-- No direct table change required if the 'extra_json_1' column already exists in profiles.
-- We'll store something like:
--  agentStats: {
--    totalFirstResponseTime: 0,
--    totalTicketsResponded: 0,
--    totalResolutionTime: 0,
--    totalTicketsResolved: 0
--  }

At run time, we dynamically maintain these counters so we can compute average times. No new DDL is needed except ensuring profiles.extra_json_1 is a JSONB column.

	Checkpoint: Confirm that you can store extra_json_1->agentStats->... in each profile row. Possibly do a test update in the console. ✅

2. CREATING & STORING ORGANIZATIONS, SLUGS, AND ADMIN SIGN-UP ✅

2.1. Admin Organization Creation ✅

In your Next.js code, open the file that handles the "business sign-up" route (for example, a page /auth/signup-business.tsx or similar).
	1.	When an admin registers:
	1.	Generate a slug from the org name by lowercasing and replacing spaces with hyphens. Check uniqueness in organizations.slug. ✅
	2.	Insert a new row into organizations with that slug, public_mode=false by default, and the name from the admin. ✅
	3.	Mark the user as role='admin'. ✅
	4.	Insert or update organization_members so that this user is "admin" of that org. ✅
	2.	Return or redirect the admin to /org/<slug>/dashboard. ✅

Pseudocode in your sign-up file:

// 1. Generate slug
const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
let finalSlug = baseSlug;
let i = 1;
while (true) {
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', finalSlug)
    .single();
  if (!existing) break;
  finalSlug = baseSlug + '-' + i;
  i++;
}

// 2. Insert new org
const { data: org, error: orgError } = await supabase
  .from('organizations')
  .insert({
    name,
    slug: finalSlug,
    public_mode: false
  })
  .single();

// 3. Mark current user as admin + membership
await supabase
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', user.id);

await supabase
  .from('organization_members')
  .insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'admin'
  });

	Checkpoint: Write a quick test. Attempt to create two organizations named "Acme Inc." and see that the second becomes "acme-inc-1" automatically. Confirm the user is set as admin. ✅

3. PUBLIC VS. PRIVATE NEW-TICKET LINKS ✅

3.1. In organizations Table, the public_mode Boolean ✅
	1.	If public_mode=true, anyone can do GET /org/<slug>/new-ticket to see the complaint form. ✅
	2.	If public_mode=false, the user must present a valid token from an invite_tokens or event_tokens table (like ?token=abc). You store or check that token upon page load. ✅

Implementation:
	•	Create a new table invite_tokens only if you want more advanced private flows. Example DDL appended to existing schema:

CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz,
  usage_limit int,
  created_at timestamptz NOT NULL DEFAULT now()
);

When the new-ticket page loads, if public_mode=false, check if ?token=... is valid in invite_tokens.

	Checkpoint: Try setting an org to public_mode=false, generate a token row in invite_tokens, and see that the "new-ticket" page blocks anyone lacking that token. ✅

4. CUSTOMER SIGN-UP OR GUEST FLOW ✅

4.1. The "/org//new-ticket" Page ✅

Open your file /pages/[orgSlug]/new-ticket.tsx or similar. Implementation:
	1.	When the user loads the form:
	1.	Retrieve the orgSlug from the URL (via Next.js [orgSlug] param). ✅
	2.	Check if the org has public_mode=true or if a valid token is present if public_mode=false. ✅
	3.	Show a form: [Email Address], [Subject], [Description], [Optional Display Name]. ✅
	2.	On Submit:
	1.	If !session (not logged in), do a Supabase "Sign Up" with role='customer' behind the scenes or do a partial creation:
	•	Insert or update profiles with needs_verification=true, role='customer'. ✅
	•	Possibly skip password; rely on magic links. ✅
	2.	Insert a new tickets row with customer_id=thatProfile.id, org_id=theOrgId, status='open'. ✅
	3.	Show a success: "Ticket created. #someID. We've emailed you details." ✅

Additionally: Mark them in organization_members(organization_id=theOrg, user_id=theProfile.id, role='customer'), if you want them in the membership table. ✅

	Checkpoint: Locally test: Go to /org/acme-inc/new-ticket, fill out the complaint, see the new ticket in the DB, see a new profiles row if the user didn't exist, and an optional membership row. ✅

4.2. Partial vs. Verified ✅

Store metadata->needs_verification=true if no password is set. If they finalize sign-up later, set needs_verification=false. This is implemented in your code that checks user's verification link from email.

	Checkpoint: Attempt to create a ticket with an unrecognized email. Confirm that the new profile row in profiles sets role='customer', needs_verification=true. ✅

5. AGENT & ADMIN INVITES ✅

5.1. Admin Invites ✅

In your admin console /org/<slug>/dashboard?view=admin, create an "Invite Agent" button. The steps are:
	1.	Admin enters the agent's email. The code calls: ✅

// 1. Insert into an 'invitations' or 'invite_tokens' table:
await supabase
  .from('invitations')
  .insert({
    org_id: currentOrgId,
    role: 'agent',
    token: someUUID(),
    expires_at: X
  });

// 2. Email the user a link: myzendesk.com/invite?orgSlug=acme-inc&role=agent&token=theGeneratedToken

	2.	The user clicks this link. If they are new, they sign up. If existing, you update organization_members with role=agent. If they are brand new, you also set profiles.role='agent'. ✅

	Checkpoint: Write a test for inviting an agent. The agent receives an email, visits the link, and sees themselves assigned as role=agent in that org. ✅

6. AGENT & ADMIN PERMISSIONS ✅
	1.	Agents see /org/<slug>/dashboard with the org's open tickets. They can respond. They can mark ticket status. They do not see "Admin Settings." ✅
	2.	Admins see the same plus an admin sub-page with "Invite Agent," "Edit Organization," "View Org Stats." ✅
	3.	Customers do not see that dashboard. They only see a simplified "My Tickets" page if they are fully logged in, or just email-based links if they are partial. ✅

Implementation detail: In your Next.js pages:
	•	A route pages/org/[slug]/dashboard.tsx checks the user's membership role. If 'agent' or 'admin', show the dashboard. If 'customer', redirect to "/profile" or show unauthorized. ✅

7. TICKET STATUS FLOW & "CUSTOMER-SIDE SOLVED" ✅

In tickets.status, only agent/admin can set 'open', 'pending', 'solved', 'closed'. ✅
A customer sets metadata->customer_side_solved: boolean. When they click "Mark as solved," your code: ✅

await supabase
  .from('tickets')
  .update({
    metadata: {
      ...existingMetadata,
      customer_side_solved: true
    }
  })
  .eq('id', ticketId);

The official ticket status remains agent-driven. ✅

8. STATS FOR AGENTS & ADMIN ✅

8.1. Agent Stats ✅

Store in profiles.extra_json_1->agentStats, e.g.:

{
  "totalTicketsResponded": 12,
  "totalFirstResponseTime": 350, // sum of minutes across those 12 tickets
  "totalTicketsResolved": 8,
  "totalResolutionTime": 920 // sum of minutes across those 8 tickets
}

Whenever an agent first replies to a ticket:
	1.	Compute minutes from ticket creation to now. ✅
	2.	Add to profiles.agentStats.totalFirstResponseTime. ✅
	3.	Increment profiles.agentStats.totalTicketsResponded. ✅

Whenever an agent sets status='solved':
	1.	Compute minutes from ticket creation. ✅
	2.	Add to profiles.agentStats.totalResolutionTime. ✅
	3.	Increment profiles.agentStats.totalTicketsResolved. ✅

Then the agent's average first response time is (totalFirstResponseTime / totalTicketsResponded). The average resolution time is (totalResolutionTime / totalTicketsResolved). ✅

Implementation:
	•	In your server or code that sets a comment from an agent, do:

// If first comment from this agent:
const diffMins = computeDifferenceInMinutes(ticket.created_at, new Date());
await supabase
  .from('profiles')
  .update({
    extra_json_1: {
      ...existingExtraJson1,
      agentStats: {
        ...existingAgentStats,
        totalFirstResponseTime: existingAgentStats.totalFirstResponseTime + diffMins,
        totalTicketsResponded: existingAgentStats.totalTicketsResponded + 1
      }
    }
  })
  .eq('id', agentId);

8.2. Admin Dashboard

Aggregate each agent's stats. Summation approach:
	•	For the entire org: sum all totalFirstResponseTime, sum all totalTicketsResponded, etc. Then do an average. Possibly store them or compute them on the fly.

Implementation: In pages/org/[slug]/dashboard/admin.tsx, do something like:

const { data: agents } = await supabase
  .from('organization_members')
  .select('user_id, role')
  .eq('organization_id', orgId)
  .eq('role', 'agent');

for (const agentMember of agents) {
  const { data: agentProfile } = await supabase
    .from('profiles')
    .select('extra_json_1')
    .eq('id', agentMember.user_id)
    .single();
  // sum up agentStats
}

Compute the totals for the org. Display them.

	Checkpoint: Write tests verifying an agent's first comment updates agentStats. Then check the admin page for correct sums.

9. GMAIL CONNECTION ✅
	1.	Optionally, any user can connect Gmail in Profile Settings page. Agents or admins might do so for direct email sending. ✅
	2.	The stored tokens go in profiles.gmail_access_token and profiles.gmail_refresh_token. ✅
	3.	For an org-level mailbox, store them in organizations.gmail_access_token and organizations.gmail_refresh_token. ✅
	4.	The code that does "Send from Gmail" or "Fetch inbound Gmail" is triggered only if tokens exist. ✅

Implementation:
	•	See your existing gmail.ts files. On the user's profile page, show a "Connect Gmail" button leading to the OAuth flow. On success, store tokens in profiles. ✅

	Checkpoint: Attempt to connect Gmail as an agent. Then attempt to send an email from the agent's interface, verifying the tokens are used. ✅

10. PAGE-BY-PAGE FLOWS (FINAL SUMMARY)
	1.	/auth/signup-business: ✅
	•	The user sets "Company Name," "Email," "Password." ✅
	•	The system creates an organizations row with a slug, sets them role='admin', inserts organization_members(orgId, userId, 'admin'), redirects to /org/<slug>/dashboard. ✅
	2.	/org/<slug>/new-ticket: ✅
	•	The system checks public_mode or token. ✅
	•	The user files a complaint with email, subject, description. ✅
	•	If a new user, store profiles with role='customer', needs_verification=true. ✅
	•	Insert tickets(customer_id, org_id, status='open'). ✅
	•	Return "Thank you, ticket #123." ✅
	3.	/org/<slug>/dashboard: ✅
	•	Only for role in ('agent','admin') under membership. They see a table of tickets. Agents can respond, set status, see their stats. Admin sees an "Admin Settings" toggle. ✅
	4.	/org/<slug>/dashboard?view=admin:
	•	Admin sees "Invite Agent" (generates link). Also sees org-level stats. Possibly sees a toggle to public_mode.
	5.	/invite?orgSlug=<>&role=agent&token=...:
	•	On load, verifies the token. On success, either logs user in or signs them up, sets role=agent in membership. Then redirects to /org/<slug>/dashboard.
	6.	Profile Settings page (for any user): ✅
	•	They see fields to update display name, connect Gmail, etc. ✅
	•	If role='agent', the user might see an overview of their personal stats.

No subdomains. No confusion. The system is consistent.

11. CODE CHANGE OVERVIEW ✅

Below is a condensed list of exactly which files you will modify or create:
	1.	/supabase/migrations/20250123111534_schema.sql (or your main schema): ✅
	•	Under CREATE TABLE public.organizations, add slug text UNIQUE NOT NULL, public_mode boolean NOT NULL DEFAULT false. ✅
	•	If needed, add extra_json_1 jsonb to profiles or tickets. ✅
	2.	/pages/auth/signup-business.tsx (or similar admin sign-up): ✅
	•	Implement the logic to create organizations with a slug, set role='admin', add membership. ✅
	3.	/pages/org/[slug]/new-ticket.tsx: ✅
	•	Check public_mode or token, show the new ticket form, create partial customers, create ticket record. ✅
	4.	/pages/org/[slug]/dashboard.tsx (or an index.tsx under /org/[slug]/dashboard): ✅
	•	Display tickets for agent/admin. If a user is a normal "customer," redirect or show "unauthorized." ✅
	5.	/pages/org/[slug]/dashboard/admin.tsx:
	•	Show invite agent form, or an "Invite" button that triggers an API route. Show org-level stats.
	6.	/pages/invite.tsx:
	•	Read the token from URL, do the membership logic.
	7.	Stats updates: Inside your comment creation or ticket status update code, add logic that updates profiles.extra_json_1->agentStats.

Additionally:
	•	If you need an "invitations" table or "invite_tokens", add it in the same or a separate existing migration block.
	•	If you want "public_mode" to be toggleable, add a route or page so the admin can toggle it.

	Checkpoint: Confirm each relevant file is updated. Confirm the new columns appear in your DB. Confirm all sign-up flows work as intended.

12. TESTING & VALIDATION
	1.	Migration Verification: ✅
	•	supabase db reset && supabase db push ✅
	•	Confirm new columns appear in organizations (slug, public_mode). ✅
	2.	Simple Unit Tests:
	•	For each function that inserts an organization, test the slug uniqueness logic.
	•	For each function that inserts or updates agentStats, test a sample scenario.
	3.	Role Checking: ✅
	•	Write a test ensuring role='customer' can't access /org/<slug>/dashboard. ✅
	4.	UI Flow: ✅
	•	Start as an admin: sign up a new organization. ✅
	•	Switch to incognito: go to /org/<slug>/new-ticket, file a complaint with an unknown email, confirm partial profile. ✅
	•	As an agent, open the dashboard, respond. Confirm agentStats updates.
	•	As the admin, open the admin sub-page. Summation of the agent's stats is correct.

13. WHY THIS IS FULLY COMPLETE ✅

This plan ensures:
	1.	One consistent approach for storing new organizations with a permanent slug. ✅
	2.	A public or private mode for the new-ticket route. ✅
	3.	Agent and admin roles assigned strictly by the admin's invitation.
	4.	Partial sign-ups for customers. ✅
	5.	Stats for agent average times.
	6.	A place for Gmail integration. ✅
	7.	Guaranteed clarity with no duplicates, no confusion about subdomains, and no user self-assigning roles. ✅

No guesswork is left. All code changes integrate into your existing schema and Next.js code following these steps.

End of instructions.