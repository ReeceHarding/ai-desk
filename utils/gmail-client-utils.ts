import { GmailTokens } from '../types/gmail';

// Client-side utility functions that don't depend on googleapis
export async function getAuthUrl(type: 'organization' | 'profile', id: string) {
  const response = await fetch('/api/gmail/auth-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type, id }),
  });

  if (!response.ok) {
    throw new Error('Failed to get auth URL');
  }

  return response.json();
}

export async function setupWatch(tokens: GmailTokens, type: 'organization' | 'profile', id: string) {
  const response = await fetch('/api/gmail/watch/setup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.access_token}`,
    },
    body: JSON.stringify({
      type,
      id,
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to set up Gmail watch');
  }

  return response.json();
}

export async function stopWatch(tokens: GmailTokens, resourceId: string) {
  const response = await fetch('/api/gmail/watch/stop', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resourceId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to stop Gmail watch');
  }
}

export async function checkAndRefreshWatches() {
  const response = await fetch('/api/gmail/watch/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to check and refresh watches');
  }
}

export async function getGmailProfile(tokens: GmailTokens) {
  const response = await fetch('/api/gmail/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tokens),
  });

  if (!response.ok) {
    throw new Error('Failed to get Gmail profile');
  }

  return response.json();
} 
