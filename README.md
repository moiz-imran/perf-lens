# PerfLens 🔍

A powerful performance analysis tool for web applications that combines Lighthouse audits with AI-powered code analysis.

[![CI](https://github.com/moiz-imran/perf-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/moiz-imran/perf-lens/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/perf-lens.svg)](https://badge.fury.io/js/perf-lens)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/perf-lens)](https://bundlephobia.com/package/perf-lens)
[![Dependencies](https://img.shields.io/librariesio/release/npm/perf-lens)](https://libraries.io/npm/perf-lens)
[![Known Vulnerabilities](https://snyk.io/test/github/moiz-imran/perf-lens/badge.svg)](https://snyk.io/test/github/moiz-imran/perf-lens)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Node Version](https://img.shields.io/node/v/perf-lens)](https://nodejs.org)

## Features

### 🌟 Lighthouse Performance Analysis
- Core Web Vitals measurement and scoring
- Performance bottleneck detection
- Resource usage analysis:
  - JavaScript execution and bundle size
  - CSS optimization opportunities
  - Network request analysis
  - Resource loading optimization

### 🧠 AI-Powered Code Analysis
- Framework-aware code scanning
- Performance pattern detection
- Batch processing of files with:
  - Smart file prioritization
  - Size-based filtering
  - Framework-specific analysis

### 📊 Rich Reporting
- Detailed HTML reports with:
  - Performance metrics dashboard
  - Critical issues highlighting
  - Code snippets with context
  - Actionable recommendations
- Markdown report generation
- File-specific insights

## Installation

Install PerfLens as a dev dependency in your project:

```bash
npm install --save-dev perf-lens
# or
yarn add -D perf-lens
# or
pnpm add -D perf-lens
```

Add scripts to your `package.json`:
```json
{
  "scripts": {
    "analyze": "perf-lens scan",
    "analyze:html": "perf-lens scan --output reports/performance.html --format html",
    "analyze:md": "perf-lens scan --output reports/performance.md"
  }
}
```

Now you can run PerfLens using:
```bash
npm run analyze
```

### Global Installation

While not recommended, you can also install PerfLens globally:

```bash
npm install -g perf-lens
# Then use directly:
perf-lens scan
```

## Quick Start

1. Configure your AI provider:
```bash
# Using environment variables
export PERF_LENS_ANTHROPIC_API_KEY=your_key_here

# Or using the CLI
perf-lens config set-key YOUR_API_KEY --provider anthropic
```

2. Run PerfLens:
```bash
perf-lens scan
```

The tool will automatically:
- Detect your development server
- Run performance audits
- Analyze your codebase
- Generate a detailed report

## Configuration

Create a `perflens.config.js` file in your project root:

```javascript
/** @type {import('perf-lens').PerflensConfig} */
export default {
  // Performance thresholds
  thresholds: {
    performance: 90,
    fcp: 2000,
    lcp: 2500,
    tbt: 200,
    cls: 0.1,
    speedIndex: 3000,
    tti: 3800
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
    include: [ // File patterns to include
      '**/*.js',
      '**/*.jsx',
      '**/*.ts',
      '**/*.tsx',
      '**/*.vue',
      '**/*.svelte',
      '**/*.astro',
      '**/*.css',
      '**/*.scss',
      '**/*.less',
      '**/*.sass',
      '**/*.html'
    ],
    ignore: [ // Patterns to ignore (in addition to .perflensignore)
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**'
    ]
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
};
```

See [Configuration Reference](docs/configuration/README.md) for all options.

## CLI Options

```bash
perf-lens scan [options]
```

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

## Documentation

- [Getting Started Guide](docs/guides/getting-started.md)
- [Configuration Reference](docs/configuration/README.md)
- [API Documentation](docs/api/README.md)
- [Examples](examples/)

## Requirements
- Node.js >= 18
- Running development server
- AI Provider API Key (OpenAI, Anthropic, or Gemini)

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Dependency Licenses

This project uses several open-source packages that are licensed under various licenses:

- **Primary License**: MIT
- **Notable Dependencies**:
  - `lighthouse` (Apache-2.0)
  - `axe-core` (MPL-2.0) - via Lighthouse
  - Other dependencies are primarily MIT/Apache-2.0 licensed

Please note that some transitive dependencies may have different licenses. We recommend reviewing the licenses of all dependencies if you plan to use this project in a commercial setting.

---

Built with ❤️ by [Moiz Imran](https://linkedin.com/in/moiz-imran)

📧 Email: moizwasti@gmail.com