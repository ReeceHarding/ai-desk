import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { TicketSidebar } from '../../components/ticket-sidebar';

// Mock the hooks
jest.mock('@supabase/auth-helpers-react', () => ({
  useSupabaseClient: jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock the toast hook
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe('TicketSidebar', () => {
  const mockTicket = {
    id: '123',
    subject: 'Test Ticket',
    description: 'Test Description',
    status: 'open' as const,
    priority: 'medium' as const,
    customer_id: 'cust123',
    assigned_agent_id: 'agent123',
    escalation_level: 1,
    due_at: new Date().toISOString(),
    custom_fields: {},
    metadata: {
      thread_id: 'thread123',
      message_id: 'msg123',
    },
    extra_text_1: null,
    extra_json_1: {},
    org_id: 'org123',
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    next_followup_at: null,
    feedback_score: null,
    customer: {
      display_name: 'John Doe',
      email: 'john@example.com',
      avatar_url: null,
    },
    organization: {
      name: 'Test Org',
    },
  };

  const mockRouter = {
    push: jest.fn(),
  };

  const mockSupabase = {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('renders ticket information correctly', () => {
    render(
      <TicketSidebar
        ticket={mockTicket}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Check if basic ticket information is rendered
    expect(screen.getByText(`Ticket #${mockTicket.id}`)).toBeInTheDocument();
    expect(screen.getByText(mockTicket.subject)).toBeInTheDocument();
    expect(screen.getByText(mockTicket.description)).toBeInTheDocument();
  });

  it('toggles details panel when button is clicked', () => {
    render(
      <TicketSidebar
        ticket={mockTicket}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Initially, details panel should be visible
    expect(screen.getByText('Hide Details')).toBeInTheDocument();

    // Click the button to hide details
    fireEvent.click(screen.getByText('Hide Details'));

    // Now the button should show 'Show Details'
    expect(screen.getByText('Show Details')).toBeInTheDocument();
  });

  it('toggles email thread panel when button is clicked', () => {
    render(
      <TicketSidebar
        ticket={mockTicket}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Initially, email thread panel should be hidden
    expect(screen.getByText('Show Thread')).toBeInTheDocument();

    // Click the button to show thread
    fireEvent.click(screen.getByText('Show Thread'));

    // Now the button should show 'Hide Thread'
    expect(screen.getByText('Hide Thread')).toBeInTheDocument();
  });

  it('updates ticket status correctly', async () => {
    render(
      <TicketSidebar
        ticket={mockTicket}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Find and click the status button
    const statusButton = screen.getByRole('button', { name: /open/i });
    fireEvent.click(statusButton);

    // Select a new status
    const solvedStatus = screen.getByText('solved');
    fireEvent.click(solvedStatus);

    // Verify that the Supabase client was called correctly
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('tickets');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({ status: 'solved' });
      expect(mockSupabase.from().update().eq).toHaveBeenCalledWith('id', mockTicket.id);
    });
  });

  it('updates ticket priority correctly', async () => {
    render(
      <TicketSidebar
        ticket={mockTicket}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Find and click the priority button
    const priorityButton = screen.getByRole('button', { name: /medium/i });
    fireEvent.click(priorityButton);

    // Select a new priority
    const highPriority = screen.getByText('high');
    fireEvent.click(highPriority);

    // Verify that the Supabase client was called correctly
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('tickets');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({ priority: 'high' });
      expect(mockSupabase.from().update().eq).toHaveBeenCalledWith('id', mockTicket.id);
    });
  });

  it('updates ticket assignee correctly', async () => {
    const newAssigneeId = 'agent456';
    render(
      <TicketSidebar
        ticket={mockTicket}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Find and click the assign button
    const assignButton = screen.getByRole('button', { name: /assign/i });
    fireEvent.click(assignButton);

    // Select a new assignee
    const newAssignee = screen.getByText('John Smith');
    fireEvent.click(newAssignee);

    // Verify that the Supabase client was called correctly
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('tickets');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({ assigned_agent_id: newAssigneeId });
      expect(mockSupabase.from().update().eq).toHaveBeenCalledWith('id', mockTicket.id);
    });
  });

  it('calls onClose when sheet is closed', () => {
    const onClose = jest.fn();
    render(
      <TicketSidebar
        ticket={mockTicket}
        isOpen={true}
        onClose={onClose}
      />
    );

    // Find and click the close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Verify that onClose was called
    expect(onClose).toHaveBeenCalled();
  });
}); 