import { google } from 'googleapis';

// Configure Gmail API to use HTTP/1.1 instead of HTTP/2 globally
if (typeof window !== 'undefined') {
  google.options({ http2: false });
}

// Create a configured Gmail client
const gmail = google.gmail({ version: 'v1' });

export { gmail, google };

