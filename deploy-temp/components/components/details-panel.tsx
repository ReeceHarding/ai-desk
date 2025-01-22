import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DetailsPanelProps {
  isOpen: boolean;
}

export function DetailsPanel({ isOpen }: DetailsPanelProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      className="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 shadow-xl"
      style={{ marginRight: '24rem' }}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white">Details</h2>
      </div>
      <div className="p-4">
        {/* Details content will be added here */}
      </div>
    </motion.div>
  );
} 