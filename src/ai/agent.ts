import fs from 'fs';
import path from 'path';
import vm from 'vm';
import chalk from 'chalk';
import fg from 'fast-glob';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { FindingsSchema, type Finding } from './schema.js';
import { recordUsage } from './cost.js';
import { thinkingFor, type AIClient } from './client.js';

const MAX_TURNS = 25;
const MAX_LIST_RESULTS = 200;
const MAX_GREP_RESULTS = 100;
const DEFAULT_MAX_FILE_SIZE = 100 * 1024;
const AGENT_MAX_TOKENS = 16000;
const REGEX_TIMEOUT_MS = 200;

const AGENT_INSTRUCTIONS = `You are investigating a frontend codebase for performance issues.

You have tools to explore the project: list_files, read_file, and grep. Use them to
form and verify hypotheses — start from the Lighthouse results below, locate the code
responsible, and read enough context to be certain before reporting an issue.

Guidance:
- Investigate before concluding. Read the actual code; never report an issue in code you have not read.
- Prioritize entry points, large components, data fetching, and rendering hot paths.
- Precision over volume: only report issues you are confident are real, with exact file and line locations.
- When you have finished investigating, call report_findings exactly once with every finding.`;

interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  strict?: boolean;
}

export interface AgentOptions {
  targetDir: string;
  ignore?: string[];
  maxFileSize?: number;
  systemPrompt: string;
  /** Prebuilt Lighthouse context string; goes into the first user message. */
  lighthouseContext?: string;
  verbose?: boolean;
  maxTurns?: number;
}

/** Resolves a model-supplied path and rejects anything that escapes the target dir. */
function resolveWithin(baseDir: string, relativePath: string): string | null {
  const resolved = path.resolve(baseDir, relativePath);
  return resolved === baseDir || resolved.startsWith(baseDir + path.sep) ? resolved : null;
}

/**
 * fast-glob does not sandbox `..` segments in patterns — a pattern like
 * "../../../etc/*" happily matches outside cwd. Reject anything that isn't a
 * plain relative pattern before it reaches fg.sync.
 */
function isSafeGlobPattern(pattern: string): boolean {
  return !path.isAbsolute(pattern) && !pattern.split(/[\\/]/).includes('..');
}

/**
 * Runs a model-supplied regex against a line with a hard wall-clock timeout,
 * so a catastrophic-backtracking pattern can't hang the process (ReDoS).
 */
function safeRegexTest(regex: RegExp, line: string): boolean {
  try {
    return vm.runInNewContext('regex.test(line)', { regex, line }, { timeout: REGEX_TIMEOUT_MS });
  } catch {
    return false; // timed out or errored — skip this line rather than hang
  }
}

function buildTools(): AgentToolDefinition[] {
  return [
    {
      name: 'list_files',
      description:
        'List source files in the project, optionally filtered by a glob pattern (e.g. "src/**/*.tsx"). Returns relative paths.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern relative to the project root. Defaults to all source files.',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      name: 'read_file',
      description:
        'Read a file from the project. Returns content with 1-based line numbers. Optionally restrict to a line range.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the project root' },
          startLine: { type: 'integer', description: 'First line to read (1-based)' },
          endLine: { type: 'integer', description: 'Last line to read (1-based, inclusive)' },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
    {
      name: 'grep',
      description:
        'Search file contents with a JavaScript regular expression. Returns "file:line: text" matches.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'JavaScript regex to search for' },
          glob: {
            type: 'string',
            description:
              'Restrict the search to files matching this glob (relative to project root)',
          },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
    },
    {
      name: 'report_findings',
      description:
        'Submit the final list of performance findings. Call this exactly once, when your investigation is complete. Calling it ends the analysis.',
      input_schema: z.toJSONSchema(FindingsSchema),
    },
  ];
}

/** Executes one investigation tool call; returns the tool_result content string. */
function executeTool(
  name: string,
  input: Record<string, unknown>,
  options: AgentOptions
): { content: string; isError: boolean } {
  const ignore = options.ignore ?? [];
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

  try {
    switch (name) {
      case 'list_files': {
        const pattern =
          (input.pattern as string) ||
          '**/*.{js,jsx,ts,tsx,vue,svelte,astro,css,scss,less,sass,html}';
        if (!isSafeGlobPattern(pattern)) {
          return { content: `Pattern escapes the project root: ${pattern}`, isError: true };
        }
        const files = fg.sync(pattern, {
          cwd: options.targetDir,
          ignore,
          onlyFiles: true,
          dot: false,
        });
        const shown = files.slice(0, MAX_LIST_RESULTS);
        const suffix =
          files.length > shown.length
            ? `\n… ${files.length - shown.length} more (narrow the pattern)`
            : '';
        return { content: shown.join('\n') + suffix || 'No files matched.', isError: false };
      }

      case 'read_file': {
        const resolved = resolveWithin(options.targetDir, input.path as string);
        if (!resolved) {
          return { content: `Path escapes the project root: ${input.path}`, isError: true };
        }
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
          return { content: `File not found: ${input.path}`, isError: true };
        }
        if (fs.statSync(resolved).size > maxFileSize) {
          return {
            content: `File exceeds the ${Math.round(maxFileSize / 1024)}KB read limit — use startLine/endLine to read a range`,
            isError: true,
          };
        }
        const lines = fs.readFileSync(resolved, 'utf-8').split('\n');
        const start = Math.max(1, (input.startLine as number) || 1);
        const end = Math.min(lines.length, (input.endLine as number) || lines.length);
        const numbered = lines
          .slice(start - 1, end)
          .map((line, i) => `${start + i}: ${line}`)
          .join('\n');
        return { content: numbered || '(empty file)', isError: false };
      }

      case 'grep': {
        const glob = (input.glob as string) || '**/*';
        if (!isSafeGlobPattern(glob)) {
          return { content: `Glob escapes the project root: ${glob}`, isError: true };
        }
        const regex = new RegExp(input.pattern as string);
        const files = fg.sync(glob, {
          cwd: options.targetDir,
          ignore,
          onlyFiles: true,
          dot: false,
        });
        const matches: string[] = [];
        for (const file of files) {
          const absolute = path.join(options.targetDir, file);
          if (fs.statSync(absolute).size > maxFileSize) continue;
          const lines = fs.readFileSync(absolute, 'utf-8').split('\n');
          for (let i = 0; i < lines.length && matches.length < MAX_GREP_RESULTS; i++) {
            if (safeRegexTest(regex, lines[i])) {
              matches.push(`${file}:${i + 1}: ${lines[i].trim()}`);
            }
          }
          if (matches.length >= MAX_GREP_RESULTS) break;
        }
        return {
          content: matches.length > 0 ? matches.join('\n') : 'No matches.',
          isError: false,
        };
      }

      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    return {
      content: `Tool error: ${error instanceof Error ? error.message : error}`,
      isError: true,
    };
  }
}

/**
 * Agent-mode analysis: the model investigates the codebase through tool use
 * across multiple turns, then submits schema-validated findings via the
 * report_findings tool. Hand-rolled loop — no framework.
 */
export async function runAgentAnalysis(
  client: AIClient,
  options: AgentOptions
): Promise<Finding[]> {
  const anthropic = client.anthropic;
  const model = client.getConfig().model!;
  const maxTurns = options.maxTurns ?? MAX_TURNS;
  const tools = buildTools() as unknown as Anthropic.ToolUnion[];

  const system: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: `${options.systemPrompt}\n\n${AGENT_INSTRUCTIONS}`,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: options.lighthouseContext
        ? `${options.lighthouseContext}\n\nInvestigate this project and report your performance findings.`
        : 'Investigate this project and report your performance findings.',
    },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    const finalTurn = turn === maxTurns - 1;
    const stream = anthropic.messages.stream({
      model,
      max_tokens: AGENT_MAX_TOKENS,
      ...thinkingFor(model),
      system,
      tools,
      // Out of turns: force the report so the run always ends with findings
      ...(finalTurn ? { tool_choice: { type: 'tool' as const, name: 'report_findings' } } : {}),
      messages,
    });
    const response = await stream.finalMessage();
    recordUsage(model, response.usage);
    messages.push({ role: 'assistant', content: response.content });

    if (options.verbose) {
      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          console.log(chalk.gray(block.text.trim()));
        }
      }
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUses.length === 0) {
      // Model stopped talking instead of reporting — nudge it once per occurrence.
      messages.push({
        role: 'user',
        content: 'Use the report_findings tool to submit your findings.',
      });
      continue;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const input = toolUse.input as Record<string, unknown>;

      if (toolUse.name === 'report_findings') {
        const parsed = FindingsSchema.safeParse(input);
        if (parsed.success) {
          console.log(chalk.gray(`  📋 report_findings (${parsed.data.findings.length} findings)`));
          return parsed.data.findings;
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Invalid findings: ${parsed.error.message}. Fix the schema errors and call report_findings again.`,
          is_error: true,
        });
        continue;
      }

      const summary =
        toolUse.name === 'read_file'
          ? `${input.path}${input.startLine ? `:${input.startLine}-${input.endLine ?? ''}` : ''}`
          : ((input.pattern as string) ?? '');
      console.log(chalk.gray(`  🔍 ${toolUse.name} ${summary}`));

      const result = executeTool(toolUse.name, input, options);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.content,
        ...(result.isError ? { is_error: true } : {}),
      });
    }

    // All tool results for a turn go back in ONE user message
    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error('Agent did not produce findings within the turn limit');
}
