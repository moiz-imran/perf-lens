# PerfLens

AI-powered frontend performance optimizer that analyzes your React, Vue, or other frontend projects for performance issues and provides intelligent suggestions for improvement.

## Features

- 🌟 Comprehensive Lighthouse Performance Analysis
  - Core Web Vitals Metrics
  - Performance Opportunities
  - JavaScript and CSS Analysis
  - Network Performance Breakdown
- 🧠 AI-Powered Code Analysis with Lighthouse Context
  - Smart File Prioritization
  - Token-Optimized Processing
  - Framework-Aware Analysis
- 📊 Detailed Performance Reports
  - Runtime Performance Metrics
  - Code-Level Optimization Suggestions
  - Actionable Recommendations
- ⚡️ Smart Batch Processing
  - Configurable Analysis Limits
  - Automatic Token Management
  - Efficient Memory Usage

## Installation

```bash
npm install -g perf-lens
# or
yarn global add perf-lens
```

## Configuration

First, set up your OpenAI API key (required for AI analysis). You only need to do this once:

```bash
perf-lens config set-key YOUR_API_KEY
```

You can also use the `OPENAI_API_KEY` environment variable if you prefer.

To verify your configuration:

```bash
perf-lens config get-key
```

## Usage

Basic scan with default settings:
```bash
perf-lens scan
```

Advanced usage with custom limits:
```bash
perf-lens scan --max-files 50 --batch-size 10 --max-tokens 60000
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max-files` | Maximum number of files to analyze | 200 |
| `--batch-size` | Number of files per batch | 20 |
| `--max-size` | Maximum file size in KB | 100 |
| `--batch-delay` | Delay between batches in ms | 1000 |
| `--max-tokens` | Maximum tokens per batch | 100000 |

## How It Works

PerfLens combines Lighthouse performance audits with AI-powered code analysis to provide comprehensive performance insights:

### 1. Lighthouse Analysis
- Runs performance audits on your development server
- Analyzes Core Web Vitals and key metrics
- Identifies performance bottlenecks
- Provides detailed breakdown of:
  - JavaScript and CSS issues
  - Resource loading optimization
  - Network performance
  - Asset optimization opportunities

### 2. AI-Powered Code Analysis
- Analyzes your codebase with Lighthouse context
- Prioritizes files based on:
  - Entry points and key components
  - Framework-specific patterns
  - File size and complexity
- Processes files in optimized batches to manage:
  - Token limits
  - Memory usage
  - API rate limits

### 3. Framework Support
Specialized analysis for:
- React and Next.js
- Vue and Nuxt
- Svelte and SvelteKit
- Angular
- Astro
- And more!

### 4. Output Format
Two comprehensive reports:
1. 🌟 Lighthouse Performance Report
   - Runtime metrics and scores
   - Performance opportunities
   - Resource optimization suggestions

2. 🧠 Code Analysis Report
   - Critical issues
   - Warnings
   - Improvement suggestions
   - File-specific recommendations

## Requirements

- Node.js >= 18
- Running development server
- OpenAI API Key

## License

MIT