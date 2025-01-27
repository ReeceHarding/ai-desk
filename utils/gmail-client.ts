import { google } from 'googleapis';

// Create a configured Gmail client
const gmail = google.gmail({
  version: 'v1'
});

export default gmail;