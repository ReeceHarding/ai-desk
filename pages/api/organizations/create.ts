import { Database } from '@/types/supabase'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createPagesServerClient<Database>({ req, res })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { name, avatar_url } = req.body
    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' })
    }

    // confirm user is admin or super_admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return res.status(500).json({ error: 'Error fetching user profile' })
    }

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden - only admin can create organizations' })
    }

    // Generate a slug from the name
    const { data: slugData, error: slugError } = await supabase
      .rpc('generate_unique_slug', { org_name: name })

    if (slugError) {
      console.error('Error generating slug:', slugError)
      return res.status(500).json({ error: 'Error generating organization slug' })
    }

    const slug = slugData

    // Create the organization
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        avatar_url: avatar_url || null,
        created_by: session.user.id,
        owner_id: session.user.id,
        email: session.user.email,
        config: { is_personal: false, created_at_timestamp: new Date().toISOString() } 
      })
      .select()
      .single()

    if (orgError) {
      console.error('Error creating organization:', orgError)
      return res.status(500).json({ error: orgError?.message || 'Error creating organization' })
    }

    if (!newOrg) {
      console.error('No organization returned after creation')
      return res.status(500).json({ error: 'Organization creation failed' })
    }

    // Add the user as admin in organization_members if not already
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: newOrg.id,
        user_id: session.user.id,
        role: 'admin'
      })

    if (memberError) {
      console.error('Error adding user as organization member:', memberError)
      // Don't return error here as org is already created
    }

    // Update the user's org_id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ org_id: newOrg.id })
      .eq('id', session.user.id)

    if (updateError) {
      console.error('Error updating user profile with org_id:', updateError)
      // Don't return error here as org is already created
    }

    return res.status(200).json({ organization: newOrg })
  } catch (error: any) {
    console.error('Error creating organization:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    })
  }
} 