# PerfLens

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
npm install -g perf-lens
# or
yarn global add perf-lens
```

## Configuration

First, set up your OpenAI API key (required for AI suggestions). You only need to do this once:

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
perf-lens
```

Or use specific commands:

```bash
perf-lens analyze     # Run analysis (default command)
perf-lens config      # Manage configuration
```

PerfLens will automatically detect and analyze your project's source code. It supports various project structures:
- `src/` directory (standard React/Vue projects)
- `app/` directory (Next.js 13+, Remix)
- `pages/` directory (Next.js pages router)
- `components/` directory
- Root directory (if no standard directories found)

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