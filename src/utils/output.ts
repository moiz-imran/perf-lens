import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { PerflensConfig } from '../types';

interface PerformanceReport {
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
${data.lighthouse.analysis}

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
function formatMarkdownToHtml(text: string): string {
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
 * Generates an HTML report from performance analysis data with styling
 * @param {PerformanceReport} data - The performance analysis data to format
 * @returns {string} A formatted HTML report with embedded styles
 */
export function generateHtmlReport(data: PerformanceReport): string {
  const formatMetricValue = (value: string | undefined) => {
    if (!value) return 'N/A';
    return value;
  };

  const updatedCssVariables = `
      :root {
        --primary: #2563eb;
        --critical: #dc2626;
        --warning: #d97706;
        --suggestion: #3b82f6;
        --success: #22c55e;
        --background: #f8fafc;
        --text: #1e293b;
        --text-light: #475569;
        --border: #e2e8f0;
        --code-bg: #1e293b;
        --code-text: #e2e8f0;
        --card-bg: #ffffff;
      }
    `;

  const tabStyles = `
      .tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 2rem;
        border-bottom: 2px solid var(--border);
        padding-bottom: 0;
        position: sticky;
        top: 0;
        background: var(--background);
        z-index: 100;
        padding: 1rem 0;
      }

      .tab {
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: 500;
        color: var(--text-light);
        background: transparent;
        border: none;
        transition: all 0.2s;
        position: relative;
      }

      .tab:hover {
        color: var(--primary);
        background: rgba(37, 99, 235, 0.1);
      }

      .tab.active {
        color: var(--primary);
        background: rgba(37, 99, 235, 0.1);
      }

      .tab-content {
        display: none;
        animation: fadeIn 0.3s ease-in-out;
      }

      .tab-content.active {
        display: block;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .tab-indicator {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.5rem;
        height: 1.5rem;
        padding: 0 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-left: 0.5rem;
        color: white;
      }

      .tab-indicator.critical { background: var(--critical); }
      .tab-indicator.warning { background: var(--warning); }
      .tab-indicator.suggestion { background: var(--suggestion); }
    `;

  const updatedSummaryCardStyles = `
      .summary-card {
        flex: 1;
        padding: 1.5rem;
        border-radius: 0.5rem;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .summary-card.critical {
        background: var(--critical);
      }

      .summary-card.warning {
        background: var(--warning);
      }

      .summary-card.suggestion {
        background: var(--suggestion);
      }

      .summary-number {
        font-size: 2.5rem;
        font-weight: bold;
        margin-bottom: 0.75rem;
      }

      .summary-label {
        font-size: 1rem;
        font-weight: 500;
      }
    `;

  const updatedCodeStyles = `
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background: var(--code-bg);
        color: var(--code-text);
        padding: 0.2rem 0.4rem;
        border-radius: 0.25rem;
        font-size: 0.9em;
      }

      pre {
        background: var(--code-bg);
        padding: 1.5rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 1.5rem 0;
        border: 1px solid var(--border);
        position: relative;
      }

      pre code {
        padding: 0;
        background: none;
        color: var(--code-text);
        font-size: 0.9rem;
        display: block;
        line-height: 1.5;
      }
    `;

  const updatedListStyles = `
      ul, ol {
        margin: 1rem 0;
        padding-left: 2rem;
      }

      li {
        margin-bottom: 0.5rem;
      }

      ul ul, ol ul, ul ol, ol ol {
        margin: 0.5rem 0;
      }

      li > ul, li > ol {
        margin-top: 0.25rem;
      }
    `;

  const accordionStyles = `
      .accordion {
        margin-bottom: 1rem;
      }

      .accordion-header {
        padding: 1rem;
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s;
      }

      .accordion-header:hover {
        background: rgba(37, 99, 235, 0.1);
      }

      .accordion-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text);
      }

      .accordion-icon {
        transition: transform 0.2s;
      }

      .accordion-content {
        display: none;
        padding: 1rem;
        border: 1px solid var(--border);
        border-top: none;
        border-radius: 0 0 0.5rem 0.5rem;
        background: var(--card-bg);
      }

      .accordion.active > .accordion-header {
        border-radius: 0.5rem 0.5rem 0 0;
        background: rgba(37, 99, 235, 0.1);

        .accordion-icon {
          transform: rotate(180deg);
        }
      }

      .accordion.active > .accordion-content {
        display: block;
      }

      .expandable-list {
        position: relative;
        max-height: 300px;
        overflow: hidden;
        transition: max-height 0.3s ease-out;
      }

      .expandable-list.expanded {
        max-height: none;
      }

      .expandable-list:not(.expanded)::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: linear-gradient(transparent, var(--card-bg));
      }

      .expand-button {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.875rem;
      }

      .expand-button:hover {
        opacity: 0.9;
      }

      .nested-accordions {
        margin: -1rem;
      }

      .nested-accordions .accordion {
        margin: 0;
        border: 1px solid var(--border);
        border-top: none;
      }

      .nested-accordions .accordion:first-child {
        border-top: 1px solid var(--border);
        border-top-left-radius: 0.5rem;
        border-top-right-radius: 0.5rem;
      }

      .nested-accordions .accordion:last-child {
        border-bottom-left-radius: 0.5rem;
        border-bottom-right-radius: 0.5rem;
      }

      .nested-accordions .accordion-header {
        background: rgba(37, 99, 235, 0.05);
        border: none;
        border-radius: 0;
        padding-left: 3rem;
      }

      .nested-accordions .accordion.active .accordion-header {
        background: rgba(37, 99, 235, 0.1);
        border-radius: 0;
      }

      .nested-accordions .accordion-content {
        border: none;
        border-radius: 0;
        padding-left: 3rem;

        h2 {
          margin-top: 1rem;
        }
      }
    `;

  const styles = `
    ${updatedCssVariables}
    ${tabStyles}
    ${accordionStyles}

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--background);
    }

    h5 {
      font-size: 1rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      text-align: center;
      margin-bottom: 3rem;
      padding: 2rem;
      background: var(--card-bg);
      border-radius: 1rem;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .metadata {
      margin-top: 1rem;
      color: var(--text-light);
      font-size: 0.9rem;
    }

    .metadata p {
      margin: 0.25rem 0;
    }

    h1 {
      color: var(--primary);
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    h2 {
      color: var(--text);
      font-size: 1.8rem;
      margin: 2rem 0 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    h3 {
      color: var(--text);
      font-size: 1.4rem;
      margin: 1.5rem 0 1rem;
      border-bottom: 2px solid var(--border);
      padding-bottom: 0.5rem;
    }

    h4 {
      color: var(--text);
      font-size: 1.2rem;
      margin: 1.2rem 0 0.8rem;
    }

    p {
      margin-bottom: 1rem;
      line-height: 1.8;
    }

    ul {
      margin: 1rem 0;
      padding-left: 2rem;
    }

    li {
      margin-bottom: 0.5rem;
    }

    ${updatedCodeStyles}

    .card {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .metric-card {
      background: var(--card-bg);
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }

    .metric-title {
      color: var(--text);
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--primary);
    }

    .issue {
      border-left: 4px solid transparent;
      padding: 1rem;
      margin-bottom: 1rem;
      background: white;
      border-radius: 0 0.5rem 0.5rem 0;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }

    .issue.critical {
      border-left-color: var(--critical);
    }

    .issue.warning {
      border-left-color: var(--warning);
    }

    .issue.suggestion {
      border-left-color: var(--suggestion);
    }

    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .issue-title {
      font-weight: 600;
    }

    .issue-path {
      font-family: monospace;
      color: var(--text-light);
      font-size: 0.9rem;
    }

    .resource-list {
      list-style: none;
    }

    .resource-item {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .resource-item:last-child {
      border-bottom: none;
    }

    .resource-url {
      color: var(--text-light);
      font-size: 0.9rem;
      word-break: break-all;
    }

    .resource-size {
      color: var(--primary);
      font-weight: 500;
      white-space: nowrap;
      margin-left: 1rem;
    }

    .summary {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .summary-card {
      flex: 1;
      padding: 1rem;
      border-radius: 0.5rem;
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .summary-card.critical { background: var(--critical); }
    .summary-card.warning { background: var(--warning); }
    .summary-card.suggestion { background: var(--suggestion); }

    .summary-number {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }

    .summary-label {
      font-size: 0.9rem;
      opacity: 0.9;
    }

    ${updatedSummaryCardStyles}

    ${updatedListStyles}

    .lighthouse-attribution {
      text-align: center;
      margin: 20px 0;
      padding: 10px;
      border-top: 1px solid #eee;
      color: #666;

      a {
        color: #0066cc;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      img {
        width: 48px;
        height: 48px;
        vertical-align: middle;
      }
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Analysis Report</title>

  <style>
    ${styles}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 Performance Analysis Report</h1>
      ${
        data.metadata
          ? `
      <div class="metadata">
        <p>Generated on: ${new Date(data.metadata.timestamp).toLocaleString()}</p>
        <p>Analysis Duration: ${Math.round(data.metadata.duration / 1000)}s</p>
      </div>`
          : ''
      }
    </div>

    <div class="summary">
      <div class="summary-card critical">
        <div class="summary-number">${data.codeAnalysis.critical.length}</div>
        <div class="summary-label">Critical Issues</div>
      </div>
      <div class="summary-card warning">
        <div class="summary-number">${data.codeAnalysis.warnings.length}</div>
        <div class="summary-label">Warnings</div>
      </div>
      <div class="summary-card suggestion">
        <div class="summary-number">${data.codeAnalysis.suggestions.length}</div>
        <div class="summary-label">Suggestions</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="overview">📊 Overview</button>
      <button class="tab" data-tab="lighthouse">
        🌟 Lighthouse
        ${data.lighthouse.metrics ? '<span class="tab-indicator suggestion">1</span>' : ''}
      </button>
      <button class="tab" data-tab="code-analysis">
        🧠 Code Analysis
        ${
          data.codeAnalysis.critical.length +
            data.codeAnalysis.warnings.length +
            data.codeAnalysis.suggestions.length >
          0
            ? `<span class="tab-indicator ${
                data.codeAnalysis.critical.length > 0
                  ? 'critical'
                  : data.codeAnalysis.warnings.length > 0
                    ? 'warning'
                    : 'suggestion'
              }">${
                data.codeAnalysis.critical.length +
                data.codeAnalysis.warnings.length +
                data.codeAnalysis.suggestions.length
              }</span>`
            : ''
        }
      </button>
    </div>

    <div class="tab-content active" id="overview">
      <div class="metrics">
        ${data.lighthouse.metrics
          .split('\n')
          .map(line => {
            if (!line.trim()) return '';
            const [title, value] = line.split(':').map(s => s.trim());
            if (!title || !value) return '';
            return `
            <div class="metric-card">
              <div class="metric-title">${title}</div>
              <div class="metric-value">${formatMetricValue(value)}</div>
            </div>
          `;
          })
          .join('')}
      </div>

      <div class="card">
        <h3>Quick Summary</h3>
        <p>This report provides a comprehensive analysis of your application's performance across multiple dimensions:</p>
        <ul>
          <li><strong>Lighthouse Analysis:</strong> Core web vitals and performance metrics</li>
          <li><strong>Code Analysis:</strong> Static analysis of your codebase for performance optimizations</li>
        </ul>
        ${
          data.codeAnalysis.critical.length > 0
            ? `<div class="alert critical">
                <h4>🚨 Critical Issues Detected</h4>
                <p>There are ${data.codeAnalysis.critical.length} critical issues that need immediate attention.</p>
              </div>`
            : ''
        }
      </div>
    </div>

    <div class="tab-content" id="lighthouse">
      <div class="accordion active">
        <div class="accordion-header">
          <span class="accordion-title">🎯 Core Web Vitals</span>
          <span class="accordion-icon">▼</span>
        </div>
        <div class="accordion-content">
          ${formatMarkdownToHtml(data.lighthouse.report.split('## Performance Opportunities')[0])}
        </div>
      </div>

      <div class="accordion">
        <div class="accordion-header">
          <span class="accordion-title">🚀 Performance Opportunities</span>
          <span class="accordion-icon">▼</span>
        </div>
        <div class="accordion-content">
          ${(() => {
            const section =
              data.lighthouse.report
                .split('## Performance Opportunities')[1]
                ?.split('## JavaScript Issues')[0] || '';
            return formatMarkdownToHtml(section);
          })()}
        </div>
      </div>

      <div class="accordion">
        <div class="accordion-header">
          <span class="accordion-title">🔍 JavaScript Analysis</span>
          <span class="accordion-icon">▼</span>
        </div>
        <div class="accordion-content">
          ${(() => {
            const section = data.lighthouse.report.split('## JavaScript Issues')[1] || '';
            const parts = section.split('### Unused JavaScript');
            const unminifiedParts = section.split('### Unminified JavaScript');

            let content = '';

            if (parts.length > 1) {
              const unusedJsSection = parts[1].split('###')[0];
              content +=
                formatMarkdownToHtml(parts[0] + '### Unused JavaScript') +
                `
                <div class="expandable-list">
                  ${formatMarkdownToHtml(unusedJsSection)}
                </div>
                <button class="expand-button">Show More</button>
              `;
            }

            if (unminifiedParts.length > 1) {
              const unminifiedJsSection = unminifiedParts[1].split('###')[0];
              content +=
                formatMarkdownToHtml('### Unminified JavaScript') +
                `
                <div class="expandable-list">
                  ${formatMarkdownToHtml(unminifiedJsSection)}
                </div>
                <button class="expand-button">Show More</button>
              `;

              // Add any remaining sections
              const remainingSections = unminifiedParts[1].split('###').slice(1);
              if (remainingSections.length > 0) {
                content += formatMarkdownToHtml('###' + remainingSections.join('###'));
              }
            }

            return content || formatMarkdownToHtml(section);
          })()}
        </div>
      </div>

      <div class="accordion">
        <div class="accordion-header">
          <span class="accordion-title">📊 Analysis & Recommendations</span>
          <span class="accordion-icon">▼</span>
        </div>
        <div class="accordion-content">
          <div class="nested-accordions">
            <div class="accordion">
              <div class="accordion-header">
                <span class="accordion-title">🎯 Core Web Vitals Analysis</span>
                <span class="accordion-icon">▼</span>
              </div>
              <div class="accordion-content">
                ${formatMarkdownToHtml(data.lighthouse.analysis.coreWebVitals)}
              </div>
            </div>

            <div class="accordion">
              <div class="accordion-header">
                <span class="accordion-title">🚀 Performance Opportunities Analysis</span>
                <span class="accordion-icon">▼</span>
              </div>
              <div class="accordion-content">
                ${formatMarkdownToHtml(data.lighthouse.analysis.performanceOpportunities)}
              </div>
            </div>

            <div class="accordion">
              <div class="accordion-header">
                <span class="accordion-title">🔍 Diagnostics Analysis</span>
                <span class="accordion-icon">▼</span>
              </div>
              <div class="accordion-content">
                ${formatMarkdownToHtml(data.lighthouse.analysis.diagnostics)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="lighthouse-attribution">
        <img src="https://developer.chrome.com/static/docs/lighthouse/overview/image/lighthouse-logo.svg" alt="Lighthouse" />
        Powered by <a href="https://www.google.com/url?q=https://developers.google.com/web/tools/lighthouse&sa=D&source=editors&ust=1742372714584851&usg=AOvVaw0H4et58bVq5T5hpQYr3br5" target="_blank">Lighthouse</a> (v12.4.0)
        • To run a full Lighthouse report, go <a href="https://www.google.com/url?q=https://developers.google.com/web/tools/lighthouse%23devtools&sa=D&source=editors&ust=1742372714585325&usg=AOvVaw3Y_g-R7icqIAg0laMFq1ol" target="_blank">here</a>.
      </div>
    </div>

    <div class="tab-content" id="code-analysis">
      ${
        data.codeAnalysis.critical.length > 0
          ? `
        <h3>Critical Issues</h3>
        ${data.codeAnalysis.critical
          .map(
            issue => `
          <div class="issue critical">
            ${formatIssue(issue)}
          </div>
        `
          )
          .join('\n')}
      `
          : ''
      }

      ${
        data.codeAnalysis.warnings.length > 0
          ? `
        <h3>Warnings</h3>
        ${data.codeAnalysis.warnings
          .map(
            issue => `
          <div class="issue warning">
            ${formatIssue(issue)}
          </div>
        `
          )
          .join('\n')}
      `
          : ''
      }

      ${
        data.codeAnalysis.suggestions.length > 0
          ? `
        <h3>Suggestions</h3>
        ${data.codeAnalysis.suggestions
          .map(
            issue => `
          <div class="issue suggestion">
            ${formatIssue(issue)}
          </div>
        `
          )
          .join('\n')}
      `
          : ''
      }
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const tabs = document.querySelectorAll('.tab');
      const tabContents = document.querySelectorAll('.tab-content');

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          const tabId = tab.getAttribute('data-tab');
          document.getElementById(tabId).classList.add('active');
        });
      });

      function handleAccordionClick(header, isNested = false) {
        const accordion = header.parentElement;
        const wasActive = accordion.classList.contains('active');

        if (!isNested) {
          const mainAccordions = header.closest('.tab-content').querySelectorAll(':scope > .accordion');
          mainAccordions.forEach(acc => {
            if (acc !== accordion) {
              acc.classList.remove('active');
            }
          });
        } else {
          const nestedAccordions = header.closest('.nested-accordions').querySelectorAll(':scope > .accordion');
          nestedAccordions.forEach(acc => {
            if (acc !== accordion) {
              acc.classList.remove('active');
            }
          });
        }

        accordion.classList.toggle('active', !wasActive);
        header.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const mainAccordions = document.querySelectorAll('.tab-content > .accordion > .accordion-header');
      mainAccordions.forEach(header => {
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          handleAccordionClick(header);
        });
      });

      const nestedAccordions = document.querySelectorAll('.nested-accordions .accordion > .accordion-header');
      nestedAccordions.forEach(header => {
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          handleAccordionClick(header, true);
        });
      });

      const expandButtons = document.querySelectorAll('.expand-button');
      expandButtons.forEach(button => {
        button.addEventListener('click', () => {
          const list = button.previousElementSibling;
          const isExpanded = list.classList.contains('expanded');
          list.classList.toggle('expanded');
          button.textContent = isExpanded ? 'Show More' : 'Show Less';
        });
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Formats an issue message with appropriate styling
 * @param {string} issue - The issue message to format
 * @returns {string} The formatted issue message
 */
function formatIssue(issue: string): string {
  const parts = issue.split('\n');
  const firstLine = parts[0];

  // Use unicode escape sequences for emojis
  const match = firstLine.match(/^(?:🚨|⚠️|💡)\s+([^:]+):(\d+-\d+)/u);

  if (!match) return issue;

  const [, path, lines] = match;
  const restOfIssue = parts.slice(1).join('\n');

  return `
    <div class="issue-header">
      <span class="issue-title">${path}</span>
      <span class="issue-path">Lines ${lines}</span>
    </div>
    ${formatMarkdownToHtml(restOfIssue)}
  `;
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
