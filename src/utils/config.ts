import fs from 'fs';
import path from 'path';
import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';
import type { PerflensConfig } from '../types/config';

// Default configuration values
export const DEFAULT_CONFIG: PerflensConfig = {
  verbose: true,
  thresholds: {
    performance: 90,
    firstContentfulPaint: 2000,
    largestContentfulPaint: 2500,
    totalBlockingTime: 200,
    cumulativeLayoutShift: 0.1,
    speedIndex: 3000,
    timeToInteractive: 3800
  },
  bundleThresholds: {
    maxBundleSize: '250kb',
    maxChunkSize: '50kb',
    maxAssetSize: '100kb',
    maxImageSize: '100kb',
    maxFontSize: '50kb'
  },
  analysis: {
    maxFiles: 200,
    batchSize: 20,
    maxFileSize: 100 * 1024, // 100KB
    batchDelay: 1000,
    include: [
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
    ignore: [
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
    ]
  },
  lighthouse: {
    mobileEmulation: true,
    throttling: {
      cpu: 4,
      network: 'fast3G'
    }
  },
  ai: {
    provider: 'openai',
    model: 'o3-mini',
    temperature: 0.2,
  },
  output: {
    format: 'md',
    includeTimestamp: true
  },
};

// Zod schema for config validation
const configSchema = z.object({
  verbose: z.boolean().optional(),

  thresholds: z.object({
    performance: z.number().min(0).max(100).optional(),
    firstContentfulPaint: z.number().positive().optional(),
    largestContentfulPaint: z.number().positive().optional(),
    totalBlockingTime: z.number().positive().optional(),
    cumulativeLayoutShift: z.number().min(0).optional(),
    speedIndex: z.number().positive().optional(),
    timeToInteractive: z.number().positive().optional()
  }).optional(),

  bundleThresholds: z.object({
    maxBundleSize: z.string().regex(/^\d+(?:kb|mb)$/i).optional(),
    maxChunkSize: z.string().regex(/^\d+(?:kb|mb)$/i).optional(),
    maxAssetSize: z.string().regex(/^\d+(?:kb|mb)$/i).optional(),
    maxImageSize: z.string().regex(/^\d+(?:kb|mb)$/i).optional(),
    maxFontSize: z.string().regex(/^\d+(?:kb|mb)$/i).optional()
  }).optional(),

  analysis: z.object({
    maxFiles: z.number().positive().optional(),
    batchSize: z.number().positive().optional(),
    maxFileSize: z.number().positive().optional(),
    batchDelay: z.number().nonnegative().optional(),
    targetDir: z.string().optional(),
    include: z.array(z.string()).optional(),
    ignore: z.array(z.string()).optional()
  }).optional(),

  lighthouse: z.object({
    port: z.number().positive().optional(),
    mobileEmulation: z.boolean().optional(),
    throttling: z.object({
      cpu: z.number().positive().optional(),
      network: z.enum(['slow3G', 'fast3G', '4G', 'none']).optional()
    }).optional()
  }).optional(),

  ai: z.object({
    provider: z.enum(['openai', 'anthropic', 'gemini']),
    model: z.string(),
    apiKey: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional()
  }).optional(),

  rules: z.record(z.object({
    severity: z.enum(['error', 'warning', 'info']),
    threshold: z.union([z.number(), z.string()]).optional(),
    options: z.record(z.any()).optional()
  })).optional(),

  output: z.object({
    format: z.enum(['md', 'html']).optional(),
    directory: z.string().optional(),
    filename: z.string().optional(),
    includeTimestamp: z.boolean().optional()
  }).optional()
});

/**
 * Load ignore patterns from .perflensignore file
 */
export function loadIgnorePatterns(cwd: string = process.cwd()): string[] {
  const ignoreFile = path.join(cwd, '.perflensignore');
  if (fs.existsSync(ignoreFile)) {
    return fs.readFileSync(ignoreFile, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  }
  return [];
}

/**
 * Load and validate configuration
 */
export async function loadConfig(configPath?: string): Promise<PerflensConfig> {
  const explorer = cosmiconfig('perflens', {
    searchPlaces: [
      'package.json',
      '.perflensrc',
      '.perflensrc.json',
      '.perflensrc.yaml',
      '.perflensrc.yml',
      '.perflensrc.js',
      'perflens.config.js'
    ],
    loaders: {
      '.js': async (filepath: string) => {
        const result = await import(filepath);
        return result.default || result;
      }
    }
  });

  try {
    // Load config file
    const result = configPath
      ? await explorer.load(configPath)
      : await explorer.search(process.cwd());

    const configFromFile = result?.config || {};

    // If config is an ES module with default export, use the default
    const actualConfig = configFromFile.default || configFromFile;

    // Load ignore patterns from the same directory as the config file
    const configDir = configPath ? path.dirname(configPath) : process.cwd();
    const ignorePatterns = loadIgnorePatterns(configDir);
    if (ignorePatterns.length > 0) {
      // Ensure analysis config exists
      actualConfig.analysis = actualConfig.analysis || {};

      // Merge ignore patterns into analysis.ignore
      actualConfig.analysis.ignore = [
        ...(actualConfig.analysis.ignore || []),
        ...ignorePatterns
      ];
    }

    // Merge with defaults
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...actualConfig,
      // Deep merge specific sections
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...actualConfig.thresholds },
      bundleThresholds: { ...DEFAULT_CONFIG.bundleThresholds, ...actualConfig.bundleThresholds },
      analysis: { ...DEFAULT_CONFIG.analysis, ...actualConfig.analysis },
      output: { ...DEFAULT_CONFIG.output, ...actualConfig.output },
      // Special handling for nested lighthouse config
      lighthouse: {
        ...DEFAULT_CONFIG.lighthouse,
        ...actualConfig.lighthouse,
        throttling: {
          ...DEFAULT_CONFIG.lighthouse?.throttling,
          ...actualConfig.lighthouse?.throttling
        }
      }
    };

    // Validate config
    const validatedConfig = configSchema.parse(mergedConfig);

    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`- ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('Error loading configuration:', error);
    }

    // Return default config if loading fails
    return DEFAULT_CONFIG;
  }
}