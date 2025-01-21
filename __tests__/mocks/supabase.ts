interface MockSupabaseClient {
  from: jest.Mock;
  insert: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  limit: jest.Mock;
}

export const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(() => mockSupabaseClient),
  insert: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  order: jest.fn(() => mockSupabaseClient),
  single: jest.fn(),
  gte: jest.fn(() => mockSupabaseClient),
  lte: jest.fn(() => mockSupabaseClient),
  limit: jest.fn(() => mockSupabaseClient)
}; 