import { KnowledgeBaseUpload } from '@/components/kb/KnowledgeBaseUpload';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, FileText, FileTextIcon, Link as LinkIcon, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type KnowledgeDoc = Database['public']['Tables']['knowledge_docs']['Row'];

const MotionDiv = motion.div;

export default function KnowledgeBasePage() {
  const router = useRouter();
  const orgId = router.query.id as string;
  const supabase = useSupabaseClient<Database>();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (router.isReady && (!orgId || orgId === 'null')) {
      toast({
        title: 'Access Denied',
        description: 'You must be part of an organization to access the knowledge base.',
        variant: 'destructive',
      });
      router.push('/profile/settings');
    }
  }, [orgId, router.isReady, router]);

  useEffect(() => {
    if (orgId) {
      fetchDocs();
    }
  }, [orgId]);

  const fetchDocs = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_docs')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setDocs(data || []);
    } catch (error) {
      logger.error('Failed to fetch knowledge docs', { error });
      toast({
        title: 'Error',
        description: 'Failed to load knowledge base documents.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_docs')
        .delete()
        .eq('id', docId);

      if (error) {
        throw error;
      }

      setDocs(docs.filter(doc => doc.id !== docId));
      toast({
        title: 'Success',
        description: 'Document deleted successfully.',
      });
    } catch (error) {
      logger.error('Failed to delete knowledge doc', { error, docId });
      toast({
        title: 'Error',
        description: 'Failed to delete document.',
        variant: 'destructive',
      });
    }
  };

  const handleUploadComplete = () => {
    fetchDocs();
  };

  if (!orgId || orgId === 'null') {
    return null;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Knowledge Base
            </h1>
            <p className="text-slate-500 mt-2">
              Upload and manage your organization's knowledge base documents
            </p>
          </div>
          <KnowledgeBaseUpload orgId={orgId} onUploadComplete={handleUploadComplete} />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-slate-500">Loading documents...</p>
            </div>
          </div>
        ) : docs.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-medium mb-2">No documents yet</h3>
            <p className="text-slate-500 mb-4">
              Upload PDF or text files to start building your knowledge base.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {docs.map(doc => (
                <MotionDiv
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative group"
                  onMouseEnter={() => setHoveredDocId(doc.id)}
                  onMouseLeave={() => setHoveredDocId(null)}
                >
                  <Card className="p-6 h-full transition-all duration-200 hover:shadow-lg hover:border-blue-200">
                    <div className="flex flex-col h-full">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <FileTextIcon className="w-5 h-5 text-blue-500" />
                          </div>
                          <h3 className="font-medium line-clamp-2">{doc.title}</h3>
                        </div>
                      </div>

                      {doc.description && (
                        <p className="mt-3 text-sm text-slate-500 line-clamp-2">
                          {doc.description}
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Added {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {doc.source_url && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                            <LinkIcon className="w-4 h-4" />
                            <a
                              href={doc.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate hover:text-blue-500 transition-colors"
                            >
                              {doc.source_url}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Delete button - only visible on hover */}
                      <AnimatePresence>
                        {hoveredDocId === doc.id && (
                          <MotionDiv
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute top-2 right-2"
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(doc.id);
                              }}
                              className="h-8 w-8 bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </MotionDiv>
                        )}
                      </AnimatePresence>
                    </div>
                  </Card>
                </MotionDiv>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
} 