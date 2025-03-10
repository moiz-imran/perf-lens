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
| \`--max-files\` | Maximum files to analyze | 200 |
| \`--batch-size\` | Files per batch | 20 |
| \`--max-size\` | Maximum file size (KB) | 100 |
| \`--batch-delay\` | Delay between batches (ms) | 1000 |
| \`--output\` | Report output path | - |
| \`--format\` | Output format (md/html) | md |

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