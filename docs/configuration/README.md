# Configuration Reference

PerfLens can be configured through multiple methods:
1. Configuration file (`perflens.config.js`)
2. Environment variables
3. CLI options

## Configuration File

Create a `perflens.config.js` in your project root:

```javascript
/** @type {import('perf-lens').PerflensConfig} */
export default {
  // Performance thresholds
  thresholds: {
    performance: 90,
    fcp: 2000, // First Contentful Paint (ms)
    lcp: 2500, // Largest Contentful Paint (ms)
    tbt: 200,  // Total Blocking Time (ms)
    cls: 0.1,  // Cumulative Layout Shift
    speedIndex: 3000,
    tti: 3800  // Time to Interactive (ms)
  },

  // Bundle size thresholds
  bundleThresholds: {
    maxInitialSize: '250kb',
    maxChunkSize: '50kb',
    maxAsyncChunks: 5,
    maxTotalSize: '1mb'
  },

  // Analysis configuration
  analysis: {
    targetDir: 'src',
    maxFiles: 200,
    batchSize: 20,
    maxFileSize: 102400, // 100KB
    batchDelay: 1000,
    include: [
      '**/*.{js,jsx,ts,tsx,vue,svelte,astro,css,scss,less,sass,html}'
    ],
    ignore: ['**/node_modules/**', '**/dist/**']
  },

  // Lighthouse configuration
  lighthouse: {
    port: 3000,
    mobileEmulation: true,
    throttling: {
      cpu: 4,
      network: 'fast3G'
    }
  },

  // Output configuration
  output: {
    format: 'html',
    directory: './reports',
    filename: 'performance-report',
    includeTimestamp: true
  },

  // AI configuration
  ai: {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    maxTokens: 8192,
    temperature: 0.2
  }
}
```

## Environment Variables

Configure AI providers using environment variables:

```bash
# OpenAI
PERF_LENS_OPENAI_API_KEY=your_key_here

# Anthropic
PERF_LENS_ANTHROPIC_API_KEY=your_key_here

# Google (Gemini)
PERF_LENS_GEMINI_API_KEY=your_key_here
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config` | Path to config file | - |
| `-p, --port` | Development server port | auto-detect |
| `-t, --target` | Target directory to scan | current directory |
| `-f, --max-files` | Maximum files to analyze | 200 |
| `-b, --batch-size` | Files per batch | 20 |
| `-s, --max-size` | Maximum file size (KB) | 100 |
| `-d, --batch-delay` | Delay between batches (ms) | 1000 |
| `-o, --output` | Report output path | - |
| `--format` | Output format (md/html) | md |
| `--mobile` | Enable mobile emulation | false |
| `--cpu-throttle` | CPU slowdown multiplier | 4 |
| `--network-throttle` | Network throttle type | fast3G |