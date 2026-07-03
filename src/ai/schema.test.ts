import { describe, it, expect } from 'vitest';
import { FindingsSchema, validateFindings, findingToMarkdown, type Finding } from './schema.js';

const finding = (overrides: Partial<Finding> = {}): Finding => ({
  file: 'src/App.tsx',
  startLine: 5,
  endLine: 8,
  severity: 'critical',
  title: 'Memory leak in useEffect',
  description: 'Event listener is never removed',
  impact: 'Memory grows on every mount',
  solution: 'Return a cleanup function',
  ...overrides,
});

describe('FindingsSchema', () => {
  it('accepts a valid findings payload', () => {
    expect(FindingsSchema.safeParse({ findings: [finding()] }).success).toBe(true);
  });

  it('rejects an unknown severity', () => {
    const result = FindingsSchema.safeParse({
      findings: [{ ...finding(), severity: 'catastrophic' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { impact: _impact, ...noImpact } = finding();
    expect(FindingsSchema.safeParse({ findings: [noImpact] }).success).toBe(false);
  });
});

describe('validateFindings', () => {
  const lineCounts = { 'src/App.tsx': 100 };

  it('keeps findings within known files and line ranges', () => {
    const { valid, dropped } = validateFindings([finding()], lineCounts);
    expect(valid).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it('drops findings for unknown files', () => {
    const { valid, dropped } = validateFindings([finding({ file: 'src/Ghost.tsx' })], lineCounts);
    expect(valid).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it('drops findings whose lines exceed the file', () => {
    const { dropped } = validateFindings([finding({ startLine: 90, endLine: 120 })], lineCounts);
    expect(dropped).toHaveLength(1);
  });

  it('drops inverted or zero line ranges', () => {
    expect(
      validateFindings([finding({ startLine: 8, endLine: 5 })], lineCounts).dropped
    ).toHaveLength(1);
    expect(
      validateFindings([finding({ startLine: 0, endLine: 3 })], lineCounts).dropped
    ).toHaveLength(1);
  });
});

describe('findingToMarkdown', () => {
  it('renders the severity emoji, location, and sections', () => {
    const markdown = findingToMarkdown(finding({ codeExample: 'return () => remove();' }));
    expect(markdown).toContain('🚨 src/App.tsx:5-8 — Memory leak in useEffect');
    expect(markdown).toContain('**Description:**');
    expect(markdown).toContain('**Impact:**');
    expect(markdown).toContain('**Solution:**');
    expect(markdown).toContain('return () => remove();');
  });

  it('omits the code example section when absent', () => {
    expect(findingToMarkdown(finding())).not.toContain('**Code Example:**');
  });
});
