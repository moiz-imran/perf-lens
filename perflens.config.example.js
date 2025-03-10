/** @type {import('./src/types/config').PerflensConfig} */
export default {
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

  // Bundle size thresholds
  bundleThresholds: {
    maxBundleSize: '250kb', // Maximum total bundle size
    maxChunkSize: '50kb', // Maximum chunk size
    maxAssetSize: '100kb', // Maximum size for any asset
    maxImageSize: '100kb', // Maximum size for images
    maxFontSize: '50kb' // Maximum size for font files
  },

  // Analysis configuration
  analysis: {
    maxFiles: 200, // Maximum number of files to analyze
    batchSize: 20, // Number of files to analyze per batch
    maxFileSize: 102400, // Maximum file size in bytes (100KB)
    batchDelay: 1000, // Delay between batches in milliseconds
    targetDir: 'src', // Directory to scan (relative to project root)
    include: [ // File patterns to include (defaults to common frontend file types)
      '**/*.js',
      '**/*.jsx',
      '**/*.ts',
      '**/*.tsx',
      '**/*.vue',
      '**/*.svelte',
      '**/*.astro',
      '**/*.css',
      '**/*.scss',
      '**/*.less',
      '**/*.sass',
      '**/*.html'
    ],
    ignore: [ // Patterns to ignore (in addition to .perflensignore)
      // Build and dependency directories
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.svelte-kit/**',
      '**/.astro/**',

      // Generated and minified files
      '**/*.min.js',
      '**/*.bundle.js',
      '**/*.chunk.js',
      '**/*.map',
      '**/*.d.ts',

      // Test files
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/test/**',
      '**/tests/**',

      // Documentation and examples
      '**/docs/**',
      '**/examples/**',
      '**/demo/**',
      '**/demos/**',

      // Configuration files
      '**/*.config.*',
      '**/*.rc.*',
      '**/tsconfig.json',
      '**/package.json',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',

      // Editor and IDE files
      '**/.vscode/**',
      '**/.idea/**',
      '**/.DS_Store',

      // Temporary and cache files
      '**/.cache/**',
      '**/.temp/**',
      '**/.tmp/**',
      '**/tmp/**',
      '**/temp/**'
    ],
  },

  // Custom rules configuration
  rules: {
    'no-render-blocking-resources': {
      severity: 'error',
      threshold: 500 // Maximum blocking time in ms
    },
    'optimize-images': {
      severity: 'warning',
      options: {
        webp: true, // Convert images to WebP
        lazy: true // Use lazy loading
      }
    },
    'minify-javascript': {
      severity: 'error'
    }
  },

  // Output configuration
  output: {
    format: 'html', // 'md' or 'html'
    directory: './reports', // Output directory
    filename: 'performance-report', // Base filename (without extension)
    includeTimestamp: true // Add timestamp to filename
  },

  // Lighthouse configuration
  lighthouse: {
    port: 3000, // Development server port
    mobileEmulation: true, // Use mobile emulation
    throttling: {
      cpu: 4, // CPU slowdown multiplier
      network: 'fast3G' // Network throttling preset
    }
  }
};