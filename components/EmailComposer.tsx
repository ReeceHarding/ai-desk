import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Paperclip, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { Button } from './ui/button'

interface Attachment {
  name: string
  url: string
  size: number
  type: string
}

interface EmailComposerProps {
  onSend: (body: string, attachments: Attachment[]) => void
  loading?: boolean
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip'
]

export function EmailComposer({ onSend, loading }: EmailComposerProps) {
  const [editorValue, setEditorValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const supabase = useSupabaseClient<Database>()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 25MB.')
      return
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('File type not allowed.')
      return
    }

    setUploading(true)
    try {
      const bucket = 'private-attachments'
      const fileExt = file.name.split('.').pop()
      const filePath = `${uuidv4()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600'
        })

      if (uploadError) {
        console.error('File upload error:', uploadError)
        toast.error('Failed to upload file.')
        return
      }

      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)
      
      if (!data?.publicUrl) {
        console.error('No public URL from supabase')
        toast.error('Failed to get file URL.')
        return
      }

      setAttachments((prev) => [
        ...prev,
        {
          name: file.name,
          url: data.publicUrl,
          size: file.size,
          type: file.type
        },
      ])
      toast.success('File attached successfully.')
    } catch (uploadErr) {
      console.error('Upload exception:', uploadErr)
      toast.error('Failed to upload file.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeAttachment = async (index: number) => {
    const attachment = attachments[index]
    const filePath = attachment.url.split('/').pop()
    if (!filePath) return

    try {
      const { error } = await supabase.storage
        .from('private-attachments')
        .remove([filePath])

      if (error) {
        console.error('Failed to remove file:', error)
        toast.error('Failed to remove attachment.')
        return
      }

      setAttachments((prev) => prev.filter((_, i) => i !== index))
      toast.success('Attachment removed.')
    } catch (error) {
      console.error('Remove attachment error:', error)
      toast.error('Failed to remove attachment.')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <textarea
        value={editorValue}
        onChange={(e) => setEditorValue(e.target.value)}
        className="w-full h-32 p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type your message here..."
      />
      
      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          {attachments.map((file, index) => (
            <div
              key={file.url}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
            >
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-gray-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeAttachment(index)}
                className="p-1 hover:bg-gray-200 rounded-full"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={uploading}
          >
            <Paperclip className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Attach File'}
          </Button>
        </div>
        <Button
          onClick={() => onSend(editorValue, attachments)}
          disabled={loading || uploading || (!editorValue && attachments.length === 0)}
        >
          Send
        </Button>
      </div>
    </div>
  )
} 