import { OpenAIProvider } from "./openai-provider";
import { GeminiProvider } from "./gemini-provider";
import { AIProvider } from "./types";
import { getSystemSetting } from "@/lib/settings";

export async function getAIProvider(): Promise<AIProvider> {
  const provider = await getSystemSetting("AI_PROVIDER");
  
  if (provider.toLowerCase() === "gemini") {
    return new GeminiProvider();
  }
  if (provider.toLowerCase() === "openai") {
    return new OpenAIProvider();
  }

  // Auto-detect based on configured keys
  const openaiKey = await getSystemSetting("OPENAI_API_KEY");
  const geminiKey = await getSystemSetting("GEMINI_API_KEY");

  const hasOpenAI = openaiKey && openaiKey !== "sk-placeholder";
  const hasGemini = !!geminiKey;

  if (hasGemini && !hasOpenAI) {
    return new GeminiProvider();
  }

  // Default to OpenAI
  return new OpenAIProvider();
}
