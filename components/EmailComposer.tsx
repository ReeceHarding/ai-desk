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
  loading: () => <div className="h-[200px] bg-slate-800/50 rounded-lg animate-pulse" />
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
    <div className="space-y-3">
      <ReactQuill
        theme="snow"
        value={editorValue}
        onChange={setEditorValue}
        className="bg-white text-black rounded-md"
        placeholder="Compose your email..."
        modules={{
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['clean'],
          ],
        }}
      />
      
      <div className="flex items-center gap-2 flex-wrap">
        {attachments.map((att) => (
          <div
            key={att.name}
            className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white rounded"
          >
            <Paperclip className="h-4 w-4" />
            <span className="text-sm">{att.name}</span>
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
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>
        <Button
          onClick={handleSend}
          variant="default"
          size="sm"
          disabled={loading}
        >
          <Send className="h-4 w-4 mr-1" />
          Send
        </Button>
      </div>
    </div>
  )
} 