# PerfLens

AI-powered frontend performance optimizer that analyzes your React, Vue, or other frontend projects for performance issues and provides intelligent suggestions for improvement.

## Features

- 🔍 AI-Powered Code Analysis
- 📊 Lighthouse Performance Metrics
- 🤖 Comprehensive Performance Reports
- 🚀 Actionable Optimization Recommendations

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

Run in your frontend project directory:

```bash
perf-lens scan
```

PerfLens will:

1. Analyze your entire codebase for performance issues at the code level
2. Run Lighthouse to evaluate runtime performance metrics
3. Generate a detailed report with file-by-file recommendations
4. Provide actionable code examples for each issue

## How It Works

PerfLens uses advanced AI to analyze your code for performance issues across various aspects:

- **Render Performance**: Identifies unnecessary re-renders, expensive calculations in render methods
- **Bundle Size**: Detects large dependencies and code splitting opportunities
- **Memory Usage**: Finds memory leaks and inefficient memory patterns
- **Network Performance**: Highlights excessive API calls and inefficient data fetching
- **CSS Performance**: Detects complex selectors and layout thrashing
- **JavaScript Performance**: Identifies inefficient algorithms and unnecessary work
- **Asset Optimization**: Suggests improvements for images, fonts, and other assets

The tool supports all major frontend frameworks and libraries:
- React and Next.js
- Vue and Nuxt
- Svelte and SvelteKit
- Angular
- Astro
- Remix
- And more!

## Requirements

- Node.js >= 18
- OpenAI API Key (set as OPENAI_API_KEY in your environment)

## License

MIT