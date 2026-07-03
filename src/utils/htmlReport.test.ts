import { describe, it, expect } from 'vitest';
import { generateHtmlReport } from './htmlReport.js';
import type { PerformanceReport } from './output.js';

const report = (overrides: Partial<PerformanceReport['codeAnalysis']> = {}): PerformanceReport => ({
  lighthouse: {
    metrics: 'Performance Score: 87%\nFirst Contentful Paint: 0.9 s\nSpeed Index: 1.2 s',
    report: '# Performance Score: 87%\n\n## Core Web Vitals\n* FCP: 0.9 s',
    analysis: { coreWebVitals: 'CWV analysis', performanceOpportunities: '', diagnostics: '' },
  },
  codeAnalysis: { critical: [], warnings: [], suggestions: [], findings: [], ...overrides },
  metadata: { timestamp: '2026-07-03T00:00:00Z', duration: 5000, config: {} },
});

describe('generateHtmlReport', () => {
  it('renders the score ring with amber color for mid-range scores', () => {
    const html = generateHtmlReport(report());
    expect(html).toContain('aria-label="Performance score 87 out of 100"');
    expect(html).toContain('var(--amber)');
  });

  it('renders metric cards from the metrics block, excluding the score line', () => {
    const html = generateHtmlReport(report());
    expect(html).toContain('First Contentful Paint');
    expect(html).toContain('0.9 s');
    expect(html).not.toContain('<div class="metric-label">Performance Score</div>');
  });

  it('escapes model-generated finding text', () => {
    const html = generateHtmlReport(
      report({
        critical: ['x'],
        findings: [
          {
            file: 'src/App.tsx',
            startLine: 1,
            endLine: 2,
            severity: 'critical',
            title: '<script>alert(1)</script>',
            description: 'desc & "stuff"',
            impact: 'i',
            solution: 's',
            codeExample: '<img onerror=hack>',
          },
        ],
      })
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img onerror=hack&gt;');
  });

  it('renders filter pills with severity counts when findings exist', () => {
    const html = generateHtmlReport(report({ critical: ['a', 'b'], warnings: ['c'] }));
    expect(html).toContain('critical 2');
    expect(html).toContain('warnings 1');
  });

  it('shows the empty state when there are no findings', () => {
    const html = generateHtmlReport(report());
    expect(html).toContain('No code findings');
    expect(html).not.toContain('class="filters"');
  });
});
