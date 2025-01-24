import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await logger.info('Organizations API request', { 
      method: req.method,
      query: req.query
    });

    switch (req.method) {
      case 'GET': {
        const { data, error } = await supabase
          .from('organizations')
          .select('*');

        if (error) {
          await logger.error('Failed to fetch organizations', { error });
          return res.status(500).json({ error: 'Failed to fetch organizations' });
        }

        await logger.info('Organizations fetched successfully', { 
          count: data?.length 
        });

        return res.status(200).json(data);
      }

      case 'POST': {
        const { name, email } = req.body;

        if (!name || !email) {
          await logger.warn('Missing required fields', { body: req.body });
          return res.status(400).json({ error: 'Name and email are required' });
        }

        const { data, error } = await supabase
          .from('organizations')
          .insert({ name, email })
          .select()
          .single();

        if (error) {
          await logger.error('Failed to create organization', { error });
          return res.status(500).json({ error: 'Failed to create organization' });
        }

        await logger.info('Organization created successfully', { 
          id: data.id,
          name: data.name 
        });

        return res.status(201).json(data);
      }

      default:
        await logger.warn('Method not allowed', { method: req.method });
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    await logger.error('Unexpected error in organizations API', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 