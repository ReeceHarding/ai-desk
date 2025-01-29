import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { promisify } from 'util';
import { GmailProfile } from '../../../types/gmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

const oauth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
);

// Create a rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
});

// Create a cache for Gmail profiles
const profileCache = new Map<string, { profile: GmailProfile; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Convert express middleware to NextJS middleware
const runMiddleware = promisify(limiter);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Apply rate limiting
    await runMiddleware(req, res);

    const { access_token, refresh_token } = req.body;

    if (!access_token || !refresh_token) {
      return res.status(400).json({ message: 'Missing required tokens' });
    }

    // Check cache first
    const cacheKey = access_token;
    const now = Date.now();
    const cached = profileCache.get(cacheKey);

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached Gmail profile');
      return res.json(cached.profile);
    }

    oauth2Client.setCredentials({
      access_token,
      refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const { data: profile } = await gmail.users.getProfile({
      userId: 'me',
    });

    const gmailProfile: GmailProfile = {
      emailAddress: profile.emailAddress || '',
      messagesTotal: profile.messagesTotal || 0,
      threadsTotal: profile.threadsTotal || 0,
      historyId: profile.historyId || '',
    };

    // Cache the profile
    profileCache.set(cacheKey, {
      profile: gmailProfile,
      timestamp: now,
    });

    return res.json(gmailProfile);
  } catch (error) {
    console.error('Error in Gmail profile API route:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 