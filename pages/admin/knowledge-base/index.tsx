import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
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
  flagged_internal: boolean
}

export default function AdminKnowledgeBasePage() {
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
            flagged_internal,
            author:profiles(display_name)
          `)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .ilike('title', searchTerm ? `%${searchTerm}%` : '%')

        if (error) throw error
        
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

  async function togglePublished(article: Article) {
    try {
      const { error } = await supabase
        .from('knowledge_base_articles')
        .update({ published: !article.published })
        .eq('id', article.id)

      if (error) throw error
      setArticles(articles.map(a => 
        a.id === article.id 
          ? { ...a, published: !a.published }
          : a
      ))
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function toggleFlagged(article: Article) {
    try {
      const { error } = await supabase
        .from('knowledge_base_articles')
        .update({ flagged_internal: !article.flagged_internal })
        .eq('id', article.id)

      if (error) throw error
      setArticles(articles.map(a => 
        a.id === article.id 
          ? { ...a, flagged_internal: !a.flagged_internal }
          : a
      ))
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function deleteArticle(id: string) {
    if (!window.confirm('Are you sure you want to delete this article?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('knowledge_base_articles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      setArticles(articles.filter(a => a.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading articles...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Manage Knowledge Base</h1>
          <div className="flex gap-4">
            <input
              type="search"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="border rounded-lg px-4 py-2 w-64"
            />
            <Link
              href="/admin/knowledge-base/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              New Article
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Author
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {articles.map(article => (
                <tr key={article.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/admin/knowledge-base/${article.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {article.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {article.article_category || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {article.article_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {article.author?.display_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(article.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => togglePublished(article)}
                        className={`px-2 py-1 rounded text-sm ${
                          article.published
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {article.published ? 'Published' : 'Draft'}
                      </button>
                      <button
                        onClick={() => toggleFlagged(article)}
                        className={`px-2 py-1 rounded text-sm ${
                          article.flagged_internal
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {article.flagged_internal ? 'Flagged' : 'Not Flagged'}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/knowledge-base/${article.id}/edit`}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteArticle(article.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 