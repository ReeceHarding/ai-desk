import { google } from 'googleapis';

// Configure Gmail API client to use HTTP/1.1
const gmail = google.gmail({
  version: 'v1',
  // Disable HTTP/2 to prevent issues in browser environment
  http2: false
});

export default gmail; 