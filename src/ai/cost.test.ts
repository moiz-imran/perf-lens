import { describe, it, expect, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { recordUsage, getCostSummary, resetUsage } from './cost.js';

const usage = (overrides: Partial<Anthropic.Usage> = {}): Anthropic.Usage =>
  ({
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    ...overrides,
  }) as Anthropic.Usage;

describe('cost tracking', () => {
  beforeEach(() => resetUsage());

  it('returns an empty summary before any calls', () => {
    expect(getCostSummary()).toBe('');
  });

  it('prices opus input and output tokens', () => {
    recordUsage('claude-opus-4-8', usage());
    // 1M input at $5 + 1M output at $25
    expect(getCostSummary()).toContain('$30.0000');
  });

  it('prices cache reads at 0.1x and writes at 1.25x input', () => {
    recordUsage(
      'claude-opus-4-8',
      usage({
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 1_000_000,
        cache_creation_input_tokens: 1_000_000,
      })
    );
    // 1M cache-read at $0.50 + 1M cache-write at $6.25
    expect(getCostSummary()).toContain('$6.7500');
    expect(getCostSummary()).toContain('1,000,000 cached');
  });

  it('accumulates across calls', () => {
    recordUsage('claude-haiku-4-5', usage()); // $1 + $5
    recordUsage('claude-haiku-4-5', usage()); // again
    expect(getCostSummary()).toContain('2 calls');
    expect(getCostSummary()).toContain('$12.0000');
  });

  it('reports unknown cost for unrecognized models', () => {
    recordUsage('some-future-model', usage());
    expect(getCostSummary()).toContain('unknown');
  });
});
