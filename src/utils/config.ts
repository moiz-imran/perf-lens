import fs from 'fs';
import path from 'path';
import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';
import chalk from 'chalk';
import type { PerflensConfig } from '../types/config';

// Default configuration values
export const DEFAULT_CONFIG: PerflensConfig = {
  verbose: true,
  thresholds: {
    performance: 90,
    fcp: 2000,
    lcp: 2500,
    tbt: 200,
    cls: 0.1,
    speedIndex: 3000,
    tti: 3800,
    fid: 100
  },
  bundleThresholds: {
    maxInitialSize: '250kb',
    maxChunkSize: '50kb',
    maxAsyncChunks: 5,
    maxTotalSize: '1mb'
  },
  analysis: {
    targetDir: '.',
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
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    maxTokens: 8192,
    temperature: 0.2,
  },
  output: {
    format: 'md',
    includeTimestamp: true
  },
};

// Zod schema for config validation
const configSchema = z.object({
  // Global config
  verbose: z.boolean().optional(),

  // AI config
  ai: z.object({
    provider: z.enum(['openai', 'anthropic', 'gemini']),
    model: z.string(),
    maxTokens: z.number().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
    apiKey: z.string().optional()
  }).optional(),

  // Performance thresholds
  thresholds: z.object({
    fcp: z.number().positive().optional(),
    lcp: z.number().positive().optional(),
    fid: z.number().positive().optional(),
    cls: z.number().min(0).max(1).optional(),
    tti: z.number().positive().optional(),
    tbt: z.number().positive().optional(),
    speedIndex: z.number().positive().optional(),
    performance: z.number().min(0).max(100).optional()
  }).strict().optional(), // Ensure correct property names

  // Bundle thresholds
  bundleThresholds: z.object({
    maxInitialSize: z.string().regex(/^\d+(?:kb|mb|gb)$/i).optional(),
    maxChunkSize: z.string().regex(/^\d+(?:kb|mb|gb)$/i).optional(),
    maxAsyncChunks: z.number().nonnegative().optional(),
    maxTotalSize: z.string().regex(/^\d+(?:kb|mb|gb)$/i).optional()
  }).strict().optional(), // Ensure correct property names

  // Analysis config
  analysis: z.object({
    targetDir: z.string().optional(),
    maxFiles: z.number().positive().optional(),
    batchSize: z.number().positive().optional(),
    maxFileSize: z.number().positive().optional(),
    batchDelay: z.number().nonnegative().optional(),
    ignore: z.array(z.string()).optional(),
    include: z.array(z.string()).optional()
  }).strict().optional(), // Ensure correct property names

  // Lighthouse config
  lighthouse: z.object({
    port: z.number().positive().optional(),
    mobileEmulation: z.boolean().optional(),
    throttling: z.object({
      cpu: z.number().positive().optional(),
      network: z.enum(['slow3G', 'fast3G', '4G', 'none']).optional()
    }).strict().optional(), // Ensure correct property names
    timeout: z.number().positive().optional(),
    retries: z.number().min(0).max(5).optional()
  }).strict().optional(), // Ensure correct property names

  // Output config
  output: z.object({
    directory: z.string().optional(),
    filename: z.string().optional(),
    format: z.enum(['md', 'html']).optional(),
    includeTimestamp: z.boolean().optional()
  }).strict().optional() // Ensure correct property names
}).strict(); // Ensure no extra root properties

/**
 * Loads ignore patterns from a .perflensignore file in the specified directory
 * @param {string} [cwd=process.cwd()] - The directory to look for the ignore file
 * @returns {string[]} Array of ignore patterns
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
 * Loads and validates the PerfLens configuration from various sources
 * @param {string} [configPath] - Optional path to a specific config file
 * @returns {Promise<PerflensConfig>} The validated and merged configuration
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

    try {
      // Validate config
      const validatedConfig = configSchema.parse(mergedConfig);
      return validatedConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(chalk.red.bold('\nConfiguration validation failed:'));
        error.errors.forEach(err => {
          console.error(chalk.red(`- ${err.path.join('.') || 'root'}: `) + chalk.yellow(err.message));
        });
        console.warn(chalk.yellow.bold('\n⚠️  Using default configuration instead.'));
        console.warn(chalk.yellow('To fix these errors:'));
        console.warn(chalk.cyan('1. Check property names match the expected format'));
        console.warn(chalk.cyan('2. Remove any unrecognized properties'));
        console.warn(chalk.cyan('3. Ensure values are of the correct type\n'));

        if (configPath) {
          console.warn(chalk.gray(`Config file: ${configPath}`));
        }
      } else {
        console.error(chalk.red('Error validating configuration:'), error);
      }
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.error(chalk.red('Error loading configuration:'), error);
    return DEFAULT_CONFIG;
  }
}