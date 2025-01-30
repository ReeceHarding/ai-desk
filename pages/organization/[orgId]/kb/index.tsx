import { AppLayout } from '@/components/AppLayout'
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { Database } from '@/types/supabase'
import { logger } from '@/utils/logger'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { FileText, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

type KnowledgeDoc = Database['public']['Tables']['knowledge_docs']['Row']

export default function KnowledgeBasePage() {
  const router = useRouter()
  const orgId = router.query.orgId as string
  const supabase = useSupabaseClient<Database>()
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (router.isReady && (!orgId || orgId === 'null')) {
      toast({
        title: 'Access Denied',
        description: 'You must be part of an organization to access the knowledge base.',
        variant: 'destructive',
      })
      router.push('/profile/settings')
    }
  }, [orgId, router.isReady, router])

  useEffect(() => {
    if (orgId) {
      fetchDocs()
    }
  }, [orgId])

  const fetchDocs = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_docs')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setDocs(data)
    } catch (error) {
      logger.error('Failed to fetch knowledge docs', { error })
      toast({
        title: 'Error',
        description: 'Failed to load knowledge base documents.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_docs')
        .delete()
        .eq('id', docId)

      if (error) {
        throw error
      }

      setDocs(docs.filter(doc => doc.id !== docId))
      toast({
        title: 'Success',
        description: 'Document deleted successfully.',
      })
    } catch (error) {
      logger.error('Failed to delete knowledge doc', { error, docId })
      toast({
        title: 'Error',
        description: 'Failed to delete document.',
        variant: 'destructive',
      })
    }
  }

  const handleUploadComplete = () => {
    fetchDocs()
  }

  if (!orgId || orgId === 'null') {
    return null
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <KnowledgeBaseUpload orgId={orgId} onUploadComplete={handleUploadComplete} />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : docs.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No documents yet</h3>
            <p className="text-gray-500 mb-4">
              Upload PDF or text files to start building your knowledge base.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {docs.map(doc => (
              <Card key={doc.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium mb-2">{doc.title}</h3>
                    {doc.description && (
                      <p className="text-sm text-gray-500 mb-2">{doc.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Added {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
} 