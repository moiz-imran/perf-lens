# PerfLens Configuration Examples

This directory contains examples demonstrating how to use the PerfLens configuration system:

1. **Basic Usage** (`basic-usage.ts`)
   - Shows how to load and use configuration
   - Demonstrates type-safe configuration access
   - Simple configuration overrides

2. **Advanced Usage** (`advanced-usage.ts`)
   - Shows configuration merging
   - Demonstrates environment-based overrides
   - Error handling and validation

3. **React Project Example** (`react-project/`)
   - Shows how to integrate PerfLens into a React project
   - Includes npm scripts for running performance analysis
   - Demonstrates configuration in a real project context

## Running the Examples

```bash
# Run basic example
npx tsx basic-usage.ts

# Run advanced example
npx tsx advanced-usage.ts

# Run React project example
cd react-project
npm install
npm run analyze:perf
```
