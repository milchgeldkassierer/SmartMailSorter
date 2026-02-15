import DOMPurify, { type Config } from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks while preserving safe formatting.
 *
 * This function uses DOMPurify to remove dangerous HTML elements and attributes
 * that could be used for XSS attacks in email content. It specifically targets:
 * - <script> tags and inline JavaScript
 * - Event handlers (onclick, onerror, onload, onmouseover, etc.)
 * - <iframe>, <object>, <embed> and other executable elements
 * - javascript: and data: URLs
 * - CSS expressions and imports that could execute code
 *
 * Safe elements are preserved:
 * - Text formatting (bold, italic, underline, etc.)
 * - Links (with external navigation handled separately)
 * - Lists, tables, and structural elements
 * - Images (src is sanitized)
 *
 * @param html - The raw HTML string from email content (potentially malicious)
 * @returns Sanitized HTML safe for rendering via dangerouslySetInnerHTML
 *
 * @example
 * ```typescript
 * const safeHtml = sanitizeHtml(email.bodyHtml);
 * <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
 * ```
 */
export function sanitizeHtml(html: string | null | undefined): string {
  // Handle null/undefined/empty input
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Configure DOMPurify with strict security settings
  const config: Config = {
    // Allow safe HTML tags for email formatting
    ALLOWED_TAGS: [
      // Text formatting
      'p',
      'br',
      'span',
      'div',
      'blockquote',
      'pre',
      'code',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'strike',
      'del',
      'ins',
      'mark',
      'sub',
      'sup',
      'small',
      'big',
      // Headings
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      // Lists
      'ul',
      'ol',
      'li',
      'dl',
      'dt',
      'dd',
      // Tables
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'caption',
      'col',
      'colgroup',
      // Links and media
      'a',
      'img',
      // Semantic elements
      'article',
      'section',
      'aside',
      'header',
      'footer',
      'main',
      'nav',
      'figure',
      'figcaption',
      // Other safe elements
      'hr',
      'abbr',
      'address',
      'cite',
      'q',
      'time',
    ],

    // Allow only safe attributes
    ALLOWED_ATTR: [
      // Link attributes (href will be further sanitized)
      'href',
      'title',
      'target',
      'rel',
      // Image attributes
      'src',
      'alt',
      'width',
      'height',
      // Table attributes
      'colspan',
      'rowspan',
      'scope',
      // Safe styling attributes (DOMPurify will sanitize style content)
      'class',
      'id',
      // Inline styles (DOMPurify sanitizes dangerous CSS like expression() and url(javascript:))
      'style',
      // Text direction
      'dir',
      // Time element
      'datetime',
      // Abbreviation
      'abbr',
    ],

    // Block all URI schemes except safe ones
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,

    // Forbid specific tags that could be dangerous
    FORBID_TAGS: [
      'script',
      'style',
      'iframe',
      'object',
      'embed',
      'link',
      'base',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'option',
      'meta',
      'title',
      'head',
      'html',
      'body',
      'applet',
      'audio',
      'video',
      'source',
      'track',
      'canvas',
      'svg',
      'math',
      'noscript',
    ],

    // Forbid all event handler attributes
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onmouseout',
      'onmousemove',
      'onmousedown',
      'onmouseup',
      'onmouseenter',
      'onmouseleave',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
      'onreset',
      'onkeydown',
      'onkeyup',
      'onkeypress',
      'ondblclick',
      'oncontextmenu',
      'oninput',
      'oninvalid',
      'onselect',
      'onwheel',
      'onscroll',
      'onscrollend',
      'oncopy',
      'oncut',
      'onpaste',
      'ondrag',
      'ondragstart',
      'ondragend',
      'ondragover',
      'ondragenter',
      'ondragleave',
      'ondrop',
      'ontouchstart',
      'ontouchmove',
      'ontouchend',
      'ontouchcancel',
      'onpointerdown',
      'onpointerup',
      'onpointermove',
      'onpointerover',
      'onpointerout',
      'onpointerenter',
      'onpointerleave',
      'onpointercancel',
      'onanimationstart',
      'onanimationend',
      'onanimationiteration',
      'ontransitionend',
      'onabort',
      'oncanplay',
      'oncanplaythrough',
      'ondurationchange',
      'onemptied',
      'onended',
      'onloadeddata',
      'onloadedmetadata',
      'onloadstart',
      'onpause',
      'onplay',
      'onplaying',
      'onprogress',
      'onratechange',
      'onseeked',
      'onseeking',
      'onstalled',
      'onsuspend',
      'ontimeupdate',
      'onvolumechange',
      'onwaiting',
      'onafterprint',
      'onbeforeprint',
      'onbeforeunload',
      'onhashchange',
      'onlanguagechange',
      'onmessage',
      'onoffline',
      'ononline',
      'onpagehide',
      'onpageshow',
      'onpopstate',
      'onstorage',
      'onunload',
      // Data attributes that could be misused
      'formaction',
      'action',
      'ping',
    ],

    // Keep safe HTML structure
    KEEP_CONTENT: true,

    // Return a DOM instead of a string for better security
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,

    // Sanitize recursively
    WHOLE_DOCUMENT: false,

    // Allow data URIs for images (base64 encoded images in emails)
    // But DOMPurify will validate them
    ALLOW_DATA_ATTR: false,

    // Force body elements
    FORCE_BODY: false,

    // Sanitize inside template tags
    IN_PLACE: false,

    // Additional security settings
    SAFE_FOR_TEMPLATES: true,
  };

  // Sanitize the HTML
  const sanitized = DOMPurify.sanitize(html, config);

  // Return sanitized string (cast from TrustedHTML to string)
  return sanitized as string;
}

/**
 * Check if HTML content contains potentially dangerous elements.
 * This is a helper function for testing and logging purposes.
 *
 * @param html - The HTML string to check
 * @returns true if dangerous patterns are detected, false otherwise
 */
export function containsDangerousHtml(html: string | null | undefined): boolean {
  if (!html || typeof html !== 'string') {
    return false;
  }

  // Check for common XSS patterns
  const dangerousPatterns = [
    /<script[\s>]/i,
    /<iframe[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=, onerror=
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /<applet[\s>]/i,
    /<form[\s>]/i,
    /data:text\/html/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(html));
}
