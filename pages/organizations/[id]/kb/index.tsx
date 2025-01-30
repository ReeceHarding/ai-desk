import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, CheckCircle2, File, Upload } from 'lucide-react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadState {
  file: File | null;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function KnowledgeBaseUpload() {
  const router = useRouter();
  const { toast } = useToast();
  const orgId = router.query.id as string;
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    progress: 0,
    status: 'idle',
  });

  useEffect(() => {
    if (router.isReady && (!orgId || orgId === 'null')) {
      toast({
        title: 'Access Denied',
        description: 'You must be part of an organization to access the knowledge base.',
        variant: 'destructive',
      });
      router.push('/profile/settings');
    }
  }, [orgId, router.isReady, toast]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (!['application/pdf', 'text/plain'].includes(file.type)) {
        toast({
          title: 'Unsupported file type',
          description: 'Please upload a PDF or text file.',
          variant: 'destructive',
        });
        return;
      }
      setUploadState(prev => ({ ...prev, file, status: 'idle' }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    multiple: false,
  });

  // If no orgId, don't render the upload interface
  if (!orgId || orgId === 'null') {
    return null;
  }

  const handleUpload = async () => {
    if (!uploadState.file || !orgId) return;

    setUploadState(prev => ({ ...prev, status: 'uploading', progress: 0 }));

    const formData = new FormData();
    formData.append('file', uploadState.file);
    formData.append('orgId', orgId);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 500);

      const response = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      
      setUploadState(prev => ({
        ...prev,
        status: 'success',
        progress: 100,
      }));

      toast({
        title: 'Upload successful',
        description: `Processed ${result.chunksProcessed} chunks from your document.`,
      });
    } catch (error: any) {
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
        progress: 0,
      }));

      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Knowledge Base Upload</h1>
        
        <Card className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}
              ${uploadState.status === 'success' ? 'border-green-500 bg-green-50' : ''}
              ${uploadState.status === 'error' ? 'border-red-500 bg-red-50' : ''}`}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center gap-4">
              {uploadState.status === 'success' ? (
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              ) : uploadState.status === 'error' ? (
                <AlertCircle className="w-12 h-12 text-red-500" />
              ) : uploadState.file ? (
                <File className="w-12 h-12 text-primary" />
              ) : (
                <Upload className="w-12 h-12 text-gray-400" />
              )}
              
              <div className="space-y-2">
                {uploadState.file ? (
                  <>
                    <p className="text-sm font-medium">{uploadState.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(uploadState.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">
                      {isDragActive
                        ? 'Drop your file here'
                        : 'Drag and drop your file here'}
                    </p>
                    <p className="text-sm text-gray-500">
                      or click to select a file
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {uploadState.status === 'uploading' && (
            <div className="mt-4 space-y-2">
              <Progress value={uploadState.progress} />
              <p className="text-sm text-center text-gray-500">
                Processing document...
              </p>
            </div>
          )}

          {uploadState.file && uploadState.status !== 'success' && (
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={uploadState.status === 'uploading'}
              >
                {uploadState.status === 'uploading' ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          )}

          {uploadState.status === 'success' && (
            <div className="mt-4">
              <p className="text-sm text-center text-green-600">
                Document uploaded and processed successfully!
              </p>
            </div>
          )}

          {uploadState.status === 'error' && (
            <div className="mt-4">
              <p className="text-sm text-center text-red-600">
                {uploadState.error || 'An error occurred during upload'}
              </p>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
} 