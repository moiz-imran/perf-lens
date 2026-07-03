import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { FindingsSchema, type Finding } from './schema.js';
import { recordUsage } from './cost.js';
import type { AIModelConfig } from '../types/config.js';

/** Single source of truth for the default model. Override via config `ai.model`. */
export const DEFAULT_MODEL = 'claude-opus-4-8';

const DEFAULT_MAX_TOKENS = 16000;

// Adaptive thinking is only supported on Claude 4.6+ models; older/smaller models reject it.
export function thinkingFor(
  model: string
): { thinking: Anthropic.ThinkingConfigParam } | undefined {
  return /opus-4-[678]|sonnet-4-6|sonnet-5|fable/.test(model)
    ? { thinking: { type: 'adaptive' } }
    : undefined;
}

export interface GenerationOptions {
  systemPrompt?: string;
  onChunk?: (chunk: string, firstChunk?: boolean) => void;
}

export interface AnalyzeOptions {
  systemPrompt?: string;
  /** Stable context shared across calls (e.g. Lighthouse results) — placed in the
   *  system prefix with cache_control so repeated batch calls hit the prompt cache. */
  sharedContext?: string;
}

/**
 * Thin wrapper around the Anthropic SDK. Structured outputs for code analysis,
 * streaming text for prose, prompt caching on the stable system prefix, and
 * usage accounting on every call. Retries are the SDK's built-in backoff.
 */
export class AIClient {
  private client: Anthropic;
  private config: AIModelConfig & { model: string };

  constructor(config: AIModelConfig & { apiKey: string }) {
    this.config = { ...config, model: config.model || DEFAULT_MODEL };
    this.client = new Anthropic({ apiKey: config.apiKey, maxRetries: 3 });
  }

  getConfig(): AIModelConfig {
    return this.config;
  }

  private systemBlocks(systemPrompt?: string, sharedContext?: string): Anthropic.TextBlockParam[] {
    const blocks: Anthropic.TextBlockParam[] = [];
    if (systemPrompt) blocks.push({ type: 'text', text: systemPrompt });
    if (sharedContext) blocks.push({ type: 'text', text: sharedContext });
    if (blocks.length > 0) {
      blocks[blocks.length - 1].cache_control = { type: 'ephemeral' };
    }
    return blocks;
  }

  /**
   * Analyzes code and returns schema-validated findings — no freeform text parsing.
   */
  async analyzeCode(prompt: string, options: AnalyzeOptions = {}): Promise<Finding[]> {
    const response = await this.client.messages.parse({
      model: this.config.model,
      max_tokens: this.config.maxTokens || DEFAULT_MAX_TOKENS,
      ...thinkingFor(this.config.model),
      system: this.systemBlocks(options.systemPrompt, options.sharedContext),
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(FindingsSchema) },
    });
    recordUsage(this.config.model, response.usage);
    return response.parsed_output?.findings ?? [];
  }

  /**
   * Streams a prose response (used for the Lighthouse report analysis).
   * Keeps the pre-revamp `generateSuggestions` surface so call sites stay small.
   */
  async generateSuggestions(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const stream = this.client.messages.stream({
      model: this.config.model,
      max_tokens: this.config.maxTokens || DEFAULT_MAX_TOKENS,
      ...thinkingFor(this.config.model),
      system: this.systemBlocks(options.systemPrompt),
      messages: [{ role: 'user', content: prompt }],
    });

    if (options.onChunk) {
      let firstChunk = true;
      stream.on('text', text => {
        options.onChunk!(text, firstChunk);
        firstChunk = false;
      });
    }

    const message = await stream.finalMessage();
    recordUsage(this.config.model, message.usage);
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');
  }

  /** Raw SDK client — used by the agent loop, which drives its own tool-use turns. */
  get anthropic(): Anthropic {
    return this.client;
  }
}
