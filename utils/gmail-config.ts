import { google } from 'googleapis';

// Gmail API scopes required for the application
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing'
];

// Client-side configuration
export const GMAIL_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
  redirectUri: process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI,
};

// Create OAuth2 client factory
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
  );
}

// Create a configured Gmail client
export const gmail = google.gmail({ 
  version: 'v1'
});

// Export google for server-side use only
export { google };

