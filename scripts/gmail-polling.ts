import cron from 'node-cron';
import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

const CRON_SECRET = process.env.CRON_SECRET;
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!CRON_SECRET) {
  console.error('CRON_SECRET environment variable is not set');
  process.exit(1);
}

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    console.log('Running Gmail polling job:', new Date().toISOString());
    
    const response = await axios.post(
      `${API_BASE_URL}/api/integrations/gmail/poll`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`
        }
      }
    );

    if (response.data.status === 'ok') {
      console.log('Gmail polling completed successfully');
    } else {
      console.error('Gmail polling completed with errors:', response.data.error);
    }
  } catch (error) {
    console.error('Failed to run Gmail polling:', error);
  }
}); 