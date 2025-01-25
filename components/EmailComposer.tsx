import { Button } from '@/components/ui/button'
import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Paperclip, Send } from 'lucide-react'
import dynamic from 'next/dynamic'
import React, { useRef, useState } from 'react'
import 'react-quill/dist/quill.snow.css'
import { v4 as uuidv4 } from 'uuid'

const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="h-[200px] bg-gray-100 rounded-lg animate-pulse" />
})

type Attachment = {
  name: string
  url: string
}

interface EmailComposerProps {
  onSend: (htmlBody: string, attachments: Attachment[]) => void
  loading?: boolean
}

export function EmailComposer({ onSend, loading }: EmailComposerProps) {
  const [editorValue, setEditorValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const supabase = useSupabaseClient<Database>()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    try {
      const bucket = 'private-attachments'
      const fileExt = file.name.split('.').pop()
      const filePath = `${uuidv4()}.${fileExt}`

      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file)

      if (error) {
        console.error('File upload error:', error)
        return
      }

      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)
      
      if (!data?.publicUrl) {
        console.error('No public URL from supabase')
        return
      }

      setAttachments((prev) => [
        ...prev,
        { name: file.name, url: data.publicUrl },
      ])
    } catch (uploadErr) {
      console.error('Upload exception:', uploadErr)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSend = () => {
    onSend(editorValue, attachments)
    setEditorValue('')
    setAttachments([])
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      <ReactQuill
        theme="snow"
        value={editorValue}
        onChange={setEditorValue}
        className="bg-white text-gray-900 rounded-lg border border-gray-200 text-sm sm:text-base"
        placeholder="Compose your email..."
        modules={{
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['clean'],
          ],
        }}
      />
      
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {attachments.map((att) => (
          <div
            key={att.name}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-50 text-gray-700 rounded-lg border border-gray-200"
          >
            <Paperclip className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
            <span className="text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[200px]">{att.name}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-500 hover:text-gray-900"
          >
            <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
        <Button
          onClick={handleSend}
          variant="default"
          size="sm"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2"
        >
          <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
          Send
        </Button>
      </div>
    </div>
  )
} 