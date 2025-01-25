import { Database } from '@/types/supabase'
import { logger } from '@/utils/logger'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

export default function CustomerSelectOrgPage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const [searchTerm, setSearchTerm] = useState('')
  const [orgs, setOrgs] = useState<{id:string, name:string}[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (searchTerm.length < 1) {
      setOrgs([]);
      setIsSearching(false);
      return;
    }
    
    logger.info('[SELECT_ORG] Starting search:', { searchTerm });
    setIsSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/organizations/search?q=${encodeURIComponent(searchTerm)}`)
        .then(resp => {
          logger.info('[SELECT_ORG] Search response:', { 
            status: resp.status,
            ok: resp.ok 
          });
          return resp.json();
        })
        .then(data => {
          setIsSearching(false);
          logger.info('[SELECT_ORG] Search results:', { 
            isArray: Array.isArray(data),
            resultCount: Array.isArray(data) ? data.length : 0,
            data
          });
          // Ensure data is an array before setting it
          if (Array.isArray(data)) {
            setOrgs(data);
            setShowDropdown(true);
          } else {
            console.error('Expected array of organizations but got:', data);
            setOrgs([]);
          }
        })
        .catch(e => {
          setIsSearching(false);
          logger.error('[SELECT_ORG] Search error:', e);
          setOrgs([]);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleOrgSelect = (org: {id: string, name: string}) => {
    setSelectedOrgId(org.id);
    setSearchTerm(org.name);
    setShowDropdown(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Save selected organization
      const resp = await fetch('/api/profiles/update-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrgId })
      })

      if (!resp.ok) {
        const er = await resp.json()
        throw new Error(er.error || 'Failed to select organization')
      }

      // Proceed to submit question
      router.push('/onboarding/customer/submit-question')
    } catch (err:any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Select Organization
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Which organization do you have a question about?
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div ref={searchRef} className="relative">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                Search Organizations
              </label>
              <div className="mt-1">
                <input
                  id="search"
                  type="text"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Type organization name..."
                />
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && (searchTerm.length > 0 || isSearching) && (
                <div className="absolute z-10 w-full mt-1 bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                    </div>
                  ) : orgs.length > 0 ? (
                    orgs.map(org => (
                      <div
                        key={org.id}
                        className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-50"
                        onClick={() => handleOrgSelect(org)}
                      >
                        <div className="flex items-center">
                          <span className="ml-3 block truncate">
                            {org.name}
                          </span>
                        </div>
                        {selectedOrgId === org.id && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No organizations found
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={!selectedOrgId || loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 