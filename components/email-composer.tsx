import { cn } from '@/lib/utils'
import { Color } from '@tiptap/extension-color'
import Paragraph from '@tiptap/extension-paragraph'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    Image as ImageIcon,
    Italic,
    List,
    ListOrdered,
    Loader2,
    Send,
    Smile,
    Sparkles,
    Underline as UnderlineIcon
} from 'lucide-react'
import { useCallback } from 'react'
import { EmojiPicker } from './emoji-picker'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Separator } from './ui/separator'
import { Toggle } from './ui/toggle'
import { Toolbar } from './ui/toolbar'

interface EmailComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onGenerateAIResponse?: () => void
  isSending?: boolean
  isGeneratingAI?: boolean
  placeholder?: string
  className?: string
}

export function EmailComposer({ 
  value, 
  onChange, 
  onSend,
  onGenerateAIResponse,
  isSending = false,
  isGeneratingAI = false,
  placeholder = 'Type your message...',
  className 
}: EmailComposerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'mb-4',
          },
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Paragraph,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // Ensure proper line breaks and spacing in the HTML output
      const html = editor.getHTML()
        .replace(/<p>/g, '<p style="margin-bottom: 1em;">')
        .replace(/<br>/g, '<br />\n')
        .replace(/<\/p>/g, '</p>\n\n');
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-none min-h-[200px] p-4 focus:outline-none',
      },
    },
  })

  const addEmoji = useCallback((emoji: string) => {
    editor?.commands.insertContent(emoji)
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <Toolbar className="border-b p-1">
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1" />

        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1" />

        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: 'left' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: 'center' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: 'right' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </Toggle>

        <div className="flex-1" />

        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <EmojiPicker onEmojiSelect={addEmoji} />
          </PopoverContent>
        </Popover>
      </Toolbar>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-between p-2 border-t">
        <div className="text-xs text-muted-foreground">
          Use <kbd className="px-1 rounded bg-muted">⌘B</kbd> for bold, <kbd className="px-1 rounded bg-muted">⌘I</kbd> for italic
        </div>
        <div className="flex items-center gap-2">
          {onGenerateAIResponse && (
            <Button
              variant="outline"
              onClick={onGenerateAIResponse}
              disabled={isGeneratingAI}
              className="gap-2"
            >
              {isGeneratingAI ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI Response
            </Button>
          )}
          <Button 
            onClick={onSend} 
            disabled={!editor.getText().trim() || isSending}
            className="gap-2"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  )
} 
