import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useState } from 'react';

interface KnowledgeBaseUploadProps {
  orgId: string;
  onUploadComplete?: () => void;
}

export function KnowledgeBaseUpload({ orgId, onUploadComplete }: KnowledgeBaseUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const supabase = useSupabaseClient<Database>();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.match(/^(application\/pdf|text\/plain)$/)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or text file.',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 50MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgId', orgId);

      // Upload file
      const response = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      logger.info('KB document uploaded successfully', {
        docId: result.docId,
        totalChunks: result.totalChunks,
      });

      toast({
        title: 'Document uploaded',
        description: `Successfully processed ${result.totalChunks} chunks.`,
      });

      // Clear input
      event.target.value = '';

      // Call completion callback
      onUploadComplete?.();
    } catch (error) {
      logger.error('Failed to upload KB document', { error });
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="flex-1"
        />
        {isUploading && (
          <div className="text-sm text-slate-500">
            Processing...
          </div>
        )}
      </div>
      <div className="text-sm text-slate-500">
        Upload PDF or text files to add to your knowledge base.
        Maximum file size: 50MB.
      </div>
    </div>
  );
} 