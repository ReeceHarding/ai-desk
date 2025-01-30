import { sendDraftResponse } from '@/utils/ai-email-processor';
import { Bot, Edit2, Save, X } from 'lucide-react';
import { useState } from 'react';
import { DraftManager } from './conversation/DraftManager';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';

interface AIDraftResponseProps {
  chatId: string;
  draftResponse: string;
  confidence?: number;
  ragReferences?: string[];
  onSent?: () => void;
}

export function AIDraftResponse({ 
  chatId, 
  draftResponse: initialDraft, 
  confidence,
  ragReferences,
  onSent 
}: AIDraftResponseProps) {
  const [sending, setSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const handleSendDraft = async (draft: string) => {
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

  const getConfidenceColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-600';
    if (score >= 85) return 'bg-green-100 text-green-700';
    if (score >= 70) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <DraftManager chatId={chatId} initialDraft={initialDraft}>
      {({ draft, setDraft, isSaving, error: saveError }) => (
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
              {!isEditing && draft && (
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

          {saveError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
              {saveError}
            </div>
          )}

          {!isEditing ? (
            <div className="prose prose-slate max-w-none">
              <div
                className="text-slate-600 bg-white p-4 rounded-md border border-slate-200 whitespace-pre-wrap break-words"
                style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{
                  __html: draft || ''
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                value={draft || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\s{2,}/g, match => ' ' + '\u00A0'.repeat(match.length - 1));
                  setDraft(value);
                }}
                className="min-h-[200px] font-mono text-sm whitespace-pre-wrap"
                style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(initialDraft);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}

          {!isEditing && draft && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => handleSendDraft(draft)}
                disabled={sending || !draft}
              >
                {sending ? 'Sending...' : 'Send This Draft'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDraft(null)}
                disabled={sending}
              >
                Discard
              </Button>
            </div>
          )}

          {ragReferences && ragReferences.length > 0 && (
            <div className="mt-3 text-sm text-slate-500">
              Based on {ragReferences.length} knowledge base references
            </div>
          )}
        </Card>
      )}
    </DraftManager>
  );
} 