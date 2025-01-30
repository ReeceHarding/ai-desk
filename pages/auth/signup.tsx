import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';
import { Building, CheckCircle, Lock, Mail, User } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

interface Organization {
  id: string;
  name: string;
}

// Helper function to create organization and associate user
async function createUserOrganization(supabase: any, userId: string, email: string, orgName?: string, selectedOrgId?: string) {
  try {
    console.group('[SIGNUP] Starting User Organization Creation');
    console.log('📝 Initial Parameters:', { userId, email, orgName, selectedOrgId });

    if (!userId || !email) {
      console.error('❌ Missing required parameters');
      console.groupEnd();
      throw new Error('User ID and email are required');
    }

    // Check for existing organization membership
    console.log('🔍 Checking existing organization membership...');
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (existingMember?.organization_id) {
      console.log('✅ User already has organization:', existingMember.organization_id);
      console.groupEnd();
      return;
    }
    console.log('✨ No existing organization membership found');

    // Check for existing profile
    console.log('🔍 Checking existing profile...');
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, org_id')
      .eq('id', userId)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('❌ Profile check error:', profileCheckError);
      console.groupEnd();
      throw profileCheckError;
    }

    if (existingProfile?.org_id) {
      console.log('✅ Profile already has organization:', existingProfile.org_id);
      console.groupEnd();
      return;
    }
    console.log('✨ No existing profile found');

    // Agent flow
    if (selectedOrgId) {
      console.group('[SIGNUP] Agent Flow - Joining Organization');
      console.log('📝 Creating agent profile...');
      
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          display_name: email.split('@')[0],
          role: 'agent',
          org_id: selectedOrgId
        })
        .select()
        .single();

      if (profileError) {
        console.error('❌ Agent profile creation failed:', profileError);
        console.groupEnd();
        console.groupEnd();
        throw profileError;
      }
      console.log('✅ Agent profile created successfully:', newProfile);

      console.log('📝 Creating organization membership...');
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({ 
          organization_id: selectedOrgId,
          user_id: userId,
          role: 'agent',
          created_at: new Date().toISOString()
        });

      if (memberError) {
        console.error('❌ Organization membership creation failed:', memberError);
        console.groupEnd();
        console.groupEnd();
        throw memberError;
      }
      console.log('✅ Organization membership created successfully');
      console.groupEnd();
      console.groupEnd();
      return;
    }

    // Admin flow
    if (orgName) {
      console.group('[SIGNUP] Admin Flow - Creating New Organization');
      console.log('📝 Creating organization:', orgName);
      
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ 
          name: orgName.slice(0, 100),
          sla_tier: 'basic',
          config: {
            is_personal: false,
            created_at_timestamp: new Date().toISOString(),
          created_by: userId,
            created_by_email: email
          }
        })
        .select()
        .single();

      if (orgError) {
        console.error('❌ Organization creation failed:', orgError);
        console.groupEnd();
        console.groupEnd();
        throw orgError;
      }
      console.log('✅ Organization created successfully:', org);

      console.log('📝 Creating admin profile...');
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          display_name: email.split('@')[0],
          role: 'admin',
          org_id: org.id
        })
        .select()
        .single();

      if (profileError) {
        console.error('❌ Profile creation failed:', profileError);
        console.groupEnd();
        console.groupEnd();
        throw profileError;
      }
      console.log('✅ Admin profile created successfully:', newProfile);

      console.log('📝 Creating organization membership...');
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({ 
          organization_id: org.id,
          user_id: userId,
          role: 'admin'
        });

      if (memberError) {
        console.error('❌ Organization membership creation failed:', memberError);
        console.groupEnd();
        console.groupEnd();
        throw memberError;
      }
      console.log('✅ Organization membership created successfully');
      console.groupEnd();
      console.groupEnd();
      return org;
    }

    // Customer flow
    console.group('[SIGNUP] Customer Flow - Creating Profile');
    console.log('📝 Creating customer profile...');
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        display_name: email.split('@')[0],
        role: 'customer',
        org_id: null
      })
      .select()
      .single();

      if (profileError) {
        console.error('❌ Customer profile creation failed:', profileError);
        console.groupEnd();
        console.groupEnd();
        throw profileError;
      }
      console.log('✅ Customer profile created successfully:', newProfile);
      console.groupEnd();
      console.groupEnd();
      return null;
    } catch (error) {
      console.error('❌ [SIGNUP] Error in createUserOrganization:', error);
      console.groupEnd();
      throw error;
    }
}

// Helper function to search organizations
async function searchOrganizations(supabase: any, query: string): Promise<Organization[]> {
  console.group('[SIGNUP] searchOrganizations Function');
  console.log('📝 Search query:', query);
  
  try {
    let queryBuilder = supabase
      .from('organizations')
      .select('id, name');

    // Only apply filter if query exists
    if (query) {
      console.log('🔍 Applying filter with query:', query);
      queryBuilder = queryBuilder.ilike('name', `%${query}%`);
    } else {
      console.log('📋 Getting all organizations (no filter)');
    }

    // Always order by name
    queryBuilder = queryBuilder.order('name');

    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Query successful');
    console.log('📊 Results count:', data?.length || 0);
    console.log('🔍 First few results:', data?.slice(0, 3));
    console.groupEnd();
    return data || [];
  } catch (error) {
    console.error('❌ Error in searchOrganizations:', error);
    console.groupEnd();
    throw error;
  }
}

type UserType = 'customer' | 'agent' | 'admin';

export default function SignUp() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const { type } = router.query;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const serviceRoleClient = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
  });
  const [origin, setOrigin] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    console.log('[SIGNUP] Type changed:', type);
    if (type && !['customer', 'agent', 'admin'].includes(type as string)) {
      router.push('/');
    }
  }, [type, router]);

  useEffect(() => {
    console.log('[SIGNUP] Component mounted, type:', type);
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (type === 'agent' && !initialLoadDone) {
      console.log('[SIGNUP] Initial organization load');
      debouncedSearch('');
      setInitialLoadDone(true);
    }
  }, [type, initialLoadDone]);

  useEffect(() => {
    // Debug query to check database access
    async function checkDatabaseAccess() {
      console.group('[SIGNUP] Database Access Check');
      try {
        const { data, error } = await serviceRoleClient
          .from('organizations')
          .select('count');
        
        console.log('📊 Database check results:', {
          success: !error,
          error: error?.message,
          count: data?.[0]?.count
        });

        if (error) {
          console.error('❌ Database access error:', error);
        } else {
          console.log('✅ Database access successful');
        }
      } catch (err) {
        console.error('❌ Database check failed:', err);
      }
      console.groupEnd();
    }

    if (type === 'agent') {
      checkDatabaseAccess();
    }
  }, [type]);

  const debouncedSearch = debounce(async (query: string) => {
    console.group('[SIGNUP] Debounced Search');
    console.log('📝 Query:', query);
    console.log('🔄 Current state:', {
      searchResults: searchResults.length,
      selectedOrg: selectedOrg?.name,
      isSearching
    });
    
    try {
      setIsSearching(true);
      console.log('🔍 Searching organizations...');
      const results = await searchOrganizations(serviceRoleClient, query);
      console.log('✅ Search results:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('❌ Error searching organizations:', error);
      setError('Failed to search organizations. Please try again.');
    } finally {
      setIsSearching(false);
    }
    console.groupEnd();
  }, 300);

  const handleOrgSearch = (query: string) => {
    console.group('[SIGNUP] Organization Search');
    console.log('🔍 Search query:', query);
    console.log('📊 Current state:', {
      searchResults: searchResults.length,
      selectedOrg: selectedOrg?.name,
      isSearching
    });
    setOrganizationName(query);
    setSelectedOrg(null);
    debouncedSearch(query);
    console.groupEnd();
  };

  const selectOrganization = (org: Organization) => {
    console.log('[SIGNUP] Selecting organization:', org.name);
    setSelectedOrg(org);
    setOrganizationName(org.name);
    setSearchResults([]);
    // Add a small delay to ensure the dropdown is closed
    setTimeout(() => {
      const input = document.getElementById('organizationName');
      if (input) {
        input.blur();
      }
    }, 100);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleGoogleSignIn = async () => {
    console.group('[SIGNUP] Google Sign In Process');
    console.time('google-signin');
    
    try {
      setError(null);
      setLoading(true);
      console.log('🔐 Initiating Google OAuth...');
      
      const { data, error } = await serviceRoleClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        throw error;
      }
      
      if (data?.url) {
        console.log('✅ OAuth URL received, redirecting...');
        window.location.href = data.url;
      } else {
        console.error('❌ No OAuth URL received');
        throw new Error('No OAuth URL received');
      }
    } catch (error: any) {
      console.error('❌ Error during Google sign in:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      console.timeEnd('google-signin');
      console.groupEnd();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.group('[SIGNUP] Sign Up Process');
    console.time('signup');

    try {
      setError(null);
      setLoading(true);

      // Validate required fields
      if (!email || !password || !name) {
        throw new Error('Please fill in all required fields');
      }

      // Additional validation for agent type
      if (type === 'agent' && !selectedOrg) {
        throw new Error('Please select an organization');
      }

      // Additional validation for admin type
      if (type === 'admin' && !organizationName) {
        throw new Error('Please enter an organization name');
      }

      // Ensure dropdown is closed before proceeding
      setSearchResults([]);

      // Create user account with improved error handling
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            user_type: type,
          },
        },
      });

      if (authError) {
        console.error('[SIGNUP] Auth error:', authError);
        throw authError;
      }
      if (!authData.user) {
        console.error('[SIGNUP] No user data returned');
        throw new Error('Failed to create account');
      }

      console.log('[SIGNUP] User account created successfully');

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, org_id, role')
        .eq('id', authData.user.id)
        .single();
      
      if (existingProfile) {
        console.log('[SIGNUP] Updating existing profile');
        if (type === 'admin') {
          // Create organization for admin
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert([
              {
                name: organizationName,
                sla_tier: 'basic',
                config: {
                  is_personal: false,
                  created_at_timestamp: new Date().toISOString(),
                  created_by: authData.user.id,
                  created_by_email: email
                }
              },
            ])
            .select()
            .single();

          if (orgError) throw orgError;
          if (!orgData) throw new Error('No organization data returned');

          // Update existing profile
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              email: email,
              display_name: name || email.split('@')[0],
              role: 'admin',
              org_id: orgData.id
            })
            .eq('id', authData.user.id);

          if (profileError) throw profileError;

          // Create organization membership
          const { error: memberError } = await supabase
            .from('organization_members')
            .insert([
              {
                organization_id: orgData.id,
                user_id: authData.user.id,
                role: 'admin'
              },
            ]);

          if (memberError) throw memberError;
        } else if (type === 'agent' && selectedOrg?.id) {
          // Update existing profile with selected organization
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              email: email,
              display_name: name || email.split('@')[0],
              role: 'agent',
              org_id: selectedOrg.id
            })
            .eq('id', authData.user.id);

          if (profileError) throw profileError;

          // Create organization membership
          const { error: memberError } = await supabase
            .from('organization_members')
            .insert([
              {
                organization_id: selectedOrg.id,
                user_id: authData.user.id,
                role: 'member'
              },
            ]);

          if (memberError) throw memberError;
        } else {
          // Update existing profile for customer
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              email: email,
              display_name: name || email.split('@')[0],
              role: 'customer'
            })
            .eq('id', authData.user.id);

          if (profileError) throw profileError;
        }
      } else {
        console.log('[SIGNUP] Creating new profile');
        if (type === 'admin') {
          // Create organization for admin
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert([
              {
                name: organizationName,
                sla_tier: 'basic',
                config: {
                  is_personal: false,
                  created_at_timestamp: new Date().toISOString(),
                  created_by: authData.user.id,
                  created_by_email: email
                }
              },
            ])
            .select()
            .single();

          if (orgError) throw orgError;
          if (!orgData) throw new Error('No organization data returned');

          // Create profile for admin
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: authData.user.id,
                email: email,
                display_name: name || email.split('@')[0],
                role: 'admin',
                org_id: orgData.id
              },
            ]);

          if (profileError) throw profileError;

          // Create organization membership
          const { error: memberError } = await supabase
            .from('organization_members')
            .insert([
              {
                organization_id: orgData.id,
                user_id: authData.user.id,
                role: 'admin'
              },
            ]);

          if (memberError) throw memberError;
        } else if (type === 'agent' && selectedOrg?.id) {
          // Create profile for agent with selected organization
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: authData.user.id,
                email: email,
                display_name: name || email.split('@')[0],
                role: 'agent',
                org_id: selectedOrg.id
              },
            ]);

          if (profileError) throw profileError;

          // Create organization membership
          const { error: memberError } = await supabase
            .from('organization_members')
            .insert([
              {
                organization_id: selectedOrg.id,
                user_id: authData.user.id,
                role: 'member'
              },
            ]);

          if (memberError) throw memberError;
        } else {
          // Create profile for customer
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: authData.user.id,
                email: email,
                display_name: name || email.split('@')[0],
                role: 'customer'
              },
            ]);

          if (profileError) throw profileError;
        }
      }

      // Redirect based on user type with improved error handling
      console.log('[SIGNUP] Redirecting user based on type:', type);
      switch (type) {
        case 'admin':
          await router.push('/tickets');
          break;
        case 'agent':
          await router.push('/tickets');
          break;
        case 'customer':
          await router.push('/customer');
          break;
        default:
          await router.push('/');
      }
    } catch (err: any) {
      console.error('[SIGNUP] Error during signup:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'customer': return 'Sign Up for Support';
      case 'agent': return 'Join as Support Agent';
      case 'admin': return 'Create Your Organization';
      default: return 'Sign Up';
    }
  };

  const formVariants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 }
  };

  return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(to bottom right, rgb(248, 250, 252), rgb(239, 246, 255))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1rem'
        }}>
      <Head>
        <title>{getTitle()} - Zendesk</title>
        <meta name="description" content="Sign up for Zendesk" />
      </Head>

          <motion.div
            variants={formVariants}
            initial="initial"
            animate="animate"
            style={{
              maxWidth: '28rem',
              width: '100%',
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgb(226, 232, 240)'
            }}
          >
            <div>
              <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white">
                {getTitle()}
              </h2>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="sr-only">Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="h-5 w-5" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 placeholder-slate-500 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-slate-700"
                      placeholder="Full name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="sr-only">Email address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-5 w-5" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 placeholder-slate-500 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-slate-700"
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="sr-only">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 placeholder-slate-500 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-slate-700"
                      placeholder="Password"
                    />
                  </div>
                </div>

                {type === 'admin' && (
                  <div>
                    <label htmlFor="organizationName" className="sr-only">Organization Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Building className="h-5 w-5" />
                      </div>
                      <input
                        id="organizationName"
                        name="organizationName"
                        type="text"
                        required
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 placeholder-slate-500 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-slate-700"
                        placeholder="Organization name"
                      />
                    </div>
                  </div>
                )}

                {type === 'agent' && (
                  <div>
                    <label htmlFor="organizationName" className="sr-only">Organization Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Building className="h-5 w-5" />
                      </div>
                      <input
                        id="organizationName"
                        name="organizationName"
                        type="text"
                        required
                        value={organizationName}
                        onFocus={() => {
                          if (!initialLoadDone) {
                            console.log('[SIGNUP] Input focused, loading all organizations');
                            debouncedSearch('');
                            setInitialLoadDone(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setSearchResults([]);
                          }, 200);
                        }}
                        onChange={(e) => handleOrgSearch(e.target.value)}
                        className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 placeholder-slate-500 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-slate-700"
                        placeholder="Search for your organization"
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                      {searchResults.length > 0 && !isSearching && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700">
                          <ul className="py-1 max-h-60 overflow-auto space-y-4">
                            {searchResults.map((org) => (
                              <li
                                key={org.id}
                                onClick={() => {
                                  selectOrganization(org);
                                  setSearchResults([]);
                                }}
                                className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-900 dark:text-white text-sm"
                              >
                                <div className="flex items-center">
                                  <Building className="h-4 w-4 mr-2 text-slate-400" />
                                  {org.name}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {searchResults.length === 0 && !isSearching && organizationName && !selectedOrg && (
                        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                          No organizations found
                        </div>
                      )}
                      {selectedOrg && (
                        <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Selected: {selectedOrg.name}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
                <div className="text-sm text-red-700 dark:text-red-200">
                  {error}
                </div>
              </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                {loading ? 'Creating account...' : 'Sign up'}
                </button>
              </div>
            </form>

          <div className="text-center">
                <button
              onClick={() => router.push('/auth/signin')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
            >
              Already have an account? Sign in
                </button>
          </div>
        </motion.div>
    </div>
  );
} 