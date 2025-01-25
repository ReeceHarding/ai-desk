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
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading article...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Article Not Found</h2>
          <p className="text-gray-600">The requested article could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
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
  )
} 