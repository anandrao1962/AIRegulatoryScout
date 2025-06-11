import OpenAI from "openai";

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentResponse {
  content: string;
  sources: Array<{
    title: string;
    relevance: number;
    tokens: number;
  }>;
  metadata?: Record<string, any>;
}

export abstract class BaseAgent {
  protected openai: OpenAI;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
    });
  }

  abstract processQuery(query: string, context?: any): Promise<AgentResponse>;

  protected async generateResponse(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    useJson = false
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1000,
        response_format: useJson ? { type: "json_object" } : undefined,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error(`Error generating response for agent ${this.config.id}:`, error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  protected async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error(`Error generating embedding for agent ${this.config.id}:`, error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }
}
