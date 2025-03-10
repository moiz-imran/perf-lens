# React Project Performance Analysis Example

This example demonstrates how to integrate PerfLens into a React project for performance analysis.

## Project Structure

```
with-react/
├── src/
│   ├── App.tsx        # Main React component
│   └── App.css        # Styles
├── package.json       # Project dependencies and scripts
└── perflens.config.json # PerfLens configuration
```

## Features

- React 18 with TypeScript
- Vite for fast development
- Performance analysis configuration
- Example of a component that could benefit from optimization

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Run performance analysis:
   ```bash
   # Development analysis
   npm run analyze:perf

   # Production analysis
   npm run analyze:perf:prod
   ```

## Configuration

The `perflens.config.json` file includes:
- Analysis settings for React components
- Lighthouse configuration for performance metrics
- Bundle size thresholds
- Performance thresholds for Core Web Vitals

## Performance Considerations

The example includes:
- A large list component that could impact performance
- Loading state management
- CSS transitions that could affect layout stability
- Bundle size considerations

## Analysis Results

After running the analysis, you'll get:
- Lighthouse performance metrics
- Bundle size analysis
- Code-level performance suggestions
- Core Web Vitals measurements