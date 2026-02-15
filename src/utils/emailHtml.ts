/** Strip remote image src attributes, keeping data: URIs for inline images */
export function blockRemoteImages(html: string): string {
  // Block <img> src attributes pointing to remote URLs (including protocol-relative URLs)
  let result = html.replace(
    /<img\s([^>]*?)src\s*=\s*["']((?:https?:)?\/\/[^"']*)["']/gi,
    "<img $1data-blocked-src=\"$2\" src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3C/svg%3E\""
  );
  // Strip CSS url() references to remote resources in style attributes (including protocol-relative URLs)
  result = result.replace(/url\s*\(\s*["']?((?:https?:)?\/\/[^"')]+)["']?\s*\)/gi, 'url()');
  return result;
}

/** Build a full HTML document for the iframe */
export function buildIframeDoc(html: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 16px; font-family: sans-serif; color: #1e293b; word-break: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #2563eb; }
  table { max-width: 100% !important; }
</style></head><body>${html}</body></html>`;
}
