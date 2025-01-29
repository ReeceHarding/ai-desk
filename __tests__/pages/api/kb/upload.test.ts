import handler from '@/pages/api/kb/upload';
import { generateEmbedding, splitIntoChunks, upsertToPinecone } from '@/utils/rag';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { createMocks } from 'node-mocks-http';
import pdf from 'pdf-parse';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/utils/rag', () => ({
  splitIntoChunks: jest.fn(),
  generateEmbedding: jest.fn(),
  upsertToPinecone: jest.fn(),
}));

jest.mock('pdf-parse', () => jest.fn());
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('Knowledge Base Upload Handler', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'doc123' },
        error: null,
      }),
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (splitIntoChunks as jest.Mock).mockReturnValue(['chunk1', 'chunk2']);
    (generateEmbedding as jest.Mock).mockResolvedValue(new Array(1536).fill(0.1));
    (upsertToPinecone as jest.Mock).mockResolvedValue(undefined);
    (fs.readFileSync as jest.Mock).mockReturnValue('test content');
    (pdf as jest.Mock).mockResolvedValue({ text: 'test pdf content' });
  });

  it('returns 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Method not allowed' });
  });

  it('returns 400 if organization ID is missing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    // Mock formidable to resolve with empty fields
    jest.spyOn(formidable.prototype, 'parse')
      .mockImplementation((_, callback: (err: any, fields: formidable.Fields, files: formidable.Files) => void) => {
        callback(null, {}, {});
      });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Missing organization ID' });
  });

  it('returns 400 if no file is uploaded', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    // Mock formidable to resolve with fields but no file
    jest.spyOn(formidable.prototype, 'parse')
      .mockImplementation((_, callback: (err: any, fields: formidable.Fields, files: formidable.Files) => void) => {
        callback(null, { orgId: 'org123' }, {});
      });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ error: 'No file uploaded' });
  });

  it('processes PDF file correctly', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    // Mock formidable to resolve with fields and PDF file
    jest.spyOn(formidable.prototype, 'parse')
      .mockImplementation((_, callback: (err: any, fields: formidable.Fields, files: formidable.Files) => void) => {
        callback(null, { orgId: 'org123' }, {
          file: {
            filepath: '/tmp/test.pdf',
            originalFilename: 'test.pdf',
            mimetype: 'application/pdf',
          } as formidable.File,
        });
      });

    await handler(req, res);

    expect(pdf).toHaveBeenCalled();
    expect(splitIntoChunks).toHaveBeenCalledWith('test pdf content', 1000, 200);
    expect(generateEmbedding).toHaveBeenCalledTimes(2); // Once for each chunk
    expect(upsertToPinecone).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.pdf');
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      docId: 'doc123',
      totalChunks: 2,
    });
  });

  it('processes text file correctly', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    // Mock formidable to resolve with fields and text file
    jest.spyOn(formidable.prototype, 'parse')
      .mockImplementation((_, callback: (err: any, fields: formidable.Fields, files: formidable.Files) => void) => {
        callback(null, { orgId: 'org123' }, {
          file: {
            filepath: '/tmp/test.txt',
            originalFilename: 'test.txt',
            mimetype: 'text/plain',
          } as formidable.File,
        });
      });

    await handler(req, res);

    expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/test.txt', 'utf8');
    expect(splitIntoChunks).toHaveBeenCalledWith('test content', 1000, 200);
    expect(generateEmbedding).toHaveBeenCalledTimes(2); // Once for each chunk
    expect(upsertToPinecone).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.txt');
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      docId: 'doc123',
      totalChunks: 2,
    });
  });

  it('returns 400 for unsupported file types', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    // Mock formidable to resolve with fields and unsupported file
    jest.spyOn(formidable.prototype, 'parse')
      .mockImplementation((_, callback: (err: any, fields: formidable.Fields, files: formidable.Files) => void) => {
        callback(null, { orgId: 'org123' }, {
          file: {
            filepath: '/tmp/test.jpg',
            originalFilename: 'test.jpg',
            mimetype: 'image/jpeg',
          } as formidable.File,
        });
      });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Unsupported file type' });
  });

  it('handles database errors gracefully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    // Mock database error
    mockSupabase.from.mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      }),
    });

    // Mock formidable to resolve with fields and file
    jest.spyOn(formidable.prototype, 'parse')
      .mockImplementation((_, callback: (err: any, fields: formidable.Fields, files: formidable.Files) => void) => {
        callback(null, { orgId: 'org123' }, {
          file: {
            filepath: '/tmp/test.txt',
            originalFilename: 'test.txt',
            mimetype: 'text/plain',
          } as formidable.File,
        });
      });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Failed to save document record' });
  });
}); 
