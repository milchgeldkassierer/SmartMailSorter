import { describe, it, expect, beforeEach, vi } from 'vitest';

// Type definitions for Electron header objects
interface ResponseHeaders {
  [key: string]: string[];
}

interface HeaderDetails {
  responseHeaders: ResponseHeaders;
}

interface HeaderResponse {
  responseHeaders: ResponseHeaders;
}

type HeaderCallback = (response: HeaderResponse) => void;

describe('Content Security Policy Configuration', () => {
  // Helper function to simulate the CSP configuration logic from main.cjs
  // This mirrors the actual implementation in main.cjs lines 44-76
  const configureCsp = (isDev: boolean) => {
    const cspDirectives = isDev
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3000 https://cdn.tailwindcss.com https://esm.sh",
          "style-src 'self' 'unsafe-inline' http://localhost:3000 https://fonts.googleapis.com https://cdn.tailwindcss.com",
          "img-src 'self' data: http://localhost:3000 https:",
          "connect-src 'self' http://localhost:3000 ws://localhost:3000 https://api.openai.com https://generativelanguage.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
        ]
      : [
          "default-src 'self'",
          "script-src 'self' https://cdn.tailwindcss.com https://esm.sh",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
          "img-src 'self' data: https:",
          "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "frame-src 'none'",
        ];

    return (details: HeaderDetails, callback: HeaderCallback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [cspDirectives.join('; ')],
        },
      });
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CSP Header Registration', () => {
    it('should set CSP headers in production mode', () => {
      const cspHandler = configureCsp(false); // Production mode

      // Simulate a request
      const mockDetails = {
        responseHeaders: {
          'content-type': ['text/html'],
        },
      };

      let capturedResponse: HeaderResponse | null = null;
      const mockCallback = (response: HeaderResponse) => {
        capturedResponse = response;
      };

      // Call the CSP handler
      cspHandler(mockDetails, mockCallback);

      // Verify CSP header was added
      expect(capturedResponse).toBeDefined();
      expect(capturedResponse.responseHeaders).toBeDefined();
      expect(capturedResponse.responseHeaders['Content-Security-Policy']).toBeDefined();
      expect(Array.isArray(capturedResponse.responseHeaders['Content-Security-Policy'])).toBe(true);

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toContain("script-src 'self'");
      expect(cspHeader).toContain('https://cdn.tailwindcss.com');
      expect(cspHeader).toContain('https://esm.sh');
      expect(cspHeader).toContain("style-src 'self' 'unsafe-inline'");
      expect(cspHeader).toContain('https://fonts.googleapis.com');
      expect(cspHeader).toContain("img-src 'self' data:");
      expect(cspHeader).toContain("connect-src 'self'");
      expect(cspHeader).toContain('https://api.openai.com');
      expect(cspHeader).toContain('https://generativelanguage.googleapis.com');
      expect(cspHeader).toContain('https://fonts.gstatic.com');
    });

    it('should set less restrictive CSP headers in development mode', () => {
      const cspHandler = configureCsp(true); // Development mode

      const mockDetails = {
        responseHeaders: {
          'content-type': ['text/html'],
        },
      };

      let capturedResponse: HeaderResponse | null = null;
      const mockCallback = (response: HeaderResponse) => {
        capturedResponse = response;
      };

      cspHandler(mockDetails, mockCallback);

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];

      // Development mode should allow localhost and unsafe directives for hot reload
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toContain('http://localhost:3000');
      expect(cspHeader).toContain("'unsafe-inline'");
      expect(cspHeader).toContain("'unsafe-eval'");
      expect(cspHeader).toContain('ws://localhost:3000');
    });
  });

  describe('CSP Directive Validation', () => {
    it('should include all required CSP directives in production', () => {
      const cspHandler = configureCsp(false); // Production mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];
      const directives = cspHeader.split('; ');

      // Verify all critical directives are present
      const hasDefaultSrc = directives.some((d: string) => d.startsWith('default-src'));
      const hasScriptSrc = directives.some((d: string) => d.startsWith('script-src'));
      const hasStyleSrc = directives.some((d: string) => d.startsWith('style-src'));
      const hasImgSrc = directives.some((d: string) => d.startsWith('img-src'));
      const hasConnectSrc = directives.some((d: string) => d.startsWith('connect-src'));
      const hasFontSrc = directives.some((d: string) => d.startsWith('font-src'));

      expect(hasDefaultSrc).toBe(true);
      expect(hasScriptSrc).toBe(true);
      expect(hasStyleSrc).toBe(true);
      expect(hasImgSrc).toBe(true);
      expect(hasConnectSrc).toBe(true);
      expect(hasFontSrc).toBe(true);
    });

    it('should not allow unsafe-eval in production mode', () => {
      const cspHandler = configureCsp(false); // Production mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];

      // Production should NOT include unsafe-eval (blocks eval() to prevent XSS)
      expect(cspHeader).not.toContain("'unsafe-eval'");
    });

    it('should preserve existing response headers', () => {
      const cspHandler = configureCsp(true); // Development mode

      const mockDetails = {
        responseHeaders: {
          'content-type': ['text/html'],
          'x-custom-header': ['custom-value'],
          'cache-control': ['no-cache'],
        },
      };

      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      // Verify original headers are preserved
      expect(capturedResponse.responseHeaders['content-type']).toEqual(['text/html']);
      expect(capturedResponse.responseHeaders['x-custom-header']).toEqual(['custom-value']);
      expect(capturedResponse.responseHeaders['cache-control']).toEqual(['no-cache']);

      // And CSP header is added
      expect(capturedResponse.responseHeaders['Content-Security-Policy']).toBeDefined();
    });
  });

  describe('CSP Security Restrictions', () => {
    it('should restrict script-src to self and whitelisted CDNs in production', () => {
      const cspHandler = configureCsp(false); // Production mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];
      const scriptSrcDirective = cspHeader.split('; ').find((d: string) => d.startsWith('script-src'));

      // Should allow self and necessary external CDNs
      expect(scriptSrcDirective).toContain("'self'");
      expect(scriptSrcDirective).toContain('https://cdn.tailwindcss.com');
      expect(scriptSrcDirective).toContain('https://esm.sh');
      // Should NOT contain unsafe-eval in production
      expect(scriptSrcDirective).not.toContain("'unsafe-eval'");
    });

    it('should allow data URIs for images', () => {
      const cspHandler = configureCsp(false); // Production mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];
      const imgSrcDirective = cspHeader.split('; ').find((d: string) => d.startsWith('img-src'));

      // Should allow both 'self' and 'data:' for images (base64 encoded images)
      expect(imgSrcDirective).toContain("'self'");
      expect(imgSrcDirective).toContain('data:');
    });

    it('should allow unsafe-inline for styles in production', () => {
      const cspHandler = configureCsp(false); // Production mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];
      const styleSrcDirective = cspHeader.split('; ').find((d: string) => d.startsWith('style-src'));

      // Styles often need unsafe-inline for framework-generated styles
      expect(styleSrcDirective).toContain("'unsafe-inline'");
    });
  });

  describe('Development Mode CSP', () => {
    it('should allow localhost connections for HMR in development', () => {
      const cspHandler = configureCsp(true); // Development mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];

      // Development needs localhost for Vite dev server
      expect(cspHeader).toContain('http://localhost:3000');

      // Development needs WebSocket for HMR
      expect(cspHeader).toContain('ws://localhost:3000');
    });

    it('should allow eval in development for source maps', () => {
      const cspHandler = configureCsp(true); // Development mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];

      // Development may need unsafe-eval for dev tools and source maps
      expect(cspHeader).toContain("'unsafe-eval'");
    });
  });

  describe('CSP Header Format', () => {
    it('should format CSP header as a single semicolon-separated string', () => {
      const cspHandler = configureCsp(false); // Production mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeaderArray = capturedResponse.responseHeaders['Content-Security-Policy'];

      // Should be an array with one element
      expect(Array.isArray(cspHeaderArray)).toBe(true);
      expect(cspHeaderArray.length).toBe(1);

      const cspHeader = cspHeaderArray[0];

      // Should be a non-empty string
      expect(typeof cspHeader).toBe('string');
      expect(cspHeader.length).toBeGreaterThan(0);

      // Should contain semicolons separating directives
      expect(cspHeader).toContain(';');
    });

    it('should not have trailing semicolon', () => {
      const cspHandler = configureCsp(false); // Production mode

      const mockDetails = { responseHeaders: {} };
      let capturedResponse: HeaderResponse | null = null;

      cspHandler(mockDetails, (response: HeaderResponse) => {
        capturedResponse = response;
      });

      const cspHeader = capturedResponse.responseHeaders['Content-Security-Policy'][0];

      // Well-formed CSP should not end with semicolon
      expect(cspHeader.endsWith(';')).toBe(false);
    });
  });
});
