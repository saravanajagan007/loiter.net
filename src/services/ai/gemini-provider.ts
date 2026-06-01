import { getSystemSetting } from "@/lib/settings";
import { AIProvider, AIResponse } from "./types";

export class GeminiProvider implements AIProvider {
  async generatePost(
    sourceContent: string,
    options: {
      tone?: string;
      style?: string;
      maxLength?: number;
      brandVoice?: string;
    }
  ): Promise<AIResponse> {
    const tone = options.tone || "professional";
    const maxLength = options.maxLength || 280;

    const apiKey = await getSystemSetting("GEMINI_API_KEY");
    const model = (await getSystemSetting("GEMINI_MODEL")) || "gemini-2.5-flash";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment or database settings.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [
            {
              text: `Rewrite the following content in a ${tone} tone. Keep it under ${maxLength} characters. Use engaging hooks and appropriate emojis. Format the response as JSON with "content" and "hashtags" (array) keys.
              
              Content:
              ${sourceContent}`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = JSON.parse(textResponse);

    const promptTokens = data.usageMetadata?.promptTokenCount || 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

    return {
      content: result.content || "",
      hashtags: result.hashtags || [],
      tone,
      usage: {
        promptTokens,
        completionTokens
      }
    };
  }

  async generateThread(
    sourceContent: string,
    options: {
      tone?: string;
      itemCount?: number;
    }
  ): Promise<AIResponse[]> {
    const tone = options.tone || "informative";
    const itemCount = options.itemCount || 3;

    const apiKey = await getSystemSetting("GEMINI_API_KEY");
    const model = (await getSystemSetting("GEMINI_MODEL")) || "gemini-2.5-flash";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [
            {
              text: `Break down the following content into a thread of ${itemCount} posts. Tone: ${tone}. Each post must be under 280 characters. Format the response as a JSON object with a "threads" key containing an array of objects, each with a "content" key.
              
              Content:
              ${sourceContent}`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = JSON.parse(textResponse);

    const threads = (Array.isArray(result.threads) ? result.threads : []) as Array<{ content: string }>;

    return threads.map((t) => ({
      content: t.content,
      tone,
    }));
  }
}
