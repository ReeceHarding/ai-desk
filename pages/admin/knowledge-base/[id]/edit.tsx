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

export default function EditArticlePage() {
  const router = useRouter()
  const { id } = router.query
  const supabase = useSupabaseClient<Database>()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    article_category: '',
    article_type: '',
    published: false,
    flagged_internal: false,
    metadata: {}
  })

  useEffect(() => {
    async function loadArticle() {
      if (!id || id === 'new') {
        setLoading(false)
        return
      }

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
        setFormData({
          title: transformedData.title,
          content: transformedData.content,
          article_category: transformedData.article_category || '',
          article_type: transformedData.article_type || '',
          published: transformedData.published,
          flagged_internal: transformedData.flagged_internal,
          metadata: transformedData.metadata || {}
        })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadArticle()
  }, [supabase, id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const isNew = !id || id === 'new'
      const { error } = isNew
        ? await supabase
            .from('knowledge_base_articles')
            .insert([{
              ...formData,
              author_id: (await supabase.auth.getUser()).data.user?.id
            }])
        : await supabase
            .from('knowledge_base_articles')
            .update(formData)
            .eq('id', id)

      if (error) throw error

      router.push('/admin/knowledge-base')
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  function handleToggle(name: string) {
    setFormData(prev => ({ ...prev, [name]: !prev[name as keyof typeof prev] }))
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">Loading article...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">
            {id === 'new' ? 'New Article' : 'Edit Article'}
          </h1>
          <Link
            href="/admin/knowledge-base"
            className="text-blue-600 hover:underline"
          >
            ← Back to Articles
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700"
            >
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="article_category"
              className="block text-sm font-medium text-gray-700"
            >
              Category
            </label>
            <input
              type="text"
              id="article_category"
              name="article_category"
              value={formData.article_category}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="article_type"
              className="block text-sm font-medium text-gray-700"
            >
              Type
            </label>
            <input
              type="text"
              id="article_type"
              name="article_type"
              value={formData.article_type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="content"
              className="block text-sm font-medium text-gray-700"
            >
              Content
            </label>
            <textarea
              id="content"
              name="content"
              rows={10}
              value={formData.content}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="published"
                name="published"
                checked={formData.published}
                onChange={() => handleToggle('published')}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="published"
                className="ml-2 block text-sm text-gray-900"
              >
                Published
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="flagged_internal"
                name="flagged_internal"
                checked={formData.flagged_internal}
                onChange={() => handleToggle('flagged_internal')}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="flagged_internal"
                className="ml-2 block text-sm text-gray-900"
              >
                Flag for Internal Review
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Article'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
} 