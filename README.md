# Zendesk Clone

A modern ticket management system built with Next.js and Supabase.

## Features

- Multi-tenant support with organizations
- Role-based access control (Admin, Agent, Customer)
- Team management
- Ticket lifecycle management
- Comment threading
- File attachments
- Real-time updates

## Tech Stack

- Next.js 14 (App Router)
- Supabase (Auth, Database, Storage)
- TypeScript
- Tailwind CSS

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase CLI
- Docker (for local development)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/zendesk-clone.git
cd zendesk-clone
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Edit `.env` with your Supabase project credentials.

4. Start Supabase locally:
```bash
supabase start
```

5. Apply database migrations:
```bash
supabase db reset
```

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

The application uses the following main tables:

- `organizations`: Multi-tenant support
- `profiles`: Extended user profiles
- `teams`: Team management
- `team_members`: Team membership
- `tickets`: Ticket management
- `comments`: Ticket comments
- `attachments`: File attachments

## Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control
- Organization-based data isolation
- Secure file uploads

## Development

### Database Migrations

Create a new migration:
```bash
supabase db diff -f migration_name
```

Apply migrations:
```bash
supabase db reset
```

### Type Generation

Update TypeScript types:
```bash
supabase gen types typescript --local > types/supabase.ts
```

## License

MIT 