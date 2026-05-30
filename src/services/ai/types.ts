export interface AIResponse {
  content: string;
  hashtags?: string[];
  tone?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIProvider {
  generatePost(
    sourceContent: string,
    options: {
      tone?: string;
      style?: string;
      maxLength?: number;
      brandVoice?: string;
    }
  ): Promise<AIResponse>;

  generateThread(
    sourceContent: string,
    options: {
      tone?: string;
      itemCount?: number;
    }
  ): Promise<AIResponse[]>;
}
