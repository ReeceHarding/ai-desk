import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ConversationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationPanel({ isOpen, onClose }: ConversationPanelProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-800 shadow-xl"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white">Conversation</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4">
        {/* Conversation content will be added here */}
      </div>
    </motion.div>
  );
} 