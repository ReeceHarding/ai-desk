import { google } from 'googleapis';

// Configure Gmail API to use HTTP/1.1 instead of HTTP/2
google.options({ http2: false });

// Create a configured Gmail client
const gmail = google.gmail({
  version: 'v1',
  // Disable HTTP/2 to prevent issues in browser environment
  http2: false
});

export default gmail; 