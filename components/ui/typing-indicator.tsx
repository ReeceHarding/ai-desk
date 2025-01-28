import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  count?: number;
  className?: string;
}

export function TypingIndicator({ count = 0, className = '' }: TypingIndicatorProps) {
  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-center space-x-2 text-sm text-slate-400 ${className}`}
    >
      <div className="flex space-x-1">
        <span className="animate-bounce">•</span>
        <span className="animate-bounce delay-100">•</span>
        <span className="animate-bounce delay-200">•</span>
      </div>
      <span>
        {count === 1 ? 'Someone is typing...' : `${count} people are typing...`}
      </span>
    </motion.div>
  );
} 