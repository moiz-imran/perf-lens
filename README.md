# ScanUI

AI-powered frontend performance optimizer that analyzes your React, Vue, or other frontend projects for performance issues and provides intelligent suggestions for improvement.

## Features

- 🔍 Framework Detection (React, Next.js, Vue, Nuxt, Astro, Remix)
- 📊 Performance Analysis
- 🤖 AI-Powered Suggestions
- 🎯 Framework-Specific Checks
- 📦 Dependency Analysis
- 🚀 Best Practices Validation

## Installation

```bash
npm install -g scan-ui
# or
yarn global add scan-ui
```

## Usage

Run in your frontend project directory:

```bash
scan-ui
```

## Requirements

- Node.js >= 18
- OpenAI API Key (set as OPENAI_API_KEY in your environment)

## Features Detection

ScanUI automatically detects and provides specific checks for:
- TypeScript usage
- Tailwind CSS
- Server-Side Rendering (SSR)
- Static Site Generation (SSG)
- Testing setup
- State management
- Routing implementation
- Styling solutions

## Framework-Specific Checks

- **React/Next.js**: useEffect dependencies, event handler naming, React.memo usage
- **Vue/Nuxt**: v-for key usage, computed properties, watcher optimizations
- **Astro**: Island architecture, hydration strategies
- **Remix**: Data loading patterns, routing optimizations

## License

MIT