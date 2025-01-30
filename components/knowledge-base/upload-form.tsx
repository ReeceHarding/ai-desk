import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { useUser } from '@supabase/auth-helpers-react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

export function KnowledgeBaseUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const user = useUser();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    if (!selectedFile.type.match('application/pdf|text/plain')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or text file.',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (50MB limit)
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 50MB.',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || !user?.id) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgId', user.id);

      const response = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      toast({
        title: 'Upload successful',
        description: `Document uploaded with ${result.totalChunks} chunks.`,
      });

      // Clear form
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload document.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }, [file, user?.id]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">Upload Knowledge Base Document</Label>
        <div className="flex gap-4">
          <Input
            ref={fileInputRef}
            id="file"
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="min-w-[100px]"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>

      {file && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileText className="h-4 w-4" />
          <span>{file.name}</span>
          <span className="text-gray-400">
            ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </span>
        </div>
      )}

      <div className="text-sm text-gray-500">
        <p>Supported file types: PDF, TXT</p>
        <p>Maximum file size: 50MB</p>
      </div>
    </div>
  );
} 