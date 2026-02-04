import React from 'react';

export enum DefaultEmailCategory {
  INBOX = 'Posteingang',
  SPAM = 'Spam',
  INVOICE = 'Rechnungen',
  NEWSLETTER = 'Newsletter',
  PRIVATE = 'Privat',
  BUSINESS = 'Geschäftlich',
  CANCELLATION = 'Kündigungen',
  OTHER = 'Sonstiges'
}

export interface Category {
  name: string;
  type: string;
}

export interface ImapAccount {
  id: string;
  name: string;
  email: string;
  provider?: string;
  imapHost?: string;
  imapPort?: number;
  username?: string;
  password?: string;
  color: string; // 'blue', 'green', 'purple', etc.
  storageUsed?: number;
  storageTotal?: number;
}

export interface Email {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  date: string; // ISO string
  folder: string; // Physical folder: Posteingang, Gesendet, etc.
  smartCategory?: string; // Virtual AI category: Rechnungen, etc.
  category?: string; // Legacy/Filtered View property (optional for UI)
  isRead: boolean;
  isFlagged: boolean; // New property for "Markierung"
  hasAttachments?: boolean;
  uid?: number;
  aiSummary?: string;
  aiReasoning?: string;
  confidence?: number;
}

export interface AccountData {
  emails: Email[];
  categories: Category[];
}

export interface SortResult {
  categoryId: string;
  summary: string;
  reasoning: string;
  confidence: number;
}

// AI Specific Types
export enum LLMProvider {
  GEMINI = 'Google Gemini',
  OPENAI = 'OpenAI',
  ANTHROPIC = 'Anthropic'
}

export interface AISettings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

export const AVAILABLE_MODELS: Record<LLMProvider, string[]> = {
  [LLMProvider.GEMINI]: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
  [LLMProvider.OPENAI]: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  [LLMProvider.ANTHROPIC]: ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307']
};

// Attachment Types
export interface Attachment {
  id: string;
  filename: string;
  size: number;
  mimeType?: string;
}

// IPC Operation Result Types
export interface SyncResult {
  success: boolean;
  newEmails?: number;
  errors?: string[];
}

export interface EmailOperationResult {
  success: boolean;
}

export interface CategoryOperationResult {
  success: boolean;
}

// Icon Component Type (for lucide-react icons)
export type LucideIcon = React.ComponentType<{ className?: string; size?: number; strokeWidth?: number; }>;
