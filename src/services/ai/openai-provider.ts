import OpenAI from "openai";
import { AIProvider, AIResponse } from "./types";

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

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

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert social media manager. Rewrite the following content in a ${tone} tone. 
          Keep it under ${maxLength} characters. Use engaging hooks and appropriate emojis. 
          Format the response as JSON with "content" and "hashtags" (array) keys.`,
        },
        {
          role: "user",
          content: sourceContent,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      content: result.content,
      hashtags: result.hashtags,
      tone,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
      },
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

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert social media manager. Break down the following content into a thread of ${itemCount} posts. 
          Tone: ${tone}. Each post must be under 280 characters. 
          Format the response as a JSON array of objects with a "content" key.`,
        },
        {
          role: "user",
          content: sourceContent,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const threads = (Array.isArray(result.threads) ? result.threads : []) as Array<{ content: string }>;

    return threads.map((t) => ({
      content: t.content,
      tone,
    }));
  }
}
