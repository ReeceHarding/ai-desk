import { config } from 'dotenv';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Load environment variables
config({ path: '.env.test' });

// Mock console methods to keep test output clean
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Restore console methods after all tests
afterAll(() => {
  vi.restoreAllMocks();
}); 