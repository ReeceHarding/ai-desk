import AppLayout from '@/components/layout/AppLayout'
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

export default function AdminArticlePage() {
  const router = useRouter()
  const { id } = router.query
  const supabase = useSupabaseClient<Database>()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    async function loadArticle() {
      if (!id) return

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
          .eq('id', id)
          .is('deleted_at', null)
          .single()

        if (error) throw error
        
        const transformedData: Article = {
          ...data,
          author: data.author?.[0] || null
        }
        
        setArticle(transformedData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadArticle()
  }, [supabase, id])

  async function togglePublished() {
    if (!article) return

    try {
      const { error } = await supabase
        .from('knowledge_base_articles')
        .update({ published: !article.published })
        .eq('id', article.id)

      if (error) throw error
      setArticle(prev => prev ? { ...prev, published: !prev.published } : null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function toggleFlagged() {
    if (!article) return

    try {
      const { error } = await supabase
        .from('knowledge_base_articles')
        .update({ flagged_internal: !article.flagged_internal })
        .eq('id', article.id)

      if (error) throw error
      setArticle(prev => prev ? { ...prev, flagged_internal: !prev.flagged_internal } : null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function deleteArticle() {
    if (!article || !window.confirm('Are you sure you want to delete this article?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('knowledge_base_articles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', article.id)

      if (error) throw error
      router.push('/admin/knowledge-base')
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">Loading article...</div>
      </AppLayout>
    )
  }

  if (error || !article) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-red-50 text-red-500 p-4 rounded mb-4">
            {error || 'Article not found'}
          </div>
          <Link href="/admin/knowledge-base" className="text-blue-600 hover:underline">
            ← Back to Articles
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <Link href="/admin/knowledge-base" className="text-blue-600 hover:underline">
            ← Back to Articles
          </Link>
          <div className="flex gap-4">
            <Link
              href={`/admin/knowledge-base/${article.id}/edit`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Edit Article
            </Link>
            <button
              onClick={deleteArticle}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Delete Article
            </button>
          </div>
        </div>

        <article className="bg-white rounded-lg shadow p-6">
          <header className="mb-6">
            <div className="flex justify-between items-start">
              <h1 className="text-3xl font-semibold mb-2">{article.title}</h1>
              <div className="flex gap-2">
                <button
                  onClick={togglePublished}
                  className={`px-3 py-1 rounded text-sm ${
                    article.published
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {article.published ? 'Published' : 'Draft'}
                </button>
                <button
                  onClick={toggleFlagged}
                  className={`px-3 py-1 rounded text-sm ${
                    article.flagged_internal
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {article.flagged_internal ? 'Flagged' : 'Not Flagged'}
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              By {article.author?.display_name || 'Unknown'} on{' '}
              {new Date(article.created_at).toLocaleDateString()}
              {article.article_category && (
                <> in <span className="text-gray-700">{article.article_category}</span></>
              )}
              {article.article_type && (
                <> • Type: <span className="text-gray-700">{article.article_type}</span></>
              )}
            </div>
          </header>

          <div className="prose max-w-none">
            {article.content.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4">
                {paragraph}
              </p>
            ))}
          </div>

          {Object.keys(article.metadata).length > 0 && (
            <div className="mt-8 pt-8 border-t">
              <h2 className="text-lg font-medium mb-4">Metadata</h2>
              <pre className="bg-gray-50 p-4 rounded overflow-auto">
                {JSON.stringify(article.metadata, null, 2)}
              </pre>
            </div>
          )}
        </article>
      </div>
    </AppLayout>
  )
} 