import { createClient } from '@supabase/supabase-js'
import { gmail_v1 } from 'googleapis'
import { Database } from '../../types/supabase'

// Initialize test Supabase client
export const getTestSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not configured')
  }
  
  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Test data generators
export const generateTestEmail = (): gmail_v1.Schema$Message => ({
  id: `test-${Date.now()}`,
  threadId: `thread-${Date.now()}`,
  labelIds: ['INBOX'],
  snippet: 'Test email snippet',
  internalDate: Date.now().toString(),
  payload: {
    headers: [
      { name: 'From', value: 'sender@test.com' },
      { name: 'To', value: 'recipient@test.com' },
      { name: 'Subject', value: 'Test Subject' }
    ],
    mimeType: 'text/plain',
    body: { data: Buffer.from('Test email body').toString('base64') }
  }
})

// Database setup helpers
export const setupTestDatabase = async () => {
  const supabase = getTestSupabaseClient()
  
  try {
    // Create test organization first
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Test Organization'
      })
      .select('*')
      .single()
    
    if (orgError) throw orgError
    if (!org) throw new Error('Failed to create test organization')

    // Create test user
    const { data: userData, error: userError } = await supabase.auth.signUp({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!
    })
    
    if (userError) throw userError
    if (!userData.user) throw new Error('Failed to create test user')
    
    // Create user profile with Gmail tokens
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userData.user.id,
        email: userData.user.email,
        org_id: org.id,
        role: 'admin',
        gmail_access_token: process.env.TEST_GMAIL_ACCESS_TOKEN,
        gmail_refresh_token: process.env.TEST_GMAIL_REFRESH_TOKEN
      })
    
    if (profileError) throw profileError

    // Create organization member
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: userData.user.id,
        role: 'admin'
      })

    if (memberError) throw memberError
    
    return { user: userData.user, org }
  } catch (error) {
    console.error('Error setting up test database:', error)
    throw error
  }
}

// Database cleanup helpers
export const cleanupTestDatabase = async () => {
  const supabase = getTestSupabaseClient()
  
  try {
    // Get all test users
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', process.env.TEST_USER_EMAIL!)
    
    if (profileError) throw profileError
    
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        // Clean up test data in reverse order of dependencies
        await supabase
          .from('organization_members')
          .delete()
          .eq('user_id', profile.id)
          
        await supabase
          .from('profiles')
          .delete()
          .eq('id', profile.id)
          
        await supabase
          .from('organizations')
          .delete()
          .eq('created_by', profile.id)
      }
    }
  } catch (error) {
    console.error('Error cleaning up test database:', error)
    throw error
  }
}

// Gmail API test helpers
export const setupTestGmailTokens = () => ({
  access_token: process.env.TEST_GMAIL_ACCESS_TOKEN!,
  refresh_token: process.env.TEST_GMAIL_REFRESH_TOKEN!,
  token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/gmail.modify',
  expiry_date: Date.now() + 3600000
})

// Verify test environment
export const verifyTestEnvironment = async () => {
  const supabase = getTestSupabaseClient()
  
  try {
    // Test database connection
    const { data, error: dbError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)
    
    if (dbError) throw new Error(`Database connection failed: ${dbError.message}`)
    
    // Verify Gmail tokens
    if (!process.env.TEST_GMAIL_ACCESS_TOKEN || !process.env.TEST_GMAIL_REFRESH_TOKEN) {
      throw new Error('Gmail test tokens not configured')
    }
    
    // Verify test user credentials
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      throw new Error('Test user credentials not configured')
    }
  } catch (error) {
    console.error('Error verifying test environment:', error)
    throw error
  }
}

// Test environment setup
export const setupTestEnvironment = async () => {
  try {
    // Set default test environment variables if not set
    process.env.TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com'
    process.env.TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test-password'
    process.env.TEST_GMAIL_ACCESS_TOKEN = process.env.TEST_GMAIL_ACCESS_TOKEN || 'test-access-token'
    process.env.TEST_GMAIL_REFRESH_TOKEN = process.env.TEST_GMAIL_REFRESH_TOKEN || 'test-refresh-token'
    
    // Verify environment first
    await verifyTestEnvironment()
    
    // Clean up any existing test data
    await cleanupTestDatabase()
    
    // Set up test database
    const { user, org } = await setupTestDatabase()
    
    return { user, org }
  } catch (error) {
    console.error('Error setting up test environment:', error)
    throw error
  }
}

// Global test teardown
export const teardownTestEnvironment = async () => {
  await cleanupTestDatabase()
} 