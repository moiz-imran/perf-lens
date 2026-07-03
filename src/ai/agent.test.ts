import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type Anthropic from '@anthropic-ai/sdk';
import { runAgentAnalysis, type AgentOptions } from './agent.js';
import type { AIClient } from './client.js';
import type { Finding } from './schema.js';

const FINDING: Finding = {
  file: 'src/App.tsx',
  startLine: 1,
  endLine: 2,
  severity: 'critical',
  title: 't',
  description: 'd',
  impact: 'i',
  solution: 's',
};

function toolUse(name: string, input: unknown, id = `toolu_${name}`): Anthropic.ToolUseBlock {
  return { type: 'tool_use', id, name, input } as Anthropic.ToolUseBlock;
}

/** Scripted fake for the SDK: each entry is one turn's response content. */
function mockClient(turns: Anthropic.ContentBlock[][]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  let turn = 0;
  const client = {
    getConfig: () => ({ model: 'claude-opus-4-8' }),
    anthropic: {
      messages: {
        stream: (params: Anthropic.MessageCreateParams) => {
          calls.push(structuredClone(params));
          const content = turns[Math.min(turn++, turns.length - 1)];
          return {
            finalMessage: async () =>
              ({
                content,
                stop_reason: 'tool_use',
                usage: { input_tokens: 1, output_tokens: 1 },
              }) as unknown as Anthropic.Message,
          };
        },
      },
    },
  } as unknown as AIClient;
  return { client, calls };
}

describe('runAgentAnalysis', () => {
  let dir: string;
  let options: AgentOptions;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perflens-agent-'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/App.tsx'), 'line one\nline two\n');
    options = { targetDir: dir, systemPrompt: 'You are a performance expert.' };
  });

  it('returns findings when the model calls report_findings', async () => {
    const { client } = mockClient([[toolUse('report_findings', { findings: [FINDING] })]]);
    const findings = await runAgentAnalysis(client, options);
    expect(findings).toEqual([FINDING]);
  });

  it('executes tools and returns all results in one user message', async () => {
    const { client, calls } = mockClient([
      [
        toolUse('read_file', { path: 'src/App.tsx' }, 'toolu_1'),
        toolUse('grep', { pattern: 'line' }, 'toolu_2'),
      ],
      [toolUse('report_findings', { findings: [] })],
    ]);
    await runAgentAnalysis(client, options);

    const secondCallMessages = calls[1].messages;
    const toolResultMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(toolResultMessage.role).toBe('user');
    const blocks = toolResultMessage.content as Anthropic.ToolResultBlockParam[];
    expect(blocks).toHaveLength(2);
    expect(blocks.map(b => b.tool_use_id)).toEqual(['toolu_1', 'toolu_2']);
    expect(blocks[0].content).toContain('1: line one');
    expect(blocks[1].content).toContain('src/App.tsx:1');
  });

  it('rejects read_file paths that escape the target directory', async () => {
    const { client, calls } = mockClient([
      [toolUse('read_file', { path: '../outside.txt' })],
      [toolUse('report_findings', { findings: [] })],
    ]);
    await runAgentAnalysis(client, options);

    const blocks = calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    expect(blocks[0].is_error).toBe(true);
    expect(blocks[0].content).toContain('escapes the project root');
  });

  it('returns a schema error for invalid findings and accepts the retry', async () => {
    const { client, calls } = mockClient([
      [toolUse('report_findings', { findings: [{ file: 'x' }] })],
      [toolUse('report_findings', { findings: [FINDING] })],
    ]);
    const findings = await runAgentAnalysis(client, options);
    expect(findings).toEqual([FINDING]);

    const blocks = calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    expect(blocks[0].is_error).toBe(true);
    expect(blocks[0].content).toContain('Invalid findings');
  });

  it('forces report_findings on the final turn', async () => {
    const { client, calls } = mockClient([[toolUse('report_findings', { findings: [] })]]);
    await runAgentAnalysis(client, { ...options, maxTurns: 1 });
    expect(calls[0].tool_choice).toEqual({ type: 'tool', name: 'report_findings' });
  });

  it('nudges the model when it stops without reporting', async () => {
    const { client, calls } = mockClient([
      [{ type: 'text', text: 'All done!' } as Anthropic.ContentBlock],
      [toolUse('report_findings', { findings: [] })],
    ]);
    await runAgentAnalysis(client, options);
    const nudge = calls[1].messages.at(-1)!;
    expect(nudge.role).toBe('user');
    expect(nudge.content).toContain('report_findings');
  });
});
