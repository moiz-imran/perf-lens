# PerfLens

AI-powered frontend performance optimizer that analyzes your React, Vue, or other frontend projects for performance issues and provides intelligent suggestions for improvement.

## Features

- 🔍 AI-Powered Code Analysis with Smart File Prioritization
- 📊 Lighthouse Performance Metrics with Detailed Breakdown
- 🤖 Comprehensive Performance Reports with File-Specific Analysis
- 🚀 Actionable Optimization Recommendations with Code Examples
- ⚡️ Configurable Analysis Limits and Batch Processing
- 🎯 Smart Memory Management and Token Optimization
- 📝 Validated Line-Number References and Code Context
- 🔄 Framework-Aware Analysis (React, Vue, Svelte, Astro, etc.)

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
perf-lens scan --max-files 100 --batch-size 10 --max-tokens 50000 --delay 2000
```

Configuration options:
- `--max-files`: Maximum number of files to analyze (default: 200)
- `--batch-size`: Number of files per batch (default: 20)
- `--max-tokens`: Maximum tokens per API call (default: 100000)
- `--delay`: Delay between batches in ms (default: 1000)
- `--max-file-size`: Maximum file size in KB (default: 100)

## How It Works

PerfLens uses advanced AI to analyze your code for performance issues across various aspects:

### Smart File Prioritization
- Entry points and important files get higher priority
- Component files are prioritized for framework-specific analysis
- Files are analyzed in batches to optimize API usage
- Intelligent size-based file filtering

### Comprehensive Analysis
- **Render Performance**: Identifies unnecessary re-renders, expensive calculations in render methods
- **Bundle Size**: Detects large dependencies and code splitting opportunities
- **Memory Usage**: Finds memory leaks and inefficient memory patterns
- **Network Performance**: Highlights excessive API calls and inefficient data fetching
- **CSS Performance**: Detects complex selectors and layout thrashing
- **JavaScript Performance**: Identifies inefficient algorithms and unnecessary work
- **Asset Optimization**: Suggests improvements for images, fonts, and other assets

### Framework Support
The tool provides specialized analysis for all major frontend frameworks and libraries:
- React and Next.js
- Vue and Nuxt
- Svelte and SvelteKit
- Angular
- Astro
- Remix
- And more!

### Report Generation
- File-by-file breakdown of issues
- Validated line number references with code context
- Prioritized action items with estimated improvements
- Detailed solutions with code examples
- Combined analysis of static code and runtime performance

## Requirements

- Node.js >= 18
- OpenAI API Key (set as OPENAI_API_KEY in your environment)

## License

MIT