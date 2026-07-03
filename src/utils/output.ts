import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Marked } from 'marked';
import type { PerflensConfig } from '../types/index.js';
import type { Finding } from '../ai/schema.js';
import { generateHtmlReport } from './htmlReport.js';

/** Escapes text before it lands in HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Markdown → HTML for AI-generated report prose. Two deliberate overrides:
// - `html`: escape raw HTML tokens instead of passing them through, so model
//   output can't inject markup into the report (secure-by-construction).
// - `heading`: shift levels down one (# → h2) to match the report's `.prose`
//   CSS, which only styles h2–h6.
const markdown = new Marked({
  renderer: {
    html(token) {
      return escapeHtml(token.text);
    },
    heading(token) {
      const level = Math.min(token.depth + 1, 6);
      return `<h${level}>${this.parser.parseInline(token.tokens)}</h${level}>\n`;
    },
  },
});

export interface PerformanceReport {
  lighthouse: {
    metrics: string;
    report: string;
    analysis: {
      coreWebVitals: string;
      performanceOpportunities: string;
      diagnostics: string;
    };
  };
  codeAnalysis: {
    critical: string[];
    warnings: string[];
    suggestions: string[];
    /** Structured findings — the HTML report renders from these directly */
    findings?: Finding[];
  };
  metadata: {
    timestamp: string;
    duration: number;
    config: PerflensConfig;
  };
}

/**
 * Generates a markdown report from performance analysis data
 * @param {PerformanceReport} data - The performance analysis data to format
 * @returns {string} A formatted markdown report
 */
export function generateMarkdownReport(data: PerformanceReport): string {
  return `# Performance Analysis Report
${
  data.metadata
    ? `
Generated on: ${new Date(data.metadata.timestamp).toLocaleString()}
Analysis Duration: ${Math.round(data.metadata.duration / 1000)}s
`
    : ''
}

## 🌟 Lighthouse Performance Report

### Metrics
\`\`\`
${data.lighthouse.metrics}
\`\`\`

### Detailed Report
${data.lighthouse.report}

### Analysis
${
  typeof data.lighthouse.analysis === 'object'
    ? Object.entries(data.lighthouse.analysis)
        .map(([key, value]) => `#### ${key}\n${value}`)
        .join('\n\n')
    : data.lighthouse.analysis || 'No analysis available'
}

## 🧠 Code Analysis

### Critical Issues
${
  data.codeAnalysis.critical.length > 0
    ? data.codeAnalysis.critical.join('\n\n')
    : '_No critical issues found_'
}

### Warnings
${
  data.codeAnalysis.warnings.length > 0
    ? data.codeAnalysis.warnings.join('\n\n')
    : '_No warnings found_'
}

### Suggestions
${
  data.codeAnalysis.suggestions.length > 0
    ? data.codeAnalysis.suggestions.join('\n\n')
    : '_No suggestions found_'
}
`;
}

/**
 * Converts AI-generated markdown to HTML for the report's prose sections.
 * Raw HTML in the source is escaped, not rendered — see the `markdown` renderer.
 * @param {string} text - The markdown text to convert
 * @returns {string} The converted HTML text
 */
export function formatMarkdownToHtml(text: string): string {
  return (markdown.parse(text, { async: false }) as string).trim();
}

/**
 * Saves a performance report in the specified format
 * @param {PerformanceReport} data - The performance analysis data to save
 * @param {'md' | 'html'} format - The output format (markdown or HTML)
 * @param {string} [outputPath] - Optional path to save the report
 * @returns {string} The path where the report was saved
 */
export function saveReport(
  data: PerformanceReport,
  format: 'md' | 'html' = 'html',
  outputPath?: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultFileName = `performance-report-${timestamp}`;
  const filePath = outputPath || path.join(process.cwd(), defaultFileName + '.' + format);

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(filePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const content = format === 'md' ? generateMarkdownReport(data) : generateHtmlReport(data);

  try {
    fs.writeFileSync(filePath, content);
    return filePath;
  } catch (error) {
    console.error(chalk.red('Error saving report:'), error);
    throw error;
  }
}
