import axios from 'axios';
import { config } from 'dotenv';
import cron from 'node-cron';

// Load environment variables
config();

const CRON_SECRET = process.env.CRON_SECRET;
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!CRON_SECRET) {
  console.error('CRON_SECRET environment variable is not set');
  process.exit(1);
}

// Run Gmail polling every 5 minutes
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

// Process unclassified emails every hour
cron.schedule('0 * * * *', async () => {
  try {
    console.log('Running unclassified email processing job:', new Date().toISOString());
    
    const response = await axios.post(
      `${API_BASE_URL}/api/integrations/gmail/process-unclassified`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`
        }
      }
    );

    if (response.data.status === 'ok') {
      console.log('Unclassified email processing completed successfully');
    } else {
      console.error('Unclassified email processing completed with errors:', response.data.error);
    }
  } catch (error) {
    console.error('Failed to process unclassified emails:', error);
  }
}); 