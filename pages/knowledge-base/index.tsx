import AppLayout from '@/components/layout/AppLayout'
import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

type Article = {
  id: string
  title: string
  content: string
  article_category: string | null
  article_type: string | null
  published: boolean
  author: {
    display_name: string
  } | null
  created_at: string
  org_id: string
  metadata: any
}

export default function KnowledgeBasePage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function loadArticles() {
      try {
        const { data, error } = await supabase
          .from('knowledge_base_articles')
          .select(`
            id,
            title,
            content,
            article_category,
            article_type,
            published,
            created_at,
            org_id,
            metadata,
            author:profiles(display_name)
          `)
          .eq('published', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .ilike('title', searchTerm ? `%${searchTerm}%` : '%')

        if (error) throw error
        
        // Transform the data to match our Article type
        const transformedData: Article[] = data.map(article => ({
          ...article,
          author: article.author?.[0] || null
        }))
        
        setArticles(transformedData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(loadArticles, 300)
    return () => clearTimeout(timer)
  }, [supabase, searchTerm])

  const categories = Array.from(new Set(articles.map(a => a.article_category))).filter(Boolean)

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">Loading knowledge base...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Knowledge Base</h1>
          <input
            type="search"
            placeholder="Search articles..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="border rounded-lg px-4 py-2 w-64"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded mb-4">
            {error}
          </div>
        )}

        {/* Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {categories.map(category => (
            <div key={category} className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium mb-3">{category}</h2>
              <ul className="space-y-2">
                {articles
                  .filter(a => a.article_category === category)
                  .map(article => (
                    <li key={article.id}>
                      <a
                        href={`/knowledge-base/${article.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {article.title}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Recent Articles */}
        <div className="bg-white rounded-lg shadow">
          <h2 className="text-lg font-medium p-4 border-b">Recent Articles</h2>
          <div className="divide-y">
            {articles.slice(0, 5).map(article => (
              <div key={article.id} className="p-4">
                <h3 className="font-medium mb-1">
                  <a
                    href={`/knowledge-base/${article.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {article.title}
                  </a>
                </h3>
                <p className="text-sm text-gray-500">
                  By {article.author?.display_name || 'Unknown'} on{' '}
                  {new Date(article.created_at).toLocaleDateString()}
                </p>
                <p className="mt-2 text-gray-600">
                  {article.content.slice(0, 150)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
} 