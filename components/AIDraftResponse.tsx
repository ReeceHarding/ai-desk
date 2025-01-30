import { Database } from '@/types/supabase';
import { sendDraftResponse } from '@/utils/ai-email-processor';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Bot, Edit2, Save, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { toast } from './ui/use-toast';

interface AIDraftResponseProps {
  chatId: string;
  draftResponse: string;
  confidence?: number;
  ragReferences?: string[];
  onSent?: () => void;
}

export function AIDraftResponse({ 
  chatId, 
  draftResponse, 
  confidence,
  ragReferences,
  onSent 
}: AIDraftResponseProps) {
  const [sending, setSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResponse, setEditedResponse] = useState(draftResponse);
  const supabase = createClientComponentClient<Database>();

  const handleSendDraft = async () => {
    try {
      setSending(true);
      await sendDraftResponse(chatId);
      toast({
        title: 'Draft sent successfully',
        description: 'The AI-generated response has been sent.',
      });
      onSent?.();
    } catch (error) {
      console.error('Error sending draft:', error);
      toast({
        title: 'Error sending draft',
        description: 'Failed to send the AI-generated response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await supabase
        .from('ticket_email_chats')
        .update({
          ai_draft_response: null,
        })
        .eq('id', chatId);

      toast({
        title: 'Draft discarded',
        description: 'The AI-generated response has been discarded.',
      });
      onSent?.();
    } catch (error) {
      console.error('Error discarding draft:', error);
      toast({
        title: 'Error discarding draft',
        description: 'Failed to discard the AI-generated response. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveEdit = async () => {
    try {
      await supabase
        .from('ticket_email_chats')
        .update({
          ai_draft_response: editedResponse,
        })
        .eq('id', chatId);

      toast({
        title: 'Draft updated',
        description: 'Your changes have been saved.',
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating draft:', error);
      toast({
        title: 'Error updating draft',
        description: 'Failed to save your changes. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getConfidenceColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-600';
    if (score >= 85) return 'bg-green-100 text-green-700';
    if (score >= 70) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <Card className="mt-4 p-4 bg-slate-50 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-slate-600" />
          <h4 className="font-semibold text-slate-700">AI-Generated Draft Response</h4>
          {confidence !== undefined && (
            <Badge className={`ml-2 ${getConfidenceColor(confidence)}`}>
              {confidence.toFixed(2)}% Confidence
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <Textarea
            value={editedResponse}
            onChange={(e) => setEditedResponse(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setEditedResponse(draftResponse);
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
            >
              <Save className="h-4 w-4 mr-1" />
              Save Changes
            </Button>
          </div>
        </div>
      ) : (
        <div className="prose prose-slate max-w-none">
          <div
            className="text-slate-600 whitespace-pre-wrap bg-white p-4 rounded-md border border-slate-200"
            dangerouslySetInnerHTML={{ __html: editedResponse }}
          />
        </div>
      )}

      {ragReferences && ragReferences.length > 0 && (
        <div className="mt-3 text-sm text-slate-500">
          Based on {ragReferences.length} knowledge base references
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <Button
          size="sm"
          variant="outline"
          onClick={handleDiscard}
          disabled={sending}
        >
          Discard
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={handleSendDraft}
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Send Draft'}
        </Button>
      </div>
    </Card>
  );
} 