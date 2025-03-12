# API Reference

## Programmatic Usage

You can use PerfLens programmatically in your Node.js applications:

```typescript
import { runLighthouse, analyzeCodebase } from 'perf-lens';

// Run Lighthouse analysis
const lhResults = await runLighthouse({
  port: 3000,
  bundleThresholds: {
    maxInitialSize: '250kb',
    maxChunkSize: '50kb'
  },
  performanceThresholds: {
    fcp: 2000,
    lcp: 2500
  }
});

// Analyze codebase
const analysisResults = await analyzeCodebase({
  targetDir: 'src',
  maxFiles: 200,
  lighthouseContext: {
    metrics: lhResults.metrics,
    analysis: lhResults.analysis
  }
});

console.log('Performance Score:', lhResults.metrics);
console.log('Critical Issues:', analysisResults.critical);
```

## Core APIs

### runLighthouse(config)

Runs Lighthouse performance analysis on your development server.

```typescript
interface LighthouseConfig {
  port?: number;
  mobileEmulation?: boolean;
  throttling?: {
    cpu?: number;
    network?: 'slow3G' | 'fast3G' | '4G' | 'none';
  };
  timeout?: number;
  retries?: number;
}

interface LighthouseResult {
  metrics: string;
  report: string;
  analysis: string;
  fullReport: Result;
}

function runLighthouse(config?: LighthouseConfig): Promise<LighthouseResult>;
```

### analyzeCodebase(config)

Analyzes your codebase for performance issues.

```typescript
interface AnalysisConfig {
  targetDir?: string;
  maxFiles?: number;
  batchSize?: number;
  maxFileSize?: number;
  batchDelay?: number;
  ignore?: string[];
  include?: string[];
  lighthouseContext?: {
    metrics: string;
    analysis: string;
  };
}

interface AnalysisResult {
  critical: string[];
  warnings: string[];
  suggestions: string[];
}

function analyzeCodebase(config: AnalysisConfig): Promise<AnalysisResult>;
```

### Configuration Types

```typescript
interface PerformanceThresholds {
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  tti?: number;
  tbt?: number;
  speedIndex?: number;
  performance?: number;
}

interface BundleThresholds {
  maxInitialSize?: string;
  maxChunkSize?: string;
  maxAsyncChunks?: number;
  maxTotalSize?: string;
}

type AIProvider = 'openai' | 'anthropic' | 'gemini';
type NetworkThrottle = 'slow3G' | 'fast3G' | '4G' | 'none';
```

## Error Handling

PerfLens uses Zod for configuration validation and throws standard errors:

```typescript
try {
  const results = await runLighthouse(config);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Configuration validation error
    console.error('Invalid configuration:', error.errors);
  } else {
    // Other errors (network, timeout, etc.)
    console.error('Analysis failed:', error);
  }
}
```