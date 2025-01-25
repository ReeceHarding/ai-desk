import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function setupCronJobs() {
  try {
    console.log('Setting up cron jobs in Vercel...');

    // Add cron job for processing notifications (every minute)
    await execAsync(`
      vercel cron jobs add \
        "Process Notifications" \
        "/api/cron/process-notifications" \
        "* * * * *"
    `);
    console.log('Added notification processing cron job');

    // Add cron job for daily summaries (every day at 8 AM UTC)
    await execAsync(`
      vercel cron jobs add \
        "Daily Summaries" \
        "/api/cron/process-daily-summaries" \
        "0 8 * * *"
    `);
    console.log('Added daily summaries cron job');

    console.log('Successfully set up all cron jobs');
  } catch (error) {
    console.error('Error setting up cron jobs:', error);
    process.exit(1);
  }
}

setupCronJobs(); 