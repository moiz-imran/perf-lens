import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { PerflensConfig } from '../types/index.js';
import type { Finding } from '../ai/schema.js';
import { generateHtmlReport } from './htmlReport.js';

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
 * Converts markdown text to HTML with proper formatting and syntax highlighting
 * @param {string} text - The markdown text to convert
 * @returns {string} The converted HTML text
 */
export function formatMarkdownToHtml(text: string): string {
  // First, escape any existing HTML to prevent injection
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Store code blocks temporarily with a unique marker
  const codeBlocks: string[] = [];
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    // Clean up the code block content
    code = code
      .trim()
      .replace(/<\/?p>/g, '') // Remove paragraph tags
      .replace(/^\s{4}/gm, '') // Remove common leading indentation
      .replace(/&lt;(\/?(?:em|strong|code|pre)>)/g, '<$1') // Restore intended HTML tags
      .replace(/&amp;([lg]t;)/g, '&$1'); // Fix HTML entities

    codeBlocks.push(`<pre><code class="language-${lang}">${code}</code></pre>`);
    return placeholder;
  });

  // Convert inline code with proper escaping
  const inlineCodeBlocks: string[] = [];
  text = text.replace(/`([^`]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodeBlocks.length}__`;
    inlineCodeBlocks.push(
      `<code>${code.replace(/&lt;(\/?(?:em|strong|code|pre)>)/g, '<$1')}</code>`
    );
    return placeholder;
  });

  // Convert headers (ensuring proper hierarchy)
  text = text
    .replace(/^# (.*$)/gm, '<h2>$1</h2>')
    .replace(/^## (.*$)/gm, '<h3>$1</h3>')
    .replace(/^### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^#### (.*$)/gm, '<h5>$1</h5>')
    .replace(/^##### (.*$)/gm, '<h6>$1</h6>');

  // Convert bold text
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert italic text
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Handle lists with better nesting support
  const processLists = (input: string): string => {
    const lines = input.split('\n');
    const output: string[] = [];
    const listStack: { type: string; level: number }[] = [];
    let currentListType: string | null = null;

    lines.forEach(line => {
      const trimmedLine = line.trimStart();
      const indentLevel = Math.floor((line.length - trimmedLine.length) / 2);

      // Check for list items
      const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)/);
      const numberMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);

      if (bulletMatch || numberMatch) {
        const content = bulletMatch ? bulletMatch[1] : numberMatch![2];
        const listType = bulletMatch ? 'ul' : 'ol';

        // If we're starting a new list
        if (!currentListType) {
          currentListType = listType;
          output.push(`<${listType}>`);
          listStack.push({ type: listType, level: indentLevel });
        }
        // If we're changing list types at the same level
        else if (
          currentListType !== listType &&
          listStack[listStack.length - 1]?.level === indentLevel
        ) {
          while (listStack.length > 0 && listStack[listStack.length - 1].level >= indentLevel) {
            const last = listStack.pop()!;
            output.push(`</li>\n</${last.type}>`);
          }
          currentListType = listType;
          output.push(`<${listType}>`);
          listStack.push({ type: listType, level: indentLevel });
        }
        // Handle nesting
        else if (indentLevel > (listStack[listStack.length - 1]?.level ?? -1)) {
          output.push(`<${listType}>`);
          listStack.push({ type: listType, level: indentLevel });
          currentListType = listType;
        }
        // If we're un-nesting
        else if (indentLevel < (listStack[listStack.length - 1]?.level ?? 0)) {
          while (listStack.length > 0 && listStack[listStack.length - 1].level > indentLevel) {
            const last = listStack.pop()!;
            output.push(`</li>\n</${last.type}>`);
          }
          if (listStack.length > 0) {
            output.push('</li>');
          }
        }
        // Same level, same type
        else if (listStack.length > 0) {
          output.push('</li>');
        }

        output.push(`<li>${content}`);
      } else if (trimmedLine.trim()) {
        // Close all open lists when hitting non-list content
        while (listStack.length > 0) {
          const last = listStack.pop()!;
          output.push(`</li>\n</${last.type}>`);
        }
        currentListType = null;
        output.push(trimmedLine);
      }
    });

    // Close any remaining open lists
    while (listStack.length > 0) {
      const last = listStack.pop()!;
      output.push(`</li>\n</${last.type}>`);
    }

    return output.join('\n');
  };

  // Process lists
  text = processLists(text);

  // Convert paragraphs (lines with content)
  text = text
    .split('\n')
    .map(line => {
      if (
        line.trim() &&
        !line.match(/^<(div|pre|p|h[1-6]|ul|ol|li)[^>]*>/i) && // Only exclude block-level elements
        !line.includes('__CODE_BLOCK_') &&
        !line.includes('__INLINE_CODE_')
      ) {
        return `<p>${line}</p>`;
      }
      return line;
    })
    .join('\n');

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    text = text.replace(`__CODE_BLOCK_${i}__`, block);
  });

  // Restore inline code blocks
  inlineCodeBlocks.forEach((block, i) => {
    text = text.replace(`__INLINE_CODE_${i}__`, block);
  });

  // Clean up formatting
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/(<\/(ul|ol)>)\s*<p>\s*<\/p>/g, '$1')
    .replace(/<p>\s*<(ul|ol)>/g, '<$1>')
    .replace(/<\/(ul|ol)>\s*<\/p>/g, '</$1>')
    .replace(/<li>\s+/g, '<li>')
    .replace(/\s+<\/li>/g, '</li>')
    .replace(/<\/(ul|ol)>\s*<(ul|ol)>/g, '</$1>\n<$2>')
    .replace(/\n+/g, '\n')
    .replace(/>\s+</g, '><') // Remove extra spaces between tags
    .replace(/>>+/g, '>') // Remove duplicate closing brackets
    .trim();
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
