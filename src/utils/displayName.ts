/** Extract display name from sender strings like '"Name" <email>' or 'Name <email>' */
export function displayName(sender: string): string {
  // Try quoted name: "Name" <email>
  const quoted = sender.match(/^"(.+?)"\s*</);
  if (quoted) return quoted[1];
  // Try unquoted name: Name <email>
  const unquoted = sender.match(/^(.+?)\s*</);
  if (unquoted) return unquoted[1].trim();
  // Fallback: return as-is (plain email or name)
  return sender;
}
