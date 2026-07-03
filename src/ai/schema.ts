import { z } from 'zod';

/**
 * A single performance finding. Shared by the batch scan and the agent mode —
 * both produce findings in this exact shape via structured outputs.
 */
export const FindingSchema = z.object({
  file: z
    .string()
    .describe('Path to the file, relative to the project root, exactly as listed in the prompt'),
  startLine: z.number().int().describe('First line of the issue (1-based, must exist in the file)'),
  endLine: z.number().int().describe('Last line of the issue (1-based, must exist in the file)'),
  severity: z
    .enum(['critical', 'warning', 'suggestion'])
    .describe(
      'critical = memory leaks, blocking operations, major bottlenecks; warning = measurable suboptimal patterns; suggestion = worthwhile improvements'
    ),
  title: z.string().describe('One-line summary of the issue'),
  description: z.string().describe('Clear description of the issue'),
  impact: z.string().describe('Specific performance impact on the user'),
  solution: z.string().describe('Concrete, actionable fix'),
  codeExample: z.string().optional().describe('Corrected code snippet, when helpful'),
});

export const FindingsSchema = z.object({
  findings: z.array(FindingSchema),
});

export type Finding = z.infer<typeof FindingSchema>;

const SEVERITY_EMOJI: Record<Finding['severity'], string> = {
  critical: '🚨',
  warning: '⚠️',
  suggestion: '💡',
};

/**
 * Drops findings that reference files outside the analyzed set or line ranges
 * that don't exist. The schema guarantees shape; this guards against hallucinated
 * locations.
 * @param findings - Findings returned by the model
 * @param fileLineCounts - Map of relative file path -> number of lines
 */
export function validateFindings(
  findings: Finding[],
  fileLineCounts: Record<string, number>
): { valid: Finding[]; dropped: Finding[] } {
  const valid: Finding[] = [];
  const dropped: Finding[] = [];
  for (const finding of findings) {
    const lineCount = fileLineCounts[finding.file];
    const inRange =
      lineCount !== undefined &&
      finding.startLine >= 1 &&
      finding.endLine >= finding.startLine &&
      finding.endLine <= lineCount;
    (inRange ? valid : dropped).push(finding);
  }
  return { valid, dropped };
}

/**
 * Renders a finding as the markdown block shape the report layer expects.
 */
export function findingToMarkdown(finding: Finding): string {
  const parts = [
    `${SEVERITY_EMOJI[finding.severity]} ${finding.file}:${finding.startLine}-${finding.endLine} — ${finding.title}`,
    `**Description:** ${finding.description}`,
    `**Impact:** ${finding.impact}`,
    `**Solution:** ${finding.solution}`,
  ];
  if (finding.codeExample) {
    parts.push(`**Code Example:**\n\`\`\`\n${finding.codeExample}\n\`\`\``);
  }
  return parts.join('\n');
}
