import { File, X } from 'lucide-react';
import Image from 'next/image';

interface FileAttachmentProps {
  type: 'image' | 'document';
  name: string;
  url: string;
  onRemove?: () => void;
  previewMode?: boolean;
  className?: string;
}

export function FileAttachment({
  type,
  name,
  url,
  onRemove,
  previewMode = false,
  className = '',
}: FileAttachmentProps) {
  if (type === 'image') {
    return (
      <div className={`relative group ${className}`}>
        <div className="relative w-20 h-20">
          <Image
            src={url}
            alt={name}
            fill
            className="rounded object-cover"
          />
          {!previewMode && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group ${className}`}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700"
      >
        <File className="h-4 w-4" />
        <span className="text-sm truncate max-w-[100px]">{name}</span>
      </a>
      {!previewMode && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3 text-white" />
        </button>
      )}
    </div>
  );
} 