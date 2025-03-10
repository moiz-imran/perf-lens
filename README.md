# PerfLens 🔍

A performance analysis tool that combines Lighthouse performance audits with static code analysis to help optimize your web applications.

## Features

### 🌟 Lighthouse Performance Analysis
- Core Web Vitals measurement and scoring
- Performance bottleneck detection
- Resource usage analysis:
  - JavaScript execution and bundle size
  - CSS optimization opportunities
  - Network request analysis
  - Resource loading optimization

### 🧠 Static Code Analysis
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

```bash
npm install -g perf-lens
# or
yarn global add perf-lens
```

### Project Setup

For project-specific configuration, install PerfLens as a dev dependency:

```bash
npm install --save-dev perf-lens
# or
yarn add -D perf-lens
```

Add analysis scripts to your `package.json`:

```json
{
  "scripts": {
    "analyze": "perf-lens scan",
    "analyze:html": "perf-lens scan --output reports/performance.html --format html",
    "analyze:md": "perf-lens scan --output reports/performance.md"
  }
}
```

## Usage

### Basic Analysis

Run a performance analysis on your development server:

```bash
perf-lens scan
```

The tool will automatically detect your development server port.

### Configuration

Set your OpenAI API key (required for code analysis):

```bash
perf-lens config set-key YOUR_API_KEY
# or use environment variable:
export OPENAI_API_KEY=your_key_here
```

### Generate Reports

Save analysis as Markdown:
```bash
perf-lens scan --output report.md
```

Generate HTML report:
```bash
perf-lens scan --output report.html --format html
```

### Advanced Options

Customize the analysis:
```bash
perf-lens scan --max-files 50 --batch-size 10 --max-size 100
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
| `--network-throttle` | Network throttle type (slow3G/fast3G/4G/none) | fast3G |

### Configuration File

Create a `perflens.config.js` file in your project root:

```javascript
/** @type {import('perf-lens').PerflensConfig} */
export default {
  // Performance thresholds
  thresholds: {
    performance: 90,
    firstContentfulPaint: 2000,
    largestContentfulPaint: 2500,
    totalBlockingTime: 200,
    cumulativeLayoutShift: 0.1,
    speedIndex: 3000,
    timeToInteractive: 3800
  },

  // Bundle size thresholds
  bundleThresholds: {
    maxBundleSize: '250kb',
    maxChunkSize: '50kb',
    maxAssetSize: '100kb',
    maxImageSize: '100kb',
    maxFontSize: '50kb'
  },

  // Analysis configuration
  analysis: {
    maxFiles: 200,
    batchSize: 20,
    maxFileSize: 102400, // 100KB
    batchDelay: 1000,
    targetDir: 'src',
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
      // Build and dependency directories
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.svelte-kit/**',
      '**/.astro/**',

      // Generated and minified files
      '**/*.min.js',
      '**/*.bundle.js',
      '**/*.chunk.js',
      '**/*.map',
      '**/*.d.ts',

      // Test files
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/test/**',
      '**/tests/**',

      // Documentation and examples
      '**/docs/**',
      '**/examples/**',
      '**/demo/**',
      '**/demos/**',

      // Configuration files
      '**/*.config.*',
      '**/*.rc.*',
      '**/tsconfig.json',
      '**/package.json',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',

      // Editor and IDE files
      '**/.vscode/**',
      '**/.idea/**',
      '**/.DS_Store',

      // Temporary and cache files
      '**/.cache/**',
      '**/.temp/**',
      '**/.tmp/**',
      '**/tmp/**',
      '**/temp/**'
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
  }
};
```

### Ignore Files

Create a `.perflensignore` file in your project root to specify additional files to ignore:

```text
# Build output
dist/
build/
.next/
.nuxt/

# Dependencies
node_modules/
.pnpm-store/

# Test files
__tests__/
*.test.*
*.spec.*

# Documentation
docs/
examples/

# Editor files
.vscode/
.idea/
.DS_Store
```

The ignore patterns from `.perflensignore` are automatically merged with the patterns specified in the `analysis.ignore` section of your config file.

## How It Works

### 1. Development Server Analysis
- Automatically detects your dev server
- Runs Lighthouse performance audits
- Collects Core Web Vitals metrics
- Analyzes resource usage

### 2. Code Analysis
- Scans your codebase for:
  - Performance bottlenecks
  - Resource optimization opportunities
  - Bundle size issues
  - Loading optimizations
- Prioritizes files based on:
  - Entry points and key components
  - File size and complexity
  - Framework patterns

### 3. Report Generation
Generates comprehensive reports with:
- Performance Metrics
  - Core Web Vitals scores
  - Performance opportunities
  - Resource usage breakdown

- Code Analysis
  - Critical performance issues
  - Warnings and suggestions
  - Code-level recommendations

## Supported File Types
- JavaScript (\`.js\`, \`.jsx\`)
- TypeScript (\`.ts\`, \`.tsx\`)
- Vue (\`.vue\`)
- Svelte (\`.svelte\`)
- Astro (\`.astro\`)
- Stylesheets (\`.css\`, \`.scss\`, \`.less\`, \`.sass\`)
- HTML (\`.html\`)

## Requirements
- Node.js >= 18
- Running development server
- OpenAI API Key

## License

MIT

---

Built with ❤️ by the Moiz Imran