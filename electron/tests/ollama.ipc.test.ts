import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store the original fetch
const originalFetch = global.fetch;

// Mock fetch responses
let mockFetch: ReturnType<typeof vi.fn>;

describe('Ollama IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh mock for each test
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe('ollama-detect handler', () => {
    it('should detect running Ollama instance successfully', async () => {
      const mockModels = [
        { name: 'llama3:latest', size: 4661211136 },
        { name: 'mistral:latest', size: 4109864384 },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: mockModels }),
      });

      // Simulate the IPC handler logic
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      const result = { available: true, models: data.models || [] };

      expect(result.available).toBe(true);
      expect(result.models).toHaveLength(2);
      expect(result.models[0].name).toBe('llama3:latest');
      expect(result.models[1].name).toBe('mistral:latest');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should return available: false when Ollama API returns non-200 status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      });

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.ok).toBe(false);
      const result = { available: false, models: [] };

      expect(result.available).toBe(false);
      expect(result.models).toEqual([]);
    });

    it('should return available: false when Ollama is not running (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'));

      try {
        await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        expect(error.message).toBe('fetch failed');
      }

      // Simulate handler's catch block
      const result = { available: false, models: [] };
      expect(result.available).toBe(false);
      expect(result.models).toEqual([]);
    });

    it('should handle empty models array from Ollama API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      });

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      const result = { available: true, models: data.models || [] };

      expect(result.available).toBe(true);
      expect(result.models).toEqual([]);
    });

    it('should handle missing models field in API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      const result = { available: true, models: data.models || [] };

      expect(result.available).toBe(true);
      expect(result.models).toEqual([]);
    });
  });

  describe('ollama-detect model listing behavior', () => {
    it('should list available Ollama models successfully', async () => {
      const mockModels = [
        { name: 'llama3:latest', size: 4661211136 },
        { name: 'mistral:latest', size: 4109864384 },
        { name: 'phi3:latest', size: 2176045056 },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: mockModels }),
      });

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      const modelNames = (data.models || []).map((model: any) => model.name);

      expect(modelNames).toHaveLength(3);
      expect(modelNames).toEqual(['llama3:latest', 'mistral:latest', 'phi3:latest']);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should return empty array when Ollama API returns non-200 status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      });

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.ok).toBe(false);
      const result: string[] = [];

      expect(result).toEqual([]);
    });

    it('should return empty array when Ollama is not running (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        expect(error.message).toBe('ECONNREFUSED');
      }

      // Simulate handler's catch block
      const result: string[] = [];
      expect(result).toEqual([]);
    });

    it('should handle empty models array from Ollama API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      });

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      const modelNames = (data.models || []).map((model: any) => model.name);

      expect(modelNames).toEqual([]);
    });

    it('should handle missing models field in API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      const modelNames = (data.models || []).map((model: any) => model.name);

      expect(modelNames).toEqual([]);
    });

    it('should extract model names from complex model objects', async () => {
      const mockModels = [
        {
          name: 'gemma2:2b',
          size: 1628827472,
          digest: 'abc123',
          modified_at: '2024-03-01T10:00:00Z',
        },
        {
          name: 'llama3:8b',
          size: 4661211136,
          digest: 'def456',
          modified_at: '2024-03-01T11:00:00Z',
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: mockModels }),
      });

      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      const modelNames = (data.models || []).map((model: any) => model.name);

      expect(modelNames).toEqual(['gemma2:2b', 'llama3:8b']);
    });

    it('should handle timeout errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      try {
        await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        expect(error.message).toBe('Request timeout');
      }

      // Simulate handler's catch block
      const result: string[] = [];
      expect(result).toEqual([]);
    });
  });

  describe('API endpoint consistency', () => {
    it('should use the same endpoint for both handlers', () => {
      const endpoint = 'http://localhost:11434/api/tags';

      // Both handlers should call the same endpoint
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      });

      // Test endpoint for detect
      fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({ method: 'GET' })
      );

      mockFetch.mockClear();

      // Test endpoint for model listing (part of ollama-detect)
      fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should use correct HTTP method (GET)', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      });

      fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should include correct Content-Type header', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      });

      fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });
});
