# Zendesk Clone Implementation TODO List

Goal:

let's adjust hte sign up flow. before showing the sign up screen, i want to ask the okay so before we start the sign up flow i want to add another screen that is our root path so we'll have a landing page and on the landing page it'll say are you a like do you have a question are you an agent or do you want to start your own organization then once they click one of those if they click agent we'll bring we'll bring them to the sign up page but we'll change the sign up page and we'll show an additional field this additional field will say what is the name of the company that you work for this sign up field as you start typing in it it'll automatically start filling in it'll show all the organizations at first with an autofill pop-up like google autofill search does and then it you type the number of choices will get whittled down based on a sub string search and then once you click the company word for it'll fill in the company's name and we will and then they'll fill in their email and password once they do that um then they will be directed to our dashboard screen similarly for admins if they click i'm an admin admin it'll say the same signup page but this time it'll be what company do you work for um once they click the company that they or sorry what is the name of your company they'll type in the name of their company they'll type in their email password then we'll create an organization assign them to that organization and then move on to the dashboard i forgot to mention that if they say that they are an agent we will assign them to the company they say they work for after they do the sign up page so once they click sign up we'll keep the same functionality creating the profile creating the authentication and then we'll also create an organization and assign the user to that organization and bind the two there can you create a step-by-step guide of the steps we should take in order to accomplish this including like designing the landing page and changing everything 

Below is a high-level Step-by-Step Implementation Guide for your junior dev team to:
	1.	Add a landing page for selecting user type (“Have a Question,” “I’m an Agent,” or “I Want to Start an Organization”).
	2.	Adjust the Signup Flow to:
	•	Show different fields (e.g., “Which company do you work for?” or “New organization name”) depending on user selection.
	•	Dynamically search for existing organizations (autocomplete suggestions).
	•	Create new organization if user chooses “Admin” path or picks a new org name.
	•	Associate the user with the selected or newly created organization.
	3.	Real-Time Messaging (customer <-> agent) to let customers and agents chat inside an active ticket.
	4.	Ticket Resolution logic (both agent and customer can mark ticket as resolved/closed).

Below are the main tasks in sequence, referencing your existing code structure. (E.g., If you already have certain pages, you can just modify them or create new ones as needed.)

1. LANDING PAGE (Root Path)

a) Create a new page at /pages/index.tsx
	1.	Design a simple UI with three large buttons or cards:
	•	“I have a question” → will direct the user to signup?type=customer or “/auth/signup?type=customer”
	•	“I’m an Agent” → will direct the user to signup?type=agent or “/auth/signup?type=agent”
	•	“Start an Organization” → will direct the user to signup?type=admin or “/auth/signup?type=admin`
	2.	This page can also have marketing text, logos, etc. A straightforward approach is to have something like:

// pages/index.tsx
export default function LandingPage() {
  const router = useRouter();
  
  const handleClick = (roleType: 'customer' | 'agent' | 'admin') => {
    router.push(`/auth/signup?type=${roleType}`);
  };
  
  return (
    <div>
      <h1>Welcome to Our System</h1>
      <button onClick={() => handleClick('customer')}>I Have a Question</button>
      <button onClick={() => handleClick('agent')}>I’m an Agent</button>
      <button onClick={() => handleClick('admin')}>Start an Organization</button>
    </div>
  );
}



b) Middleware Redirect (Optional)
	•	If you have a middleware that currently redirects / → /dashboard if logged in, you can remove that logic or update it to land on this new page for non-logged-in users. For example:

// middleware.ts (existing)
if (isRootPage && !session) {
  return NextResponse.next(); // let them see the landing
}
// If session is valid and they're at root, maybe still push them to /dashboard

2. UPDATED SIGNUP PAGE

a) Existing Flow
	•	Currently, pages/auth/signup.tsx checks type from router.query.type. Let’s expand to have either:
	•	“customer” → minimal: email, password
	•	“agent” → email, password + “Which company do you work for?” (search input w/ autocomplete)
	•	“admin” → email, password + “Name of your new organization”

b) Implementation Steps
	1.	Conditional Form Fields
	•	If type==="agent", show a text field labeled Which Company do you work for?.
	•	As user types, show an autocomplete list of existing org names from the organizations table.
	•	If type==="admin", show a text field labeled Name of your organization.
	•	This can be plain: user just types new org name.
	2.	Autocomplete for Agents
	•	On input change, call a function searchOrganizations(query: string) that calls a Supabase endpoint or an internal Next API route:

// (Potentially in /pages/api/organization-search.ts or a serverless route)
// This route does a LIKE or ILIKE on the organizations.name column

const { data, error } = await supabase
  .from('organizations')
  .select('id, name')
  .ilike('name', `%${query}%`)
  .limit(5);


	•	Display results in a small popover or list. When user clicks a result, fill the field, store orgId in local state.

	3.	On Submit
	•	If type==="agent", call existing signup logic. Once Supabase creates the user, associate that user with the selected orgId.
	•	If type==="admin", after signup, create a new organizations row with user-supplied name and add them as admin in organization_members.

Important: The “trigger function handle_new_user()” in your schema automatically creates a personal org. If you want a custom flow (agent or admin picks an existing or new org), you could either:
	1.	Disable or modify that trigger function (so it doesn’t always create an org).
	2.	Overwrite the profiles.org_id after the user is created, or remove the function’s logic around personal org creation if type is agent or admin.

c) Example Pseudocode

Within signup.tsx:

import { searchOrganizations } from '../path/to/api'; // or call fetch('api/...')

function SignUp() {
  const router = useRouter();
  const type = router.query.type; // 'agent' | 'admin' | 'customer'

  const [orgName, setOrgName] = useState('');
  const [orgSearchResults, setOrgSearchResults] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  
  const handleOrgSearch = async (value: string) => {
    setOrgName(value);
    // Only search if length > 2 or something
    if (value.length > 2) {
      const results = await searchOrganizations(value);
      setOrgSearchResults(results);
    } else {
      setOrgSearchResults([]);
    }
  };

  const selectOrg = (org) => {
    setOrgName(org.name);
    setSelectedOrgId(org.id);
    setOrgSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Step 1: signUp with Supabase
    const { data, error } = await supabase.auth.signUp({ ... });
    if (error) { ... }

    // Step 2: If 'agent', upsert or attach to existing org
    if (type === 'agent') {
       await upsertOrgMembership(selectedOrgId, data.user.id, 'agent');
       // e.g. supabase.from('organization_members').insert(...) 
    }
    // Step 3: If 'admin', create new org
    if (type === 'admin') {
      const newOrg = await supabase.from('organizations').insert({
        name: orgName,
        ...
      }).select().single();
      // then add membership for that user
      await supabase.from('organization_members').insert({
        organization_id: newOrg.id, 
        user_id: data.user.id,
        role: 'admin'
      });
      // Also update profiles.org_id if needed
    }

    // ...
    router.push('/dashboard');
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* email, password fields, etc */}
      
      {type === 'agent' && (
        <div>
          <label>Which company do you work for?</label>
          <input 
            value={orgName}
            onChange={(e) => handleOrgSearch(e.target.value)}
          />
          {/* Render orgSearchResults if length>0 */}
          {orgSearchResults.map(org => (
            <div key={org.id} onClick={() => selectOrg(org)}>
              {org.name}
            </div>
          ))}
        </div>
      )}

      {type === 'admin' && (
        <div>
          <label>New Organization Name</label>
          <input 
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
        </div>
      )}

      <button type="submit">Sign up</button>
    </form>
  );
}

3. REAL-TIME MESSAGING (CUSTOMER <-> AGENT)

a) Goal
	•	A ticket’s comments (or a new table for real-time messages) can be listened to in real time.
	•	Either continue using the existing comments table with a “channel subscription” for that ticket, or create a new messages table.
	•	Once the user is on the ticket page, you can do:

// Subscribe in useEffect
supabase.channel('comments-for-ticket-123')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: 'ticket_id=eq.123' }, payload => {
     // new comment arrived => setState
  })
  .subscribe();



b) Implementation Steps
	1.	On the customer’s Ticket details page: show a chat panel. When user posts a message, do supabase.from('comments').insert(...).
	2.	On the agent’s Ticket details page: also subscribe to the same ticket_id. They see new messages in real time.
	3.	Both can mark a ticket as resolved or closed. The agent’s UI has a “Close Ticket” button; the customer’s UI has a “Resolve/Mark as Solved” button, which updates tickets.status='solved'.

c) Mark as Resolved
	•	Add a simple button e.g. <Button onClick={() => closeTicket(ticketId)}>Close</Button>.
	•	The closeTicket() function calls:

await supabase
  .from('tickets')
  .update({ status: 'solved' })
  .eq('id', ticketId);


	•	Or if the agent wants to do a different final status, let them set status='closed' or 'solved'. The UI can reflect that.

4. TICKET RESOLUTION LOGIC

a) Customer Request to Mark Resolved
	•	If ticket.status !== 'solved', show them a button “Mark as Resolved.”
	•	On click, do:

await supabase.from('tickets').update({ status: 'solved' }).eq('id', ticketId);



b) Agent Overriding to “Closed”
	•	Once the agent sees that it’s solved, they can do:

await supabase.from('tickets').update({ status: 'closed' }).eq('id', ticketId);



c) UI Indication
	•	You can conditionally display status badges:
	•	Open = “We are working on it”
	•	Pending / On Hold = “We are waiting on something else”
	•	Solved = “Customer or agent marked as solved”
	•	Closed = “Fully closed - read-only”

5. RECAP & ORDER OF EXECUTION

Overall Flow your dev team should follow:
	1.	Landing Page
	•	Add root route UI (you have partial code in pages/index.tsx).
	•	3 big buttons: “I have a Question,” “I’m an Agent,” “Start an Organization.”
	2.	Signup Page
	•	Modify signup.tsx to show extra fields if type==="agent" or type==="admin".
	•	Implement the dynamic org search (for agent).
	•	If admin, let them input a new org name.
	3.	Update or Remove the default “personal org creation trigger.” (If you keep it, you might override it after signup with the “real” org for agent/admin flows, or you might disable it entirely so you control logic in the signup page code.)
	4.	Organization/Member Linking
	•	If agent selected existing org, insert row in organization_members(organization_id, user_id, role='agent').
	•	If admin typed new org name, create the org row, then organization_members row with role=‘admin’.
	5.	Real-time Chat
	•	In your ticket pages (ticket-interface.tsx, ticket-conversation-panel.tsx), add subscription to comments or a new messages table.
	•	Insert new messages as the user types.
	•	Use on('postgres_changes', ...) to update in real time.
	6.	Ticket Resolution
	•	Provide a “Close Ticket” or “Mark as Resolved” button for both agent and customer.
	•	Simple .update({ status: 'solved' }).

Additional Tips
	•	UI/UX: Possibly use modals or toasts to confirm “Are you sure you want to close this ticket?”
	•	Security: If you remove or alter the “auto org creation” in the handle_new_user() function, ensure your new approach still works for pure “customer” signups.
	•	Testing: Thoroughly test each path:
	1.	Customer path – minimal fields
	2.	Agent path – searching for an existing org
	3.	Admin path – creating a new org

With these steps, you and your dev team should be able to implement the new onboarding flow and real-time chat + resolution features. Good luck!