import { describe, it, expect } from 'vitest';
import type { Result } from 'lighthouse';
import { formatLighthouseReport, formatConsoleOutput } from './lighthouse.js';
import type { PerformanceThresholds, BundleThresholds } from '../types/config.js';

// Minimal fake Lighthouse result: a low score with every metric over threshold,
// plus a couple of network requests so the resource sections render.
const fakeReport = {
  categories: { performance: { score: 0.42 } },
  audits: {
    'first-contentful-paint': { numericValue: 3000, displayValue: '3.0 s' },
    'largest-contentful-paint': { numericValue: 4000, displayValue: '4.0 s' },
    'total-blocking-time': { numericValue: 500, displayValue: '500 ms' },
    'cumulative-layout-shift': { numericValue: 0.3, displayValue: '0.3' },
    'speed-index': { numericValue: 5000, displayValue: '5.0 s' },
    interactive: { numericValue: 6000, displayValue: '6.0 s' },
    'render-blocking-resources': {
      displayValue: 'Potential savings of 300 ms',
      details: { items: [{ url: 'style.css', wastedMs: 300 }] },
    },
    'network-requests': {
      details: {
        items: [
          { url: 'app.js', resourceType: 'Script', transferSize: 102400 },
          { url: 'logo.png', resourceType: 'Image', transferSize: 51200 },
        ],
      },
    },
  },
} as unknown as Result;

const thresholds: PerformanceThresholds = {
  performance: 90,
  fcp: 1800,
  lcp: 2500,
  tbt: 200,
  cls: 0.1,
  speedIndex: 3400,
  tti: 3800,
};

const bundleThresholds: BundleThresholds = { maxInitialSize: '50kb' };

describe('formatLighthouseReport (markdown)', () => {
  const out = formatLighthouseReport(fakeReport, bundleThresholds, thresholds);

  it('renders the performance score and below-threshold warning', () => {
    expect(out).toContain('Performance Score: 42%');
    expect(out).toContain('below threshold of 90%');
  });

  it('flags metrics that exceed their thresholds', () => {
    expect(out).toContain('First Contentful Paint: 3.0 s');
    expect(out).toContain('exceeds threshold of 1800ms');
  });

  it('renders the bundle size analysis with the JS total', () => {
    expect(out).toContain('Total JavaScript: 100.0KB');
    expect(out).toContain('exceeds threshold');
  });

  it('renders render-blocking resources', () => {
    expect(out).toContain('Render Blocking Resources');
    expect(out).toContain('style.css');
  });
});

describe('formatConsoleOutput', () => {
  const out = formatConsoleOutput(fakeReport, thresholds);

  it('renders the performance score and below-threshold warning', () => {
    expect(out).toContain('Performance Score: 42%');
    expect(out).toContain('Below threshold of 90');
  });

  it('flags metrics that exceed their thresholds', () => {
    expect(out).toContain('First Contentful Paint: 3.0 s');
    expect(out).toContain('Exceeds 1800ms');
  });

  it('renders the network resource breakdown', () => {
    expect(out).toContain('Network Analysis');
    expect(out).toContain('Script');
  });
});
