import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Email, DefaultEmailCategory, SortResult, AISettings, LLMProvider, INBOX_FOLDER } from '../types';

// Internal types for AI responses
interface GeneratedEmailData {
  sender?: string;
  senderEmail?: string;
  subject?: string;
  body?: string;
  dateOffset?: number;
}

interface CategorizationResult {
  id: string;
  category?: string;
  summary?: string;
  reasoning?: string;
  confidence?: number;
}

interface GeminiConfig {
  responseMimeType: string;
  responseSchema: Schema;
  systemInstruction: string;
  thinkingConfig?: {
    thinkingBudget: number;
  };
}

interface GeminiContentPart {
  text?: string;
}

interface GeminiContent {
  parts?: GeminiContentPart[];
}

interface GeminiCandidate {
  content?: GeminiContent;
}

// Type for the actual SDK response
interface GeminiResponse {
  response?: {
    text?: string | (() => string);
    candidates?: GeminiCandidate[];
  };
  candidates?: GeminiCandidate[];
  text?: string | (() => string);
}

/** Extract and return the API key from settings, or empty string if missing. */
const getApiKey = (settings?: AISettings) => {
  if (settings?.apiKey && settings.apiKey.trim() !== '') return settings.apiKey.trim();
  return '';
};

/** Route an LLM call to the configured provider and return parsed JSON. */
async function callLLM(
  prompt: string,
  systemInstruction: string,
  jsonSchema: Schema,
  settings: AISettings
): Promise<unknown> {
  // --- GOOGLE GEMINI ---
  if (settings.provider === LLMProvider.GEMINI) {
    const apiKey = getApiKey(settings);
    if (!apiKey) throw new Error('Missing API Key for Gemini');

    const ai = new GoogleGenAI({ apiKey });

    try {
      const result = (await ai.models.generateContent({
        model: settings.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: jsonSchema,
          systemInstruction: systemInstruction,
          // Optimization: Limit reasoning budget for speed
          thinkingConfig: {
            thinkingBudget: 1024,
          },
        } as GeminiConfig,
      })) as unknown as GeminiResponse;

      let text = '';

      // Strategy 1: result.response.text() (Standard SDK)
      if (result.response) {
        const responseText = result.response.text;
        if (typeof responseText === 'function') {
          try {
            text = responseText();
          } catch (e) {
            console.warn('Gemini Strategy 1 failed:', e);
          }
        } else if (typeof responseText === 'string') {
          text = responseText;
        }
      }

      // Strategy 2: result.text() (Simpler SDK)
      if (!text) {
        const resultText = result.text;
        if (typeof resultText === 'function') {
          try {
            text = resultText();
          } catch (e) {
            console.warn('Gemini Strategy 2 failed:', e);
          }
        } else if (typeof resultText === 'string') {
          text = resultText;
        }
      }

      // Strategy 3: Manual Candidate Extraction (Safest backup)
      if (!text) {
        const candidates = result.candidates || result.response?.candidates;
        if (candidates && candidates.length > 0) {
          const part = candidates[0]?.content?.parts?.[0];
          if (part?.text) text = part.text;
        }
      }

      if (!text) {
        console.warn('Gemini: Text extraction failed', result);
        throw new Error('Failed to extract text from Gemini response.');
      }

      // Clean Markdown
      text = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(text);
    } catch (error: unknown) {
      // Handle Rate Limits silently if possible, or throw
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('429') || msg.includes('quota')) {
        console.warn('AI Rate limit hit');
        throw new Error('AI Busy (429)');
      }
      throw error;
    }
  }

  // --- OPENAI / ANTHROPIC / OLLAMA ---
  // Route through Electron main process via IPC to avoid CORS restrictions
  if (
    settings.provider === LLMProvider.OPENAI ||
    settings.provider === LLMProvider.ANTHROPIC ||
    settings.provider === LLMProvider.OLLAMA
  ) {
    if (!window.electron?.aiCall) {
      throw new Error('Electron IPC not available for AI call');
    }
    return await window.electron.aiCall({
      systemInstruction,
      userPrompt: prompt,
      jsonSchema: jsonSchema as unknown as Record<string, unknown>,
    });
  }

  throw new Error('Unknown Provider');
}

/** Generate synthetic demo emails via AI for testing/preview purposes. */
export const generateDemoEmails = async (count: number = 5, settings?: AISettings): Promise<Email[]> => {
  if (!settings) return [];
  const emailSchema: Schema = {
    type: Type.ARRAY,
    items: { type: Type.OBJECT, properties: { sender: { type: Type.STRING } } },
  };
  try {
    const prompt = `Generiere ${count} realistische Emails auf Deutsch. Format: JSON Array.`;
    const rawData = await callLLM(prompt, 'You are a data generator.', emailSchema, settings);
    return (Array.isArray(rawData) ? rawData : [])
      .filter((item: unknown): item is object => typeof item === 'object' && item !== null)
      .map((item: unknown, index: number) => {
        const emailData = item as GeneratedEmailData;
        return {
          id: `gen-${Date.now()}-${index}`,
          sender: emailData.sender || 'Unbekannt',
          senderEmail: emailData.senderEmail || 'unknown@example.com',
          subject: emailData.subject || 'Kein Betreff',
          body: emailData.body || '',
          date: new Date(Date.now() - (emailData.dateOffset || 0) * 3600000).toISOString(),
          category: DefaultEmailCategory.INBOX,
          folder: INBOX_FOLDER,
          isRead: false,
          isFlagged: false,
        };
      });
  } catch {
    return [];
  }
};

/** Categorize a single email with AI (delegates to batch categorization). */
export const categorizeEmailWithAI = async (
  email: Email,
  availableCategories: string[],
  settings: AISettings,
  accountId?: string
): Promise<SortResult> => {
  // Legacy Single Item Wrapper
  const results = await categorizeBatchWithAI([email], availableCategories, settings, accountId);
  return (
    results[0] || {
      categoryId: DefaultEmailCategory.OTHER,
      summary: 'Fehler',
      reasoning: 'Batch Failed',
      confidence: 0,
    }
  );
};

/** Categorize a batch of emails using the configured AI provider, returning sort results with categories and confidence. */
export const categorizeBatchWithAI = async (
  emails: Email[],
  availableCategories: string[],
  settings: AISettings,
  accountId?: string
): Promise<SortResult[]> => {
  if (emails.length === 0) return [];

  // Fetch recent feedback examples for few-shot learning (if accountId provided)
  const feedbackExamples: Array<{ senderEmail: string; originalCategory: string; correctedCategory: string; subject: string }> = [];
  if (accountId && window.electron?.getRecentFeedbackForSender) {
    // Extract unique sender emails from the batch
    const uniqueSenders = Array.from(new Set(emails.map(e => e.senderEmail).filter(Boolean)));

    // Fetch recent feedback for each unique sender (limit 5 per sender)
    for (const senderEmail of uniqueSenders) {
      try {
        const feedback = await window.electron.getRecentFeedbackForSender(accountId, senderEmail, 5);
        // Collect relevant fields for prompt injection (will be used in subtask-4-2)
        feedback.forEach(f => {
          feedbackExamples.push({
            senderEmail: f.senderEmail,
            originalCategory: f.originalCategory,
            correctedCategory: f.correctedCategory,
            subject: f.subject
          });
        });
      } catch (error) {
        // Silently continue if feedback fetch fails - categorization should still work
        console.warn(`Failed to fetch feedback for sender ${senderEmail}:`, error);
      }
    }
  }

  const targetCategories = availableCategories.filter((c) => c !== DefaultEmailCategory.INBOX);

  // Schema is now an ARRAY of results
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'The exact email ID from the input' },
        category: { type: Type.STRING },
        summary: { type: Type.STRING },
      },
      required: ['id', 'category', 'summary'],
    },
  };

  // Construct lightweight input list (save tokens)
  // For local models (Ollama), use smaller context window
  const bodyPreviewLength = settings.provider === LLMProvider.OLLAMA ? 500 : 1500;
  const inputs = emails.map((e) => ({
    id: e.id,
    sender: e.sender,
    subject: e.subject,
    body_preview: (e.body || '').substring(0, bodyPreviewLength),
  }));

  // Gemini returns bare arrays (enforced by SDK schema). All IPC-routed providers
  // (OpenAI, Anthropic, Ollama) return {results: [...]} wrappers via prompt instruction.
  const jsonFormatHint =
    settings.provider === LLMProvider.GEMINI
      ? "Antworte als JSON Array von Objekten. Jedes Objekt MUSS die 'id' der entsprechenden Email enthalten."
      : 'Antworte als JSON Objekt mit einem "results" Array. Jedes Element MUSS die exakte \'id\' der Email enthalten. Beispiel: {"results": [{"id": "...", "category": "...", "summary": "..."}]}';

  // Build learned preferences section from feedback examples (few-shot learning)
  let learnedPreferencesSection = '';
  if (feedbackExamples.length > 0) {
    // Limit to 5 examples to keep token budget reasonable
    const limitedExamples = feedbackExamples.slice(0, 5);
    const exampleLines = limitedExamples.map(ex =>
      `  - ${ex.senderEmail}: Emails wurden von "${ex.originalCategory}" zu "${ex.correctedCategory}" korrigiert (Betreff: "${ex.subject}")`
    ).join('\n');

    learnedPreferencesSection = `
GELERNTE PRÄFERENZEN:
Der Benutzer hat folgende Korrekturen vorgenommen:
${exampleLines}

Berücksichtige diese Präferenzen bei ähnlichen Emails.

`;
  }

  const prompt =
    settings.provider === LLMProvider.OLLAMA
      ? `Sortiere diese ${emails.length} Emails.
${learnedPreferencesSection}
Emails: ${JSON.stringify(inputs)}

Kategorien: ${targetCategories.join(', ')}

Nutze existierende Kategorien. Falls keine passt, schlage neue vor (1 Wort). Vermeide "Sonstiges".

${jsonFormatHint}`
      : `
      Du bist ein strenger Email-Sortierer. Sortiere die folgenden ${emails.length} Emails.
${learnedPreferencesSection}
      Eingabedaten (JSON):
      ${JSON.stringify(inputs)}

      EXISTIERENDE KATEGORIEN: ${targetCategories.join(', ')}.

      REGELN:
      1. PRÜFE zuerst, ob die Email in eine der EXISTIERENDEN Kategorien passt. Das hat HÖCHSTE Priorität.
      2. NUR wenn absolut nichts passt, schlage eine NEUE, sprechende Kategorie vor (1 Wort, z.B. "Reisen").
      3. Vermeide "Sonstiges".

      ${jsonFormatHint}
    `;

  try {
    const rawResults = await callLLM(prompt, 'Batch Email Sorter. Output JSON Array.', schema, settings);

    // Gemini returns a bare array; OpenAI/Ollama wrap it in an object like { results: [...] }
    let resultsArray: unknown[] | null = null;
    if (Array.isArray(rawResults)) {
      resultsArray = rawResults;
    } else if (rawResults && typeof rawResults === 'object') {
      const obj = rawResults as Record<string, unknown>;
      if (Array.isArray(obj.results)) {
        resultsArray = obj.results;
      }
    }

    if (!resultsArray) {
      console.warn(
        '[SmartSort] AI returned no results array. Type:',
        typeof rawResults,
        'IsArray:',
        Array.isArray(rawResults),
        'Keys:',
        rawResults && typeof rawResults === 'object' ? Object.keys(rawResults as object).join(',') : 'N/A'
      );
      resultsArray = [];
    }

    // Build ID-based lookup map
    const resultMap = new Map<string, CategorizationResult>();
    const resultsList: CategorizationResult[] = [];
    resultsArray.forEach((r: unknown) => {
      if (typeof r !== 'object' || r === null) return;
      const result = r as CategorizationResult;
      resultsList.push(result);
      if (result.id) {
        resultMap.set(result.id, result);
      }
    });

    // Map back to original order: try ID match first, fall back to index only when
    // no email IDs matched (indicating the AI didn't return correct IDs at all)
    const idMatchCount = emails.filter((e) => resultMap.has(e.id)).length;
    const useIndexFallback = idMatchCount === 0 && resultsList.length === emails.length;
    if (useIndexFallback) {
      console.warn(
        '[AI] No email IDs matched in AI response — using positional index fallback for',
        emails.length,
        'emails'
      );
    }
    const FALLBACK_CONFIDENCE_FACTOR = 0.5;
    return emails.map((email, index) => {
      const idMatch = resultMap.get(email.id);
      const res = idMatch || (useIndexFallback ? resultsList[index] : undefined);
      if (res && res.category) {
        const isFallback = !idMatch && useIndexFallback;
        const rawConfidence = res.confidence || 0.8;
        return {
          categoryId: res.category || DefaultEmailCategory.OTHER,
          summary: res.summary || 'Analysiert',
          reasoning: res.reasoning || 'Batch OK',
          confidence: isFallback ? rawConfidence * FALLBACK_CONFIDENCE_FACTOR : rawConfidence,
          indexFallbackUsed: isFallback,
        };
      }
      return {
        categoryId: DefaultEmailCategory.OTHER,
        summary: 'Fehler',
        reasoning: 'AI lieferte kein Ergebnis für diese Email',
        confidence: 0,
      };
    });
  } catch (error) {
    console.error('Batch Categorization Failed:', error);
    // Fail all gracefully
    return emails.map(() => ({
      categoryId: DefaultEmailCategory.OTHER,
      summary: 'Fehler',
      reasoning: 'Batch API Error: ' + String(error),
      confidence: 0,
    }));
  }
};

/**
 * Parse natural language search query and convert to search operators
 * @param query Natural language query in German (e.g., "Rechnungen von letztem Monat")
 * @param settings AI settings for the LLM provider
 * @returns Search query string with operators (e.g., "category:Rechnungen after:2026-01-01")
 */
export const parseNaturalLanguageQuery = async (query: string, settings: AISettings): Promise<string> => {
  if (!query || query.trim() === '') {
    return '';
  }

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Formatted search query with operators',
      },
    },
    required: ['query'],
  };

  const systemInstruction = `Du bist ein Such-Query-Übersetzer für ein Email-System.

Deine Aufgabe: Wandle natürlichsprachige deutsche Suchanfragen in strukturierte Such-Operatoren um.

VERFÜGBARE OPERATOREN:
- from:EMAIL_ODER_NAME - Suche nach Absender
- to:EMAIL_ODER_NAME - Suche nach Empfänger
- subject:TEXT - Suche im Betreff
- category:KATEGORIE - Suche in Kategorie (z.B. Rechnungen, Newsletter, Spam, Privat, Geschäftlich)
- has:attachment - Nur Emails mit Anhängen
- before:YYYY-MM-DD - Emails vor diesem Datum
- after:YYYY-MM-DD - Emails nach diesem Datum

REGELN:
1. Erkenne die Absicht des Benutzers und wähle die passenden Operatoren
2. Für Zeitangaben wie "letzter Monat", "diese Woche", berechne das entsprechende Datum (heute ist ${new Date().toISOString().split('T')[0]})
3. Wenn keine Operatoren passen, gib den Suchtext als Freitext zurück
4. Kombiniere mehrere Operatoren mit Leerzeichen
5. Verwende keine Anführungszeichen um Werte, es sei denn der Wert enthält Leerzeichen

BEISPIELE:
- "Rechnungen von letztem Monat" → "category:Rechnungen after:2026-01-01"
- "Emails von Amazon" → "from:amazon"
- "Newsletter mit Anhängen" → "category:Newsletter has:attachment"
- "Betreff Rechnung" → "subject:Rechnung"
- "vor Januar 2026" → "before:2026-01-01"
- "meeting notes" → "meeting notes" (kein Operator)

Antworte NUR mit dem JSON-Objekt mit dem "query" Feld.`;

  const prompt = `Wandle diese Suchanfrage um: "${query}"`;

  const result = await callLLM(prompt, systemInstruction, schema, settings);

  if (typeof result === 'object' && result !== null && 'query' in result) {
    const queryResult = result as { query: string };
    return queryResult.query || '';
  }

  return '';
};
