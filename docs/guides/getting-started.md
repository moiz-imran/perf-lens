# Getting Started with PerfLens

## Prerequisites

- Node.js >= 18
- A running development server
- An API key from one of the supported AI providers:
  - OpenAI
  - Anthropic
  - Google (Gemini)

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

2. Configure your AI provider:

```bash
# Using environment variables
export PERF_LENS_ANTHROPIC_API_KEY=your_key_here

# Or using the CLI
perf-lens config set-key YOUR_API_KEY --provider anthropic
```

## Basic Usage

1. Navigate to your project:

```bash
cd your-project
```

2. Start your development server:

```bash
npm run dev
```

3. Run PerfLens:

```bash
perf-lens scan
```

PerfLens will:

1. Detect your development server
2. Run Lighthouse performance audits
3. Analyze your codebase
4. Generate a comprehensive report

## Configuration

Create a basic configuration file:

```bash
# Create a config file
touch perflens.config.js
```

Add your configuration:

```javascript
export default {
  thresholds: {
    performance: 90,
    fcp: 2000,
    lcp: 2500,
  },
  analysis: {
    targetDir: 'src',
  },
};
```

See the [Configuration Reference](../configuration/README.md) for all options.

## Generating Reports

Generate a Markdown report:

```bash
perf-lens scan --output report.md
```

Generate an HTML report:

```bash
perf-lens scan --output report.html --format html
```

## Next Steps

- [Configuration Reference](../configuration/README.md)
- [API Documentation](../api/README.md)
- [Advanced Usage](./advanced-usage.md)
