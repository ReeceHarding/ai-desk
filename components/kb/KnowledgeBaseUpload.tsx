import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { CheckCircle2, Upload, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface KnowledgeBaseUploadProps {
  orgId: string;
  onUploadComplete?: () => void;
}

interface UploadState {
  files: File[];
  progress: Record<string, number>;
  status: 'idle' | 'uploading' | 'error';
  error?: string;
}

export function KnowledgeBaseUpload({ orgId, onUploadComplete }: KnowledgeBaseUploadProps) {
  const { toast } = useToast();
  const [uploadState, setUploadState] = useState<UploadState>({
    files: [],
    progress: {},
    status: 'idle',
  });
  const [isOpen, setIsOpen] = useState(false);
  const supabase = useSupabaseClient<Database>();

  const onDrop = async (acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => 
      ['application/pdf', 'text/plain'].includes(file.type)
    );

    if (validFiles.length < acceptedFiles.length) {
      toast({
        title: 'Some files skipped',
        description: 'Only PDF and text files are supported.',
        variant: 'destructive',
      });
    }

    if (validFiles.length > 0) {
      setUploadState((prev: UploadState) => ({ 
        ...prev, 
        files: validFiles,
        status: 'idle',
        progress: Object.fromEntries(validFiles.map(f => [f.name, 0]))
      }));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    multiple: true,
  });

  const handleUpload = async () => {
    if (!uploadState.files.length || !orgId) return;

    setUploadState((prev: UploadState) => ({ ...prev, status: 'uploading' }));

    try {
      const uploadPromises = uploadState.files.map(async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('orgId', orgId);

        // Simulate progress updates for this file
        const progressInterval = setInterval(() => {
          setUploadState((prev: UploadState) => ({
            ...prev,
            progress: {
              ...prev.progress,
              [file.name]: Math.min((prev.progress[file.name] || 0) + 10, 90)
            }
          }));
        }, 500);

        try {
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
          
          setUploadState((prev: UploadState) => ({
            ...prev,
            progress: {
              ...prev.progress,
              [file.name]: 100
            }
          }));

          return { file, result };
        } catch (error) {
          clearInterval(progressInterval);
          throw error;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      
      const successful = results.filter((r: PromiseSettledResult<{file: File, result: any}>) => r.status === 'fulfilled') as PromiseFulfilledResult<{file: File, result: any}>[];
      const failed = results.filter((r: PromiseSettledResult<{file: File, result: any}>) => r.status === 'rejected') as PromiseRejectedResult[];

      if (successful.length > 0) {
        toast({
          title: 'Upload successful',
          description: `Successfully uploaded ${successful.length} document${successful.length > 1 ? 's' : ''}.`,
        });
      }

      if (failed.length > 0) {
        toast({
          title: 'Some uploads failed',
          description: `${failed.length} document${failed.length > 1 ? 's' : ''} failed to upload.`,
          variant: 'destructive',
        });
      }

      onUploadComplete?.();
      setTimeout(() => {
        setIsOpen(false);
        setUploadState({
          files: [],
          progress: {},
          status: 'idle',
        });
      }, 1500);
    } catch (error: any) {
      logger.error('Failed to upload documents', { error });
      setUploadState((prev: UploadState) => ({
        ...prev,
        status: 'error',
        error: error.message,
        progress: {}
      }));

      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {/* Drag & Drop Area - Hide while uploading */}
        {uploadState.status !== 'uploading' && (
          <div 
            {...getRootProps()} 
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              {isDragActive ? (
                <p className="text-sm text-gray-600">Drop your files here</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Drag and drop your files here, or click to select
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF or text files, up to 50MB each
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* File List and Upload Progress */}
        {uploadState.files.length > 0 && (
          <div className="space-y-3 bg-white rounded-lg border p-4">
            <div className="text-sm font-medium text-gray-700">
              {uploadState.status === 'uploading' ? 'Uploading Files...' : 'Selected Files'}
            </div>
            
            <div className="space-y-3">
              {uploadState.files.map((file) => {
                const progress = uploadState.progress[file.name] || 0;
                const isComplete = progress === 100;
                
                return (
                  <div key={file.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Upload className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="truncate max-w-[200px]" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {progress}%
                      </span>
                    </div>
                    
                    <Progress 
                      value={progress} 
                      className={`h-1 ${isComplete ? 'bg-green-100' : 'bg-gray-100'}`}
                    />
                  </div>
                );
              })}
            </div>

            {uploadState.status === 'idle' && (
              <Button
                onClick={handleUpload}
                disabled={uploadState.status !== 'idle'}
                className="w-full mt-4"
              >
                Upload {uploadState.files.length} {uploadState.files.length === 1 ? 'File' : 'Files'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {uploadState.status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-3 rounded-lg">
          <XCircle className="w-4 h-4" />
          <span>{uploadState.error}</span>
        </div>
      )}
    </div>
  );
} 