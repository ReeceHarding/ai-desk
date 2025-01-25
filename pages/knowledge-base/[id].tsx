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
}

export default function ArticlePage() {
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
            author:profiles(display_name)
          `)
          .eq('id', id)
          .eq('published', true)
          .is('deleted_at', null)
          .single()

        if (error) throw error
        
        // Transform the data to match our Article type
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
          <Link href="/knowledge-base" className="text-blue-600 hover:underline">
            ← Back to Knowledge Base
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6">
        <Link href="/knowledge-base" className="text-blue-600 hover:underline mb-6 block">
          ← Back to Knowledge Base
        </Link>

        <article className="bg-white rounded-lg shadow p-6">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold mb-2">{article.title}</h1>
            <div className="text-sm text-gray-500">
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
        </article>
      </div>
    </AppLayout>
  )
} 