import "server-only";
import { geminiEmbed, geminiEmbedBatch } from "@/lib/ai/gemini";

export async function embedText(text: string): Promise<number[]> {
  return geminiEmbed(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return geminiEmbedBatch(texts);
}
