import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    case 'PUT':
      return handlePut(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

// Get organization details by slug
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' });
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('*, organization_members(*)')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching organization:', error);
    return res.status(500).json({ error: 'Failed to fetch organization' });
  }

  if (!org) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  return res.status(200).json(org);
}

// Create new organization
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { name, sla_tier = 'basic' } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({ name, sla_tier })
    .select()
    .single();

  if (error) {
    console.error('Error creating organization:', error);
    return res.status(500).json({ error: 'Failed to create organization' });
  }

  return res.status(201).json(org);
}

// Update organization
async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;
  const { name, public_mode, sla_tier } = req.body;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' });
  }

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (public_mode !== undefined) updates.public_mode = public_mode;
  if (sla_tier !== undefined) updates.sla_tier = sla_tier;

  const { data: org, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('slug', slug)
    .select()
    .single();

  if (error) {
    console.error('Error updating organization:', error);
    return res.status(500).json({ error: 'Failed to update organization' });
  }

  return res.status(200).json(org);
} 