import type Anthropic from '@anthropic-ai/sdk';

// USD per million tokens. Cache read = 0.1x input, cache write (5m TTL) = 1.25x input.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

// ponytail: module-level accumulator; fine for a single-run CLI process
const totals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
  costKnown: true,
  calls: 0,
};

/**
 * Records token usage from an API response and accumulates estimated cost.
 */
export function recordUsage(model: string, usage: Anthropic.Usage): void {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;

  totals.inputTokens += input;
  totals.outputTokens += output;
  totals.cacheReadTokens += cacheRead;
  totals.cacheWriteTokens += cacheWrite;
  totals.calls += 1;

  const pricing = PRICING[Object.keys(PRICING).find(id => model.startsWith(id)) ?? ''];
  if (!pricing) {
    totals.costKnown = false;
    return;
  }
  totals.costUsd +=
    (input * pricing.input +
      output * pricing.output +
      cacheRead * pricing.input * 0.1 +
      cacheWrite * pricing.input * 1.25) /
    1_000_000;
}

/**
 * One-line usage summary printed at the end of a scan.
 */
export function getCostSummary(): string {
  if (totals.calls === 0) return '';
  const tokens = `${totals.inputTokens.toLocaleString()} in / ${totals.outputTokens.toLocaleString()} out`;
  const cache =
    totals.cacheReadTokens > 0 ? `, ${totals.cacheReadTokens.toLocaleString()} cached` : '';
  const cost = totals.costKnown ? `$${totals.costUsd.toFixed(4)}` : 'unknown (unrecognized model)';
  return `AI usage: ${totals.calls} calls, ${tokens}${cache} tokens — estimated cost ${cost}`;
}

/** Test hook. */
export function resetUsage(): void {
  totals.inputTokens = 0;
  totals.outputTokens = 0;
  totals.cacheReadTokens = 0;
  totals.cacheWriteTokens = 0;
  totals.costUsd = 0;
  totals.costKnown = true;
  totals.calls = 0;
}
