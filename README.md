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

PerfLens supports configuration files in multiple formats. Create any of these files in your project root:
- `.perflensrc.js` or `perflens.config.js` (JavaScript with ES modules)
- `.perflensrc.json` (JSON format)
- `.perflensrc.yaml` or `.perflensrc.yml` (YAML format)
- `package.json` with a "perflens" field

Example configuration (`perflens.config.js`):
```javascript
/** @type {import('perf-lens').PerflensConfig} */
export default {
  // Analysis configuration
  analysis: {
    batchDelay: 1000, // Delay between batches in milliseconds
    batchSize: 20, // Number of files to analyze per batch
    maxFileSize: 102400, // Maximum file size in bytes (100KB)
    maxFiles: 200, // Maximum number of files to analyze
    maxTokensPerBatch: 10000, //
    targetDir: 'src' // Directory to scan, relative to cwd
  },

  // Bundle size thresholds
  bundleThresholds: {
    maxAssetSize: '100kb', // Maximum size for any asset
    maxBundleSize: '250kb', // Maximum total bundle size
    maxChunkSize: '50kb', // Maximum chunk size
    maxFontSize: '50kb', // Maximum size for font files
    maxImageSize: '100kb' // Maximum size for images
  },

  // Lighthouse configuration
  lighthouse: {
    port: 3001, // Development server port
    mobileEmulation: true, // Enable mobile emulation
    throttling: {
      cpu: 4, // CPU slowdown multiplier
      network: 'fast3G' // Network throttling preset
    }
  },

  // Output configuration
  output: {
    directory: './reports', // Output directory
    filename: 'performance-report', // Base filename (without extension)
    format: 'html', // 'md' or 'html'
    includeTimestamp: true // Add timestamp to filename
  },

  // Performance score thresholds
  thresholds: {
    performance: 90, // Minimum overall Lighthouse performance score
    firstContentfulPaint: 2000, // Maximum FCP in milliseconds
    largestContentfulPaint: 2500, // Maximum LCP in milliseconds
    totalBlockingTime: 200, // Maximum TBT in milliseconds
    cumulativeLayoutShift: 0.1, // Maximum CLS score
    speedIndex: 3000, // Maximum Speed Index in milliseconds
    timeToInteractive: 3800 // Maximum TTI in milliseconds
  },

  // Custom rules configuration
  rules: {
    'minify-javascript': {
      severity: 'error'
    },
    'no-render-blocking-resources': {
      severity: 'error',
      threshold: 500 // Maximum blocking time in ms
    },
    'optimize-images': {
      severity: 'warning',
      options: {
        lazy: true, // Use lazy loading
        webp: true // Convert images to WebP
      }
    }
  }
};
```

### Ignore Files

Create a `.perflensignore` file in your project root to exclude files and directories from analysis. Uses gitignore syntax:

```plaintext
# Dependencies
node_modules/
**/node_modules/

# Build outputs
dist/
build/
out/

# Test files
**/*.test.js
**/*.spec.js
coverage/

# Other common excludes
.git/
*.min.js
*.bundle.js
public/
mock-api/
```

You can also specify ignore patterns in your config file:
```javascript
{
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js'
  ]
}
```

Patterns from both sources will be combined.

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
1. Performance Metrics
   - Core Web Vitals scores
   - Performance opportunities
   - Resource usage breakdown

2. Code Analysis
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