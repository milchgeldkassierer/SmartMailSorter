import { describe, it, expect } from 'vitest';
import { displayName } from '../displayName';

describe('displayName', () => {
  it('should extract quoted name from "Name" <email> format', () => {
    expect(displayName('"John Doe" <john@example.com>')).toBe('John Doe');
  });

  it('should extract unquoted name from Name <email> format', () => {
    expect(displayName('John Doe <john@example.com>')).toBe('John Doe');
  });

  it('should return plain email as-is when no angle brackets', () => {
    expect(displayName('john@example.com')).toBe('john@example.com');
  });

  it('should return plain name as-is when no angle brackets', () => {
    expect(displayName('John Doe')).toBe('John Doe');
  });

  it('should handle empty string', () => {
    expect(displayName('')).toBe('');
  });

  it('should trim whitespace from unquoted names', () => {
    expect(displayName('  John Doe  <john@example.com>')).toBe('John Doe');
  });

  it('should handle quoted name with special characters', () => {
    expect(displayName('"O\'Brien, Jane" <jane@example.com>')).toBe("O'Brien, Jane");
  });

  it('should handle single-word unquoted name', () => {
    expect(displayName('Support <support@example.com>')).toBe('Support');
  });

  it('should handle quoted name with spaces', () => {
    expect(displayName('"  Spaced Name  " <test@example.com>')).toBe('  Spaced Name  ');
  });

  it('should fall back to unquoted parsing for empty quoted name', () => {
    expect(displayName('"" <test@example.com>')).toBe('""');
  });
});
