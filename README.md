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
- Email notifications and daily summaries

## Tech Stack

- Next.js 14 (App Router)
- Supabase (Auth, Database, Storage)
- TypeScript
- Tailwind CSS
- Resend (Email delivery)

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase CLI
- Docker (for local development)
- Resend API key

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
Edit `.env` with your Supabase project credentials and Resend API key.

4. Start Supabase locally:
```bash
supabase start
```

5. Apply database migrations:
```bash
supabase db reset
```

6. Set up cron jobs (production only):
```bash
npm run setup-cron
```

7. Run the development server:
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
- `notification_preferences`: User notification settings
- `notification_history`: Record of sent notifications

## Notification System

The application includes a comprehensive notification system that keeps users informed about ticket updates and activities.

### Features

- **Real-time Email Notifications**: Users receive immediate email notifications when:
  - A new comment is added to a ticket they're assigned to
  - A new comment is added to a ticket they're watching
  - Their ticket status changes
  - They're assigned to a ticket

- **Daily Summaries**: Users can opt to receive a daily summary email containing:
  - All ticket activity from the previous day
  - New comments and status changes
  - Quick links to view tickets

- **Notification Preferences**: Users can customize their notification settings:
  - Enable/disable email notifications
  - Enable/disable daily summaries
  - (Coming soon) Push notifications

### Setting Up Notifications

1. **Configure Environment Variables**:
   ```env
   RESEND_API_KEY=your_resend_api_key
   CRON_SECRET=your_cron_secret
   ```

2. **Set Up Cron Jobs** (production only):
   ```bash
   npm run setup-cron
   ```
   This will create two cron jobs in Vercel:
   - Process notifications: Runs every minute
   - Process daily summaries: Runs daily at 8 AM UTC

3. **User Configuration**:
   - Users can manage their notification preferences in their profile settings
   - Navigate to `/profile/settings` to access notification preferences

### Development

- Notifications are stored in the `notification_history` table
- Preferences are stored in the `notification_preferences` table
- The system uses Resend for sending emails
- Cron jobs are managed through Vercel Cron

### Testing

To test the notification system:

1. Create a test user and enable notifications
2. Add a comment to a ticket they're watching
3. Check that the notification is created and sent
4. Wait for the daily summary (or trigger it manually)

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