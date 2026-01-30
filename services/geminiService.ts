import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Email, DefaultEmailCategory, SortResult, AISettings, LLMProvider } from "../types";

// Version marker
console.log("GeminiService: Loaded Version 6.0 (Batch Processing)");

const getApiKey = (settings?: AISettings) => {
  if (settings?.apiKey && settings.apiKey.trim() !== '') return settings.apiKey;
  if (settings?.provider === LLMProvider.GEMINI) return process.env.API_KEY;
  return '';
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callLLM(
  prompt: string,
  systemInstruction: string,
  jsonSchema: any,
  settings: AISettings
): Promise<any> {

  // --- GOOGLE GEMINI ---
  if (settings.provider === LLMProvider.GEMINI) {
    const apiKey = getApiKey(settings);
    if (!apiKey) throw new Error("Missing API Key for Gemini");

    const ai = new GoogleGenAI({ apiKey });

    try {
      const result = await ai.models.generateContent({
        model: settings.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: jsonSchema,
          systemInstruction: systemInstruction,
          // Optimization: Limit reasoning budget for speed
          thinkingConfig: {
            thinkingBudget: 1024
          }
        } as any
      });

      let text = "";

      // Strategy 1: result.response.text() (Standard SDK)
      if (result.response && typeof result.response.text === 'function') {
        try { text = result.response.text(); } catch (e) { }
      }

      // Strategy 2: result.text() (Simpler SDK)
      if (!text && typeof (result as any).text === 'function') {
        try { text = (result as any).text(); } catch (e) { }
      }

      // Strategy 3: Manual Candidate Extraction (Safest backup)
      if (!text) {
        const candidates = (result as any).candidates || result.response?.candidates;
        if (candidates && candidates.length > 0) {
          const part = candidates[0].content?.parts?.[0];
          if (part && part.text) text = part.text;
        }
      }

      if (!text) {
        console.warn("Gemini: Text extraction failed", result);
        throw new Error("Failed to extract text from Gemini response.");
      }

      // Clean Markdown
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      return JSON.parse(text);

    } catch (error: any) {
      // Handle Rate Limits silently if possible, or throw
      const msg = error.message || String(error);
      if (msg.includes("429") || msg.includes("quota")) {
        console.warn("AI Rate limit hit");
        throw new Error("AI Busy (429)");
      }
      throw error;
    }
  }

  // --- OPENAI ---
  if (settings.provider === LLMProvider.OPENAI) {
    const apiKey = getApiKey(settings);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  throw new Error("Unknown Provider");
}

export const generateDemoEmails = async (count: number = 5, settings?: AISettings): Promise<Email[]> => {
  const emailSchema: Schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { sender: { type: Type.STRING } } } };
  try {
    const prompt = `Generiere ${count} realistische Emails auf Deutsch. Format: JSON Array.`;
    const rawData = await callLLM(prompt, "You are a data generator.", emailSchema, settings || { provider: LLMProvider.GEMINI, model: 'gemini-3-flash-preview', apiKey: process.env.API_KEY || '' });
    return (Array.isArray(rawData) ? rawData : []).map((item: any, index: number) => ({
      id: `gen-${Date.now()}-${index}`,
      sender: item.sender || "Unbekannt",
      senderEmail: item.senderEmail || "unknown@example.com",
      subject: item.subject || "Kein Betreff",
      body: item.body || "",
      date: new Date(Date.now() - (item.dateOffset || 0) * 3600000).toISOString(),
      category: DefaultEmailCategory.INBOX, folder: 'Posteingang', isRead: false, isFlagged: false
    }));
  } catch (e) { return []; }
};

export const categorizeEmailWithAI = async (
  email: Email,
  availableCategories: string[],
  settings: AISettings
): Promise<SortResult> => {
  // Legacy Single Item Wrapper
  const results = await categorizeBatchWithAI([email], availableCategories, settings);
  return results[0] || { categoryId: DefaultEmailCategory.OTHER, summary: "Fehler", reasoning: "Batch Failed", confidence: 0 };
};

/**
 * BATCH PROCESSING
 */
export const categorizeBatchWithAI = async (
  emails: Email[],
  availableCategories: string[],
  settings: AISettings
): Promise<SortResult[]> => {

  if (emails.length === 0) return [];

  const targetCategories = availableCategories.filter(c => c !== DefaultEmailCategory.INBOX);

  // Schema is now an ARRAY of results
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The exact email ID from the input" },
        category: { type: Type.STRING },
        summary: { type: Type.STRING }
      },
      required: ["id", "category", "summary"]
    }
  };

  // Construct lightweight input list (save tokens)
  const inputs = emails.map(e => ({
    id: e.id,
    sender: e.sender,
    subject: e.subject,
    body_preview: e.body.substring(0, 1500) // 1500 chars limit per email
  }));

  const prompt = `
      Du bist ein strenger Email-Sortierer. Sortiere die folgenden ${emails.length} Emails.
      
      Eingabedaten (JSON):
      ${JSON.stringify(inputs, null, 2)}
      
      EXISTIERENDE KATEGORIEN: ${targetCategories.join(", ")}.
      
      REGELN:
      1. PRÜFE zuerst, ob die Email in eine der EXISTIERENDEN Kategorien passt. Das hat HÖCHSTE Priorität.
      2. NUR wenn absolut nichts passt, schlage eine NEUE, sprechende Kategorie vor (1 Wort, z.B. "Reisen").
      3. Vermeide "Sonstiges".
      
      Antworte als JSON Array von Objekten. Jedes Objekt MUSS die 'id' der entsprechenden Email enthalten.
    `;

  try {
    const rawResults = await callLLM(prompt, "Batch Email Sorter. Output JSON Array.", schema, settings);

    const resultMap = new Map<string, any>();
    if (Array.isArray(rawResults)) {
      rawResults.forEach((r: any) => resultMap.set(r.id, r));
    }

    // Map back to original order, ensuring no missing items
    return emails.map(email => {
      const res = resultMap.get(email.id);
      if (res) {
        return {
          categoryId: res.category || DefaultEmailCategory.OTHER,
          summary: res.summary || "Analysiert",
          reasoning: res.reasoning || "Batch OK",
          confidence: res.confidence || 0.8
        };
      }
      // Fallback for missing items (should not happen with good AI)
      return {
        categoryId: DefaultEmailCategory.OTHER,
        summary: "Fehler",
        reasoning: "AI lieferte kein Ergebnis für diese ID",
        confidence: 0
      };
    });

  } catch (error) {
    console.error("Batch Categorization Failed:", error);
    // Fail all gracefully
    return emails.map(() => ({
      categoryId: DefaultEmailCategory.OTHER,
      summary: "Fehler",
      reasoning: "Batch API Error: " + String(error),
      confidence: 0
    }));
  }
};