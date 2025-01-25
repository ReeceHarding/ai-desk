import { google } from 'googleapis';

// Configure Gmail API to use HTTP/1.1
google.options({ http2: false });

// Create Gmail client
const gmail = google.gmail({ version: 'v1' });

export { gmail };

// Export types only from googleapis
    export type { gmail_v1 } from 'googleapis';
