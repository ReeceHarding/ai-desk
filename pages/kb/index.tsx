import { KnowledgeBaseUpload } from '@/components/kb/KnowledgeBaseUpload';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';

type KnowledgeDoc = Database['public']['Tables']['knowledge_docs']['Row'];

export default function KnowledgeBasePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useSupabaseClient<Database>();
  const user = useUser();

  // Get user's organization ID
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Get user's organization
    const fetchOrgId = async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (error) {
        logger.error('Failed to fetch user profile', { error });
        toast({
          title: 'Error',
          description: 'Failed to load user organization',
          variant: 'destructive',
        });
        return;
      }

      setOrgId(profile.org_id);
    };

    fetchOrgId();
  }, [user, supabase]);

  // Load knowledge base documents
  useEffect(() => {
    if (!orgId) return;

    const loadDocs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('knowledge_docs')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setDocs(data || []);
      } catch (error) {
        logger.error('Failed to load knowledge docs', { error });
        toast({
          title: 'Error',
          description: 'Failed to load knowledge base documents',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadDocs();
  }, [orgId, supabase]);

  const handleDelete = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_docs')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      setDocs((prev) => prev.filter((doc) => doc.id !== docId));

      toast({
        title: 'Document deleted',
        description: 'The document has been removed from your knowledge base.',
      });
    } catch (error) {
      logger.error('Failed to delete document', { error });
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const handleUploadComplete = () => {
    // Reload the documents list
    if (orgId) {
      supabase
        .from('knowledge_docs')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            logger.error('Failed to reload docs after upload', { error });
            return;
          }
          setDocs(data || []);
        });
    }
  };

  if (!user || !orgId) {
    return (
      <AppLayout>
        <div className="p-4">
          <div>Please log in to access the knowledge base.</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold mb-4">Knowledge Base</h1>
          <KnowledgeBaseUpload orgId={orgId} onUploadComplete={handleUploadComplete} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Uploaded Documents</h2>
          {isLoading ? (
            <div>Loading documents...</div>
          ) : docs.length === 0 ? (
            <div className="text-slate-500">
              No documents uploaded yet. Upload a document to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 border border-slate-200 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{doc.title}</div>
                    <div className="text-sm text-slate-500">
                      Uploaded {new Date(doc.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
} 