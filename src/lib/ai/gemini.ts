import "server-only";
import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from "@google/generative-ai";

const CHAT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const EMBED_MODEL = "gemini-embedding-001";
// Must match the pgvector columns used by match_similar_emails (1536).
const EMBEDDING_DIMENSIONS = 1536;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GeminiChatInput {
  system: string;
  prompt: string;
  temperature?: number;
  jsonMode?: boolean;
}

/**
 * One shared chat wrapper for all AI reply generation (drafts, classification
 * verifier, call summaries, follow-ups). Returns the raw text or null on
 * repeated failure.
 */
export async function geminiChat(
  input: GeminiChatInput,
): Promise<string | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const model = chatModel(input);
      const result = await model.generateContent(input.prompt);
      const text = result.response.text();
      return text.length > 0 ? text : null;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`[ai/gemini] Chat attempt ${attempt + 1} failed, retrying...`, lastError.message);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  console.warn(`[ai/gemini] Chat failed after ${MAX_RETRIES} attempts:`, lastError?.message);
  return null;
}

function chatModel(input: GeminiChatInput): GenerativeModel {
  const genAI = getGenAI();
  return genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction: input.system,
    generationConfig: {
      temperature: input.temperature ?? 0.3,
      ...(input.jsonMode ? { responseMimeType: "application/json" as const } : {}),
    },
  });
}

export async function geminiEmbed(text: string): Promise<number[]> {
  const [values] = await geminiEmbedBatch([text]);
  return values;
}

export async function geminiEmbedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
      const result = await model.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { role: "user" as const, parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      });
      return result.embeddings.map((e) => e.values);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`[ai/gemini] Embedding attempt ${attempt + 1} failed, retrying...`, lastError.message);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("Gemini embedding failed after retries");
}
