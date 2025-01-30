import { KnowledgeBaseUploadForm } from '@/components/knowledge-base/upload-form';
import { toast } from '@/components/ui/use-toast';
import { useUser } from '@supabase/auth-helpers-react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@supabase/auth-helpers-react', () => ({
  useUser: jest.fn(),
}));

jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

describe('KnowledgeBaseUploadForm', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useUser as jest.Mock).mockReturnValue(mockUser);
    global.fetch = jest.fn();
  });

  it('renders upload form with file input and button', () => {
    render(<KnowledgeBaseUploadForm />);
    
    expect(screen.getByLabelText(/upload knowledge base document/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByText(/supported file types/i)).toBeInTheDocument();
    expect(screen.getByText(/maximum file size/i)).toBeInTheDocument();
  });

  it('validates PDF file type', () => {
    render(<KnowledgeBaseUploadForm />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload knowledge base document/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText(/0.00 mb/i)).toBeInTheDocument();
  });

  it('validates text file type', () => {
    render(<KnowledgeBaseUploadForm />);
    
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload knowledge base document/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText(/0.00 mb/i)).toBeInTheDocument();
  });

  it('shows error for invalid file type', () => {
    render(<KnowledgeBaseUploadForm />);
    
    const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload knowledge base document/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(toast).toHaveBeenCalledWith({
      title: 'Invalid file type',
      description: 'Please upload a PDF or text file.',
      variant: 'destructive',
    });
  });

  it('shows error for file size over 50MB', () => {
    render(<KnowledgeBaseUploadForm />);
    
    const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload knowledge base document/i);
    
    fireEvent.change(input, { target: { files: [largeFile] } });
    
    expect(toast).toHaveBeenCalledWith({
      title: 'File too large',
      description: 'Maximum file size is 50MB.',
      variant: 'destructive',
    });
  });

  it('handles successful file upload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ totalChunks: 5 }),
    });

    render(<KnowledgeBaseUploadForm />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload knowledge base document/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Upload successful',
        description: 'Document uploaded with 5 chunks.',
      });
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/kb/upload', {
      method: 'POST',
      body: expect.any(FormData),
    });
  });

  it('handles upload error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Upload failed' }),
    });

    render(<KnowledgeBaseUploadForm />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload knowledge base document/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Upload failed',
        description: 'Upload failed',
        variant: 'destructive',
      });
    });
  });

  it('disables form during upload', async () => {
    let resolveUpload: (value: any) => void;
    const uploadPromise = new Promise(resolve => {
      resolveUpload = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValueOnce(uploadPromise);

    render(<KnowledgeBaseUploadForm />);
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload knowledge base document/i);
    const button = screen.getByRole('button', { name: /upload/i });
    
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(button);
    
    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();

    resolveUpload!({
      ok: true,
      json: () => Promise.resolve({ totalChunks: 5 }),
    });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(button).toBeDisabled(); // Still disabled because file is cleared
      expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
    });
  });
}); 