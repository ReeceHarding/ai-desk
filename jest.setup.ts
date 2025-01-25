import '@testing-library/jest-dom';

// Mock window.crypto for PKCE tests
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    },
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        return new Uint8Array([1, 2, 3, 4, 5]).buffer;
      }
    }
  }
}); 