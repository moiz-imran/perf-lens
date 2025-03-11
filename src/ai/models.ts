import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIModelConfig } from '../types/config.js';

export interface AIModel {
  generateSuggestions(prompt: string, systemPrompt?: string): Promise<string>;
  getConfig(): AIModelConfig;
}

export class OpenAIModel implements AIModel {
  private client: OpenAI;
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.PERF_LENS_OPENAI_API_KEY,
    });
  }

  async generateSuggestions(prompt: string, systemPrompt?: string): Promise<string> {
    const isReasoningModel = /^o/.test(this.config.model);
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: systemPrompt || "You are a performance optimization expert for frontend web applications. You MUST only reference files and line numbers that actually exist in the provided code. Never make assumptions about code you cannot see."
        },
        { role: 'user', content: prompt }
      ],
      ...(isReasoningModel ? { reasoning_effort: 'high' } : { temperature: this.config.temperature || 0.2 }),
      max_completion_tokens: this.config.maxTokens,
    });

    return response.choices[0].message.content || '';
  }

  getConfig(): AIModelConfig {
    return this.config;
  }
}

export class AnthropicModel implements AIModel {
  private client: Anthropic;
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.PERF_LENS_ANTHROPIC_API_KEY,
    });
  }

  async generateSuggestions(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.model,
      system: systemPrompt || "You are a performance optimization expert for frontend web applications. You MUST only reference files and line numbers that actually exist in the provided code. Never make assumptions about code you cannot see.",
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature || 0.2,
      max_tokens: this.config.maxTokens || 100000,
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  getConfig(): AIModelConfig {
    return this.config;
  }
}

export class GeminiModel implements AIModel {
  private client: GoogleGenerativeAI;
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = config;
    this.client = new GoogleGenerativeAI(
      config.apiKey || process.env.PERF_LENS_GEMINI_API_KEY || ''
    );
  }

  async generateSuggestions(prompt: string, systemPrompt?: string): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        temperature: this.config.temperature || 0.2,
        maxOutputTokens: this.config.maxTokens,
      },
      systemInstruction: systemPrompt || "You are a performance optimization expert for frontend web applications. You MUST only reference files and line numbers that actually exist in the provided code. Never make assumptions about code you cannot see."
    });
    const result = await model.generateContent({
      contents: [
        {role: 'user', parts: [{text: prompt}]},
      ],
    });
    const response = result.response;
    return response.text();
  }

  getConfig(): AIModelConfig {
    return this.config;
  }
}

export function createAIModel(config: AIModelConfig): AIModel {
  switch (config.provider) {
    case 'openai':
      return new OpenAIModel(config);
    case 'anthropic':
      return new AnthropicModel(config);
    case 'gemini':
      return new GeminiModel(config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}