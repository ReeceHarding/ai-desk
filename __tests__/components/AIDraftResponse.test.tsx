import { sendGmailReply } from '@/utils/gmail';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AIDraftResponse } from '../../components/AIDraftResponse';

// Mock dependencies
jest.mock('../../utils/ai-email-processor');
jest.mock('@supabase/auth-helpers-nextjs');
jest.mock('../../components/ui/use-toast');
jest.mock('@/utils/gmail');
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
  })),
}));

describe('AIDraftResponse', () => {
  const mockProps = {
    chatId: 'chat123',
    messageId: 'msg123',
    threadId: 'thread123',
    toAddress: 'customer@example.com',
    subject: 'Test Subject',
    draftResponse: 'This is a test response',
    onSent: jest.fn(),
    onDiscarded: jest.fn(),
    orgId: 'org123',
  };

  const mockSupabaseClient = {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    }))
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  it('renders the draft response with send and discard buttons', () => {
    render(<AIDraftResponse {...mockProps} />);

    expect(screen.getByText('AI Draft Response')).toBeInTheDocument();
    expect(screen.getByText('This is a test response')).toBeInTheDocument();
    expect(screen.getByText('Send This Draft')).toBeInTheDocument();
    expect(screen.getByText('Discard')).toBeInTheDocument();
  });

  it('sends the draft when clicking Send This Draft', async () => {
    (sendGmailReply as jest.Mock).mockResolvedValue(undefined);

    render(<AIDraftResponse {...mockProps} />);

    fireEvent.click(screen.getByText('Send This Draft'));

    await waitFor(() => {
      expect(sendGmailReply).toHaveBeenCalledWith({
        threadId: 'thread123',
        inReplyTo: 'msg123',
        to: ['customer@example.com'],
        subject: 'Re: Test Subject',
        htmlBody: 'This is a test response',
        orgId: 'org123',
      });
    });

    // Verify Supabase update
    const supabase = createClient('', '');
    expect(supabase.from).toHaveBeenCalledWith('ticket_email_chats');
    expect(supabase.from('ticket_email_chats').update).toHaveBeenCalledWith({
      ai_auto_responded: true,
    });

    expect(mockProps.onSent).toHaveBeenCalled();
  });

  it('discards the draft when clicking Discard', async () => {
    render(<AIDraftResponse {...mockProps} />);

    fireEvent.click(screen.getByText('Discard'));

    // Verify Supabase update
    const supabase = createClient('', '');
    expect(supabase.from).toHaveBeenCalledWith('ticket_email_chats');
    expect(supabase.from('ticket_email_chats').update).toHaveBeenCalledWith({
      ai_draft_response: null,
    });

    expect(mockProps.onDiscarded).toHaveBeenCalled();
  });

  it('shows error message when send fails', async () => {
    (sendGmailReply as jest.Mock).mockRejectedValue(new Error('Failed to send'));

    render(<AIDraftResponse {...mockProps} />);

    fireEvent.click(screen.getByText('Send This Draft'));

    await waitFor(() => {
      expect(screen.getByText('Failed to send response')).toBeInTheDocument();
    });

    expect(mockProps.onSent).not.toHaveBeenCalled();
  });

  it('disables buttons while sending', async () => {
    // Make sendGmailReply take some time
    (sendGmailReply as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<AIDraftResponse {...mockProps} />);

    fireEvent.click(screen.getByText('Send This Draft'));

    // Buttons should be disabled and Send button should show loading state
    expect(screen.getByText('Sending...')).toBeInTheDocument();
    expect(screen.getByText('Sending...')).toBeDisabled();
    expect(screen.getByText('Discard')).toBeDisabled();

    // Wait for send to complete
    await waitFor(() => {
      expect(screen.getByText('Send This Draft')).toBeInTheDocument();
    });

    // Buttons should be enabled again
    expect(screen.getByText('Send This Draft')).not.toBeDisabled();
    expect(screen.getByText('Discard')).not.toBeDisabled();
  });
}); 