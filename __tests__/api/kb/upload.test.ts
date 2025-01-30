import handler from '@/pages/api/kb/upload';
import { generateEmbedding, upsertToPinecone } from '@/utils/rag';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { createMocks } from 'node-mocks-http';
import pdf from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('formidable');
jest.mock('fs');
jest.mock('pdf-parse');
jest.mock('uuid');
jest.mock('@/utils/rag');
jest.mock('@supabase/supabase-js');

describe('/api/kb/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles PDF upload successfully', async () => {
    // Mock UUID
    (uuidv4 as jest.Mock).mockReturnValue('doc123');

    // Mock file data
    const mockFile = {
      filepath: '/tmp/test.pdf',
      originalFilename: 'test.pdf',
      mimetype: 'application/pdf',
    };

    // Mock form parsing
    (formidable as unknown as jest.Mock).mockImplementation(() => ({
      parse: (req: any, callback: any) => {
        callback(null, { orgId: 'org123' }, { file: mockFile });
      },
    }));

    // Mock PDF parsing
    (fs.readFileSync as jest.Mock).mockReturnValue('pdf buffer');
    (pdf as jest.Mock).mockResolvedValue({
      text: 'This is the PDF content',
    });

    // Mock Supabase
    const mockSupabase = {
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 'doc123' },
              error: null,
            })),
          })),
        })),
      })),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock embedding generation
    (generateEmbedding as jest.Mock).mockResolvedValue([0.1, 0.2, 0.3]);

    // Create mock request
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        orgId: 'org123',
      },
    });

    await handler(req, res);

    // Verify response
    expect(res._getStatusCode()).toBe(200);
    const jsonResponse = JSON.parse(res._getData());
    expect(jsonResponse).toEqual({
      success: true,
      docId: 'doc123',
      totalChunks: expect.any(Number),
    });

    // Verify Supabase calls
    expect(mockSupabase.from).toHaveBeenCalledWith('knowledge_docs');
    expect(mockSupabase.from().insert).toHaveBeenCalledWith({
      org_id: 'org123',
      title: 'test.pdf',
      metadata: {
        original_filename: 'test.pdf',
      },
    });

    // Verify embedding and Pinecone calls
    expect(generateEmbedding).toHaveBeenCalled();
    expect(upsertToPinecone).toHaveBeenCalled();
  });

  it('handles text file upload successfully', async () => {
    // Mock UUID
    (uuidv4 as jest.Mock).mockReturnValue('doc123');

    // Mock file data
    const mockFile = {
      filepath: '/tmp/test.txt',
      originalFilename: 'test.txt',
      mimetype: 'text/plain',
    };

    // Mock form parsing
    (formidable as unknown as jest.Mock).mockImplementation(() => ({
      parse: (req: any, callback: any) => {
        callback(null, { orgId: 'org123' }, { file: mockFile });
      },
    }));

    // Mock text file reading
    (fs.readFileSync as jest.Mock).mockReturnValue('This is the text content');

    // Mock Supabase
    const mockSupabase = {
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 'doc123' },
              error: null,
            })),
          })),
        })),
      })),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Create mock request
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      docId: 'doc123',
      totalChunks: expect.any(Number),
    });
  });

  it('handles missing orgId', async () => {
    // Mock form parsing with missing orgId
    (formidable as unknown as jest.Mock).mockImplementation(() => ({
      parse: (req: any, callback: any) => {
        callback(null, {}, {});
      },
    }));

    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Missing orgId',
    });
  });

  it('handles missing file', async () => {
    // Mock form parsing with missing file
    (formidable as unknown as jest.Mock).mockImplementation(() => ({
      parse: (req: any, callback: any) => {
        callback(null, { orgId: 'org123' }, {});
      },
    }));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'No file uploaded',
    });
  });

  it('handles unsupported file type', async () => {
    // Mock file data with unsupported type
    const mockFile = {
      filepath: '/tmp/test.jpg',
      originalFilename: 'test.jpg',
      mimetype: 'image/jpeg',
    };

    // Mock form parsing
    (formidable as unknown as jest.Mock).mockImplementation(() => ({
      parse: (req: any, callback: any) => {
        callback(null, { orgId: 'org123' }, { file: mockFile });
      },
    }));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Unsupported file type',
    });
  });

  it('handles Supabase error', async () => {
    // Mock file data
    const mockFile = {
      filepath: '/tmp/test.txt',
      originalFilename: 'test.txt',
      mimetype: 'text/plain',
    };

    // Mock form parsing
    (formidable as unknown as jest.Mock).mockImplementation(() => ({
      parse: (req: any, callback: any) => {
        callback(null, { orgId: 'org123' }, { file: mockFile });
      },
    }));

    // Mock Supabase error
    const mockSupabase = {
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: new Error('Database error'),
            })),
          })),
        })),
      })),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        orgId: 'org123',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to save doc record',
    });
  });
}); 